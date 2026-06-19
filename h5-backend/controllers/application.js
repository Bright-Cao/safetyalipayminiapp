const { Application, User } = require('../models');

exports.getMyApplications = async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) return res.json({ success: false, message: '未授权访问' });

  try {
    const applications = await Application.find({ _openid: userId }).sort({ create_time: -1 }).lean();
    return res.json({ success: true, data: applications });
  } catch (error) {
    console.error('获取申请记录失败:', error);
    return res.json({ success: false, message: '获取失败: ' + error.message });
  }
};

exports.submitApplication = async (req, res) => {
  const userId = req.user && req.user.userId;
  if (!userId) return res.json({ success: false, message: '未授权访问' });

  const appData = req.body;

  // Decide routing based on category
  let defaultStatus = 'pending_workshop_interview';
  if (appData.category === 'safety_principal' || appData.category === 'safety_officer') {
    defaultStatus = 'pending_admin_interview';
  }

  try {
    // ── 服务端校验：同一车间不能重复申请（有效证书或申请进行中） ──
    if (appData.workshop) {
      const ACTIVE_STATUSES = [
        'pending_workshop_interview',
        'pending_admin_interview',
        'pending_training',
        'training_completed',
        'qualified',
      ];
      const existing = await Application.findOne({
        _openid: userId,
        workshop: appData.workshop,
        status: { $in: ACTIVE_STATUSES },
      }).lean();

      if (existing) {
        if (existing.status === 'qualified') {
          // 如果已持证但证书已过期，允许重新申请
          const validUntil = existing.valid_until ? new Date(existing.valid_until) : null;
          if (!validUntil || validUntil > new Date()) {
            return res.json({ success: false, message: `您在"${appData.workshop}"已持有效证书，无需重复申请。如证书已过期请联系安全科处理。` });
          }
        } else {
          return res.json({ success: false, message: `您在"${appData.workshop}"已有进行中的申请（${existing.status}），请等待审批完成后再申请。` });
        }
      }
    }

    const newApplication = new Application({
      ...appData,
      _openid: userId,
      status: defaultStatus,
      create_time: new Date(),
      update_time: new Date()
    });

    const savedApp = await newApplication.save();

    // 把真实姓名同步回 User 表，确保与手机号永久绑定
    if (appData.name) {
      await User.findOneAndUpdate(
        { _openid: userId },
        { name: appData.name },
        { new: true }
      );
    }

    return res.json({ success: true, data: savedApp });

  } catch (error) {
    console.error('提交申请失败:', error);
    return res.json({ success: false, message: '提交失败: ' + error.message });
  }
};

exports.getAllApplications = async (req, res) => {
  // admin only logic usually
  const { workshop } = req.body;
  try {
    const query = {};
    if (workshop) query.workshop = workshop;

    const applications = await Application.find(query).sort({ create_time: -1 }).limit(100).lean();
    return res.json({ success: true, data: applications });
  } catch (error) {
    return res.json({ success: false, message: '获取失败: ' + error.message });
  }
};
