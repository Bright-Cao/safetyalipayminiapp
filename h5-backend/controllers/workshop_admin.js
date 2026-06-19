const { Application, User } = require('../models');

// 获取当前车间的待审批申请列表
exports.getWorkshopApplications = async (req, res) => {
  const caller = req.user;
  if (!caller) return res.json({ success: false, message: '未授权访问' });

  try {
    const user = await User.findById(caller.dbId).lean();
    if (!user) return res.json({ success: false, message: '当前用户不存在' });

    if (!['workshop_leader', 'safety_admin', 'super_admin'].includes(user.role)) {
      return res.json({ success: false, message: '无权限访问' });
    }

    // 车间领导只看自己车间的申请；安全科和超管能看所有
    const query = { status: 'pending_workshop_interview' };
    if (user.role === 'workshop_leader' && user.workshop_name) {
      query.workshop = user.workshop_name;
    }

    const applications = await Application.find(query).sort({ update_time: -1 }).lean();
    return res.json({ success: true, data: applications });
  } catch (error) {
    console.error('获取车间申请失败:', error);
    return res.json({ success: false, message: '获取失败: ' + error.message });
  }
};

// 车间领导面试打分并放行
exports.approveWorkshopInterview = async (req, res) => {
  const caller = req.user;
  if (!caller) return res.json({ success: false, message: '未授权访问' });

  const { applicationId, interviewScore, interviewNotes, passed } = req.body;

  try {
    const user = await User.findById(caller.dbId).lean();
    if (!user || !['workshop_leader', 'safety_admin', 'super_admin'].includes(user.role)) {
      return res.json({ success: false, message: '权限不足' });
    }

    const app = await Application.findById(applicationId);
    if (!app) return res.json({ success: false, message: '申请记录不存在' });

    if (passed) {
      // ── 快速发证逻辑：监护人如果已持有其他车间有效证书，直接发证 ──
      if (app.category === 'guardian') {
        const now = new Date();
        const existingQualified = await Application.findOne({
          _openid: app._openid,
          category: 'guardian',
          status: 'qualified',
          valid_until: { $gt: now },          // 证书仍在有效期内
          _id: { $ne: app._id }               // 排除当前申请
        }).lean();

        if (existingQualified) {
          // 已有有效资质 → 免培训免考试，直接发证
          app.status     = 'qualified';
          app.fast_track = true;              // 标记快速通道，前端用于展示
          app.valid_until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          console.log(`[快速发证] ${app.name} 已持有 ${existingQualified.workshop} 有效证书，${app.workshop} 直接发证`);
        } else {
          // 无历史资质 → 正常流程：待培训
          app.status = 'pending_training';
        }
      } else {
        // 非监护人类别（班组长等）→ 待培训
        app.status = 'pending_training';
      }
    } else {
      app.status = 'rejected';
    }

    app.interview_score = interviewScore;
    app.interview_notes = interviewNotes;
    app.update_time = new Date();
    await app.save();

    const msg = app.fast_track ? '面试通过，已直接发证（快速通道）' : '面试结果已保存';
    return res.json({ success: true, message: msg, fast_track: !!app.fast_track });
  } catch (error) {
    console.error('保存面试结果失败:', error);
    return res.json({ success: false, message: '审批失败: ' + error.message });
  }
};

// 安全科/超管：获取所有进行中的申请（含卡住的流程）
exports.getAllInProgress = async (req, res) => {
  const caller = req.user;
  if (!caller) return res.json({ success: false, message: '未授权访问' });
  try {
    const user = await User.findById(caller.dbId).lean();
    if (!user || !['safety_admin', 'super_admin'].includes(user.role)) {
      return res.json({ success: false, message: '权限不足，仅安全科可用' });
    }
    const apps = await Application.find({
      status: { $in: ['pending_workshop_interview', 'pending_admin_interview', 'pending_training', 'training_completed'] }
    }).sort({ update_time: -1 }).lean();
    return res.json({ success: true, data: apps });
  } catch (err) {
    return res.json({ success: false, message: '查询失败: ' + err.message });
  }
};

// 安全科/超管：强制关闭某个申请流程
exports.closeApplication = async (req, res) => {
  const caller = req.user;
  if (!caller) return res.json({ success: false, message: '未授权访问' });
  const { applicationId, reason } = req.body;
  if (!applicationId) return res.json({ success: false, message: '缺少 applicationId' });
  try {
    const user = await User.findById(caller.dbId).lean();
    if (!user || !['safety_admin', 'super_admin'].includes(user.role)) {
      return res.json({ success: false, message: '权限不足，仅安全科可用' });
    }
    const app = await Application.findById(applicationId);
    if (!app) return res.json({ success: false, message: '申请记录不存在' });

    app.status       = 'closed';
    app.close_reason = reason || '安全科手动关闭流程';
    app.close_time   = new Date();
    app.update_time  = new Date();
    await app.save();
    console.log(`[关闭流程] ${app.name} 的 ${app.workshop} 申请已关闭，操作人: ${user.name}，原因: ${app.close_reason}`);
    return res.json({ success: true, message: '流程已关闭' });
  } catch (err) {
    return res.json({ success: false, message: '关闭失败: ' + err.message });
  }
};
