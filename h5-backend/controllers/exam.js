const { ExamQuestion, ExamSetting, ExamRecord, Application } = require('../models');

// 获取练题题目 (对应 getPracticeQuestions)
exports.getPracticeQuestions = async (req, res) => {
  const { mode } = req.body; // 'recitation' | 'mock'
  
  try {
    const query = { status: 'active' };
    const questionsRes = await ExamQuestion.find(query).limit(500).lean();

    let questions = questionsRes.map(q => ({
      _id: q._id,
      type: q.type,
      question: q.question,
      options: q.options || [],
      correct_answer: q.correct_answer,
      explanation: q.explanation || '',
    }));

    // 模拟考试模式：随机打乱顺序并限制数量
    if (mode === 'mock') {
      for (let i = questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }
      questions = questions.slice(0, 50); // 模拟考试取50题
    }

    return res.json({
      success: true,
      data: questions,
      total: questions.length
    });
  } catch (error) {
    console.error('获取练习题失败:', error);
    return res.json({ success: false, message: '获取题目失败: ' + error.message });
  }
};

// 获取考试题目 (对应 getExamQuestions)
exports.getExamQuestions = async (req, res) => {
  const userId = req.user && req.user.userId;

  // ── 门禁：培训完成后才能参加考试 ──
  if (userId) {
    try {
      const { Application, TrainingRecord } = require('../models');

      // 路径1：申请已推进到 training_completed（正常路径）
      const readyApp = await Application.findOne({
        _openid: userId,
        status: 'training_completed'
      }).lean();

      if (!readyApp) {
        // 路径2：状态仍是 pending_training，检查培训记录是否有已完成的视频
        const pendingApp = await Application.findOne({
          _openid: userId,
          status: 'pending_training'
        }).sort({ update_time: -1 });

        if (!pendingApp) {
          return res.json({ success: false, message: '请先完成培训视频学习（观看进度≥90%），再参加考试。' });
        }

        // 直接遍历 Map 条目，找是否有已完成（progress≥90 或 completed=true）的视频
        const trainingRecord = await TrainingRecord.findOne({ _openid: userId }).sort({ update_time: -1 });

        let hasCompleted = false;
        if (trainingRecord && trainingRecord.video_progress) {
          const vp = trainingRecord.video_progress;
          // 兼容 Mongoose Map 和 plain object 两种情况
          const entries = vp instanceof Map
            ? Array.from(vp.values())
            : Object.values(vp);

          hasCompleted = entries.some(p =>
            p && (p.completed === true || (typeof p.progress === 'number' && p.progress >= 90))
          );
        }

        if (!hasCompleted) {
          return res.json({ success: false, message: '请先完成培训视频学习（观看进度≥90%），再参加考试。' });
        }

        // 培训已完成，补推申请状态
        pendingApp.status = 'training_completed';
        pendingApp.update_time = new Date();
        await pendingApp.save();
      }
    } catch (e) {
      console.error('检查培训状态出错:', e.message);
      // 门禁异常时放行，避免阻断正常用户
    }
  }

  try {
    let config = { single: 20, multiple: 10, judge: 20 };
    try {
      const settingsRes = await ExamSetting.findById('global_config');
      if (settingsRes) {
        if (settingsRes.single) config.single = settingsRes.single.count || 20;
        if (settingsRes.multiple) config.multiple = settingsRes.multiple.count || 10;
        if (settingsRes.judge) config.judge = settingsRes.judge.count || 20;
      }
    } catch (e) {
      console.warn('读取考试配置失败，使用默认值');
    }

    const fetchRandom = async (type, count) => {
      let all = await ExamQuestion.find({ type, status: 'active' }).limit(500).lean();
      
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      
      return all.slice(0, count).map(q => ({
        _id: q._id,
        type: q.type,
        question: q.question,
        options: q.options || [],
        // 不暴露 correct_answer 和 explanation
      }));
    };

    const [singles, multiples, judges] = await Promise.all([
      fetchRandom('single', config.single),
      fetchRandom('multiple', config.multiple),
      fetchRandom('judge', config.judge),
    ]);

    const questions = [...singles, ...multiples, ...judges];

    return res.json({
      success: true,
      data: questions,
      total: questions.length
    });
  } catch (error) {
    console.error('获取考试题目失败:', error);
    return res.json({ success: false, message: '获取题目失败: ' + error.message });
  }
};

// 提交考试 (对应 submitExam)
exports.submitExam = async (req, res) => {
  const { application_id, answers, time_used } = req.body;
  const userId = req.user && req.user.userId; // 假定有 auth middleware

  if (!userId) {
    return res.json({ success: false, message: '未授权访问' });
  }

  try {
    // 0. 获取评分配置
    let scoreConfig = { single: 2, multiple: 2, judge: 2, _passScore: 80 };
    try {
      const settingsRes = await ExamSetting.findById('global_config');
      if (settingsRes) {
        if (settingsRes.single) scoreConfig.single = settingsRes.single.score;
        if (settingsRes.multiple) scoreConfig.multiple = settingsRes.multiple.score;
        if (settingsRes.judge) scoreConfig.judge = settingsRes.judge.score;
        if (settingsRes.pass_score) scoreConfig._passScore = settingsRes.pass_score;
      }
    } catch (e) {
      console.warn('读取评分配置失败，用默认值', e);
    }


    // 1. 获取题库中对应的正确答案
    const questionIds = (answers || []).map(a => a.question_id);
    const questionsRes = await ExamQuestion.find({ _id: { $in: questionIds } });
    const questionsMap = {};
    questionsRes.forEach(q => { questionsMap[q._id.toString()] = q; });

    // 2. 评分
    let totalScore = 0;
    let correctCount = 0;
    const detailedAnswers = (answers || []).map(answer => {
      const question = questionsMap[answer.question_id];
      if (!question) return null;

      const typeScore = scoreConfig[question.type] || 0;

      // 标准化数据库答案
      let dbAnsRaw = question.correct_answer;
      let dbAnsList = [];
      if (Array.isArray(dbAnsRaw)) {
        dbAnsList = dbAnsRaw;
      } else if (dbAnsRaw !== undefined && dbAnsRaw !== null) {
        const s = String(dbAnsRaw).trim();
        dbAnsList = s.includes(',') ? s.split(',') : [s];
      }

      const normalizedDbList = dbAnsList.map(item => {
        let s = String(item).trim();
        if (s.toLowerCase() === 'true') s = '正确';
        if (s.toLowerCase() === 'false') s = '错误';
        if (/^[A-Z]$/.test(s)) {
          const idx = s.charCodeAt(0) - 65;
          if (question.options && question.options[idx]) return String(question.options[idx]).trim();
        }
        return s;
      });
      const correctVal = normalizedDbList.sort().join(',');

      // 标准化用户答案
      let userVal = '';
      if (Array.isArray(answer.answer)) {
        userVal = answer.answer.map(a => String(a).trim()).sort().join(',');
      } else {
        userVal = String(answer.answer || '').trim();
        if (userVal.toLowerCase() === 'true') userVal = '正确';
        if (userVal.toLowerCase() === 'false') userVal = '错误';
      }

      const isCorrect = userVal === correctVal;
      const score = isCorrect ? typeScore : 0;
      if (isCorrect) correctCount++;
      totalScore += score;

      return {
        question_id: answer.question_id,
        user_answer: answer.answer,
        correct_answer: correctVal,
        explanation: question.explanation || '',
        is_correct: isCorrect,
        score: score
      };
    }).filter(Boolean);

    const passed = totalScore >= (scoreConfig._passScore || 80);


    // 3. 保存考试记录
    const examRecord = new ExamRecord({
      application_id,
      _openid: userId,
      answers: detailedAnswers,
      total_score: totalScore,
      correct_count: correctCount,
      total_count: answers.length,
      time_used,
      passed,
      exam_time: new Date()
    });
    
    await examRecord.save();

    // 4. 考试通过 → 自动将申请状态更新为"已发证"
    if (passed) {
      const { Application, User } = require('../models');

      // 找到该用户当前进行中的申请（pending_training 或 training_completed）
      const activeApp = await Application.findOne({
        _openid: userId,
        status: { $in: ['pending_training', 'training_completed'] }
      }).sort({ update_time: -1 });

      if (activeApp) {
        activeApp.status     = 'qualified';
        activeApp.exam_time  = new Date();
        activeApp.valid_until = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1年有效期
        activeApp.update_time = new Date();
        await activeApp.save();

        // 更新用户首次发证时间
        const appUser = await User.findOne({ _openid: userId });
        if (appUser && !appUser.first_cert_date) {
          appUser.first_cert_date = new Date();
          await appUser.save();
        }
      }
    }

    return res.json({
      success: true,
      data: {
        score: totalScore,
        correct_count: correctCount,
        total_count: answers.length,
        passed,
        detailed_answers: detailedAnswers
      }
    });
  } catch (error) {
    console.error('提交考试失败:', error);
    return res.json({ success: false, message: '提交失败: ' + error.message });
  }
};
