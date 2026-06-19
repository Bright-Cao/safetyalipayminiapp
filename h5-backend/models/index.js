const mongoose = require('mongoose');

// User Model (users)
const userSchema = new mongoose.Schema({
  _openid: { type: String }, // 兼容旧版微信数据，H5系统不强制要求
  phone: { type: String, required: true },
  role: { type: String, required: true }, // 'applicant', 'safety_admin', etc.
  name: { type: String, required: true },
  status: { type: String, default: 'active' },
  workshop_id: { type: String },
  workshop_name: { type: String },
  first_cert_date: { type: Date },
  createTime: { type: Date, default: Date.now },
  lastLoginTime: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema, 'users');

// Application Model (applications)
const applicationSchema = new mongoose.Schema({
  _openid: { type: String }, // 兼容旧版，H5系统不强制
  name: { type: String, required: true },
  // idCard 字段已废弃：H5系统不收集身份证信息（隐私保护）
  phone: { type: String, required: true },
  company: { type: String },
  workshop: { type: String }, // maybe workshop_name
  workshop_name: { type: String },
  category: { type: String }, // 'guardian', 'team_leader', etc.
  status: { type: String }, // 'pending', 'qualified', 'rejected', etc.
  interview_score: { type: Number },
  interview_notes: { type: String },
  valid_until: { type: Date },
  exam_time: { type: Date },
  update_time: { type: Date, default: Date.now }
}, { strict: false });
const Application = mongoose.model('Application', applicationSchema, 'applications');

// Exam Question Model (exam_questions)
const examQuestionSchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'single', 'multiple', 'judge'
  question: { type: String, required: true },
  options: [String],
  correct_answer: { type: mongoose.Schema.Types.Mixed }, // String or Array
  explanation: { type: String },
  status: { type: String, default: 'active' },
  create_time: { type: Date, default: Date.now }
});
const ExamQuestion = mongoose.model('ExamQuestion', examQuestionSchema, 'exam_questions');

// Exam Setting Model (exam_settings)
const examSettingSchema = new mongoose.Schema({
  _id: { type: String }, // e.g. 'global_config'
  single: { count: Number, score: Number },
  multiple: { count: Number, score: Number },
  judge: { count: Number, score: Number }
}, { strict: false });
const ExamSetting = mongoose.model('ExamSetting', examSettingSchema, 'exam_settings');

// Video Model (videos)
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  file_id: { type: String, required: true }, // OSS 文件名/路径
  description: { type: String, default: '' },
  sort_order: { type: Number, default: 0 },  // 播放顺序
  status: { type: String, default: 'active' }, // 'active' | 'disabled'
  create_time: { type: Date, default: Date.now }
});
const Video = mongoose.model('Video', videoSchema, 'videos');

// Exam Record Model (exam_records)
const examRecordSchema = new mongoose.Schema({
  application_id: { type: String },
  _openid: { type: String, required: true },
  answers: [{
    question_id: String,
    user_answer: mongoose.Schema.Types.Mixed,
    correct_answer: String,
    explanation: String,
    is_correct: Boolean,
    score: Number
  }],
  total_score: { type: Number, required: true },
  correct_count: { type: Number, required: true },
  total_count: { type: Number, required: true },
  time_used: { type: Number },
  passed: { type: Boolean, required: true },
  exam_time: { type: Date, default: Date.now }
});
const ExamRecord = mongoose.model('ExamRecord', examRecordSchema, 'exam_records');

// Training Record Model (training_records)
const trainingRecordSchema = new mongoose.Schema({
  application_id: { type: String },
  _openid: { type: String, required: true },
  video_progress: {
    type: Map,
    of: {
      progress: Number,
      watch_time: Number,
      last_time: Number,
      completed: Boolean,
      last_update: Date,
      completed_time: Date
    }
  },
  update_time: { type: Date, default: Date.now }
}, { strict: false });
const TrainingRecord = mongoose.model('TrainingRecord', trainingRecordSchema, 'training_records');

module.exports = {
  User,
  Application,
  Video,
  ExamQuestion,
  ExamSetting,
  ExamRecord,
  TrainingRecord
};
