// pages/index/index.js
const { applicationAPI } = require('../../utils/api');
const { getStatusText, getStatusClass, showLoading, hideLoading, showError } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    userInfo: {},
    application: null,
    hasApplication: false,
    canReapply: false,
    showTraining: false,
    showExam: false,
    currentStep: 0,
    statusText: '未申请',
    statusClass: '',
    notices: [],
    // 工作流定义
    flows: {
      guardian: [
        { name: '加入计划', statuses: ['pending'] },
        { name: '综合评估', statuses: ['workshop_interview_passed'] },
        { name: '培训练习', statuses: ['interview_passed', 'training', 'training_completed', 'exam_pending'] },
        { name: '自测达标', statuses: ['exam_passed', 'qualified'] }
      ],
      safety_manager: [
        { name: '加入计划', statuses: ['pending'] },
        { name: '水平评估', statuses: ['interview_passed'] },
        { name: '学习完成', statuses: ['qualified'] }
      ],
      safety_officer: [
        { name: '加入计划', statuses: ['pending'] },
        { name: '水平评估', statuses: ['interview_passed'] },
        { name: '学习完成', statuses: ['qualified'] }
      ],
      team_leader: [
        { name: '加入计划', statuses: ['pending'] },
        { name: '综合评估', statuses: ['workshop_interview_passed'] },
        { name: '水平评估', statuses: ['interview_passed'] },
        { name: '学习完成', statuses: ['qualified'] }
      ]
    },
    currentFlow: []
  },

  onLoad() {
    const role = app.globalData.userRole || my.getStorageSync({ key: 'userRole' }).data;
    if (role === 'checker') {
      my.reLaunch({ url: '/pages/check/check' });
      return;
    } else if (role === 'workshop_leader' || role === 'safety_admin') {
      my.reLaunch({ url: '/pages/admin/admin' });
      return;
    }
    // 数据加载统一在 onShow 处理（onLoad 执行后紧接着触发 onShow）
  },

  onShow() {
    // 等首帧渲染完毕，避免 "Expected updated data" 警告
    my.nextTick(function() {
      this.loadUserInfo();
      this.loadApplicationStatus();
      this.loadNotices();
    }.bind(this));
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
    this.setData({ userInfo: userInfo });
  },

  loadApplicationStatus() {
    showLoading();
    const openid = app.globalData.openid || my.getStorageSync({ key: 'openid' }).data;
    applicationAPI.getMyApplications(openid)
      .then(function(res) {

      if (res.data.length > 0) {
        const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
        const currentWorkshop = userInfo.workshop_name;
        const application = res.data.find(function(a) { return a.workshop === currentWorkshop; });

        if (application) {
          console.log('检测到当前车间申请:', application);
          const status = application.status;
          const category = application.category || 'guardian';
          const flow = this.data.flows[category] || this.data.flows.guardian;

          let currentStep = 0;
          let showTraining = false;
          let showExam = false;
          let canReapply = false;

          // 计算当前进度
          flow.forEach(function(step, index) {
            if (step.statuses.includes(status)) {
              currentStep = index + 1;
            }
          });

          if (status === 'qualified' || status === 'exam_passed') {
            currentStep = flow.length;
          }

          if (category === 'guardian') {
            if (status === 'interview_passed' || status === 'training') {
              showTraining = true;
            } else if (status === 'training_completed' || status === 'exam_pending') {
              showExam = true;
            }
          }

          if (status === 'rejected' || status === 'exam_failed') {
            canReapply = true;
          }

          this.setData({
            application: application,
            hasApplication: true,
            currentFlow: flow,
            currentStep: currentStep,
            showTraining: showTraining,
            showExam: showExam,
            canReapply: canReapply,
            statusText: getStatusText(status),
            statusClass: getStatusClass(status)
          });
        } else {
          console.log('当前车间无申请记录');
          this.setData({
            application: null,
            hasApplication: false,
            currentStep: 0,
            statusText: '未申请',
            currentFlow: []
          });
        }
      } else {
        console.log('该用户任何车间都没有申请记录');
        this.setData({
          application: null,
          hasApplication: false,
          currentStep: 0,
          statusText: '未申请',
          currentFlow: []
        });
      }
      hideLoading();
    }.bind(this)).catch(function(error) {
      hideLoading();
      console.warn('加载状态错误:', error);
    });
  },

  loadNotices() {
    // 加载通知公告
    const db = Cloud.database();
    db.collection('notices')
      .where({ status: 'published' })
      .orderBy('publish_time', 'desc')
      .limit(5)
      .get()
      .then(function(res) {

      const notices = res.data.map(function(item) {
        return {
          id: item._id,
          title: item.title,
          time: this.formatTime(item.publish_time)
        };
      }.bind(this));

      this.setData({ notices: notices });
    }.bind(this)).catch(function(error) {
      console.warn('加载通知失败:', error);
      // 数据库未配置时显示提示
      this.setData({
        notices: [{
          id: 'temp',
          title: '👉 请先配置云开发数据库',
          time: '现在'
        }]
      });
    }.bind(this));
  },

  formatTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < hour) {
      return Math.floor(diff / minute) + '分钟前';
    } else if (diff < day) {
      return Math.floor(diff / hour) + '小时前';
    } else if (diff < 7 * day) {
      return Math.floor(diff / day) + '天前';
    } else {
      return target.toLocaleDateString();
    }
  },

  goToApply() {
    my.navigateTo({ url: '/pages/apply/apply' });
  },

  goToTraining() {
    if (!this.data.application) {
      showError('请先提交申请');
      return;
    }
    my.navigateTo({
      url: '/pages/training/training?applicationId=' + this.data.application._id
    });
  },

  goToExam() {
    if (!this.data.application) {
      showError('请先完成培训');
      return;
    }
    my.navigateTo({
      url: '/pages/exam/exam?applicationId=' + this.data.application._id
    });
  },

  goToResult() {
    my.navigateTo({ url: '/pages/result/result' });
  },

  goToPractice() {
    my.navigateTo({ url: '/pages/practice/practice' });
  },

  viewNotice(e) {
    const id = e.currentTarget.dataset.id;
    my.showModal({
      title: '通知详情',
      content: '这里显示通知的详细内容...',
      showCancel: false
    });
  },

  handleLogout() {
    my.showModal({
      title: '切换车间',
      content: '确定要退出当前车间身份并重新登录吗？',
      success: function(res) {
        if (res.confirm) {
          app.clearUserInfo();
          my.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});
