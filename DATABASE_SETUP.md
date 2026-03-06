# 数据库配置指南

## 📋 快速配置步骤

### 第一步：开通云开发

1. 在微信开发者工具顶部，点击「**云开发**」按钮
2. 首次使用需要开通（选择免费版即可）
3. 创建云环境，环境名称如：`guardian-prod`
4. 等待环境初始化完成（约1-2分钟）

---

### 第二步：创建数据库集合

点击「**数据库**」标签，然后点击「**+**」号，创建以下11个集合：

#### 必须创建的集合清单：

| 序号 | 集合名称 | 说明 |
|-----|---------|------|
| 1 | `applications` | 申请表 - 存储监护人认证申请信息 |
| 2 | `users` | 用户表 - 存储用户基本信息和角色 |
| 3 | `interviews` | 面试记录 - 存储车间面试评分记录 |
| 4 | `training_videos` | 培训视频 - 存储培训视频信息 |
| 5 | `training_records` | 培训记录 - 记录用户观看视频的详细数据 |
| 6 | `practice_questions` | 练习题 - 培训视频的随堂练习题 |
| 7 | `exam_questions` | 考试题库 - 正式考试的题目库 |
| 8 | `exam_records` | 考试记录 - 用户考试的答题记录和成绩 |
| 9 | `notices` | 通知公告 - 系统通知和公告信息 |
| 10 | `sms_codes` | 验证码记录 - 登录验证码记录（可选） |
| 11 | `activities` | 活动记录 - 用户操作日志（可选） |

**创建方法：**
- 点击数据库面板的「**+**」按钮
- 输入集合名称（如：`applications`）
- 点击「确定」

---

### 第三步：配置权限（测试环境）

**⚠️ 仅在测试阶段使用，正式环境需要更严格的权限控制**

对每个集合执行以下操作：
1. 点击集合名称进入详情
2. 点击「**权限设置**」标签
3. 选择「**所有用户可读写**」
4. 点击「保存」

---

### 第四步：部署云函数

在开发者工具左侧文件树中，展开 `cloudfunctions` 文件夹：

#### 核心云函数（必须部署）：

| 云函数名称 | 说明 |
|-----------|------|
| `login` | 用户登录认证 |
| `sendSMS` | 发送短信验证码 |
| `updateVideoProgress` | 更新视频学习进度 |
| `getExamQuestions` | 获取考试题目 |
| `submitExam` | 提交考试答案 |
| `checkGuardian` | 查询监护人资质 |
| `getStatistics` | 获取统计数据 |

#### 辅助云函数（可选）：

| 云函数名称 | 说明 |
|-----------|------|
| `initDatabase` | 数据库初始化脚本 |
| `seedTestData` | 添加测试数据 |

**部署方法：**
1. 右键点击云函数文件夹（如 `login`）
2. 选择「**上传并部署：云端安装依赖**」
3. 等待部署完成（看到绿色的"✓"）

---

### 第五步：添加测试数据

#### 方法1：使用云函数添加（推荐）

1. 先部署 `seedTestData` 云函数
2. 在云开发控制台，点击「云函数」
3. 找到 `seedTestData`，点击「测试」
4. 点击「运行测试」
5. 查看运行结果，确认数据添加成功

#### 方法2：手动添加

在数据库控制台手动添加记录：

**添加通知公告（notices）：**
```json
{
  "title": "欢迎使用监护人培训与考核平台",
  "content": "本平台致力于提升监护人员的专业能力和安全意识。",
  "type": "info",
  "status": "active",
  "createTime": "2026-01-05T00:00:00.000Z"
}
```

**添加培训视频（training_videos）：**
```json
{
  "title": "监护人基础知识培训",
  "description": "介绍监护人的基本职责、安全要求和操作规范",
  "cover": "cloud://placeholder.png",
  "url": "cloud://placeholder.mp4",
  "duration": 600,
  "min_watch_time": 540,
  "sequence": 1,
  "status": "active"
}
```

**添加考试题目（exam_questions）：**

单选题示例：
```json
{
  "type": "single",
  "question": "监护人在作业现场的首要任务是？",
  "options": ["A. 技术指导", "B. 安全监护", "C. 质量检查", "D. 进度管理"],
  "correct_answer": "B",
  "score": 2,
  "difficulty": "easy",
  "category": "基础知识",
  "status": "active"
}
```

多选题示例：
```json
{
  "type": "multiple",
  "question": "监护人应具备的基本素质包括（多选）",
  "options": ["A. 责任心强", "B. 熟悉安全规程", "C. 善于沟通", "D. 技术精湛"],
  "correct_answer": "ABC",
  "score": 3,
  "difficulty": "medium",
  "category": "基础知识",
  "status": "active"
}
```

判断题示例：
```json
{
  "type": "judge",
  "question": "监护人可以在监护过程中临时离开现场处理其他事务。",
  "correct_answer": false,
  "score": 1,
  "difficulty": "easy",
  "category": "安全规范",
  "status": "active"
}
```

---

### 第六步：配置环境ID

在 `miniprogram/app.js` 中配置云环境ID：

```javascript
wx.cloud.init({
  env: 'your-env-id', // 替换为您的云环境ID
  traceUser: true
});
```

**如何获取环境ID：**
1. 云开发控制台
2. 点击「设置」
3. 复制「环境ID」

---

## ✅ 验证配置

### 1. 检查数据库集合

在云开发控制台 → 数据库，确认所有11个集合都已创建。

### 2. 检查云函数

在云开发控制台 → 云函数，确认所有云函数都已部署成功（有绿色勾号）。

### 3. 测试小程序

1. 点击开发者工具的「编译」按钮
2. 小程序应该正常启动，不再报错
3. 尝试登录和访问各个功能

---

## 🔧 常见问题

### 问题1：数据库集合不存在
**现象：** `database collection not exists`
**解决：** 确认已在云开发控制台创建所有集合

### 问题2：权限不足
**现象：** `permission denied`
**解决：** 检查数据库权限设置，测试环境设为"所有用户可读写"

### 问题3：云函数调用失败
**现象：** `cloud function not found`
**解决：** 确认云函数已部署，检查函数名称是否正确

### 问题4：环境ID未配置
**现象：** 云开发功能无法使用
**解决：** 在 `app.js` 中配置正确的环境ID

---

## 📊 数据库索引优化（可选）

为了提升查询性能，可以为以下字段创建索引：

**applications 集合：**
- `user_id` (升序)
- `status` (升序)
- `createTime` (降序)

**exam_records 集合：**
- `user_id` (升序)
- `application_id` (升序)
- `score` (降序)

**training_records 集合：**
- `user_id` (升序)
- `video_id` (升序)
- `is_completed` (升序)

---

## 🚀 下一步

配置完成后，您可以：

1. ✅ 测试完整的注册流程
2. ✅ 上传真实的培训视频到云存储
3. ✅ 添加完整的考试题库
4. ✅ 配置生产环境的权限规则
5. ✅ 对接真实的短信服务

---

## 📝 注意事项

1. **测试环境 vs 生产环境**
   - 测试环境：权限可以宽松
   - 生产环境：必须配置严格的权限规则

2. **数据备份**
   - 定期导出重要数据
   - 云开发控制台 → 数据库 → 导出

3. **安全性**
   - 不要在代码中硬编码敏感信息
   - 使用云函数处理敏感操作
   - 配置合理的数据库权限

4. **性能优化**
   - 为常用查询字段建立索引
   - 控制单次查询的数据量
   - 使用分页查询

---

如有问题，请参考微信云开发官方文档：
https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html
