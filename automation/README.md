# 沙钢每日一练自动化

这个目录用于每天打开 `http://qypt.shasteel.cn/mobile-apps/`，定位“每日一练”，并完成答题。

## 首次配置

1. 安装依赖：

   ```bash
   cd /Users/cml/Documents/20260105153022_migrant_1772376920121/automation
   npm install
   npx playwright install chromium
   ```

2. 创建本机密钥文件：

   ```bash
   cp .daily-practice.env.example .daily-practice.env
   ```

3. 编辑 `.daily-practice.env`，填入：

   ```bash
   SHASTEEL_USERNAME=你的工号
   SHASTEEL_PASSWORD=你的密码
   ```

`.daily-practice.env` 已被当前目录的 `.gitignore` 忽略，不会被这个仓库提交。

## 手动运行

首次建议打开可视化浏览器：

```bash
cd /Users/cml/Documents/20260105153022_migrant_1772376920121/automation
HEADLESS=false ./run_daily_practice.sh
```

如果页面结构变动导致脚本失败，会在 `screenshots/` 下保存截图和页面文本，方便调整选择器。

日常运行：

```bash
cd /Users/cml/Documents/20260105153022_migrant_1772376920121/automation
./run_daily_practice.sh
```

## 自动运行

当前线程可以创建每天早上 8:00 的 Codex 自动化任务，任务会运行：

```bash
/Users/cml/Documents/20260105153022_migrant_1772376920121/automation/run_daily_practice.sh
```

在创建自动任务前，请先完成 `.daily-practice.env` 和 `npm install`，并至少手动跑通一次。
