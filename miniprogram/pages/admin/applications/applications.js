// pages/admin/applications/applications.js
const { applicationAPI } = require('../../../utils/api');
const { showLoading, hideLoading, showError } = require('../../../utils/util');
const app = getApp();

Page({
  data: {
    userRole: '',
    applications: [],
    statusList: [
      { value: '', label: '全部状态' },
      { value: 'pending', label: '待面试' },
      { value: 'interview_passed', label: '面试通过' },
      { value: 'training', label: '培训中' },
      { value: 'training_completed', label: '培训完成' },
      { value: 'exam_passed', label: '考试通过' },
      { value: 'qualified', label: '已认证' },
      { value: 'rejected', label: '已拒绝' }
    ],
    statusIndex: 0,
    workshopList: [
      { id: '', name: '全部车间' },
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
    statusMap: {
      'pending': '待面试',
      'interview_passed': '面试通过',
      'training': '培训中',
      'training_completed': '培训完成',
      'exam_passed': '考试通过',
      'qualified': '已认证',
      'rejected': '已拒绝'
    }
  },

  onLoad() {
    const userRole = app.globalData.userRole || my.getStorageSync({ key: 'userRole' }).data;
    this.setData({ userRole });
    this.loadApplications();
  },

  onShow() {
    this.loadApplications();
  },

  async loadApplications() {
    showLoading();

    try {
      const db = Cloud.database();
      const _ = db.command;
      // 优先从 app.globalData 获取最新的用户信息（包含角色切换后的临时车间）
      const userInfo = app.globalData.userInfo || my.getStorageSync({ key: 'userInfo' }).data;
      const { userRole, statusIndex, workshopIndex, statusList, workshopList } = this.data;

      console.log('--- 权限核查 ---');
      console.log('当前登录角色:', userRole);
      console.log('所属车间:', userInfo ? userInfo.workshop_name : '未关联车间');

      // 构建查询条件
      let query = {};

      // 1. 状态筛选
      const selectedStatus = statusList[statusIndex].value;
      if (selectedStatus) {
        query.status = selectedStatus;
      }

      // 2. 车间强制过滤（核心防护点）
      if (userRole === 'workshop_leader') {
        if (userInfo && userInfo.workshop_name) {
          // 领导只能看到自己车间的。同时匹配 workshop_name 和 workshop 两个可能的字段名
          const workshopVal = userInfo.workshop_name;
          query = _.and([
            query,
            _.or([
              { workshop: workshopVal },
              { workshop_name: workshopVal },
              { workshop_id: userInfo.workshop_id }
            ])
          ]);
        } else {
          // 安全兜底：如果没拿到所属车间，为了安全起见，让他什么也看不见
          query.workshop_name = '___SECURITY_VOID___';
          console.error('警告：车间领导身份未携带有效车间信息，查询已拦截');
        }
      } else if (userRole === 'safety_admin') {
        // 安全科（管理员）可以跨车间筛选
        const selectedWorkshop = workshopList[workshopIndex].id;
        if (selectedWorkshop) {
          query.workshop_id = selectedWorkshop;
        }
      }

      console.log('最终执行的查询指令:', query);

      // 查询数据
      const res = await db.collection('applications')
        .where(query)
        .orderBy('create_time', 'desc')
        .limit(100)
        .get();

      // 格式化时间
      const applications = res.data.map(item => ({
        ...item,
        create_time_str: this.formatTime(item.create_time)
      }));

      this.setData({ applications });
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载申请列表失败:', error);
      showError('加载失败');
    }
  },

  formatTime(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  onStatusChange(e) {
    this.setData({ statusIndex: e.detail.value });
    this.loadApplications();
  },

  onWorkshopChange(e) {
    this.setData({ workshopIndex: e.detail.value });
    this.loadApplications();
  },

  handleItemClick(e) {
    const id = e.currentTarget.dataset.id;
    my.navigateTo({
      url: `/pages/admin/application-detail/application-detail?id=${id}`
    });
  },

  startInterview(e) {
    const id = e.currentTarget.dataset.id;
    console.log('开始面试，申请ID:', id);
    my.navigateTo({
      url: `/pages/admin/interview/interview?applicationId=${id}`
    });
  }
});
