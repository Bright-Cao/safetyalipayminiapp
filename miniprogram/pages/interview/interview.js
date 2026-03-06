// pages/interview/interview.js
const { applicationAPI, interviewAPI } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    applicationId: '',
    application: {},
    scores: {
      q1: 0, q2: 0, q3: 0, q4: 0, q5: 0,
      q6: 0, q7: 0, q8: 0, q9: 0
    },
    totalScore: 0,
    comments: '',
    interviewId: ''
  },

  onLoad(options) {
    if (options.applicationId) {
      this.setData({ applicationId: options.applicationId });
      this.loadApplicationData();
      this.loadInterviewDraft();
    }
  },

  async loadApplicationData() {
    showLoading();
    try {
      const db = Cloud.database();
      const res = await db.collection('applications').doc(this.data.applicationId).get();
      
      if (res.data) {
        this.setData({ application: res.data });
      }
      
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载申请数据失败:', error);
      showError('加载失败');
    }
  },

  async loadInterviewDraft() {
    try {
      const res = await interviewAPI.getInterviewByApplicationId(this.data.applicationId);
      
      if (res.data.length > 0) {
        const interview = res.data[0];
        if (interview.status === 'draft') {
          this.setData({
            interviewId: interview._id,
            scores: interview.scores || this.data.scores,
            comments: interview.comments || '',
            totalScore: interview.total_score || 0
          });
        }
      }
    } catch (error) {
      console.error('加载草稿失败:', error);
    }
  },

  onScoreChange(e) {
    const question = e.currentTarget.dataset.question;
    const score = e.detail.value;
    
    this.setData({
      [`scores.${question}`]: score
    }, () => {
      this.calculateTotalScore();
    });
  },

  calculateTotalScore() {
    const { scores } = this.data;
    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    this.setData({ totalScore: total });
  },

  onCommentInput(e) {
    this.setData({ comments: e.detail.value });
  },

  async saveDraft() {
    showLoading('保存中...');
    
    try {
      const data = {
        application_id: this.data.applicationId,
        scores: this.data.scores,
        total_score: this.data.totalScore,
        comments: this.data.comments,
        status: 'draft',
        interviewer_openid: app.globalData.openid || (my.getStorageSync({key: 'openid'}).data || ''),
        update_time: new Date()
      };

      if (this.data.interviewId) {
        // 更新草稿
        const db = Cloud.database();
        await db.collection('interviews').doc(this.data.interviewId).update({ data });
      } else {
        // 创建草稿
        const res = await interviewAPI.createInterview(data);
        this.setData({ interviewId: res._id });
      }

      hideLoading();
      showSuccess('保存成功');
    } catch (error) {
      hideLoading();
      console.error('保存失败:', error);
      showError('保存失败');
    }
  },

  async submitInterview() {
    const { totalScore, scores, comments, applicationId } = this.data;

    // 检查是否所有题目都已评分
    const allScored = Object.values(scores).every(score => score > 0);
    if (!allScored) {
      showError('请对所有问题进行评分');
      return;
    }

    if (!comments) {
      showError('请填写面试评语');
      return;
    }

    try {
      const confirmed = await showConfirm(
        `总分：${totalScore}分，${totalScore >= 80 ? '合格' : '不合格'}。确认提交吗？`,
        '确认提交'
      );

      showLoading('提交中...');

      const passed = totalScore >= 80;

      // 如果有草稿，更新草稿
      if (this.data.interviewId) {
        await interviewAPI.submitInterviewScore(
          this.data.interviewId,
          scores,
          totalScore,
          passed,
          comments
        );
      } else {
        // 创建新的面试记录
        await interviewAPI.createInterview({
          application_id: applicationId,
          scores,
          total_score: totalScore,
          passed,
          comments,
          status: 'completed',
          interviewer_openid: app.globalData.openid || (my.getStorageSync({key: 'openid'}).data || ''),
          interview_time: new Date()
        });
      }

      // 更新申请状态
      const newStatus = passed ? 'interview_passed' : 'interview_failed';
      await applicationAPI.updateApplicationStatus(applicationId, newStatus, {
        interview_score: totalScore,
        interview_time: new Date()
      });

      hideLoading();
      showSuccess('提交成功');

      setTimeout(() => {
        my.navigateBack();
      }, 1500);
    } catch (error) {
      hideLoading();
      if (error !== false) {
        console.error('提交失败:', error);
        showError('提交失败');
      }
    }
  }
});
