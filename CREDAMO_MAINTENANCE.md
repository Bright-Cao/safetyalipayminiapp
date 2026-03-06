# Credamo 日常维护手册

> 适用人员：安全科管理员  
> 更新频率：**每天一次**（Cookie 有效期约 10 小时）

---

## 📅 每日标准流程（约 2 分钟）

### 第一步：获取新 Cookie

1. 用电脑浏览器打开 [Credamo 网站](https://www.credamo.com)
2. 用账号 **CML** 登录（如已登录则跳过）
3. 按 **F12** 打开开发者工具 → 选择 **Console**（控制台）标签
4. 输入以下命令并回车：
   ```javascript
   document.cookie
   ```
5. 复制输出的整段字符串（很长，包含多个 Cookie）

---

### 第二步：更新云函数 Cookie

1. 打开**微信云开发控制台** → 云函数 → `syncCredamo` → **测试**

2. 将以下 JSON 粘贴到测试输入框，**替换对应值**：

```json
{
  "action": "saveCookie",
  "session": "从Cookie中提取",
  "dm_dfh": "从Cookie中提取",
  "user_info": "从Cookie中提取"
}
```

**提取方法**：从 `document.cookie` 的输出中找到以下字段：

| 字段 | Cookie 中的 Key | 备注 |
|------|-----------------|------|
| `dm_dfh` | `dm_dfh=xxxxxx` | 取等号后的值 |
| `user_info` | `predamo-dms-user-info=xxxxxx` | 取等号后的整段（很长） |
| `session` | 在 `user_info` 中找 `sid%3D` 后的值，将 `%253D` 替换为 `%3D` | |

**快速提取 session 的方法**：
```javascript
// 在 Console 中运行：
document.cookie.match(/sid%3D([^%]+%(?:25)?3D)/)?.[1]?.replace('%253D', '%3D')
```

3. 点**调用**，预期结果：
```json
{"success": true, "message": "Cookie 已保存，于 2026-XX-XX HH:MM UTC 过期"}
```

---

### 第三步：验证 Cookie 有效性

打开小程序管理员首页 → 点击 **「Cookie」** 按钮（🔑 图标）

- 🟢 **Cookie 有效**，弹窗显示剩余小时数和过期时间 → 完成！
- 🔴 **Cookie 过期或失效** → 返回第一步重新获取

---

## 🔄 同步 Credamo 培训数据

> 每次有新学员完成 Credamo 培训后执行

**方式 A：管理员小程序（推荐）**
1. 管理员首页 → 点击橙色 **「同步培训」** 按钮（🔄 图标）
2. 点「开始同步」，等待约 90 秒
3. 显示「✅ 同步完成！共保存 XXX 条」即完成

**方式 B：云函数测试台（手动分页）**
```json
{ "action": "sync", "page": 1, "pageSize": 100 }
{ "action": "sync", "page": 2, "pageSize": 100 }
...（共 9 页）
```

---

## 🆘 常见问题

### Q1：Cookie 按钮显示红色「Cookie✗」怎么办？
**A：** Cookie 已过期，按「每日标准流程」重新获取更新即可。

### Q2：「同步培训」报错「Cookie 已过期，请重新登录」
**A：** 先完成第一步和第二步更新 Cookie，再触发同步。

### Q3：用户刷新状态显示「未查到完成记录」但确实完成了
**A：** 
1. 先执行「同步培训」让数据入库
2. 通知用户再次点击「刷新 Credamo 学习状态」
3. 如仍不显示，在云函数测试台运行：
   ```json
   { "action": "checkPhone", "phone": "用户手机号" }
   ```
   确认数据库是否有该手机号的记录

### Q4：Credamo 网站显示「重新登录」怎么办？
**A：** 账号 Session 过期，重新输入用户名密码登录网站，登录后再做第一步。

### Q5：早上忘记更新 Cookie，怎么知道 Cookie 有没有过期？
**A：** 点小程序管理员页的「Cookie」按钮。弹窗会显示剩余时间；如果已过期会显示红色并提示。

---

## 📋 Cookie 参数示例

以下是 `document.cookie` 输出的示例（实际值不同每次登录都会变化）：

```
Hm_lvt_xxx=...; dm_dfh=02154af8125d9f8f5abbeb1c2e69bff5; predamo-dms-user-info=loginUserId%3D4302790%2CloginUserName%3DCML%2CloginId%3Dcdm7775028493598720%2Csid%3DAmg5IMw49upfZa35idDD7RmE9SUj3S2fzUpCmptmFUw%253D%2C...
```

对应 saveCookie 参数：
```json
{
  "action": "saveCookie",
  "session": "Amg5IMw49upfZa35idDD7RmE9SUj3S2fzUpCmptmFUw%3D",
  "dm_dfh": "02154af8125d9f8f5abbeb1c2e69bff5",
  "user_info": "loginUserId%3D4302790%2CloginUserName%3DCML%2C..."
}
```

> **注意**：`session` 的值是从 `user_info` 中 `sid%3D` 后提取的，并将 `%253D` 替换为 `%3D`

---

## ⏰ 建议时间安排

| 时间 | 操作 |
|------|------|
| 每天上班后（8:00-9:00）| 更新 Cookie，点「Cookie」验证 |
| 有新学员完成培训时 | 点「同步培训」 |
| 每周一次 | 检查 `credamo_completions` 数据量是否正常增长 |

---

*文档版本：2026-02-28*
