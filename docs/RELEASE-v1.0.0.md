# v1.0.0 — 首次正式发布

AI 本地化翻译工具，支持多格式文件导入、多引擎 AI 翻译、术语库管理和翻译质量检查。

## ✨ 主要功能

### 多格式文件支持
XLIFF / PO / JSON / YAML / CSV / RESX / Android XML / iOS Strings / Qt TS

### AI 翻译引擎
- **DeepSeek**（推荐）— 上下文感知翻译、多轮会话记忆、Priming 样本、Key 参考
- **OpenAI** — GPT 系列模型
- **Google** — Google Translate API

### 术语库管理
自定义术语提高翻译一致性，支持导入/导出

### 翻译质量检查
雷达图 + 柱状图可视化，多维度评分（准确性、术语、标点、格式、数字）

### 项目管理
自动保存（IndexedDB + 文件夹存储双后端），数据导入/导出

### UI
暗黑模式、响应式布局、快捷键支持、批量操作

### 📱 移动端适配
- 精简顶栏 + 溢出菜单，底部工具栏快捷入口
- 侧边栏底部 Sheet 滑入，带遮罩层和滑动手势
- 紧凑翻译卡片，自适应 textarea
- 设置/质量报告/术语库/帮助等模态框全面适配移动端
- 长按多选、左右滑动开关侧边栏

---

## 📸 截图

### 主界面 — 翻译列表 + DeepSeek 引擎
![主界面](https://raw.githubusercontent.com/webmturn/ai-localization/main/docs/screenshots/01-main-interface.png)

### 翻译质量报告
![质量报告](https://raw.githubusercontent.com/webmturn/ai-localization/main/docs/screenshots/02-quality-report.png)

### 术语库管理
![术语库](https://raw.githubusercontent.com/webmturn/ai-localization/main/docs/screenshots/03-terminology.png)

### 设置 — 外观
![外观设置](https://raw.githubusercontent.com/webmturn/ai-localization/main/docs/screenshots/04-settings-appearance.png)

### 设置 — 数据管理
![数据管理](https://raw.githubusercontent.com/webmturn/ai-localization/main/docs/screenshots/05-settings-data.png)

---

## 🏗️ 架构

- DI 容器 + 命名空间管理 + 模块管理
- 统一错误处理 + loggers 分级日志
- DOM 缓存 + 性能监控
- 事件绑定管理器 + DOM 优化管理器

## 📦 安装

```bash
git clone https://github.com/webmturn/ai-localization.git
cd ai-localization
npm install
npm run build-css
```

直接用浏览器打开 `public/index.html` 即可使用。
