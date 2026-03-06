// pages/result/result.js
const { applicationAPI } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    hasCertificate: false,
    certificate: null,
    trainingRecords: [],
    canApply: false,
    emptyMessage: '',
    categoryNames: {
      guardian: '监护人',
      safety_manager: '安全负责人',
      safety_officer: '专职安全员',
      team_leader: '班组长'
    }
  },

  onLoad() {
    this.loadCertificate();
  },

  async loadCertificate() {
    showLoading();

    try {
      const openid = app.globalData.openid || my.getStorageSync({ key: 'openid' }).data;
      const res = await applicationAPI.getMyApplications(openid);

      if (res.data.length > 0) {
        // 查找当前登录车间的申请记录
        const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
        const currentWorkshop = userInfo.workshop_name;
        const application = res.data.find(a => a.workshop === currentWorkshop);

        if (application && (application.status === 'qualified' || application.status === 'exam_passed')) {
          // 有证书
          const category = application.category || 'guardian';
          const certificate = {
            name: application.name,
            gender: application.gender === 'male' ? '男' : '女',
            idCard: this.maskIdCard(application.idCard),
            workshop: application.workshop,
            certNumber: this.generateCertNumber(application._id),
            issueDate: this.formatDate(application.exam_time || application.update_time),
            expiryDate: this.calculateExpiryDate(application.exam_time || application.update_time),
            photo: application.profile_photo || application.photo,
            applicantType: application.applicantType || 'internal',
            contractSigned: application.contractSigned || 'yes',
            age: application.age || '',
            workYears: application.workYears || '',
            safetyManagementYears: application.safetyManagementYears || '',
            siteManagementYears: application.siteManagementYears || '',
            category: category,
            categoryName: this.data.categoryNames[category] || '监护人',
            isTeamLeader: application.isTeamLeader || 'no',
            interviewScore: application.interview_score || 0,
            examScore: application.exam_score || 0
          };

          // 加载培训记录
          this.loadTrainingRecords(application._id);

          this.setData({
            hasCertificate: true,
            certificate
          });
        } else {
          // 无证书，显示状态
          let emptyMessage = '';
          let canApply = false;

          switch (application.status) {
            case 'pending':
              emptyMessage = '您的申请正在审核中';
              break;
            case 'interview_passed':
              emptyMessage = '请完成培训学习';
              break;
            case 'training':
              emptyMessage = '培训进行中，请继续学习';
              break;
            case 'exam_pending':
              emptyMessage = '请参加在线考试';
              break;
            case 'exam_failed':
              emptyMessage = '考试未通过，可重新考试';
              canApply = true;
              break;
            case 'interview_failed':
              emptyMessage = '面试未通过，可重新申请';
              canApply = true;
              break;
            default:
              emptyMessage = '未知状态';
          }

          this.setData({
            hasCertificate: false,
            emptyMessage,
            canApply
          });
        }
      } else {
        // 未申请
        this.setData({
          hasCertificate: false,
          emptyMessage: '您还未申请监护人认证',
          canApply: true
        });
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载证书失败:', error);
      showError('加载失败');
    }
  },

  async loadTrainingRecords(applicationId) {
    try {
      const db = Cloud.database();
      const res = await db.collection('training_records')
        .where({ application_id: applicationId })
        .get();

      if (res.data.length > 0) {
        const record = res.data[0];
        const videoProgress = record.video_progress || {};

        const trainingRecords = Object.keys(videoProgress).map(videoId => ({
          id: videoId,
          title: '培训视频',
          time: this.formatDate(videoProgress[videoId].completed_time)
        }));

        this.setData({ trainingRecords });
      }
    } catch (error) {
      console.error('加载培训记录失败:', error);
    }
  },

  maskIdCard(idCard) {
    if (!idCard || idCard.length < 10) return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(idCard.length - 4);
  },

  generateCertNumber(id) {
    const prefix = 'TQZC';
    const year = new Date().getFullYear();
    const random = id.substring(id.length - 6).toUpperCase();
    return `${prefix}${year}${random}`;
  },

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  calculateExpiryDate(issueDate) {
    if (!issueDate) return '';
    const d = new Date(issueDate);
    d.setFullYear(d.getFullYear() + 1); // 1年有效期
    return this.formatDate(d);
  },


  downloadCert() {
    my.showModal({
      title: '下载证书',
      content: '证书下载功能开发中...',
      showCancel: false
    });
  },

  shareCert() {
    my.showSharePanel();
    showSuccess('点击右上角分享');
  },

  goToApply() {
    my.navigateTo({ url: '/pages/apply/apply' });
  }
});
