// pages/exam/exam.js
const { examAPI, applicationAPI } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    applicationId: '',
    totalQuestions: 50,
    examDuration: 60,
    passingScore: 80,
    remainingAttempts: 3,
    examStarted: false,
    examFinished: false,
    reviewMode: false,
    questions: [],
    answeredCount: 0,
    remainingTime: 0,
    remainingTimeText: '60:00',
    timer: null,
    startTime: null,
    examScore: 0,
    correctRate: 0,
    examTimeUsed: '',
    passed: false
  },

  onLoad(options) {
    if (options.applicationId) {
      this.setData({ applicationId: options.applicationId });
      this.loadExamInfo();
    }
  },

  onUnload() {
    this.clearTimer();
  },

  async loadExamInfo() {
    showLoading();

    try {
      const db = Cloud.database();

      // 并行加载：考试记录 + 考试配置
      const [recordRes, settingsRes] = await Promise.all([
        examAPI.getExamRecords(this.data.applicationId),
        db.collection('exam_settings').doc('global_config').get().catch(() => ({ data: null }))
      ]);

      // 处理考试记录
      const attempts = recordRes.data.length;
      const maxAttempts = 3;
      const remainingAttempts = maxAttempts - attempts;

      if (remainingAttempts <= 0) {
        hideLoading();
        showError('考试次数已用完');
        setTimeout(() => {
          my.navigateBack();
        }, 2000);
        return;
      }

      // 处理考试配置
      let totalQuestions = 50;
      let passingScore = 80;

      if (settingsRes.data) {
        const { single, multiple, judge, passing_score } = settingsRes.data;
        totalQuestions = (single && single.count || 0) + (multiple && multiple.count || 0) + (judge && judge.count || 0);
        passingScore = passing_score || 80;
      }

      this.setData({
        remainingAttempts,
        totalQuestions,
        passingScore
      });

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载考试信息失败:', error);
      showError('加载失败');
    }
  },

  async startExam() {
    showLoading('正在生成试卷...');

    try {
      // 从题库随机抽取题目
      const res = await examAPI.getExamQuestions();

      if (!res.result.success) {
        hideLoading();
        showError(res.result.message || '生成试卷失败');
        return;
      }

      const questions = res.result.data.map(q => {
        const type = q.type;
        return {
          ...q,
          typeText: this.getQuestionTypeText(type),
          answer: type === 'multiple' ? [] : ''
        };
      });

      console.log('Processed questions:', questions); // Debug log

      const remainingTime = this.data.examDuration * 60;

      this.setData({
        questions,
        totalQuestions: questions.length,
        examStarted: true,
        reviewMode: false,
        remainingTime,
        remainingTimeText: this.formatTime(remainingTime),
        startTime: Date.now()
      });

      this.startTimer();
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('开始考试失败:', error);
      showError('生成试卷失败');
    }
  },

  getQuestionTypeText(type) {
    const typeMap = {
      'single': '单选题',
      'multiple': '多选题',
      'judge': '判断题'
    };
    return typeMap[type] || type;
  },

  startTimer() {
    this.data.timer = setInterval(() => {
      let remainingTime = this.data.remainingTime - 1;

      if (remainingTime <= 0) {
        this.clearTimer();
        this.autoSubmit();
        return;
      }

      this.setData({
        remainingTime,
        remainingTimeText: this.formatTime(remainingTime)
      });
    }, 1000);
  },

  clearTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  },

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  },

  onAnswerChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;

    console.log(`Answer changed for question ${index}:`, value); // Debug log

    this.setData({
      [`questions[${index}].answer`]: value
    }, () => {
      this.updateAnsweredCount();
    });
  },

  updateAnsweredCount() {
    const answeredCount = this.data.questions.filter(q => {
      if (Array.isArray(q.answer)) {
        return q.answer.length > 0;
      }
      return q.answer !== '';
    }).length;

    this.setData({ answeredCount });
  },

  scrollToQuestion(e) {
    const index = e.currentTarget.dataset.index;
    const query = my.createSelectorQuery();
    query.select(`#question-${index}`).boundingClientRect();
    query.selectViewport().scrollOffset();
    query.exec(res => {
      if (res[0]) {
        my.pageScrollTo({
          scrollTop: res[1].scrollTop + res[0].top - 100,
          duration: 300
        });
      }
    });
  },

  async submitExam() {
    const { answeredCount, totalQuestions } = this.data;

    if (answeredCount < totalQuestions) {
      try {
        await showConfirm(`还有${totalQuestions - answeredCount}题未作答，确认提交吗？`, '提示');
      } catch (e) {
        return;
      }
    } else {
      try {
        await showConfirm('确认提交试卷吗？提交后无法修改', '确认提交');
      } catch (e) {
        return;
      }
    }

    this.clearTimer();
    this.calculateScore();
  },

  autoSubmit() {
    my.showModal({
      title: '时间到',
      content: '考试时间已到，系统将自动提交试卷',
      showCancel: false,
      success: () => {
        this.calculateScore();
      }
    });
  },

  async calculateScore() {
    showLoading('正在评分...');

    try {
      const answers = this.data.questions.map(q => ({
        question_id: q._id,
        answer: q.answer
      }));

      const timeUsed = Math.floor((Date.now() - this.data.startTime) / 1000);

      const res = await examAPI.submitExam({
        application_id: this.data.applicationId,
        answers,
        time_used: timeUsed
      });

      if (!res.result.success) {
        hideLoading();
        showError('提交失败');
        return;
      }

      const { score, correct_count, total_count, passed, detailed_answers } = res.result.data;
      const correctRate = Math.round((correct_count / total_count) * 100);

      // Merge results back to questions
      const questions = this.data.questions.map(q => {
        const detail = detailed_answers ? detailed_answers.find(d => d.question_id === q._id) : null;
        return {
          ...q,
          correctAnswer: detail ? detail.correct_answer : '',
          explanation: detail ? detail.explanation : '',
          isCorrect: detail ? detail.is_correct : false
        };
      });

      this.setData({ questions });

      // 如果通过，更新申请状态
      if (passed) {
        await applicationAPI.updateApplicationStatus(this.data.applicationId, 'exam_passed', {
          exam_score: score,
          exam_time: new Date(),
          status: 'qualified'
        });
      } else {
        await applicationAPI.updateApplicationStatus(this.data.applicationId, 'exam_failed', {
          exam_score: score,
          exam_time: new Date()
        });
      }

      this.setData({
        examFinished: true,
        examScore: score,
        correctRate,
        examTimeUsed: this.formatTime(timeUsed),
        passed,
        remainingAttempts: this.data.remainingAttempts - 1
      });

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('提交考试失败:', error);
      showError('提交失败');
    }
  },

  viewAnswers() {
    this.setData({
      reviewMode: true
    });
  },

  backToHome() {
    my.reLaunch({ url: '/pages/index/index' });
  },

  retryExam() {
    my.reLaunch({ url: `/pages/exam/exam?applicationId=${this.data.applicationId}` });
  }
});
