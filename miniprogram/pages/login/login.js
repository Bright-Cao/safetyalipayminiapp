// pages/login/login.js
const { showError, showSuccess, showLoading, hideLoading, validatePhone } = require('../../utils/util');

Page({
  data: {
    phoneNumber: '',
    loading: false,
    agreedToTerms: false,
    selectedRole: 'applicant',
    workshopList: [
      { id: 'ws001', name: '炼铁一车间' },
      { id: 'ws002', name: '炼铁二车间' },
      { id: 'ws003', name: '炼铁三车间' },
      { id: 'ws004', name: '炼铁四车间' },
      { id: 'ws005', name: '炼铁辅助车间' },
      { id: 'ws006', name: '原料一车间' },
      { id: 'ws007', name: '原料二车间' },
      { id: 'ws008', name: '原料三车间' },
      { id: 'ws009', name: '烧结一车间' },
      { id: 'ws010', name: '烧结二车间' },
      { id: 'ws011', name: '烧结三车间' },
      { id: 'ws012', name: '烧结四车间' },
      { id: 'ws013', name: '球团车间' },
      { id: 'ws014', name: '铁前设备科' }
    ],
    workshopIndex: 0,
    selectedWorkshop: null
  },

  onLoad() {
    this.setData({
      selectedWorkshop: this.data.workshopList[0]
    });
  },

  onPhoneInput(e) {
    this.setData({ phoneNumber: e.detail.value });
  },

  onWorkshopChange(e) {
    const index = e.detail.value;
    this.setData({
      workshopIndex: index,
      selectedWorkshop: this.data.workshopList[index]
    });
  },

  // checkbox-group onChange：e.detail.value 是已勾选 value 的数组
  onAgreementChange(e) {
    this.setData({ agreedToTerms: e.detail.value.length > 0 });
  },

  selectRole(e) {
    this.setData({ selectedRole: e.currentTarget.dataset.role });
  },

  // 手机号登录
  async handleLogin() {
    const { phoneNumber, agreedToTerms, selectedRole, selectedWorkshop } = this.data;

    if (!agreedToTerms) {
      showError('请先同意用户协议');
      return;
    }

    if (!validatePhone(phoneNumber)) {
      showError('请输入正确的手机号');
      return;
    }

    this.setData({ loading: true });
    showLoading('登录中...');

    try {
      let res;

      if (typeof Cloud === 'undefined' || typeof Cloud.callFunction !== 'function') {
        // ===== 开发调试模式：Cloud 未配置，使用本地 mock =====
        console.warn('[调试模式] Cloud 未初始化，使用 mock 登录');
        const mockOpenid = 'mock_' + phoneNumber + '_' + Date.now();
        res = {
          result: {
            success: true,
            data: {
              userInfo: {
                phone: phoneNumber,
                role: selectedRole,
                name: '调试用户' + phoneNumber.slice(-4),
                workshop_id: selectedWorkshop ? selectedWorkshop.id : '',
                workshop_name: selectedWorkshop ? selectedWorkshop.name : '',
                status: 'active'
              },
              openid: mockOpenid
            }
          }
        };
      } else {
        // ===== 正式模式：调用云函数 =====
        res = await Cloud.callFunction({
          name: 'login',
          data: {
            phoneNumber,
            role: selectedRole,
            workshop_id: selectedWorkshop ? selectedWorkshop.id : '',
            workshop_name: selectedWorkshop ? selectedWorkshop.name : ''
          }
        });
      }

      hideLoading();
      this.setData({ loading: false });

      if (res.result && res.result.success) {
        const userInfo = res.result.data && res.result.data.userInfo;
        const finalRole = userInfo && userInfo.role;
        const openid = res.result.data.openid;

        // 保存登录状态
        my.setStorageSync({ key: 'token', data: openid });
        my.setStorageSync({ key: 'openid', data: openid });
        my.setStorageSync({ key: 'userInfo', data: userInfo });
        my.setStorageSync({ key: 'userRole', data: finalRole });

        const app = getApp();
        app.globalData.openid = openid;
        app.globalData.userInfo = userInfo;
        app.globalData.userRole = finalRole;

        showSuccess('登录成功');

        setTimeout(function () {
          if (selectedRole === 'applicant') {
            my.reLaunch({ url: '/pages/index/index' });
          } else if (finalRole === 'workshop_leader' || finalRole === 'safety_admin') {
            my.reLaunch({ url: '/pages/admin/admin' });
          } else if (finalRole === 'checker') {
            my.reLaunch({ url: '/pages/check/check' });
          } else {
            my.reLaunch({ url: '/pages/index/index' });
          }
        }, 1000);
      } else {
        my.showModal({
          title: '登录失败',
          content: (res.result && res.result.message) || '该手机号未在系统中注册，请联系管理员',
          showCancel: false
        });
      }
    } catch (error) {
      hideLoading();
      this.setData({ loading: false });
      console.error('登录失败:', error);
      showError('登录服务异常，请重试');
    }
  },

  showTerms() {
    my.showModal({
      title: '用户协议',
      content: '本系统仅限厂内授权人员使用，用于安全生产知识学习与资质管理。',
      showCancel: false
    });
  },

  showPrivacy() {
    my.showModal({
      title: '隐私政策',
      content: '您的手机号仅用于身份验证，不会对外共享或用于商业用途。',
      showCancel: false
    });
  }
});
