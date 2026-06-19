/**
 * 初始化超级管理员脚本
 * 用法：node h5-backend/scripts/init_admin.js <手机号>
 * 例如：node h5-backend/scripts/init_admin.js 18796245711
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

const phone = process.argv[2];
if (!phone) {
  console.error('❌ 请传入手机号: node init_admin.js <手机号>');
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/training_db';

mongoose.connect(mongoUri).then(async () => {
  const db = mongoose.connection.db;
  const result = await db.collection('users').updateOne(
    { phone },
    { $set: { role: 'super_admin' } },
    { upsert: false }
  );

  if (result.matchedCount === 0) {
    console.log(`⚠️  未找到手机号为 ${phone} 的用户（请先用该手机号登录系统注册后再运行本脚本）`);
  } else {
    console.log(`✅ 成功！${phone} 已被设置为 [超级管理员 super_admin]`);
    console.log('   现在用该手机号登录系统，进入 [管理后台]，即可分配其他人的角色。');
  }
  mongoose.disconnect();
}).catch(err => {
  console.error('数据库连接失败:', err.message);
  process.exit(1);
});
