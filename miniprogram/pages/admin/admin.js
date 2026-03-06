// pages/admin/admin.js
const { adminAPI } = require('../../utils/api');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/util');
const app = getApp();

Page({
  data: {
    userRole: '',
    stats: {
      totalApplications: 0,
      pendingReview: 0,
      inTraining: 0,
      qualified: 0
    },
    todos: [],
    activities: [],
    // Credamo 同步进度
    syncStatus: '',
    syncTotal: 0,
    syncSaved: 0,
    syncProgress: 0,
    syncDone: false,
    cookieStatus: '', // '' | 'ok' | 'error' | 'checking'
  },

  onLoad() {
    const userRole = app.globalData.userRole || my.getStorageSync({ key: 'userRole' }).data;

    // 权限校验：非管人员禁止访问
    if (userRole !== 'workshop_leader' && userRole !== 'safety_admin') {
      my.reLaunch({ url: '/pages/index/index' });
      return;
    }

    this.setData({ userRole });
    this.loadDashboardData();
  },

  onShow() {
    this.loadDashboardData();
  },

  async loadDashboardData() {
    showLoading();

    try {
      const { userRole } = this.data;
      const userInfo = app.globalData.userInfo;
      let workshop = '';

      if (userRole === 'workshop_leader' && userInfo) {
        workshop = userInfo.workshop_name;
      }

      // 加载统计数据
      const statsRes = await adminAPI.getStatistics(workshop);

      if (statsRes.result && statsRes.result.success) {
        this.setData({ stats: statsRes.result.data });
      }

      // 加载待办事项
      await this.loadTodos();

      // 加载最近活动
      await this.loadActivities();

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载数据失败:', error);
      showError('加载失败');
    }
  },

  async loadTodos() {
    const { userRole } = this.data;
    const userInfo = app.globalData.userInfo;
    let todos = [];

    try {
      if (typeof Cloud === 'undefined') {
        console.warn('[调试模式] Cloud 未初始化，跳过待办加载');
        this.setData({ todos: [] });
        return;
      }
      const db = Cloud.database();
      const _ = db.command;

      if (userRole === 'workshop_leader') {
        // 车间领导：只能看到本车间的待面试申请
        console.log('车间领导信息:', userInfo);

        let query = {
          status: 'pending'
        };

        // 如果车间领导有分配车间，显示本车间的申请（包括未分配车间ID的旧数据）
        if (userInfo && userInfo.workshop_id) {
          query = db.command.or([
            {
              status: 'pending',
              workshop_id: userInfo.workshop_id
            },
            {
              status: 'pending',
              workshop: userInfo.workshop_name
            },
            {
              status: 'pending',
              workshop_id: _.exists(false)  // 兼容旧数据（没有workshop_id字段）
            }
          ]);
          console.log('使用车间过滤（含兼容模式）');
        } else {
          console.warn('车间领导未分配车间，将显示所有待审核申请');
        }

        const res = await db.collection('applications')
          .where(query)
          .get();

        console.log('查询到的申请:', res);

        if (res.data && res.data.length > 0) {
          todos.push({
            id: 'pending_interview',
            title: `待面试申请${userInfo && userInfo.workshop_name ? '（' + userInfo.workshop_name + '）' : ''}`,
            desc: '有新的申请需要进行面试',
            count: res.data.length,
            priority: 'high'
          });
        } else {
          console.log('没有找到待审核的申请');
        }
      } else if (userRole === 'safety_admin') {
        // 安全科：培训完成待考试、考试通过待发证
        const trainingRes = await db.collection('applications')
          .where({ status: 'training_completed' })
          .count();

        if (trainingRes.total > 0) {
          todos.push({
            id: 'training_completed',
            title: '待考试人员',
            desc: '有人员完成培训，可以安排考试',
            count: trainingRes.total,
            priority: 'medium'
          });
        }

        const examRes = await db.collection('applications')
          .where({ status: 'exam_passed' })
          .count();

        if (examRes.total > 0) {
          todos.push({
            id: 'exam_passed',
            title: '待发证人员',
            desc: '有人员考试通过，需发放证书',
            count: examRes.total,
            priority: 'high'
          });
        }
      }

      console.log('待办事项:', todos);
      this.setData({ todos });
    } catch (error) {
      console.error('加载待办事项失败:', error);
    }
  },

  async loadActivities() {
    try {
      if (typeof Cloud === 'undefined') {
        console.warn('[调试模式] Cloud 未初始化，跳过活动记录加载');
        return;
      }
      const db = Cloud.database();
      const res = await db.collection('activities')
        .orderBy('create_time', 'desc')
        .limit(10)
        .get();

      const activities = res.data.map(item => ({
        id: item._id,
        title: item.title,
        desc: item.description,
        time: this.formatTime(item.create_time)
      }));

      this.setData({ activities });
    } catch (error) {
      console.error('加载活动记录失败:', error);
    }
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

  goToPage(e) {
    const url = e.currentTarget.dataset.url;
    my.navigateTo({ url });
  },

  handleTodo(e) {
    const id = e.currentTarget.dataset.id;

    const urlMap = {
      'pending_interview': '/pages/admin/applications/applications',
      'training_completed': '/pages/admin/trainings/trainings',
      'exam_passed': '/pages/admin/users/users'
    };

    const url = urlMap[id];
    if (url) {
      my.navigateTo({ url });
    }
  },

  // 测试 Credamo Cookie 是否有效
  async testCredamoCookie() {
    if (typeof Cloud === 'undefined') {
      my.showModal({
        title: '云开发未配置',
        content: '请先在 IDE 中配置云开发环境（关联 AppID 和云环境），再使用此功能。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    this.setData({ cookieStatus: 'checking' });
    my.showLoading({ title: '测试中...' });
    try {
      const res = await Cloud.callFunction({
        name: 'syncCredamo',
        data: { action: 'test' }
      });
      const r = res.result;
      my.hideLoading();
      if (r && r.success) {
        this.setData({ cookieStatus: 'ok' });
        const hoursLeft = r.hours_left;
        const expiry = r.expiry_time || '';
        let title = 'Cookie 有效！共 ' + r.total + ' 条';
        if (hoursLeft !== undefined) {
          title = hoursLeft <= 2
            ? '⚠️ Cookie 仅剩 ' + hoursLeft + ' 小时，请尽快更新！'
            : 'Cookie 有效，还剩 ' + hoursLeft + ' 小时';
        }
        my.showModal({
          title: title,
          content: expiry ? '过期时间：' + expiry + '\n\n共 ' + r.total + ' 条数据可访问' : '共 ' + r.total + ' 条数据可访问',
          showCancel: false,
          confirmText: '知道了'
        });
        if (hoursLeft !== undefined && hoursLeft <= 2) {
          this.setData({ cookieStatus: 'error' });
        }
      } else {
        this.setData({ cookieStatus: 'error' });
        my.showModal({
          title: 'Cookie 已过期',
          content: '请到 Credamo 网站重新登录，在浏览器控制台执行 document.cookie 获取新 Cookie，然后在云函数测试台运行 saveCookie 更新。',
          showCancel: false,
          confirmText: '知道了'
        });
      }
    } catch (err) {
      my.hideLoading();
      this.setData({ cookieStatus: 'error' });
      my.showToast({ title: '测试失败', icon: 'error' });
    }
  },

  // 一键同步 Credamo 培训完成数据
  async syncCredamo() {
    if (typeof Cloud === 'undefined') {
      my.showModal({
        title: '云开发未配置',
        content: '请先在 IDE 中配置云开发环境（关联 AppID 和云环境），再使用同步功能。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    const confirmed = await new Promise(resolve => {
      my.showModal({
        title: '同步 Credamo 培训数据',
        content: '将从 Credamo 拉取全部已完成答卷（共约843条），同步到本地数据库。约需1分钟，请勿关闭页面。',
        confirmText: '开始同步',
        cancelText: '取消',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;

    this.setData({ syncStatus: '正在初始化...', syncTotal: 0, syncSaved: 0, syncProgress: 0, syncDone: false });

    const PAGE_SIZE = 100;
    let page = 1;
    let totalPages = null;
    let totalSaved = 0;
    let totalMatched = 0;
    let totalUpdated = 0;

    try {
      while (true) {
        this.setData({ syncStatus: '同步第 ' + page + (totalPages ? '/' + totalPages : '') + ' 页...' });

        const res = await Cloud.callFunction({
          name: 'syncCredamo',
          data: { action: 'sync', page, pageSize: PAGE_SIZE }
        });

        const r = res.result;
        if (!r || !r.success) {
          this.setData({ syncStatus: '❌ 失败：' + (r && r.message || '未知错误'), syncDone: true });
          my.showToast({ title: '同步失败', icon: 'error' });
          return;
        }

        totalPages = r.totalPages;
        totalSaved += r.saved || 0;
        totalMatched += r.matched || 0;
        totalUpdated += r.updated || 0;

        const progress = Math.round((page / totalPages) * 100);
        this.setData({
          syncTotal: r.total || 0,
          syncSaved: totalSaved,
          syncProgress: progress,
          syncStatus: '第 ' + page + '/' + totalPages + ' 页完成，已保存 ' + totalSaved + ' 条'
        });

        if (!r.hasMore) break;
        page++;

        // 避免频繁请求
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      this.setData({
        syncStatus: '✅ 同步完成！共保存 ' + totalSaved + ' 条，匹配 ' + totalMatched + ' 个申请，更新 ' + totalUpdated + ' 条',
        syncProgress: 100,
        syncDone: true
      });
      my.showToast({ title: '同步完成', icon: 'success', duration: 3000 });
    } catch (err) {
      console.error('同步Credamo失败:', err);
      this.setData({ syncStatus: '❌ 出错：' + err.message, syncDone: true });
      my.showToast({ title: '同步出错', icon: 'error' });
    }
  },

  async exportData() {
    my.showActionSheet({
      items: ['导出申请数据', '导出培训数据', '导出考试数据', '导出认证人员数据'],
      success: async (res) => {
        const types = ['applications', 'trainings', 'exams', 'qualified'];
        const index = res.index;
        const type = types[index];

        showLoading('导出中...');

        try {
          const { userRole } = this.data;
          const userInfo = app.globalData.userInfo;
          let workshop = '';

          if (userRole === 'workshop_leader' && userInfo) {
            workshop = userInfo.workshop_name;
          }

          const filters = workshop ? { workshop } : {};
          const result = await adminAPI.exportData(type, filters);

          if (result.result && result.result.success) {
            const { url, filename } = result.result;

            // 提示用户正在下载
            showLoading('下载中...');

            // 1. 下载文件
            my.downloadFile({
              url: url,
              filePath: my.env.USER_DATA_PATH + '/' + (filename || 'export.xlsx'),
              success: (res) => {
                if (res.statusCode === 200) {
                  hideLoading();
                  showSuccess('下载完成');

                  // 2. 打开文档
                  my.openDocument({
                    filePath: res.filePath,
                    fileType: 'xlsx',
                    showMenu: true,
                    success: () => console.log('打开文档成功'),
                    fail: (err) => {
                      console.error('打开文档失败', err);
                      showError('无法打开文件，请检查是否有对应查看器');
                    }
                  });
                } else {
                  hideLoading();
                  showError('下载失败');
                }
              },
              fail: (err) => {
                hideLoading();
                console.error('下载文件失败', err);
                showError('下载失败');
              }
            });
          } else {
            hideLoading();
            showError(result.result.message || '导出失败');
          }
        } catch (error) {
          hideLoading();
          console.error('导出失败:', error);
          showError('导出失败');
        }
      }
    });
  }
});
