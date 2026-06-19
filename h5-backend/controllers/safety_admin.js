const { ExamQuestion, ExamSetting, Video } = require('../models');
const xlsx = require('node-xlsx');


// ──────────────────────────────────────────────────────────────
// 权限校验辅助
// ──────────────────────────────────────────────────────────────
function isSafetyAdmin(req) {
  return req.user && ['safety_admin', 'super_admin'].includes(req.user.role);
}

// ══════════════════════════════════════════════════════════════
// 教学视频管理
// ══════════════════════════════════════════════════════════════

/** 获取全部视频列表 */
exports.getVideos = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  try {
    const videos = await Video.find().sort({ sort_order: 1, create_time: -1 }).lean();
    return res.json({ success: true, data: videos });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 新增视频 */
exports.addVideo = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { title, file_id, description, sort_order } = req.body;
  if (!title || !file_id) return res.json({ success: false, message: '标题和文件ID不能为空' });
  try {
    const video = new Video({
      title,
      file_id,
      description: description || '',
      sort_order: sort_order || 0,
      status: 'active',
      create_time: new Date()
    });
    await video.save();
    return res.json({ success: true, data: video });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 更新视频信息 */
exports.updateVideo = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { videoId, title, file_id, description, sort_order, status } = req.body;
  if (!videoId) return res.json({ success: false, message: '缺少 videoId' });
  try {
    const update = {};
    if (title !== undefined) update.title = title;
    if (file_id !== undefined) update.file_id = file_id;
    if (description !== undefined) update.description = description;
    if (sort_order !== undefined) update.sort_order = sort_order;
    if (status !== undefined) update.status = status;
    const video = await Video.findByIdAndUpdate(videoId, update, { new: true });
    if (!video) return res.json({ success: false, message: '视频不存在' });
    return res.json({ success: true, data: video });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 删除视频 */
exports.deleteVideo = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { videoId } = req.body;
  if (!videoId) return res.json({ success: false, message: '缺少 videoId' });
  try {
    await Video.findByIdAndDelete(videoId);
    return res.json({ success: true, message: '删除成功' });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
// 题库管理
// ══════════════════════════════════════════════════════════════

/** 获取题库列表（分页） */
exports.getQuestions = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { page = 1, pageSize = 20, type, keyword } = req.body;
  try {
    const query = {};
    if (type) query.type = type;
    if (keyword) query.question = { $regex: keyword, $options: 'i' };

    const total = await ExamQuestion.countDocuments(query);
    const questions = await ExamQuestion.find(query)
      .sort({ create_time: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean();

    return res.json({ success: true, data: questions, total, page, pageSize });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 新增单道题目 */
exports.addQuestion = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { type, question, options, correct_answer, explanation } = req.body;
  if (!type || !question || correct_answer === undefined) {
    return res.json({ success: false, message: '题型、题目内容和正确答案不能为空' });
  }
  try {
    const q = new ExamQuestion({ type, question, options: options || [], correct_answer, explanation: explanation || '', status: 'active' });
    await q.save();
    return res.json({ success: true, data: q });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 更新题目 */
exports.updateQuestion = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { questionId, type, question, options, correct_answer, explanation, status } = req.body;
  if (!questionId) return res.json({ success: false, message: '缺少 questionId' });
  try {
    const update = {};
    if (type !== undefined) update.type = type;
    if (question !== undefined) update.question = question;
    if (options !== undefined) update.options = options;
    if (correct_answer !== undefined) update.correct_answer = correct_answer;
    if (explanation !== undefined) update.explanation = explanation;
    if (status !== undefined) update.status = status;
    const q = await ExamQuestion.findByIdAndUpdate(questionId, update, { new: true });
    if (!q) return res.json({ success: false, message: '题目不存在' });
    return res.json({ success: true, data: q });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 删除题目（支持批量） */
exports.deleteQuestions = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { questionIds } = req.body; // 数组
  if (!questionIds || !questionIds.length) return res.json({ success: false, message: '缺少 questionIds' });
  try {
    await ExamQuestion.deleteMany({ _id: { $in: questionIds } });
    return res.json({ success: true, message: `已删除 ${questionIds.length} 道题` });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

// ══════════════════════════════════════════════════════════════
// 考试设置
// ══════════════════════════════════════════════════════════════

/** 获取考试全局设置 */
exports.getExamSettings = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  try {
    const settings = await ExamSetting.findById('global_config').lean();
    // 返回默认值（如尚未初始化）
    return res.json({
      success: true,
      data: settings || {
        _id: 'global_config',
        single:   { count: 20, score: 2 },
        multiple: { count: 10, score: 2 },
        judge:    { count: 20, score: 2 },
        pass_score: 80
      }
    });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

/** 保存考试全局设置（upsert） */
exports.updateExamSettings = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { single, multiple, judge, pass_score } = req.body;

  // 基本校验
  const err = [];
  if (single?.count < 0 || single?.score < 0) err.push('单选题参数非法');
  if (multiple?.count < 0 || multiple?.score < 0) err.push('多选题参数非法');
  if (judge?.count < 0 || judge?.score < 0) err.push('判断题参数非法');
  if (pass_score !== undefined && (pass_score < 0 || pass_score > 200)) err.push('合格分数线应在 0-200 之间');
  if (err.length) return res.json({ success: false, message: err.join('；') });

  try {
    const update = {};
    if (single)   { update.single   = single; }
    if (multiple) { update.multiple = multiple; }
    if (judge)    { update.judge    = judge; }
    if (pass_score !== undefined) update.pass_score = pass_score;

    const saved = await ExamSetting.findByIdAndUpdate(
      'global_config',
      { $set: update },
      { new: true, upsert: true }
    );
    return res.json({ success: true, data: saved });
  } catch (e) {
    return res.json({ success: false, message: e.message });
  }
};

// ──────────────────────────────────────────────────────────────
// Excel 批量导入

// ──────────────────────────────────────────────────────────────
/**
 * 前端将 Excel 文件 base64 编码后发送到此接口。
 * 支持的列格式（第1行为表头，从第2行起读数据）：
 *   A: 题型（单选题 | 多选题 | 判断题）
 *   B: 题目
 *   C: 选项A（判断题此列填 正确/错误 即可，其他选项空白）
 *   D: 选项B
 *   E: 选项C
 *   F: 选项D
 *   G: 正确答案（单选填 A/B/C/D，多选填 AB/ABC，判断题填 正确/错误）
 *   H: 解析（可空）
 */
exports.bulkImportQuestions = async (req, res) => {
  if (!isSafetyAdmin(req)) return res.status(403).json({ success: false, message: '权限不足' });
  const { fileBase64 } = req.body;
  if (!fileBase64) return res.json({ success: false, message: '未收到文件数据' });

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const workSheetsFromBuffer = xlsx.parse(buffer);
    if (!workSheetsFromBuffer || !workSheetsFromBuffer.length) {
      return res.json({ success: false, message: 'Excel 文件解析失败或为空' });
    }

    const rows = workSheetsFromBuffer[0].data;
    if (rows.length < 2) return res.json({ success: false, message: '表格内容为空（至少需要表头行+1条数据）' });

    const TYPE_MAP = { '单选题': 'single', '多选题': 'multiple', '判断题': 'judge' };
    const LETTER_MAP = { A: 0, B: 1, C: 2, D: 3 };

    const toInsert = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

      const rawType = String(row[0] || '').trim();
      const questionText = String(row[1] || '').trim();
      // 去掉选项前缀：A. / A、/ A） / A: 等各种格式
      const stripOpt = (s) => String(s || '').trim().replace(/^[A-Da-d][.、）)：:\s]\s*/u, '').trim();
      const optA = stripOpt(row[2]);
      const optB = stripOpt(row[3]);
      const optC = stripOpt(row[4]);
      const optD = stripOpt(row[5]);
      // 同样去掉题目前缀（如 "1. " "（1）" 等序号）
      const rawAnswer = String(row[6] || '').trim().toUpperCase();
      const explanation = String(row[7] || '').trim();


      const type = TYPE_MAP[rawType];
      if (!type) { errors.push(`第${i + 1}行：未知题型 "${rawType}"`); continue; }
      if (!questionText) { errors.push(`第${i + 1}行：题目内容为空`); continue; }
      if (!rawAnswer) { errors.push(`第${i + 1}行：正确答案为空`); continue; }

      let options = [];
      let correct_answer;

      if (type === 'judge') {
        options = ['正确', '错误'];
        // 判断题答案：正确/错误 or T/F or A/B
        let ans = rawAnswer;
        if (ans === 'A' || ans === 'T' || ans === '正确') ans = '正确';
        else if (ans === 'B' || ans === 'F' || ans === '错误') ans = '错误';
        else { errors.push(`第${i + 1}行：判断题答案应为 正确/错误，当前值：${rawAnswer}`); continue; }
        correct_answer = ans;
      } else {
        options = [optA, optB, optC, optD].filter(o => o !== '');
        if (options.length < 2) { errors.push(`第${i + 1}行：选项不足两项`); continue; }

        if (type === 'single') {
          const idx = LETTER_MAP[rawAnswer];
          if (idx === undefined || !options[idx]) { errors.push(`第${i + 1}行：单选答案 ${rawAnswer} 超出选项范围`); continue; }
          correct_answer = options[idx]; // 存储选项内容
        } else {
          // 多选
          const letters = rawAnswer.split('').filter(l => LETTER_MAP[l] !== undefined);
          if (!letters.length) { errors.push(`第${i + 1}行：多选答案格式无效 "${rawAnswer}"`); continue; }
          correct_answer = letters.map(l => options[LETTER_MAP[l]]).filter(Boolean);
        }
      }

      toInsert.push({ type, question: questionText, options, correct_answer, explanation, status: 'active', create_time: new Date() });
    }

    if (!toInsert.length) {
      return res.json({ success: false, message: '没有可导入的有效数据', errors });
    }

    const result = await ExamQuestion.insertMany(toInsert, { ordered: false });
    return res.json({
      success: true,
      message: `成功导入 ${result.length} 道题目`,
      imported: result.length,
      skipped: errors.length,
      errors: errors.slice(0, 20) // 最多返回20条错误详情
    });
  } catch (e) {
    console.error('批量导入题库失败:', e);
    return res.json({ success: false, message: '导入失败: ' + e.message });
  }
};
