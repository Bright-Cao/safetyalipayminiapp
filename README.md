# 铁前总厂监护人培训与考核平台

## 项目简介

本项目是一个完整的微信小程序，用于管理和执行监护人认证流程，包括申请、面试、培训、考试等全流程管理。培训环节通过第三方平台 **Credamo** 完成线上学习，其余均在本小程序内进行。

---

## 系统状态流转

```
用户提交申请 (pending)
    ↓
车间领导面试评分
    ↓ 通过              ↓ 未通过 → interview_failed（终止）
interview_passed
    ↓
Credamo 线上培训 (training → training_completed)
    ↓
在线考试
    ↓ 通过              ↓ 未通过 → exam_failed（可重考）
exam_passed
    ↓
安全科确认
    ↓
qualified（已达标）
```

---

## 主要功能

### 1. 用户认证系统
- 手机号+验证码登录
- 多角色支持：申请人、车间领导、安全科管理员、检查人员

### 2. 监护人申请管理
- 在线填写申请表（姓名、年龄、厂龄、手机号、车间等）
- 上传身份证和相关证书
- 申请状态实时跟踪

### 3. 车间面试评分
- 结构化面试评分表（总分100分）
- 安全意识、专业知识、沟通能力等多维度评估

### 4. Credamo 线上培训（外部平台）
- 用户扫描小程序码进入 Credamo 完成培训和测试
- 完成后回到本小程序点击「刷新学习状态」即可确认
- 自助查询：先查本地缓存（~100ms），未命中时从 Credamo 拉最新数据
- 3分钟冷却防止频繁请求
- 完成后自动更新申请状态为 `training_completed`

### 5. 在线考试系统
- 随机抽题组卷（单选、多选、判断）
- 60分钟考试时间，自动计时和评分
- 最多3次考试机会，80分及格

### 6. 资质查询功能
- 输入姓名或身份证号查询（支持模糊搜索历史）
- 显示完整证书信息（年龄、厂龄、车间、成绩、有效期）

### 7. 后台管理系统（安全科专用）
- 数据统计看板
- 申请审核管理
- **🔄 Credamo 一键全量同步**（进度条显示，~90秒完成）
- **🔑 Cookie 有效性检测**（显示剩余小时数和过期时间）
- 题库管理（批量导入、考试规则配置）
- 数据导出功能

---

## 技术架构

- **前端框架**: 微信小程序原生开发
- **后端服务**: 微信云开发
- **数据库**: 云数据库（MongoDB）
- **云存储**: 云存储（图片）
- **外部培训**: Credamo（Cookie 认证，Data API）

---

## 数据库集合

### 1. users（用户表）
```javascript
{
  _id, _openid, phone, name, role,
  workshop_id, workshop_name,
  create_time, update_time
}
```

### 2. applications（申请表）
```javascript
{
  _id, applicant_openid,
  name, gender, age, idCard, phone,
  company, workshop, workshop_id, workYears,
  education, major, specialCert, safetyCert,
  applicantType,           // 'internal' | 'contractor'
  isTeamLeader,            // 'yes' | 'no'
  status,                  // 见状态流转图
  interview_score, exam_score,
  training_complete_time,
  id_card_images, other_images,
  create_time, update_time
}
```

### 3. credamo_completions（Credamo 完成记录）⭐ 新增
```javascript
{
  _id, phone, name, company, workshop,
  score,               // Credamo 测试得分
  watch_video,         // 是否观看视频
  answer_id,           // Credamo 答卷ID
  finish_time,         // 答题完成时间
  survey_id,           // Credamo 问卷ID（固定）
  sync_time,           // 最近一次同步时间
  create_time, update_time
}
```

### 4. system_config（系统配置）⭐ 新增
```javascript
{
  _id, key: 'credamo_cookie',
  session,             // Credamo session token
  dm_dfh,              // Credamo 鉴权参数
  user_info,           // Credamo 用户信息
  expiry_time,         // Cookie 过期时间（存入时 +10小时）
  update_time
}
```

### 5. training_records（培训记录）
```javascript
{
  _id, application_id,
  credamo_completed,   // Credamo 是否完成
  credamo_score,       // Credamo 得分
  credamo_watch_video, // 是否观看视频
  credamo_sync_time,   // 同步时间
  status, update_time
}
```

### 6. exam_questions（考试题库）
```javascript
{
  _id, type, question, options,
  correct_answer, score, difficulty, status
}
```

### 7. exam_records（考试记录）
```javascript
{
  _id, application_id, _openid,
  answers, total_score, passed, exam_time
}
```

### 8. exam_settings（考试配置）
```javascript
{
  _id: "global_config",
  passing_score,
  single: { count, score },
  multiple: { count, score },
  judge: { count, score }
}
```

---

## 云函数列表

| 云函数 | 功能 | 说明 |
|--------|------|------|
| `login` | 用户登录 | 手机号+验证码 |
| `sendSMS` | 发送短信验证码 | |
| `syncCredamo` | Credamo 数据同步 | 见下方说明 |
| `checkGuardian` | 查询监护人资质 | 按姓名/身份证查询 |
| `checkGuardianByQR` | 扫码查询 | |
| `getStatistics` | 统计数据 | |
| `getExamQuestions` | 获取考试题目 | |
| `submitExam` | 提交考试答案 | 自动评分 |
| `importExamQuestions` | 批量导入题目 | |
| `exportData` | 导出数据 | |
| `manageQuestions` | 题库管理 | |

### syncCredamo 支持的 action

| action | 说明 | 需要 Cookie |
|--------|------|-------------|
| `saveCookie` | 保存 Credamo Cookie | 否 |
| `test` | 验证 Cookie 有效性，返回过期时间 | 是 |
| `sync` | 分页同步数据（page/pageSize 参数）| 是 |
| `checkPhone` | 按手机号查本地 completions | 否 |
| `selfCheck` | 用户自助查询（先本地后远程）| 是 |

---

## 部署说明

### 1. 环境准备
- 微信开发者工具（最新版）
- 微信小程序账号（已开通云开发）

### 2. 配置项目
1. 修改 `project.config.json` 中的 `appid`
2. 在微信开发者工具中打开项目，开通云开发

### 3. 部署云函数
右键点击 `cloudfunctions` 目录下的各个云函数 → **上传并部署：云端安装依赖**

### 4. 初始化数据库集合
手动在云开发控制台创建：
- `applications`
- `credamo_completions`（新）
- `system_config`（新）
- `exam_questions`
- `exam_records`
- `exam_settings`
- `training_records`

### 5. 初始化 Credamo Cookie
参见 `CREDAMO_MAINTENANCE.md`

---

## 使用指南

### 申请人流程
1. 登录小程序，填写申请表
2. 等待车间领导面试
3. 面试通过后，进入「培训」页面
4. 微信扫描 Credamo 小程序码完成线上培训
5. 返回小程序点击「刷新学习状态」确认完成
6. 完成后点击「前往考试」
7. 考试通过后获得认证资质

### 车间领导流程
1. 登录管理后台
2. 查看「待办事项 - 待面试申请」
3. 进行面试评分并提交

### 安全科流程
1. 每天登录 Credamo 网站更新 Cookie（见维护手册）
2. 管理员首页点「Cookie」检测有效性
3. 定期点「同步培训」同步最新完成数据
4. 管理考试题库、查看数据统计、导出报表

### 检查人员流程
1. 输入姓名或身份证号查询
2. 查看监护人资质状态（已达标/未达标）

---

## 注意事项

1. **Credamo Cookie 每日需更新**（10小时有效期），参见 `CREDAMO_MAINTENANCE.md`
2. 定期备份数据库
3. 身份证号等敏感信息已脱敏显示（前6后4）
4. 考试题库需定期更新维护

---

## 文档索引

| 文档 | 内容 |
|------|------|
| `README.md` | 系统概览（本文件）|
| `WORKSHOP_GUIDE.md` | 车间管理功能说明 |
| `CREDAMO_MAINTENANCE.md` | Credamo 日常维护手册 |
| `DATABASE_SETUP.md` | 数据库初始化说明 |
# safetyalipayminiapp
