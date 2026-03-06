// pages/setup/setup.js
Page({
  data: {
    cloudEnabled: false,
    dbCreated: false,
    functionsDeployed: false,
    dataSeeded: false,
    collections: [
      'applications',
      'users',
      'interviews',
      'training_videos',
      'training_records',
      'practice_questions',
      'exam_questions',
      'exam_records',
      'notices',
      'sms_codes',
      'activities'
    ]
  },

  onLoad() {
    this.checkStatus();
  },

  async checkStatus() {
    my.showLoading({ content: '检查中...' });

    try {
      // 检查云开发是否可用
      const cloudEnabled = await this.checkCloud();

      // 检查数据库集合
      const dbCreated = await this.checkDatabase();

      this.setData({
        cloudEnabled,
        dbCreated
      });

      my.hideLoading();

      if (cloudEnabled && dbCreated) {
        my.showModal({
          title: '✅ 配置完成',
          content: '系统配置已完成，可以正常使用了！',
          showCancel: false,
          success: (res) => {
            if (res.confirm) {
              this.skipSetup();
            }
          }
        });
      } else {
        let message = '请完成以下配置：\n';
        if (!cloudEnabled) message += '• 开通云开发\n';
        if (!dbCreated) message += '• 创建数据库集合\n';

        my.showModal({
          title: '⚠️ 配置未完成',
          content: message,
          showCancel: false
        });
      }
    } catch (error) {
      my.hideLoading();
      console.error('检查配置失败:', error);
      my.showToast({
        content: '检查失败',
        type: 'none'
      });
    }
  },

  // 检查云开发是否可用
  async checkCloud() {
    try {
      const db = Cloud.database();
      return true;
    } catch (error) {
      return false;
    }
  },

  // 检查数据库集合是否创建
  async checkDatabase() {
    try {
      const db = Cloud.database();

      // 尝试查询 notices 集合
      await db.collection('notices').limit(1).get();

      return true;
    } catch (error) {
      return false;
    }
  },

  viewGuide() {
    my.showModal({
      title: '📖 配置指南',
      content: '详细配置文档请查看项目根目录下的 DATABASE_SETUP.md 文件，或参考 README.md 中的说明。',
      showCancel: false
    });
  },

  async initAdmin() {
    my.showLoading({ content: '初始化中...' });
    try {
      Cloud.callFunction({
        name: 'seedTestData'
      }).then((res) => {
        my.hideLoading();
        if (res.result && res.result.success) {
          my.showModal({
            title: '✅ 初始化成功',
            content: '您的手机号 (18796245711) 已设为管理员。现在可以返回登录页，选择“安全科”进行支付宝一键登录了。',
            confirmText: '去登录',
            success: (res) => {
              if (res.confirm) {
                this.skipSetup();
              }
            }
          });
        } else {
          throw new Error(res.result ? res.result.error : '未知错误');
        }
      }).catch((error) => {
        throw error;
      });
    } catch (error) {
      my.hideLoading();
      console.error('初始化失败:', error);
      my.showModal({
        title: '❌ 初始化失败',
        content: '请确保您已经在开发者工具右键部署了 seedTestData 云函数。'
      });
    }
  },

  skipSetup() {
    // 跳转到登录页
    my.reLaunch({
      url: '/pages/login/login'
    });
  }
});
