// 云函数：提交考试答案并评分（支付宝云函数）
exports.main = async (event, context) => {
  const { application_id, answers, time_used } = event;
  const userId = (context.identity && context.identity.userId) || ('uid_' + Date.now());
  const db = cloud.database();

  try {
    // 0. 获取评分配置
    let scoreConfig = { single: 2, multiple: 4, judge: 2 };
    try {
      const settingsRes = await db.collection('exam_settings').doc('global_config').get();
      if (settingsRes.data) {
        if (settingsRes.data.single) scoreConfig.single = settingsRes.data.single.score;
        if (settingsRes.data.multiple) scoreConfig.multiple = settingsRes.data.multiple.score;
        if (settingsRes.data.judge) scoreConfig.judge = settingsRes.data.judge.score;
      }
    } catch (e) {
      console.warn('读取评分配置失败，用默认值', e);
    }

    // 1. 获取题库中对应的正确答案
    const questionIds = answers.map(a => a.question_id);
    const questionsRes = await db.collection('exam_questions')
      .where({ _id: db.command.in(questionIds) })
      .get();
    const questionsMap = {};
    questionsRes.data.forEach(q => { questionsMap[q._id] = q; });

    // 2. 评分
    let totalScore = 0;
    let correctCount = 0;
    const detailedAnswers = answers.map(answer => {
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

    const passed = totalScore >= 80;

    // 3. 保存考试记录
    await db.collection('exam_records').add({
      data: {
        application_id,
        _openid: userId,
        answers: detailedAnswers,
        total_score: totalScore,
        correct_count: correctCount,
        total_count: answers.length,
        time_used,
        passed,
        exam_time: new Date()
      }
    });

    return {
      success: true,
      data: {
        score: totalScore,
        correct_count: correctCount,
        total_count: answers.length,
        passed,
        detailed_answers: detailedAnswers
      }
    };
  } catch (error) {
    console.error('提交考试失败:', error);
    return { success: false, message: '提交失败: ' + error.message };
  }
};
