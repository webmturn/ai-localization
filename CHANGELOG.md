# 更新日志

本项目所有版本的变更记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

---

## [v1.3.3] — 2026-08-16

> 批量翻译性能优化：并发分块 + 限速/Token 上限上调 + 超长文本告警 + JS bundle 压缩

### 新增
- **批量翻译并发分块** (ai-engine-base.js) — AI 批量路径不再串行请求：
  - 会话记忆关闭时按引擎限速适度并发（上限 3，受 checkRateLimit 令牌桶统一节流，不会突破引擎 RPS）
  - 会话记忆开启时保持串行（跨 chunk 历史链有顺序依赖）
  - 结果严格按 items 顺序组装（并发完成顺序与 chunk 顺序解耦）
  - 自适应拆半重试与取消时的 partialOutputs 前缀语义在并发下保持不变
- **超长文本截断告警** — 单条文本超过 10000 字符将被 sanitizeForApi 截断，现会在截断前输出警告日志并弹出一次性提示（批量路径逐条检测 + 单条翻译路径检测）
- 新增 5 个并发/顺序测试用例（共 173 个全通过）
### 改进
- **UI 交互优化：应用内对话框替换原生 prompt/confirm** —
  - 新增通用确认/输入对话框组件 (app/ui/confirm-dialog.js)：深色模式、danger 红色按钮、Esc 关闭、Enter 提交、自动聚焦、焦点恢复
  - 10 处原生 prompt()/confirm() 全部替换：删除项目、重命名项目（带默认值）、导入冲突覆盖选择、新建/打开项目未保存确认、删除自定义引擎、清除示例数据、清空翻译记忆、删除术语
  - 对话框 DOM 缺失时自动降级为原生 prompt/confirm，功能不受影响
- **修复删除项目后项目复活的 bug** — 删除当前项目且无其他项目时清空本地状态并刷新 UI（此前 refreshProjectManagerList 会把已删除项目重新索引保存）
- **弹窗尺寸一致性** — 设置弹窗（8 个选项卡）与项目管理器（列表/创建/导入）切换时弹窗高度恒定，内容区内部滚动，不再跳变
- **弹窗布局微调** — 设置弹窗桌面高度 85vh → 80vh（默认内容完整可见，减少底部空白）；设置弹窗主体与导航补 min-h-0 修复 flex 溢出；项目管理器空列表状态垂直居中
- **术语库管理弹窗尺寸统一** — 术语列表 / 导入导出标签页切换时弹窗高度恒定（桌面 70vh / 移动 65vh），术语表格区随剩余空间滚动（替代固定 max-h-80）
- **修复搜索预览面板对齐** — 搜索结果显示面板移入输入框同一 relative 容器，宽度与输入框严格一致（此前面板定位在外层容器，比输入框宽 16px、右缘超出 8px）
- **翻译列表项间距优化** — 原文/译文列表项增加 px-2 内边距，选中蓝色指示条与文字间距从 4px 提升至 13px（此前紧贴），移动端保持原样
- **导出 UI 新增 YAML 格式** — 导出弹窗格式下拉加入 YAML 选项，走 exportYAML（jsyaml.dump）：嵌套对象与数组路径（menu[0]）正确重建，引号可配
- **YAML 解析器升级（js-yaml 4.1.0）**：
  - 引入 js-yaml（本地化 public/lib/js-yaml/，动态按需加载，CDN 配置同步）
  - 完整支持：多行块（`|`/`>`）、数组（含对象数组 `app.items[0].name`）、锚点/别名、多文档、引号/注释规范解析
  - js-yaml 加载失败自动降级内置简单解析器（保留原功能）
  - 导出改用 jsyaml.dump（forceQuotes 可配）
  - parse.js 解析调度改为 await 兼容同步/异步解析器
  - 实测：多行块/数组/锚点全部正确提取（旧解析器均不支持）
- **示例项目补全文件元数据** — loadSampleProject 条目增加 file 字段并重置 fileMetadata：文件树显示 sample-project.json（67% 进度 + 1 KB），替代占位 default.xml；加载示例不再沿用上一项目残留文件；无原始内容时不显示「编辑源文件」
- **品牌视觉统一（P0/P1）**：
  - 主 CTA 统一 `.btn-brand`（蓝→青渐变 + 阴影），补 `:focus-visible` 焦点环；标签页/描边按钮保持原样式
  - 顶栏暗色背景与侧栏对齐为 `dark:bg-gray-800`，避免与 body `gray-900` 融层
  - Logo 徽章、质量统计卡片色条、空状态引导按钮、术语删除图标化同步打磨
- **源文件编辑器（方案 B）** — 文件树操作菜单新增"编辑源文件"入口：
  - 弹窗内编辑导入文件的原始内容（等宽字体、Ctrl+Enter 保存、Esc 取消）
  - 保存时按格式语法校验（XML/JSON/YAML），非法内容报错不保存
  - 重新解析走 silent + skipPersist，避免导入 toast / 解析失败仍覆盖原始内容
  - 按 key/路径回填译文、状态、质量分、id、issues 与缺失 metadata；重复原文分桶匹配
  - 原文已变但仍保留旧译文时提示核对；保存期间禁用按钮防连点
  - 成功后再更新 IndexedDB 原始内容并持久化项目
- **XLIFF 命名空间前缀支持** — getElementsByTagName → getElementsByTagNameNS("*", ...)，带 `<xliff:trans-unit>` 前缀的文件可正常解析（修复前解析 0 条）
- **PO 复数导出** — 原格式导出时同时更新 msgstr[0]（主译文）与 msgstr[1]（metadata.pluralTarget 复数译文），复数语言往返不再丢译文
- **格式解析器修复（PO/iOS strings/YAML/XLIFF）**：
  - PO：`\\n` 字面序列转义顺序错误（被误转为换行）修复为单次映射替换；复数翻译 msgstr[1] 保留到 metadata.pluralTarget
  - iOS strings：新增 `\uXXXX` unicode 转义支持；空值条目不再误用 key 当原文（sourceText 留空、key 保留）
  - YAML：剥离值中的内联注释（`value # comment`）
  - XLIFF：序列化内联标记时清洗注入的 xmlns 命名空间声明，保证源文本与原文标记一致（占位符保护可正确匹配）
  - 新增 13 个格式解析测试用例
- **文件树文件级翻译进度** — 每个文件行显示已译百分比徽章（0% 灰 / 部分蓝色 / 100% 绿色），单次遍历统计避免 O(n×文件数)；翻译完成后经防抖（300ms）自动刷新文件树进度；百分比位于文件名右侧（重要信息靠内）、大小贴右缘，hover 时大小淡出让位给操作菜单、进度保持可见
- **CSV 导出公式注入防护** — escapeCSVField 对以 = + - @ 开头的字段加单引号前缀，防止 Excel/WPS 打开导出文件时执行公式（安全修复）
- **术语库防重复** — 添加术语时检查同源术语：完全重复提示无需添加，译名不同则提示改用编辑功能，避免术语库混乱
- **Prompt 模板 v2（本地化质量优化）** — 默认单条/批量模板全面升级：
  - 更专业的本地化指令：杜绝翻译腔、术语全文一致（术语库优先）、UI 文案简洁、品牌名/代码标识符保留、译文长度控制
  - 强化占位符与格式约束（%s、{0}、{{var}}、HTML 标记、换行结构），批量输出 JSON 结构/数量/顺序纪律
  - 同步更新代码内兜底提示词（ai-engine-base.js 单条+批量）
  - 真实 DeepSeek API 验证：JSON 严格、6/6 数量一致、占位符零缺失、译文自然（"Delete {0} items?" → "删除 {0} 个项目？此操作无法撤销。"）
  - 兼容性：批量后缀去重检测关键词保持不变；用户已有自定义模板不受影响
- **深色模式对比度全面审计与修复** — 用 WCAG 对比度算法扫描全部 20 个界面场景（主界面/设置 8 选项卡/项目管理器/术语库/查找替换/导出/翻译进度/质量报告/新建项目/添加术语/搜索预览），修复：
  - text-primary（#2563eb）在深色背景上对比度仅 2.84:1（顶栏标题/温度值/进度百分比/质量分数等），深色模式下统一提亮为 blue-400（~4.6:1），浅色模式不变
  - 右侧栏弱提示文字（API/外观/高级、记忆库/引擎计数徽标）dark:text-gray-500 → gray-400
  - 审计后全部场景低对比度元素为 0
- **修复深色模式下搜索预览黑字看不清** — Tailwind 的 `dark:` 变体选择器 `:is(.dark-mode *)` 不匹配 `.dark-mode` 自身（应用把 dark-mode 加在 body 上），导致继承 body 颜色的搜索结果项文字保持黑色；已为面板/结果项/文件名/序号补充显式 `dark:text-gray-100` 等文字色
- **新增项目文件删除功能** — 文件树每行新增删除按钮（桌面 hover 从右向左滑出操作菜单、移动端常显；hover 时文件大小文字淡出隐藏、操作菜单滑入其位置，VS Code 风格）：
  - 删除前应用内确认对话框（红色 danger），说明翻译项将一并移除
  - 清理链路完整：IndexedDB/localStorage 文件内容缓存（新增 idbDeleteFileContent API）→ 文件元数据 → 该文件全部翻译项 → 选中状态 → 持久化项目 → 刷新文件树/列表/计数
- **JS bundle 压缩（terser）** — 构建产物从 1.16MB 降至 579KB（-50%）：
  - build-bundle.js 新增 terser minify（ecma 2022、passes 2、保留 console），压缩失败自动回退未压缩版本
  - index.html bundle 脚本加 defer：并行下载不阻塞 HTML 解析
  - 实测（无头 Chrome）：DOMContentLoaded 256ms → 50ms（-80%）、脚本执行 26ms → 7ms（-72%）、JS 堆内存 -25%

### 改进
- **引擎限速上调**（令牌桶仍生效，429 冷却机制不变）：
  - DeepSeek rateLimitPerSecond 3 → 10（官方无严格 RPM 限制）
  - OpenAI 3 → 15（gpt-4o 系 RPM 达 10000）
  - Claude 3 → 8（各模型 RPM 通常 1000+）
  - Gemini 保持 0.25（免费层 15 RPM 约束）
- **OpenAI 输出上限上调**：单条 max_tokens 2000 → 4096；批量 8000 → 16000（gpt-4o 上限 16384）
  - DeepSeek（上限 8192）/ Claude（上限 8192）保持原值，避免请求 400

---

## [v1.3.2] — 2026-03-07

> 翻译流程增强：占位符保护 + TM 自动应用

### 新增
- **占位符保护** (`placeholder-guard.js`) — 翻译前自动检测并保护变量/占位符：
  - 支持 `{{var}}` `{name}` `%s` `%1$s` `<b>` `&amp;` `\n` 等 14 种模式
  - 翻译后自动恢复占位符，提供 `validate()` 检查一致性
  - 集成到 `translate.js` 核心翻译流程
- **TM 自动应用** (`tm-auto-apply.js`) — 翻译时自动查询翻译记忆库：
  - 精确匹配直接使用 TM 结果，跳过 API 调用（省 Token/费用）
  - 模糊匹配记录建议供参考
  - 翻译成功后自动保存新条目到 TM
  - 集成到 `batch.js` 批量翻译流程
- 新增 27 个测试用例（共 134 个全通过）
- Bundle 从 113 → 115 个脚本

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
