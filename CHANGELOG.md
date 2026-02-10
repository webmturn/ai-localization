# 更新日志

本项目所有版本的变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

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
