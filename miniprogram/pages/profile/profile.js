// pages/profile/profile.js
const { applicationAPI } = require('../../utils/api');
const { showLoading, hideLoading, showSuccess, showError, showConfirm } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    userInfo: {},
    userRole: '',
    roleText: '',
    certStatus: '',
    certStatusText: '',
    certStatusDesc: '',
    cacheSize: '0MB',
    version: '1.0.0'
  },

  onLoad() {
    // onShow 会紧接着执行，数据加载统一在 onShow 处理
  },

  onShow() {
    // 等首帧渲染完毕再加载，避免 "Expected updated data" 警告
    my.nextTick(() => {
      this.loadUserInfo();
      this.getCacheSize();
    });
  },

  async loadUserInfo() {
    const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
    const userRole = app.globalData.userRole || my.getStorageSync({ key: 'userRole' }).data;
    const openid = app.globalData.openid || my.getStorageSync({ key: 'openid' }).data;

    const roleMap = {
      'applicant': '申请人',
      'workshop_leader': '车间领导',
      'safety_admin': '安全科管理员',
      'checker': '检查人员'
    };

    let certStatus = 'unqualified';
    let certStatusText = '未达标';
    let certStatusDesc = '您还未完成学习测评计划';

    if (userRole === 'applicant' && openid) {
      try {
        const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
        const currentWorkshop = userInfo.workshop_name;
        const res = await applicationAPI.getMyApplications(openid);

        // 全部的分析记录
        const qualifiedApps = res.data.filter(a => a.status === 'qualified' || a.status === 'exam_passed');
        // 当前所属的分析记录
        const currentQualified = qualifiedApps.find(a => a.workshop === currentWorkshop);

        if (currentQualified) {
          certStatus = 'qualified';
          certStatusText = '学习已达标';
        }

        if (qualifiedApps.length > 0) {
          const workshops = Array.from(new Set(qualifiedApps.map(a => a.workshop))).join('、');
          certStatusDesc = '已获成果：' + workshops;
        }
      } catch (err) {
        console.error('加载记录失败:', err);
      }
    }

    this.setData({
      userInfo,
      userRole,
      roleText: roleMap[userRole] || '用户',
      certStatus,
      certStatusText,
      certStatusDesc
    });
  },

  getCacheSize() {
    // 获取缓存大小（简化版）
    try {
      const info = my.getStorageInfoSync();
      const size = (info.currentSize / 1024).toFixed(2);
      this.setData({ cacheSize: size + 'MB' });
    } catch (error) {
      console.error('获取缓存大小失败:', error);
    }
  },

  goToPage(e) {
    const url = e.currentTarget.dataset.url;
    my.navigateTo({ url });
  },

  viewCertificate() {
    my.navigateTo({ url: '/pages/result/result' });
  },

  showAbout() {
    my.showModal({
      title: '关于我们',
      content: '安全知识个人学习练习助手\n版本：1.0.0\n\n本工具致力于提升个人在作业环境中的安全意识和知识储备。',
      showCancel: false
    });
  },

  showHelp() {
    my.showModal({
      title: '帮助中心',
      content: '说明：\n\n1. 如何加入学习计划？\n答：在首页点击"加入计划"，填写基础描述并提交。\n\n2. 评估未通过怎么办？\n答：可以重新发起评估，建议先观看视频课件学习。\n\n3. 测评有几次机会？\n答：每份试卷有3次自主测评机会。',
      showCancel: false
    });
  },

  contactService() {
    my.showModal({
      title: '联系客服',
      content: '客服电话：400-123-4567\n工作时间：周一至周五 9:00-18:00',
      confirmText: '拨打电话',
      success: function(res) {
        if (res.confirm) {
          my.makePhoneCall({
            phoneNumber: '4001234567'
          });
        }
      }
    });
  },

  clearCache() {
    my.showModal({
      title: '清除缓存',
      content: '确定要清除缓存吗？',
      success: function(res) {
        if (res.confirm) {
          showLoading('清除中...');

          setTimeout(function() {
            try {
              // 保留用户信息和登录状态
              const userInfo = my.getStorageSync({ key: 'userInfo' }).data;
              const userRole = my.getStorageSync({ key: 'userRole' }).data;
              const token = my.getStorageSync({ key: 'token' }).data;

              my.clearStorageSync();

              my.setStorageSync({ key: 'userInfo', data: userInfo });
              my.setStorageSync({ key: 'userRole', data: userRole });
              my.setStorageSync({ key: 'token', data: token });

              hideLoading();
              showSuccess('清除成功');
              this.getCacheSize();
            } catch (error) {
              hideLoading();
              showError('清除失败');
            }
          }, 1000);
        }
      }
    });
  },

  checkUpdate() {
    showLoading('检查中...');

    setTimeout(function() {
      hideLoading();
      my.showModal({
        title: '已是最新版本',
        content: '当前版本：1.0.0\n已经是最新版本了',
        showCancel: false
      });
    }, 1000);
  },

  async handleLogout() {
    try {
      await showConfirm('确定要退出登录吗？', '退出登录');

      const app = getApp();
      app.clearUserInfo();

      showSuccess('已退出');

      setTimeout(function() {
        my.reLaunch({ url: '/pages/login/login' });
      }, 1000);
    } catch (error) {
      // 用户取消
    }
  }
});
