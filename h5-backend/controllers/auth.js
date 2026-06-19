const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

exports.login = async (req, res) => {
  const { phoneNumber, loginMode } = req.body;
  const ADMIN_ROLES = ['workshop_leader', 'safety_admin', 'super_admin'];

  try {
    if (!phoneNumber || phoneNumber.length < 11) {
      return res.json({ success: false, message: '请输入正确的11位手机号' });
    }

    let user = await User.findOne({ phone: phoneNumber });

    if (user) {
      // 账号存在：正常登录
      if (user.status !== 'active') {
        return res.json({ success: false, message: '账号已被锁定，请联系安全科' });
      }
      // 管理入口：验证是否有管理权限
      if (loginMode === 'admin' && !ADMIN_ROLES.includes(user.role)) {
        return res.json({ success: false, message: '您没有管理权限，请走申请人入口，或联系安全科开通管理账号' });
      }
      user.lastLoginTime = new Date();
      await user.save();
    } else {
      // 新手机号：管理入口不允许自动注册
      if (loginMode === 'admin') {
        return res.json({ success: false, message: '该手机号未绑定管理账号，请联系安全科开通权限' });
      }
      // 申请人入口：自动注册
      const userId = 'uid_' + Date.now();
      user = new User({
        _openid: userId,
        phone: phoneNumber,
        role: 'user',
        name: '用户' + phoneNumber.slice(-4),
        status: 'active',
        createTime: new Date(),
        lastLoginTime: new Date()
      });
      await user.save();
    }

    // 角色从数据库读取，不信任前端传入的 role 参数（安全加固）
    const token = jwt.sign(
      {
        userId: user._openid,
        dbId: user._id.toString(),
        phone: user.phone,
        role: user.role,
        workshop_name: user.workshop_name || ''
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      data: {
        userInfo: {
          _id: user._id,
          phone: user.phone,
          name: user.name,
          role: user.role,
          workshop_name: user.workshop_name,
          status: user.status
        },
        token
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return res.json({ success: false, message: '系统异常: ' + error.message });
  }
};
