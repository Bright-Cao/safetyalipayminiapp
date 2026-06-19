const { User } = require('../models');

// 获取所有用户列表 (仅 super_admin / safety_admin 可用)
exports.getAllUsers = async (req, res) => {
  try {
    const caller = req.user;
    if (!caller) return res.status(401).json({ success: false, message: '未登录' });

    const callerUser = await User.findById(caller.dbId).lean();
    if (!callerUser || !['super_admin', 'safety_admin'].includes(callerUser.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    const users = await User.find({}, {
      phone: 1, name: 1, role: 1, workshop_id: 1, workshop_name: 1, status: 1, createTime: 1
    }).sort({ createTime: -1 });

    res.json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '服务器异常' });
  }
};

// 更新用户角色与车间 (仅 super_admin 可用)
exports.updateUserRole = async (req, res) => {
  try {
    const caller = req.user;
    if (!['super_admin'].includes(caller.role)) {
      return res.status(403).json({ success: false, message: '权限不足：仅超级管理员可分配角色' });
    }

    const { userId, role, workshop_name } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const validRoles = ['user', 'workshop_leader', 'safety_admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色类型' });
    }

    const updateData = { role };
    if (workshop_name !== undefined) updateData.workshop_name = workshop_name;

    await User.findByIdAndUpdate(userId, { $set: updateData });
    res.json({ success: true, message: '角色更新成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '服务器异常' });
  }
};

// ── 新增人员账号 (仅 super_admin 可用) ──────────────────────────
exports.createUser = async (req, res) => {
  try {
    const caller = req.user;
    if (!['super_admin'].includes(caller.role)) {
      return res.status(403).json({ success: false, message: '权限不足：仅超级管理员可新增人员' });
    }

    const { phone, name, role, workshop_name } = req.body;
    if (!phone || !name || !role) {
      return res.status(400).json({ success: false, message: '手机号、姓名、角色均为必填项' });
    }
    if (!/^1\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: '手机号格式不正确' });
    }

    const validRoles = ['user', 'workshop_leader', 'safety_admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: '无效的角色类型' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: `手机号 ${phone} 已存在，可直接在列表中修改角色` });
    }

    const newUser = new User({
      phone,
      name,
      role,
      workshop_name: workshop_name || '',
      status: 'active',
      createTime: new Date(),
      lastLoginTime: new Date()
    });
    await newUser.save();

    res.json({ success: true, message: `账号「${name}」创建成功，对方用该手机号即可登录`, data: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '服务器异常' });
  }
};

// ── 删除用户账号 (仅 super_admin 可用) ──────────────────────────
exports.deleteUser = async (req, res) => {
  try {
    const caller = req.user;
    if (!['super_admin'].includes(caller.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: '缺少 userId' });

    if (caller.dbId === userId || caller.userId === userId) {
      return res.status(400).json({ success: false, message: '不能删除自己的账号' });
    }

    await User.findByIdAndDelete(userId);
    res.json({ success: true, message: '账号已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: '服务器异常' });
  }
};
