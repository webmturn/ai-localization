# 项目综合分析报告（ai-localization）

> 最后更新：2026-01-31 · 仓库：[https://github.com/webmturn/ai-localization](https://github.com/webmturn/ai-localization)

## 1. 项目概览

本项目是一个“多格式本地化翻译助手”，以纯前端（原生 JavaScript + Tailwind CSS）构建，支持多文件格式的导入、翻译管理、术语库、质量检查与导出。应用直接打开 `public/index.html` 即可运行，不依赖后端服务器，所有数据保存在浏览器本地存储。

核心价值：
- 多格式文件解析与统一翻译项管理
- 支持多翻译引擎（DeepSeek/OpenAI/Google）
- 术语库与质量检查提升一致性
- 本地化存储 + 自动保存，降低数据丢失风险

## 2. 目录结构与构建流程

- `public/`：应用主体（HTML/CSS/JS），直接部署/打开即可运行。
- `public/app.js`：应用入口，负责按顺序加载分拆模块（非 ES Module，保证 file:// 可用）。
- `public/app/`：核心逻辑与功能模块。
- `src/input.css`：Tailwind CSS 源文件；`public/styles.css` 由构建生成。
- `config/`：Tailwind 配置（`tailwind.config.js`）、CDN 版本（`cdn-versions.json`）、通用术语示例（`common-terms-50.json`）等。
- `scripts/`：PowerShell 脚本（第三方库更新、Node 安装检查、应用拆分等，如 `update-cdn.ps1`、`check-node-install.ps1`、`split-app-js.ps1`）。

构建主要通过 `npm run build-css` 生成 `public/styles.css`。

## 3. 应用生命周期与启动流程

1. 用户打开 `public/index.html`。
2. `public/app.js` 顺序加载所有脚本模块，确保依赖一致性。
3. `public/app.js` 在架构初始化完成后调用 `window.__appBootstrap(bootstrapContext)`（由 `public/app/core/bootstrap.js` 暴露）。
4. `public/app/core/bootstrap.js` 在 DOMContentLoaded 后执行应用初始化：
   - 清理 DOM 缓存、注册生命周期事件。
   - 初始化事件监听器、加载设置、初始化存储后端。
   - 进行引擎/模型联动初始化。
   - 尝试恢复自动保存项目，否则加载示例项目。
   - 初始化术语库、启动自动保存。

## 4. 核心架构与模块分层

### 4.1 全局状态管理（AppState）

- `AppState` 是全局单例，包含 project/translation/terminology/ui/fileMetadata 等关键状态。
- translations 中包含分页、过滤、选中、翻译进度状态等。

**质量检查相关状态与函数：**

- **`AppState.qualityCheckResults`**（定义于 `public/app/core/state.js`，唯一数据源）
  - **用途**：存放最近一次质量检查的汇总结果，供图表、报告 UI、导出使用。
  - **结构**：`{ overallScore, translatedCount, totalCount, issues[], termMatches, lastCheckTime, scope?, fileName? }`。
  - **写入**：仅由 `public/app/features/quality/run.js` 在运行质量检查时对属性赋值/追加；`public/app/features/quality/scoring.js` 写入 `overallScore`。
  - **读取**：`public/app/features/quality/charts.js`、`public/app/features/quality/export.js`、`public/app/features/quality/ui.js` 用于绘图、导出 PDF/JSON、更新报告面板。
  - **兼容**：`public/app/core/state.js` 中设置 `window.qualityCheckResults = AppState.qualityCheckResults`，旧代码或外部脚本使用全局名时仍指向同一对象。

- **`__getQualityCheckOptions()`**（定义于 `public/app/features/quality/checks.js`）
  - **用途**：从 `localStorage.translatorSettings` 读取质量检查开关（术语、占位符、标点、长度、数字等），供检查逻辑、图表、导出、报告 UI 共用。
  - **返回**：`{ checkTerminology, checkPlaceholders, checkPunctuation, checkLength, checkNumbers }`（均为 boolean）。
  - **调用方**：`public/app/features/quality/checks.js` 内部、`public/app/features/quality/charts.js`、`public/app/features/quality/export.js`、`public/app/features/quality/ui.js`（质量模块加载后可用）。

### 4.2 核心工具层（core/）

- `public/app/core/utils.js`：防抖/节流、JSON 安全解析、动态脚本加载（懒加载 Chart.js/SheetJS/质量模块/导出模块）。
- `public/app/core/dom-cache.js`：DOM 缓存，避免重复查询，提高性能。
- `public/app/core/event-manager.js`：统一管理事件监听器，支持清理与统计，避免内存泄漏。

### 4.3 服务层（services/）与网络层（network/）

- **services/**  
  - `public/app/services/auto-save-manager.js`：自动保存与“快速保存”节流；支持保存降级策略。  
  - `public/app/services/storage/storage-manager.js`：多后端存储（IndexedDB/LocalStorage），支持项目索引、多项目管理、降级与异常提示。  
  - `public/app/services/security-utils.js`：输入清洗、API Key 校验、文件大小/XML 校验、加解密工具。  
  - `translation/`：翻译引擎与批量翻译逻辑。
- **network/**  
  - `public/app/network/network-utils.js`：封装请求超时与取消、请求大小校验，供翻译请求等调用。

### 4.4 解析器层（public/app/features/files/parse.js + public/app/parsers/）

- `public/app/features/files/parse.js` 为解析入口：根据扩展名与 XML 结构（DOMParser + root/localName/关键节点）选择并调用 `public/app/parsers/` 下对应解析器。
- **public/app/parsers/** 包含：`xliff.js`、`qt-ts.js`、`ios-strings.js`、`resx.js`、`po.js`、`json.js`、`xml-android.js`、`xml-generic.js`、`text.js` 等；XML 类文件优先按结构识别格式（android/xliff/ts/resx），失败时回退到通用 XML 或文本兜底解析。
- 解析时做 XML 安全校验、编码处理、元数据与原始内容保存。

### 4.5 功能层（features/）

#### 翻译管理
- `public/app/features/translations/render.js`：分页与列表渲染（PC/移动端合并列表），支持搜索高亮与空态处理。
- `public/app/features/translations/search.js`：搜索过滤与缓存，支持文件内搜索与分页。
- `public/app/features/translations/selection.js`：单选/多选逻辑、选中样式同步、计数器更新。
- `public/app/features/translations/actions.js`：翻译、查找替换、错误处理等；调用 translationService。

#### 文件处理
- `public/app/features/files/read.js`：编码检测 + 解码策略。
- `public/app/features/files/parse.js`：解析入口，按文件类型调用对应解析器。
- `public/app/features/files/process.js`：处理多文件导入、合并翻译项、更新 UI 和存储。

#### 项目管理
- `public/app/features/projects/manager.js`：项目创建/切换/导入/导出/删除，统一更新 AppState。

#### 导入/导出
- `public/app/features/translations/export/*`：
  - 项目导出/打开
  - 多格式翻译文件导出（XML/JSON/PO 等）
  - 术语库导入/导出（CSV/JSON/XML/Excel）

#### 质量检查
- `public/app/features/quality/*`：对翻译项进行长度、术语一致性、变量/标签匹配等检查，支持并发与进度 UI。

### 4.6 UI 层（ui/）

- `ui/file-tree.js`：文件树渲染与按文件筛选。
- `ui/settings.js`：设置加载与应用（主题、分页、翻译引擎、质量检查、文件处理等）。
- `ui/engine-model-sync.js`：引擎/模型/温度联动与持久化。
- `ui/event-listeners/*`：集中注册 UI 行为（数据与 UI、文件面板、键盘、质量、术语、翻译列表与搜索等）。
- `ui/perf/sync-heights.js`：列表高度同步，减少布局抖动。

**兼容层**：`public/app/compat/` 提供 files、perf、quality 等兼容桥接，供旧入口或按需加载使用。

## 5. 核心数据流梳理

### 5.1 文件导入流
```
用户拖拽/选择文件 -> public/app/ui/file-drop.js -> processFiles
  -> parseFileAsync -> public/app/features/files/parse.js -> parser -> items
  -> AppState.project.translationItems + fileMetadata
  -> updateFileTree/updateTranslationLists -> autoSave
```

### 5.2 翻译流
```
用户点击翻译按钮 -> public/app/features/translations/actions.js
  -> translationService.translateBatch
     -> 引擎调用（DeepSeek/OpenAI/Google）
     -> rate-limit & retry
  -> 更新翻译项状态/进度
  -> 刷新列表与计数
```

### 5.3 自动保存流
```
修改翻译项 -> autoSaveManager.markDirty
  -> 定时/快速保存 -> storageManager.saveCurrentProject
  -> IndexedDB（文件内容）+ LocalStorage 兜底
```

### 5.4 质量检查流
```
运行质量检查 -> public/app/features/quality/run.js
  -> 批量并发检查 -> public/app/features/quality/checks.js
  -> 汇总报告/更新 UI
```

## 6. 翻译引擎与外部依赖

- DeepSeek：支持批量翻译、对话上下文、JSON 输出校验。
- OpenAI：使用 Chat Completions API。
- Google Translate：使用 REST API。

所有引擎均要求 API Key，并提供格式校验和错误提示。

## 7. 本地存储与数据安全

- 项目数据优先存储在 IndexedDB，失败时降级到 localStorage。
- 原始文件内容单独存储，避免项目文件过大；当配额不足时提供降级保存策略。
- API Key 支持加密存储（AES-GCM），并提供输入清洗与 XML 体积校验。

## 8. 性能与稳定性设计

- DOM 缓存与事件管理器降低内存泄漏风险。
- 批量翻译与质量检查支持并发控制。
- 列表渲染采用 DocumentFragment，并同步高度避免布局抖动。
- 搜索结果缓存避免重复计算。

## 9. 已识别的风险与限制

1. **本地存储上限与稳定性**：大项目容易触达 IndexedDB/localStorage 配额，浏览器清理缓存、无痕模式或跨标签页升级会导致存储被清空/阻塞，可能触发保存降级或失败提示，影响数据持久化可靠性。
2. **第三方 API 依赖**：需要用户配置合法 Key；网络、代理、CORS、配额/限流（429）或模型权限变化会导致翻译失败或中断，不同引擎的计费与可用性差异也会带来成本与稳定性波动。
3. **解析边界**：解析器主要基于扩展名 + 关键字/结构特征进行判断（如 Android strings、XLIFF 等），复杂或异常文件（命名空间/实体、嵌套标签、复数规则、特殊转义、非标准编码）可能被误判为通用或兜底解析，导致翻译项遗漏、上下文缺失或还原不完整；缺少严格 schema 校验与错误恢复策略。
4. **导出还原准确性**：当缺少原始文件内容时，导出会采用通用生成或文本替换，复杂结构（嵌套节点、属性顺序、空白保留）可能无法完整还原，存在格式漂移风险。
5. **性能与内存压力**：大量翻译项时，列表渲染、搜索过滤、批量翻译/质量检查可能阻塞主线程，移动端更易出现卡顿与崩溃风险。
6. **数据结构演进风险**：项目数据版本字段较少，缺乏统一的迁移机制，未来字段扩展或格式变化可能导致旧项目兼容问题。
7. **测试体系缺失**：当前未见自动化测试或 CI，解析/导出/存储/翻译策略变更容易引入回归问题。

## 10. 建议改进方向

1. **完善测试体系**：为解析器、导出器、翻译批处理建立单元测试；补充“导入-翻译-导出”端到端冒烟测试，覆盖主流格式与异常样本。
2. **解析/导出强化（重点解决解析边界）**：
   - **结构化识别**：XML 解析前先用 DOMParser 建立结构树，基于 root/localName/namespace/关键节点识别格式，减少仅凭扩展名或字符串包含的误判。
   - **轻量 schema 校验**：为 XLIFF/RESX/TS 等建立“必需元素/属性”校验规则，校验失败时提示用户并允许切换到通用 XML 解析。
   - **可控降级策略**：解析失败时不直接降级为文本；提供“重新选择格式/通用解析”的入口，保留失败原因以便排查。
   - **结构保真导出**：保留原始结构路径与内容快照，导出前提供预览/差异比对，必要时走可逆转换策略以降低格式漂移。
3. **存储可靠性增强**：增加存储占用监控与容量预警，提供一键备份/导出；引入 schema version + migration；支持分块保存或压缩以降低配额压力。
4. **性能优化**：长列表采用虚拟滚动；搜索与渲染进一步节流；将重计算任务迁移至 Web Worker；动态调整翻译并发与批处理规模。
5. **可观测性与运维**：统一错误码与异常分类，增加可视化日志面板与导出能力；必要时支持匿名错误上报以定位问题。
6. **安全性提升**：API Key 可改为用户口令派生或系统凭据存储；提供一键清除/过期策略；导出时可选脱敏处理。
7. **可扩展性设计**：翻译引擎与文件格式采用插件化注册机制，便于新增模型或格式；配置化管理引擎参数与模型列表。
8. **用户体验完善**：
   - **翻译任务控制**：在进度弹窗中提供“暂停/继续/失败重试”，暂停时保留已完成进度并允许续传；对失败项提供一键重试入口与失败原因摘要。
   - **导入提示细化**：检测编码异常（�、BOM/UTF-16猜测）、非法控制字符、重复 key/路径，导入完成后给出可读提示与示例 key，避免“导入成功但内容异常”。
   - **可见进度与反馈**：进度日志标注当前文件/Key 摘要，任务结束后展示已完成/失败数量，便于用户判断是否需要重试。

## 11. 结论

项目整体架构清晰：使用“入口加载器 + 模块化脚本”的方式，兼顾 file:// 运行需求；核心能力集中在“文件解析 + 翻译编排 + 本地存储 + UI 交互”。对本地化翻译场景支持度高，具备继续扩展为专业翻译管理工具的潜力。
