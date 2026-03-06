// 云函数：用户手机号登录（支付宝云函数）
exports.main = async (event, context) => {
  const { phoneNumber, role, workshop_id, workshop_name } = event;

  // 支付宝云函数 context 里的用户唯一标识
  const userId = (context.identity && context.identity.userId)
    || (context.user && context.user.userId)
    || ('uid_' + Date.now());

  // 获取数据库引用（支付宝云函数全局 cloud 对象）
  let db;
  try {
    db = cloud.database();
  } catch (e) {
    // 云函数本地调试模式：cloud 未初始化，返回模拟数据供前端流程测试
    console.log('[开发模式] cloud 未初始化，返回 mock 数据');
    return {
      success: true,
      data: {
        userInfo: {
          phone: phoneNumber,
          role: role,
          name: phoneNumber ? ('用户' + phoneNumber.slice(-4)) : '测试用户',
          workshop_id: workshop_id || '',
          workshop_name: workshop_name || '',
          status: 'active'
        },
        openid: userId
      }
    };
  }

  try {
    if (!phoneNumber || phoneNumber.length < 11) {
      return { success: false, message: '请输入正确的手机号' };
    }

    const usersCollection = db.collection('users');
    const userRes = await usersCollection.where({ phone: phoneNumber }).get();

    let userInfo;

    if (userRes.data.length > 0) {
      userInfo = userRes.data[0];

      if (userInfo.status !== 'active') {
        return { success: false, message: '账号已被锁定，请联系安全科' };
      }

      // 角色切换逻辑
      if (userInfo.role !== role) {
        if (role === 'applicant' || userInfo.role === 'safety_admin') {
          userInfo.role = role;
          if (workshop_id || workshop_name) {
            userInfo.workshop_id = workshop_id;
            userInfo.workshop_name = workshop_name;
          }
        } else {
          return { success: false, message: '权限不足，无法以该身份登录' };
        }
      }

      await usersCollection.doc(userInfo._id).update({
        data: { _openid: userId, lastLoginTime: new Date() }
      });

    } else {
      // 仅申请人可自助注册
      if (role !== 'applicant') {
        return { success: false, message: '该手机号未授权，请联系安全科添加账号' };
      }

      const userData = {
        _openid: userId,
        phone: phoneNumber,
        role: 'applicant',
        name: '用户' + phoneNumber.slice(-4),
        status: 'active',
        workshop_id: workshop_id || '',
        workshop_name: workshop_name || '',
        createTime: new Date(),
        lastLoginTime: new Date()
      };

      const addRes = await usersCollection.add({ data: userData });
      const newUser = await usersCollection.doc(addRes._id).get();
      userInfo = newUser.data;
    }

    return {
      success: true,
      data: { userInfo, openid: userId }
    };
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, message: '系统异常: ' + error.message };
  }
};
