# 更新日志

本项目所有版本的变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [v1.3.1] — 2026-03-03

> 翻译记忆库管理 UI + 自定义引擎配置 UI

### 新增
- **翻译记忆库管理面板** (`app/features/tm/ui.js`) — 侧边栏入口按钮，模态框内支持：
  - 统计概览（总条目数、语言对）
  - 全文搜索（实时筛选源文/译文）
  - 单条删除（hover 显示删除按钮）
  - 一键导出 TMX 文件
  - 清空全部记忆
- **自定义引擎配置面板** (`app/features/engines/custom-ui.js`) — 侧边栏入口按钮，模态框内支持：
  - 已注册引擎列表（显示端点、模型）
  - 添加/编辑/删除自定义引擎（表单验证）
  - 保存后自动同步到侧边栏引擎下拉框
  - 持久化到 localStorage，页面刷新后自动恢复
- Bundle 从 111 → 113 个脚本

---

## [v1.3.0] — 2026-03-03

> 四大新功能 + 自动化测试基础设施 + Font Awesome v6 升级

### 新增
- **翻译记忆库 (TM)** — 跨项目存储和复用已翻译条目，支持精确匹配和 Levenshtein 模糊匹配（阈值可调），IndexedDB 独立存储，TMX 标准格式导出
- **增量翻译 Diff** — 源文件变更检测，自动标记需重新翻译的条目（变更/新增/删除），快照管理，一键标记重译
- **批量翻译断点续传** — 进度持久化到 localStorage，中断后可从断点恢复，24 小时自动过期清理
- **自定义引擎接入** — 用户配置私有 LLM 端点（Ollama/vLLM/LiteLLM 等），OpenAI 兼容 API 格式，持久化到 localStorage 并自动恢复
- **自动化测试基础设施** — Vitest 4.x + jsdom，`vm.runInThisContext` 加载全局命名空间源文件，106 个单元测试全部通过
  - `tests/setup.mjs` — 测试环境设置（全局变量模拟）
  - 6 个测试文件覆盖：helpers、security-utils、parser-utils、translation-memory、translation-diff、batch-resume

### 修复
- **P2**: `project.js` 最后一处 DOM0 事件绑定 `input.onchange` 替换为 `EventManager.add`

### 改进
- Font Awesome v4.7.0 → v6.7.2 全面升级（132 处图标类名迁移，49 个不同图标，`fa-solid`/`fa-regular` 分类）
- CDN 下载工具适配 FA v6 多文件结构（`css/all.min.css` + `webfonts/`）
- CI 工作流新增测试步骤（在构建前运行，fail-fast）
- Bundle 从 107 → 111 个脚本（新增 4 个功能模块）

---

## [v1.2.2] — 2026-03-03

> 安全修复、AI 引擎优化 & 构建基础设施跨平台改造

### 修复
- **P2**: API Key 验证补全 Gemini（`AIza` 前缀 + 长度 30-100）和 Claude（`sk-ant-` 前缀 + 长度 ≥ 20）专用规则
- **P3**: 术语匹配 `text.toLowerCase()` 从循环内提到循环外，消除大术语库场景下的冗余调用
- **P3**: `getSettings()` 添加解密结果缓存（引用比较），避免批量翻译时重复执行 PBKDF2 100K 迭代解密
- **P3**: 会话历史内存估算加入 `priming` 消息内容 + ×3 UTF-8 字节系数，淘汰循环同步修正

### 新增
- `scripts/tools.mjs` — 跨平台 Node.js 项目工具（替代 `tools.ps1` 及 4 个 PS1 包装脚本）
  - 支持 `check-node` / `check-versions` / `update-config` / `update-cdn` / `all`
  - 自动处理 UTF-8 BOM 兼容
- `scripts/build-production.mjs` — 跨平台生产构建脚本（替代 `build-production.ps1`）
- `.github/workflows/ci.yml` — GitHub Actions CI 工作流（Node 18/20/22 矩阵，含构建产物验证）

### 改进
- `_AI_LANG_NAMES` 从 7 种语言扩充至 38 种（覆盖中文变体、欧洲、中东、南亚、东南亚语言），AI 提示词使用各语言原生名称
- `package.json` 所有 npm scripts 从 PowerShell 调用改为 Node.js 调用，macOS/Linux 可直接运行
- 代码规范化：43 个文件 catch 参数命名统一

---

## [v1.2.1] — 2026-02-13

> 代码质量审查 & 事件监听器规范化

### 修复
- **P1**: `settings-ai-engine.js` DOM0 事件绑定 (`.onclick`/`.onchange`) 替换为 `EventManager.add`，消除标签去重失效和内存泄漏风险
- **P1**: `ui-controller.js` 移除 `EventManager` 不可用时回退原生 `addEventListener` 的死代码分支
- **P2**: `storage-manager.js` `saveCurrentProject()` 内联 IndexedDB 错误通知逻辑（QuotaExceeded/AbortError/InvalidState/blocked）与 `StorageErrorHandler` 重复，委托给 `storageErrorHandler.handleError()`
- 其余 11×P2 + 2×P3 问题已在前序迭代修复（共 13 个修复提交）

### 改进
- 全量代码质量审查：覆盖 `public/app/` 全部 11 个子目录、~127 个文件
- 确认 27+ 处原生 `addEventListener` 均为合理使用（全局错误捕获 / DOMContentLoaded / 自管理 scroll+cleanup / AbortSignal / 开发环境专用）
- 连续 9 轮审查无新问题，代码库无剩余已知质量缺陷

---

## [v1.2.0] — 2026-02-10

> 多引擎支持 & 性能优化

### 新增
- 翻译引擎注册表 `EngineRegistry`，统一引擎配置与发现
- 新增 Gemini、Claude 翻译引擎支持
- AI 引擎基类 `AIEngineBase`，支持 `_transformRequestBody` / `_parseResponseText` 钩子
- 传统引擎基类 `TraditionalEngineBase`（Google Translate）
- JS 打包脚本 `scripts/build-bundle.js`，合并 106 个 JS 为 1 个 `app.bundle.js`
- `npm run build` 一键构建（CSS + JS Bundle）
- 引擎切换 Toast 通知（工具栏/侧边栏/设置面板）
- 批量翻译 ETA 预估（预计剩余 Xm Xs）
- 用户友好错误消息（密钥无效/配额用完）

### 修复
- 速率限制：Promise 队列串行化 + `reportRateLimit` 共享冷却机制
- Gemini `rateLimitPerSecond` 5→0.25（匹配免费层 15 RPM）
- Claude API 端点修正为原生 `/v1/messages` + `anthropic-version` 头
- 解析 `Retry-After` 头（单条+批量双路径）
- 区分 quota-exceeded（不可重试）与 rate-limit（可重试）
- 批量翻译并发数受限于引擎 `rateLimitPerSecond`
- 设置面板引擎切换后模型下拉框联动重建
- Bundle TDZ 修复：顶层 `const`/`let` 转 `var`，`safeLog` 注入

### 改进
- `index.html` 自动检测 bundle，不存在时回退到 `app.js` 开发模式
- 批量翻译 `processOne` 传递 `normalizedEngine`（保证非 null）

---

## [v1.1.0] — 2026-02-09

> 移动端体验优化 & 桌面客户端预览 | [详细发布说明](docs/RELEASE-v1.1.0.md)

### 新增
- 移动端底部工具栏（文件/翻译/全选/设置），44px 触控目标
- 侧边栏 Sheet 化（底部滑入 + 遮罩层 + 下滑手势关闭）
- 安全区域适配（底部工具栏、模态框、通知适配 iPhone X+ safe-area）
- 桌面端 UI 优化（滚动条可见、工具栏布局、分页高度、resizer 宽度等）
- 右侧面板标签页切换时自动隐藏/显示设置面板和导出按钮
- Electron 桌面客户端预览（实验性，Windows x64）

### 修复
- `service-startup-manager.js` 中 `eventListeners` 初始化类型错误（Set → Map）
- 多处 DOM 元素空引用防护（searchResultsPanel、进度条、通知组件）
- Google API Key 从 URL 参数迁移到 `X-Goog-Api-Key` 请求头
- `.sidebar-tab` 重复事件绑定移除
- 移动端分页栏与底部工具栏重叠（margin-bottom 调整）
- 移动端侧边栏遮罩层 z-index 层级修正
- 翻译列表滚动跳动（scroll anchoring）
- 通知徽章深色模式对比度
- 深色模式下"清除译文"/"清除示例"按钮文字颜色统一

### 改进
- API Key 加密存储（AES-GCM）
- Map 缓存添加大小限制和定期清理
- IndexedDB 项目操作添加 localStorage 降级方案
- 脚本懒加载优化（减少初始加载 9 个脚本）
- 日志分级控制系统（ERROR/WARN/INFO/DEBUG/VERBOSE）

---

## [v1.0.0] — 2026-01-15

> 首次正式发布 | [详细发布说明](docs/RELEASE-v1.0.0.md)

### 新增
- 多格式文件支持（XLIFF / PO / JSON / YAML / CSV / RESX / Android XML / iOS Strings / Qt TS）
- AI 翻译引擎（DeepSeek / OpenAI / Google Translate）
- DeepSeek 增强功能（上下文感知、多轮会话记忆、Priming 样本、Key 参考）
- 术语库管理（自定义术语、导入/导出）
- 翻译质量检查（雷达图 + 柱状图，多维度评分）
- 项目管理（IndexedDB + 文件夹存储双后端、自动保存）
- 暗黑模式、响应式布局、快捷键支持
- 批量翻译（分块调度、暂停/取消/重试）
- 翻译请求缓存（可配置 TTL）
- DI 容器 + 命名空间管理 + 模块管理架构
- 统一错误处理 + 分级日志系统
