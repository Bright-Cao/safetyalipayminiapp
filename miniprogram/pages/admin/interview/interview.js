// pages/admin/interview/interview.js
const { interviewAPI, applicationAPI } = require('../../../utils/api');
const { showLoading, hideLoading, showError, showSuccess, showConfirm } = require('../../../utils/util');
const app = getApp();

Page({
  data: {
    applicationId: '',
    applicationInfo: {},
    userRole: '',
    categoryNames: {
      guardian: '监护人',
      safety_manager: '安全负责人',
      safety_officer: '专职安全员',
      team_leader: '班组长'
    },
    criteriaTemplates: {
      guardian: [
        { id: 'responsibility_safety', name: '责任心与安全意识', desc: '责任心与安全意识', maxScore: 25 },
        { id: 'risk_id', name: '风险辨识能力', desc: '风险辨识能力', maxScore: 25 },
        { id: 'safety_measures', name: '安全措施', desc: '从事项目相关的危险作业的安全措施', maxScore: 25 },
        { id: 'emergency_disposal', name: '应急处置能力', desc: '应急处置能力/描述汇报流程', maxScore: 25 }
      ],
      safety_manager: [
        { id: 'legal_knowledge', name: '法律法规知识储备', desc: '安全生产、职业卫生、消防等相关法律法规', maxScore: 25 },
        { id: 'shagang_system', name: '沙钢安全制度', desc: '对沙钢相关安全管理制度的了解', maxScore: 25 },
        { id: 'training_org', name: '人员培训组织', desc: '人员培训及教育组织能力', maxScore: 25 },
        { id: 'emergency_investigation', name: '应急处理与事故调查', desc: '应急预案响应与事故调查分析能力', maxScore: 25 }
      ],
      safety_officer: [
        { id: 'system_knowledge', name: '各项安全制度了解', desc: '沙钢各项安全制度的熟悉程度', maxScore: 25 },
        { id: 'plan_formulation', name: '方案制定能力', desc: '现场作业方案及处置方案的制定', maxScore: 25 },
        { id: 'measure_familiarity', name: '安全措施了解', desc: '对各类检修维修和危险作业的安全措施了解程度', maxScore: 25 },
        { id: 'event_handling', name: '现场事故/事件处理', desc: '现场突发状况的即时处理能力', maxScore: 25 }
      ],
      team_leader: [
        { id: 'policy_law', name: '方针法规了解', desc: '各项安全生产方针和法律法规', maxScore: 25 },
        { id: 'dangerous_work', name: '危险作业管理制度', desc: '沙钢危险作业安全管理制度', maxScore: 25 },
        { id: 'kyt_process', name: 'KYT开展流程', desc: '风险预知训练(KYT)的具体执行步骤', maxScore: 25 },
        { id: 'daily_duty', name: '日常管理要点', desc: '日常工作职责、安全检查等工作要点', maxScore: 25 }
      ]
    },
    scoreItems: [],
    scores: {},
    totalScore: 0,
    comments: ''
  },

  onLoad(options) {
    const userRole = app.globalData.userRole || my.getStorageSync({ key: 'userRole' }).data;
    if (options.applicationId) {
      this.setData({
        applicationId: options.applicationId,
        userRole
      });
      this.loadApplicationInfo();
    }
  },

  async loadApplicationInfo() {
    showLoading();

    try {
      const db = Cloud.database();
      const res = await db.collection('applications')
        .doc(this.data.applicationId)
        .get();

      if (res.data) {
        const appInfo = res.data;
        const category = appInfo.category || 'guardian';
        const items = this.data.criteriaTemplates[category] || this.data.criteriaTemplates.guardian;

        // 初始化评分值
        const initialScores = {};
        items.forEach(item => {
          initialScores[item.id] = 0;
        });

        this.setData({
          applicationInfo: appInfo,
          scoreItems: items,
          scores: initialScores
        });
      }

      hideLoading();
    } catch (error) {
      hideLoading();
      console.error('加载申请信息失败:', error);
      showError('加载失败');
    }
  },

  onScoreChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;

    this.setData({
      [`scores.${id}`]: value
    }, () => {
      this.calculateTotalScore();
    });
  },

  calculateTotalScore() {
    const { scores, scoreItems } = this.data;
    let total = 0;

    // 遍历评分项配置数组进行加总，确保不漏掉任何一项
    scoreItems.forEach(item => {
      const score = scores[item.id] || 0;
      total += Number(score);
    });

    this.setData({ totalScore: total });
    console.log('当前各分项:', scores, '计算总分:', total);
  },

  onCommentInput(e) {
    this.setData({ comments: e.detail.value });
  },

  async handleReject() {
    const { comments } = this.data;

    if (!comments.trim()) {
      showError('请填写不通过原因');
      return;
    }

    try {
      await showConfirm('确认不通过此申请吗？', '确认操作');

      showLoading('提交中...');

      const db = Cloud.database();

      // 创建面试记录
      await db.collection('interviews').add({
        data: {
          application_id: this.data.applicationId,
          scores: this.data.scores,
          total_score: this.data.totalScore,
          passed: false,
          comments: comments,
          interviewer: app.globalData.userInfo.name || '未知',
          interview_time: new Date(),
          status: 'completed'
        }
      });

      // 更新申请状态
      await db.collection('applications')
        .doc(this.data.applicationId)
        .update({
          data: {
            status: 'rejected',
            interview_score: this.data.totalScore,
            interview_comments: comments,
            update_time: new Date()
          }
        });

      hideLoading();
      showSuccess('已拒绝');

      setTimeout(function () {
        my.navigateBack();
      }, 1500);
    } catch (error) {
      hideLoading();
      if (error !== false) {
        console.error('提交失败:', error);
        showError('提交失败');
      }
    }
  },

  async handlePass() {
    const { totalScore, comments, applicationInfo, userRole } = this.data;
    const category = applicationInfo.category || 'guardian';

    if (totalScore < 80) {
      showError('总分不足80分，不能通过面试');
      return;
    }

    if (!comments.trim()) {
      showError('请填写面试意见');
      return;
    }

    try {
      await showConfirm(`当前总分为 ${totalScore} 分，确认通过此申请吗？`, '确认操作');

      showLoading('提交中...');

      const db = Cloud.database();
      const _ = db.command;

      // 创建面试记录
      await db.collection('interviews').add({
        data: {
          application_id: this.data.applicationId,
          scores: this.data.scores,
          total_score: totalScore,
          passed: true,
          comments: comments,
          interviewer: app.globalData.userInfo.name || '未知',
          interview_time: new Date(),
          status: 'completed'
        }
      });

      // 状态转移逻辑
      let nextStatus = '';
      if (category === 'guardian') {
        // 监护人：车间面试通过后直接进入待培训状态 (interview_passed)
        nextStatus = 'interview_passed';
      } else if (category === 'safety_manager' || category === 'safety_officer') {
        // 安全负责人/专职安全员：安全科面试过即认证
        nextStatus = 'qualified';
      } else if (category === 'team_leader') {
        // 班组长：车间过 -> 待安全科；安全科过 -> 即认证 (无培训/考试)
        nextStatus = userRole === 'workshop_leader' ? 'workshop_interview_passed' : 'qualified';
      }

      // 更新申请状态
      await db.collection('applications')
        .doc(this.data.applicationId)
        .update({
          data: {
            status: nextStatus,
            interview_score: totalScore,
            interview_comments: comments,
            update_time: new Date()
          }
        });

      // 💡 智能转场逻辑：如果该人员在其他车间已有【同类型】的有效证书，则面试后直接认证
      try {
        const idCard = this.data.applicationInfo.idCard;
        const currentCategory = this.data.applicationInfo.category || 'guardian';

        if (idCard && idCard.trim() !== '') {
          console.log('[资质转移核查] 正在检索身份证:', idCard, '类别:', currentCategory);
          const checkRes = await db.collection('applications')
            .where({
              idCard: idCard.trim(),
              category: currentCategory, // 必须是同类型资质
              _id: _.neq(this.data.applicationId),
              status: _.in(['qualified', 'exam_passed'])
            })
            .get();

          if (checkRes.data.length > 0) {
            const prior = checkRes.data[0];
            console.log('[资质转移] 发现匹配记录，源车间:', prior.workshop);

            await db.collection('applications')
              .doc(this.data.applicationId)
              .update({
                data: {
                  status: 'qualified', // 直接设为认证成功，跳过培训/考试
                  transfer_source: 'prior_qualification',
                  transfer_from_workshop: prior.workshop,
                  note: `已有同类型有效资质（来自` + prior.workshop + `），跨车间调动面试外审后免培免考`,
                  exam_time: new Date(),
                  update_time: new Date()
                }
              });

            showSuccess('面试通过\n(已沿用旧资质)');
            setTimeout(function () { my.navigateBack(); }, 1500);
            return;
          }
        }
      } catch (e) {
        console.error('资质转移逻辑执行异常:', e);
      }

      hideLoading();
      showSuccess('面试通过');

      setTimeout(function () {
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
