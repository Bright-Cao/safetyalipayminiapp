// app.js
App({
  globalData: {
    userInfo: null,
    userRole: null, // 'applicant', 'workshop_leader', 'safety_admin', 'checker'
    openid: null
  },

  onLaunch() {
    // 初始化云开发环境
    if (typeof Cloud === 'undefined') {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      Cloud.init({
        env: 'env-00jy61dujbbj'
      });
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const token = my.getStorageSync({ key: 'token' }).data;
    const userInfo = my.getStorageSync({ key: 'userInfo' }).data;
    const userRole = my.getStorageSync({ key: 'userRole' }).data;

    if (token && userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.userRole = userRole;
    } else {
      // 跳转到登录页
      my.reLaunch({
        url: '/pages/login/login'
      });
    }
  },

  // 保存用户信息
  setUserInfo(userInfo, role) {
    this.globalData.userInfo = userInfo;
    this.globalData.userRole = role;
    my.setStorageSync({ key: 'userInfo', data: userInfo });
    my.setStorageSync({ key: 'userRole', data: role });
  },

  // 清除用户信息
  clearUserInfo() {
    this.globalData.userInfo = null;
    this.globalData.userRole = null;
    my.removeStorageSync({ key: 'token' });
    my.removeStorageSync({ key: 'userInfo' });
    my.removeStorageSync({ key: 'userRole' });
  }
});
