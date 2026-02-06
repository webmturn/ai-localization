# public/app/** 函数中文说明指南

本文档用于解释 `public/app/**` 下主要模块、类与函数的职责、输入输出、关键副作用与调用关系，便于维护与二次开发。

`public/app.js` 为应用入口加载器（按顺序加载 `public/app/**` 下脚本），通常不承载业务逻辑。

## 1. 总体结构（按模块）

- **全局状态管理**：`AppState`
- **DOM 缓存**：`DOMCache`
- **调试/性能工具**：`isDevelopment`、`debugMemory()`、`debounce()`、`throttle()`
- **安全工具**：`SecurityUtils`、`securityUtils`
- **自动保存**：`AutoSaveManager`、`autoSaveManager`
- **网络请求**：`NetworkUtils`、`networkUtils`
- **翻译服务**：`TranslationService`、`translationService`、`translateText()`
- **事件监听器管理**：`EventManager`
- **UI 初始化与事件绑定**：`DOMContentLoaded`、`initEngineModelSync()`、`initEventListeners()`
- **文件导入与解析**：拖拽/选择文件处理 + 多格式解析器（XML/Android/XLIFF/iOS/RESX/PO/JSON/Text 等）
- **列表渲染/分页/选择/编辑**：`updateTranslationLists()`、`selectTranslationItem()`、`updateTranslationItem()` 等
- **通知与弹窗**：`showNotification()`、`openModal()`、`closeModal()` 等
- **导出**：`exportTranslation()` + `generateXML()/generateJSON()/generateXLIFF()/generateCSV()` + `downloadFile()`
- **质量检查**：`runQualityCheck()` + 批处理/缓存/表格&图表渲染 + `exportQualityReportData()`

## 2. 全局状态与缓存

### 2.1 `AppState`

- **用途**：集中管理项目、翻译列表、术语库与文件元数据，避免散落的全局变量。
- **关键字段**：
  - `project`: 当前项目对象（包含 `translationItems` 等）
  - `translations`: 列表状态（`items/filtered/selected/currentPage/itemsPerPage/searchQuery/isInProgress` 及 `multiSelected`、`isPaused`、`progress`、`lastFailedItems`、`lastBatchContext` 等）
  - `terminology`: 术语库数据与分页
  - `fileMetadata`: 以 `fileName` 为 key 的元信息（size、原始内容、扩展名等）
  - `qualityCheckResults`: 最近一次质量检查的汇总结果（见 2.2）
- **副作用**：多数 UI 刷新函数都依赖 `AppState`，修改后通常需要调用 `updateTranslationLists()` / `updateCounters()` 等同步界面。

### 2.2 质量检查结果：`AppState.qualityCheckResults`

- **定义位置**：`public/app/core/state.js`（与 `AppState` 一同初始化，唯一数据源）。
- **用途**：保存最近一次质量检查的汇总结果，供质量报告面板、图表、导出 JSON/PDF 使用。
- **写入**：仅由 `public/app/features/quality/run.js`（运行检查时对属性赋值/追加）和 `public/app/features/quality/scoring.js`（计算总分时写入 `overallScore`）。
- **读取**：`public/app/features/quality/charts.js`、`export.js`、`ui.js`（统一使用 `AppState.qualityCheckResults`）。
- **结构**：`{ overallScore, translatedCount, totalCount, issues[], termMatches, lastCheckTime, scope?, fileName? }`。
- **兼容**：`window.qualityCheckResults` 在 state.js 中指向 `AppState.qualityCheckResults`，便于旧代码或控制台调试。

### 2.3 质量检查选项：`__getQualityCheckOptions()`

- **定义位置**：`public/app/features/quality/checks.js`（质量模块懒加载后可用）。
- **用途**：从 `localStorage.translatorSettings` 读取质量检查开关（术语、占位符、标点、长度、数字），供检查逻辑、图表、导出、报告 UI 共用。
- **返回**：`{ checkTerminology, checkPlaceholders, checkPunctuation, checkLength, checkNumbers }`（均为 boolean）。
- **调用方**：`checks.js` 内部、`charts.js`、`export.js`、`ui.js`。

### 2.4 `DOMCache`

- **定义位置**：`public/app/core/dom-cache.js`。
- **`DOMCache.get(id)`**
  - **用途**：缓存 `document.getElementById(id)` 的结果，减少重复查询。
  - **返回**：`HTMLElement | undefined`
  - **注意**：如果元素动态销毁/重建，需 `DOMCache.remove(id)` 或 `DOMCache.clear()`。

- **`DOMCache.clear()`**
  - **用途**：清空缓存 Map。

- **`DOMCache.remove(id)`**
  - **用途**：移除单个缓存项。

## 3. 调试与高频工具函数

- **定义位置**：`isDevelopment`、`debugMemory` 在 `public/app/core/dev-tools.js`；`debounce`、`throttle`、`filterItems`、`safeJsonParse` 在 `public/app/core/utils.js`。

### 3.1 `isDevelopment`（IIFE）

- **用途**：判断是否启用开发模式调试工具。
- **判定来源**：
  - URL 参数 `?debug=true`
  - `localStorage.debugMode === 'true'`
  - hostname 为 `localhost/127.0.0.1/空`

### 3.2 `debugMemory()`（仅开发模式注入到 `window`）

- **用途**：输出 DOM 缓存数量、事件监听器统计、活跃翻译请求数量、（Chrome）堆内存使用信息。
- **调用点**：控制台手动执行。

### 3.3 `debounce(func, wait)`

- **用途**：防抖；频繁触发时只执行最后一次。
- **参数**：
  - `func: Function`
  - `wait: number`（毫秒）
- **返回**：包装后的函数。
- **典型调用点**：搜索输入、resize 等。

### 3.4 `throttle(func, limit)`

- **用途**：节流；指定时间窗口内最多执行一次。
- **参数**：
  - `func: Function`
  - `limit: number`（毫秒）
- **返回**：包装后的函数。

### 3.5 `filterItems(items, query, fields)`

- **用途**：统一的搜索过滤函数，支持嵌套字段（如 `metadata.resourceId`）。
- **参数**：
  - `items: Array`
  - `query: string`
  - `fields: Array<string>`（默认 `['sourceText','targetText','context']`）
- **返回**：过滤后的新数组。

## 4. 安全工具：`SecurityUtils`

- **定义位置**：`public/app/services/security-utils.js`；全局实例 `securityUtils` 同文件内创建。

### 4.1 关键点

- 使用 Web Crypto API：PBKDF2 派生 AES-GCM key。
- 加密/解密失败时会降级（返回原文或兼容旧数据），属于"可用性优先"的策略。

### 4.2 方法说明

- **`deriveKey(password)`**
  - **用途**：通过 PBKDF2 派生 AES-GCM 密钥。
  - **返回**：`CryptoKey`（Promise）。

- **`encrypt(text, password='default-key')`**
  - **用途**：AES-GCM 加密后 Base64 输出。
  - **返回**：`Promise<string>`。
  - **失败降级**：返回 `text` 原文。

- **`decrypt(encryptedText, password='default-key')`**
  - **用途**：Base64 解码后 AES-GCM 解密。
  - **失败降级**：返回 `encryptedText`（兼容旧数据）。

- **`sanitizeInput(input)`**
  - **用途**：简单 XSS 防护；替换 `< > " ' \`` 等字符并截断长度。
  - **返回**：安全字符串。

- **`validateApiKey(key, type)`**
  - **用途**：校验 API Key 形态；`type` 为 `openai`（sk- 开头）、`google`（长度 20–100）或默认 `generic`（DeepSeek 等走 default，长度≥10）。

- **`validateFileSize(size, maxSizeMB=10)`**
  - **用途**：文件体积限制。

- **`validateXMLContent(content)`**
  - **用途**：简单 XML 特征与最大体积校验（50MB）。

### 4.3 实例

- `const securityUtils = new SecurityUtils()`：全局单例。

## 5. 自动保存：`AutoSaveManager`

- **用途**：周期性把 `AppState.project` 通过 `storageManager.saveCurrentProject()` 持久化（优先 IndexedDB，失败时降级 localStorage）。
- **定义位置**：`public/app/services/auto-save-manager.js`。

### 方法

- **`start()`**
  - **用途**：开启定时器，间隔 `saveInterval` 检查 `isDirty`。

- **`stop()`**
  - **用途**：停止定时器。

- **`markDirty()`**
  - **用途**：标记有未保存更改，并触发一次“快速保存”节流。

- **`saveProject()`**
  - **用途**：序列化并调用 `storageManager.saveCurrentProject(payload)`；保存成功后清理 dirty 标记并展示保存指示器；配额不足时会尝试去掉 `originalContent` 的降级保存。

- **`restoreProject()`**
  - **用途**：从 `storageManager.loadCurrentProject()` 恢复项目。
  - **返回**：`Promise<project | null>`。

## 6. 网络请求：`NetworkUtils`

- **定义位置**：`public/app/network/network-utils.js`；同文件末尾创建全局实例 `networkUtils`（以全局标识符形式可直接访问，不要求挂到 `window.networkUtils`）。
- **`fetchWithTimeout(url, options, timeout)`**
  - **用途**：`fetch` + 超时 + AbortController；并追踪活动请求。
  - **返回**：`Response`（Promise）。
  - **异常**：超时/取消会抛出 `Error('请求已取消或超时')`。

- **`cancelAll()`**
  - **用途**：取消所有活动请求。

- **`validateRequestSize(data, maxSizeKB=500)`**
  - **用途**：限制请求 JSON 体积，过大直接抛错。

## 7. 翻译服务：`TranslationService` 与 `translateText()`

### 7.1 `TranslationService`

- **用途**：对外提供统一翻译接口与批量翻译，内部支持引擎选择、速率限制、重试与术语库提示。

#### 主要方法

- **`getSettings()`**
  - **用途**：读取 `localStorage.translatorSettings`，并对疑似加密的 key 做解密。
  - **返回**：`Promise<object>`。

- **`translateWithDeepSeek(text, sourceLang, targetLang, context=null)`**
  - **用途**：调用 DeepSeek Chat Completions，并注入上下文/术语库提示。
  - **依赖**：`networkUtils.fetchWithTimeout()`、`securityUtils.sanitizeInput()`、`findTerminologyMatches()`。

- **`translateWithOpenAI(text, sourceLang, targetLang, context=null)`**
  - **用途**：调用 OpenAI Chat Completions（注意：代码里使用 `settings.openaiModel || 'gpt-4o-mini'`）。

- **`findTerminologyMatches(text)`**
  - **用途**：从 `AppState.terminology.list` 中找出与输入文本匹配的术语，供提示词使用。

- **`checkRateLimit(engine)`**
  - **用途**：按引擎控制最小请求间隔，避免过频。

- **`translate(text, sourceLang, targetLang, engine='deepseek', context=null, maxRetries=3)`**
  - **用途**：统一翻译入口；包含重试与指数退避。
  - **注意**：API Key 错误（未配置/401/403）会提前停止重试。

- **`translateBatch(items, sourceLang, targetLang, engine='deepseek', onProgress=null)`**
  - **用途**：逐项翻译并通过回调上报进度。
  - **取消机制**：依赖 `AppState.translations.isInProgress`。
  - **副作用**：直接修改传入 `items` 的 `targetText/status/qualityScore`。
  - **API Key 严格模式**：当所选引擎为 OpenAI/Google 时，批量翻译会在开始前预检 API Key，缺失/无效会立即中止，并只提示一次（避免逐条失败刷屏）。

### 7.2 `translateText(text, sourceLang='en', targetLang='zh', context=null)`

- **用途**：UI 层的翻译包装函数，读取当前引擎配置并调用 `translationService.translate()`。
- **错误处理**：
  - 发生异常时会 `showNotification()` 提示。
  - 不再返回 `mockTranslate()`；失败会 `throw`（并在 error 上打 `__notified` 标记），避免"伪译文"污染真实数据。

### 7.3 `mockTranslate(text)`

- **用途**：演示/测试用途的降级翻译（带字典替换或前缀 `[翻译]`），不用于主翻译链路的失败兜底。

## 8. 事件监听器管理：`EventManager`

- **定义位置**：`public/app/core/event-manager.js`。
- **用途**：集中管理 add/remove，降低内存泄漏风险。

### 方法

- **`add(target, event, handler, options)`**
  - **返回**：监听器 ID（字符串）或 `null`。

- **`removeById(listenerId)`**
- **`removeByTarget(target)`**
- **`removeByEvent(event)`**
- **`remove(target, event)`**
- **`removeAll()` / `clear()`**
- **`getStats()`**：返回 `{ total, byEvent, byTarget, byTag, byScope }`，按事件类型、目标类型、tag、scope 聚合统计。

### 生命周期

- 在 `DOMContentLoaded` 中注册 `beforeunload`：卸载时 `EventManager.removeAll()`、`DOMCache.clear()`，并取消翻译请求。

## 9. UI 初始化与交互

### 9.1 `DOMContentLoaded` 初始化顺序（核心入口）

加载后主要做（见 `public/app/core/bootstrap.js`）：
- 清缓存 `DOMCache.clear()`
- 绑定窗口 resize、visibilitychange、beforeunload
- `initEventListeners()`
- `loadSettings()`
- `storageManager.loadPreferredBackendFromSettings()`、`storageManager.ensureBackendAvailable()`
- `initEngineModelSync()`
- `autoSaveManager.restoreProject()`：若有恢复项目则更新 AppState 并刷新 UI，否则 `loadSampleProject()`
- `initTerminology()`、`updateTerminologyList()`
- `autoSaveManager.start()`

> 注意：为优化首屏性能与 `file://` 兼容性，部分"重量级模块/第三方库"已改为按需加载（首次使用时再加载），例如：
> - 质量检查模块（图表/导出/运行逻辑）
> - Chart.js / SheetJS
> - 翻译导出子模块（translation-*）
> - 术语导入/导出（terminology-import/export）
> 
> 对应入口通常通过 `App.services.ensureQualityModule()` / `App.services.ensureChartJs()` / `App.services.ensureSheetJs()` / `App.services.ensureTranslationsExportModule()` / `App.services.ensureTerminologyImportExportModule()` 来触发加载。

### 9.2 `initEngineModelSync()`

- **用途**：同步工具栏/侧边栏翻译引擎选择，动态显示模型与温度 UI，并持久化到 `translatorSettings`。
- **内部函数**：
  - `updateEngineUI(selectedEngine)`：处理模型列表填充与 UI 显示/隐藏
  - `syncEngineSelects(source, target, value)`：双向同步

### 9.3 `initEventListeners()`

- **用途**：集中绑定 UI 事件；对翻译项列表采用事件委托减少大量监听器。
- **重复绑定防护**：函数内部有初始化守卫（`eventListenersInitialized`），避免重复调用导致监听器叠加。
- **典型委托事件**：
  - 列表项 click -> `selectTranslationItem()`
  - textarea input -> `updateTranslationItem()`
  - textarea focus（捕获阶段）-> `selectTranslationItem(..., { shouldScroll:false, shouldFocusTextarea:false })`

## 10. 文件导入、解析与数据构建

### 10.1 拖拽/选择文件

- **`handleDragOver(e)` / `handleDragLeave(e)` / `handleDrop(e)`**
  - **用途**：拖放区域交互 + 调用 `processFiles(filesArray)`。

- **`handleFileSelect(e)`**
  - **用途**：选择文件后校验体积（默认 10MB），再 `processFiles()`。

> 注意：主页文件导入区的"浏览文件"按钮嵌在 `fileDropArea` 内，若同时绑定了 `fileDropArea.click` 与 `browseFilesBtn.click`，会因事件冒泡导致 `fileInput.click()` 被触发两次，从而出现文件选择框"重复打开/需要点两次"的异常。现已在按钮点击处理中 `stopPropagation()` 以避免双触发。

### 10.2 文件读取与解析

- **`readFileAsync(file)`**
  - **用途**：FileReader Promise 化。

- **`parseFileAsync(file)`**
  - **用途**：读取文件、必要时校验 XML、写入 `AppState.fileMetadata[file.name]`（含 `originalContent`、`contentKey`），再按扩展名分发到对应解析器；成功时可能含 `warnings`（编码/控制字符等）。
  - **返回**：`{ success, items, fileName }`（成功时另有 `warnings` 数组）。
  - **失败策略**：返回一个带 `issues: ['FILE_PARSE_ERROR']` 的错误项。
  - **定义位置**：实现为 `__parseFileAsyncImpl` 在 `public/app/features/files/parse.js`，对外入口在 `public/app/compat/files.js`。

- **`processFiles(files)`**
  - **用途**：并行 `Promise.allSettled(files.map(parseFileAsync))`，汇总 items 与 warnings，然后调用 `completeFileProcessing(files, newItems, warnings)`。
  - **定义位置**：实现为 `__processFilesImpl` 在 `public/app/features/files/process.js`，对外入口在 `public/app/compat/files.js`。

> 备注：`completeFileProcessing(files, newItems, warnings)` 用于最终合并新 items、刷新 UI、提示等；实现在 `public/app/features/files/process.js`。

### 10.3 多格式解析器（核心）

- **定义位置**：各解析器在 `public/app/parsers/*.js`（xml-generic、xml-android、xliff、ios-strings、resx、po、json、text），由 `public/app/features/files/parse.js` 按扩展名调用。
- **`parseGenericXML(content, fileName)`**
  - 定义于 `public/app/parsers/xml-generic.js`。TreeWalker 遍历文本节点；失败或无结果会回退 `parseXMLWithRegex()`。

- **`parseXMLWithRegex(content, fileName)`**
  - 备用方案：提取 `>(text)</` 与 CDATA；再不行则把文件前 1000 字符作为一个项。

- **`parseAndroidStrings(content, fileName)`**
  - 解析 `<string name="...">` 与 `<string-array>`。
  - `metadata.resourceId` 用于后续搜索与展示。

- **`parseXLIFF(content, fileName)`**
  - 解析 `trans-unit` 的 `source/target`。

- **`parseIOSStrings(content, fileName)`**
  - 解析 `"key" = "value";`。

- **`parseRESX(content, fileName)`**
  - 解析 .resx 的 data/value 结构（用于 .NET 资源）。

- **`parsePO(content, fileName)`**
  - 解析 gettext `.po`（按空行分隔条目）。

- **`parseJSON(content, fileName)`**
  - 递归遍历字符串 value，context 使用 JSON path。

- **`parseTextFile(content, fileName)`**
  - 逐行作为翻译项。

## 11. 文件树与翻译列表渲染

### 11.1 文件树

- **`updateFileTree(files)`**
  - **用途**：渲染文件列表；同时会把上传文件 size 等写入 `AppState.fileMetadata`，用于展示文件大小。
  - **副作用**：给每个文件行绑定 click：`filterTranslationItemsByFile(filename)`。

- **`getFileSize(filename)`**
  - **用途**：读取 `AppState.fileMetadata[filename].size` 并格式化；无 size 时返回 `—`。

- **`formatFileSize(bytes)`**
  - **用途**：格式化 Bytes/KB/MB/GB。

- **`filterTranslationItemsByFile(filename)`**
  - **用途**：仅显示某文件的翻译项；重置页码并 `updateTranslationLists()`。

### 11.2 列表渲染

- **`updateTranslationLists()`**
  - **用途**：根据 `AppState.translations.filtered/currentPage/itemsPerPage/selected` 渲染桌面端双列表与移动端合并列表。
  - **性能策略**：
    - DOM 元素用 `DOMCache.get()`
    - 用 `DocumentFragment` 批量插入
    - 渲染后调用 `syncTranslationHeights()`（保持左右列表高度一致）

- **`createEmptyStateElement(message)`**
  - **用途**：生成"空状态"提示 DOM。

> 备注：渲染单项 DOM 的函数在文件中以 `createTranslationItemElement(...)`、`createMobileCombinedTranslationItemElement(...)` 等形式存在，用于生成列表项与 textarea。

## 12. 选择、编辑与计数

- **`selectTranslationItem(index, options?)`**
  - **用途**：更新 `AppState.translations.selected`，并只更新样式（不全量重渲染）。
  - **options**：
    - `shouldScroll`（默认 true）
    - `shouldFocusTextarea`（默认 true）
  - **注意**：函数内部通过判断"重复选择同一 index"提前 return，避免事件循环。

- **`updateTranslationItem(index, targetText)`**
  - **用途**：编辑译文时更新对应项；根据是否为空切换 `edited/pending`；必要时仅更新状态 badge。
  - **副作用**：更新 `AppState.project.updatedAt`；当 `targetText` 实际变更时调用 `autoSaveManager.markDirty()`；调用 `updateCounters()`。
  - **定义位置**：`public/app/features/translations/selection.js`。

- **`updateStatusBadge(index, newStatus)`**
  - **用途**：不重渲染列表，只更新状态标签文本与样式。

- **`updateCounters()`**
  - **用途**：刷新"总数/已翻译数"。

## 13. 翻译流程（UI 层）

> **模块拆分说明**：原 `actions.js`（1405行）已拆分为三个文件：
> - `public/app/features/translations/actions.js` — 翻译操作（翻译选中/全部/取消/重试/暂停/恢复）
> - `public/app/features/translations/find-replace.js` — 查找替换功能
> - `public/app/features/translations/progress.js` — 进度 UI（进度条/日志/控制按钮状态）

- **`translateSelected()`**
  - **用途**：翻译当前选中项；弹出进度框；构建上下文并调用 `translateText()`。

- **批量翻译**：代码中还存在批量翻译流程（通过 `translationService.translateBatch`），并使用 `updateUIIfNeeded` 减少频繁 UI 刷新。

- **`cancelTranslation()`**
  - **用途**：设置 `AppState.translations.isInProgress=false`，`networkUtils.cancelAll()`，关闭进度框并提示。

### 查找替换（`find-replace.js`）

- **`previewFindReplace(options)`** — 预览查找替换匹配数和预览列表
- **`applyFindReplace()`** — 执行查找替换，更新 `targetText` 和状态

### 进度弹窗（`progress.js`）

- **`showTranslationProgress()` / `hideTranslationProgress()`**
- **`updateProgress(current, total, status)`**
- **`addProgressLog(message)`**
- **`updateTranslationControlState()`** — 同步暂停/恢复/重试按钮的启用状态

## 14. 通知与模态框

### 14.1 通知

- **`showNotification(type, title, message)`**
  - **用途**：展示滑入通知；5s 自动关闭。
  - **type**：`success | warning | error | info`。

- **`closeNotification()`**
  - **用途**：关闭通知并移除 body 标记类。

### 14.2 模态框

- **`openModal(modalId)`**：移除 `hidden`。
- **`closeModal(eventOrModalId)`**：支持传 modalId、传事件、或无参关闭最上层可见 modal。

## 15. 导出

- **`exportTranslation()`**
  - **用途**：按导出格式生成内容并下载。
  - **过滤策略**：可选"仅已翻译项"（要求 `targetText` 非空且 status 为 `translated/edited/approved`）。

> 性能提示：翻译导出的实现脚本（`translation-formats.js / translation-original.js / translation-entry.js`）已从启动链路移除，首次点击"确认导出"时会通过 `App.services.ensureTranslationsExportModule()` 按需加载后再执行。
> 
> Excel 导出依赖 SheetJS（`public/lib/sheetjs/xlsx.full.min.js`），已改为运行时按需加载（`App.services.ensureSheetJs()`）。

- **`generateXML(items, includeOriginal)`**
  - **用途**：优先在"原始文件内容"基础上做替换导出（依赖 `AppState.fileMetadata[fileName].originalContent`），否则生成通用 XML。

- **`generateGenericXML(items, includeOriginal)`**：无原始文件时的通用结构。

- **`replaceXMLContent(items, originalContent)`** / **`replaceXMLContentByText(...)`**
  - **用途**：替换原 XML 内容（DOM 解析优先，失败则文本替换）。

- **`generateJSON(items, includeOriginal)`**
- **`generateXLIFF(items, includeOriginal)`**
- **`generateCSV(items, includeOriginal)`**

- **`downloadFile(content, filename)`**
  - **用途**：Blob + ObjectURL 触发下载。

## 16. 质量检查

- **`runQualityCheck()`**
  - **用途**：对项目翻译项进行批量质量检查，更新进度条与报告 UI。
  - **性能策略**：使用并发池限制并发（默认 8，可配置）并在批处理中定期让出事件循环以减少 UI 卡顿；缓存最多 1000 个检查结果。

> 性能提示：质量检查相关脚本与 Chart.js 已改为按需加载（通过 `App.services.ensureQualityModule()` / `App.services.ensureChartJs()`），不再阻塞首屏。

- **`processBatch(items)`**
  - **用途**：并行执行 `checkTranslationItemCached` 并汇总。

- **`checkTranslationItemCached(item)`**
  - **用途**：基于 `id/sourceText/targetText` 生成 cacheKey，命中则直接返回。

- **`checkTranslationItemOptimized(item)`**
  - **检查项**：空译文、长度异常、术语一致性（最多前 100 个术语）、变量占位符一致性、HTML 标签数量。

- **`calculateOverallScore()`**
  - **用途**：总体分 = 完成度 60 + 质量分 40（按问题扣分）。

- **`updateQualityReportUI()`**
  - **用途**：刷新概览统计、问题表、图表。

- **`updateIssuesTable(filter)`**
  - **用途**：渲染问题列表（最多 200 条），支持 severity/type 筛选。

- **`filterIssues()`**
  - **用途**：节流后应用筛选。

- **`focusTranslationItem(itemId)`**
  - **用途**：从质量报告定位到具体翻译项（切页 -> 选中 -> 滚动 -> 临时高亮）。

- **`exportQualityReportData()`**
  - **用途**：导出质量报告 JSON。

 ## 17. 重要风险提示（建议优先处理）
 
 - **~~手动编辑译文不会触发自动保存~~（已修复）**：`updateTranslationItem()` 在译文实际变更时会调用 `autoSaveManager.markDirty()`（见 `selection.js`），手动编辑会参与周期性持久化。
 
 - **`updateCounters()` 的 DOM 写入需要判空**：如果页面结构调整导致 `sourceCount/targetCount` 缺失，直接写入会抛错。
   - **现状**：代码中已对 `sourceCount/targetCount` 元素判空，并对 `translationItems` 缺失做了容错（按空数组处理）。
   - **建议**：后续新增/改动计数 UI 时沿用该判空约定。
 
 - **`innerHTML` 模板拼接仍较多**：包含动态插值（如文件名、搜索关键词、翻译文本等）。
   - **风险**：如果有任意插值未经过 `escapeHtml()` / `securityUtils.sanitizeInput()`，可能引入 XSS 或 HTML 注入；同时也更难做静态审计。
   - **建议**：
     - 统一要求所有"用户可控/文件可控"的字符串插值先转义。
     - 能用 DOM API（`createElement`/`textContent`）的地方尽量避免 `innerHTML`。
 
 - **调试日志未统一按环境开关**：存在较多 `console.log()`（尤其导出/批量翻译流程）。
   - **风险**：生产环境控制台噪音、潜在泄露数据片段（源文/译文/文件名）。
   - **建议**：把日志收敛到 `isDevelopment` 或显式 debug 开关下。

- **事件监听管理不完全统一**：已引入 `EventManager`，但仍存在直接 `addEventListener` 的绑定点。
  - **风险**：监听器清理路径不一致，长期使用可能积累"未释放监听器"的隐患。
  - **现状**：全局/长期监听已基本统一迁移到 `EventManager.add()` 管理，并增加 `initEventListeners()` 的初始化守卫防止重复绑定；`addEventListener` 主要存在于 `EventManager` 内部实现（用于实际注册/注销）。
  - **建议**：
    - 对动态 DOM（如通过 `innerHTML` 重建的输入框）优先使用事件委托或在重建后重新绑定，但要避免"同一次用户操作触发两条 click 路径"（典型是按钮嵌套在可点击区域内的冒泡双触发）。
    - 保持"打开时增加、关闭时清理"的监听器生命周期闭环（例如模态框/菜单的点击外部关闭）。

- **`localStorage` JSON 解析**：已封装 `safeJsonParse()`（`core/utils.js`），多处已使用；新增解析处请继续使用 `safeJsonParse(raw, fallback)`，避免非 JSON 存储导致抛错。

 - **函数名重复（历史风险）**：历史版本曾出现重复定义（例如 `escapeHtml`、`highlightText`、`downloadFile`）。
   - **风险**：后定义会覆盖前定义；不同版本实现差异可能导致行为不一致。
   - **建议**：在重构/合并分支时保持"同名函数只存在一个权威实现"，并用搜索确认无重复定义。
 
- **状态与 UI 同步约定**：
   - 修改 `AppState.translations.filtered/currentPage/selected/itemsPerPage` 后，通常需要 `updateTranslationLists()`。
   - 修改翻译文本后，通常需要 `updateCounters()`，并在需要持久化时 `autoSaveManager.markDirty()`。

## 18. 推荐的"函数中文说明"模板（供你后续扩展）

你在新增/改造函数时，建议按以下结构写在函数上方或写到本文档：

- **函数名**：`xxx()`
- **用途**：一句话说明它做什么
- **参数**：
  - `a: type`：含义
- **返回**：`type` + 含义
- **副作用**：是否会改 `AppState`、操作 DOM、读写 localStorage、发网络请求
- **典型调用点**：由哪个事件/哪个模块触发
- **异常/失败策略**：抛错/返回默认值/降级处理

## 18.5 存储模块拆分说明

> **模块拆分说明**：原 `storage-manager.js`（1453行）已拆分为三个文件：
> - `public/app/services/storage/idb-operations.js` — IndexedDB 底层操作（`openFileContentDB`、所有 `idb*` 前缀函数、GC/清理）
> - `public/app/services/storage/file-content-keys.js` — 文件内容键管理（`buildFileContentKey`、`hydrateFileMetadataContentKeys`、`ensureOriginalContentLoadedForFile`）
> - `public/app/services/storage/storage-manager.js` — 存储管理器（多后端调度、项目 CRUD、后端切换）

> **事件监听器拆分说明**：原 `data-and-ui.js`（1184行）已拆分为：
> - `public/app/ui/event-listeners/data-management.js` — 数据管理（存储后端状态、缓存清理、导出/导入、示例数据清除）
> - `public/app/ui/event-listeners/data-and-ui.js` — UI 交互（密码切换、主题/字体、侧边栏、标签页、拖拽调整宽度）

## 18.6 日志系统

- **日志配置**：`public/app/core/logger-config.js` 定义 `loggerConfig`（全局单例）和预创建的 `loggers` 对象。
- **日志分类**：`architecture`、`modules`、`services`、`scripts`、`errors`、`app`、`storage`、`startup`、`translation`。
- **使用方式**：`(loggers.startup || console).info('...')` — 安全降级，若 loggers 未初始化则回退到 console。
- **级别控制**：生产环境默认 `ERROR`，开发模式 `INFO`。可通过 `window.setLogLevel(LOG_LEVELS.DEBUG)` 运行时调整。

## 19. 维护建议与待改进项（备忘）

本节用于记录近期重构与存储改造后，仍建议后续逐步完善的点（不一定立即实现）。

### 19.1 存储与持久化（IndexedDB / localStorage）

- **降级保存的体积风险**：当 `IndexedDB` 写入失败后，`StorageManager.saveCurrentProject()` 会尝试降级保存到 `localStorage`。
  - **风险**：`localStorage` 容量通常较小（常见约 5MB），大项目（大量翻译项）可能仍保存失败。
  - **建议**：降级保存时写入"slim 版本"（例如去掉非必要字段，或只保存最近编辑部分），并在 UI 上明确提示"降级保存不保证完整"。

- **两阶段写入的一致性**：项目本体（`currentProject`）与原始文件内容（`fileContents`）是两套存储。
  - **现状**：项目可恢复不代表 `originalContent` 一定可用。
  - **建议**：在导出原格式前做一致性检查；必要时提示用户"原文缺失，将使用通用导出"。

- **后端切换的可见性**：当前会在 `IndexedDB` 不可用时自动降级到 `localStorage`。
  - **建议**：在设置页提供"当前存储后端状态"显示与手动切换入口；切换时可考虑提供迁移与重试机制。

### 19.2 导入/解析与编码兼容性

- **文件编码**：`readFileAsync()` 使用 `FileReader.readAsText`，在非 UTF-8 或存在 BOM/特殊编码时可能出现乱码。
  - **建议**：如果要增强兼容性，可引入编码探测或让用户选择编码。

### 19.3 导出策略与用户提示

- **原格式导出缺失原文的提示策略**：避免逐文件弹窗刷屏，优先采用汇总提示。
  - **建议**：对多文件导出可在结果通知中附带"缺失原文文件数/列表预览"。

### 19.4 UI / Tailwind 构建注意事项

- **Tailwind purge 导致样式缺失**：新增 Tailwind class 后，如果 class 未被构建扫描到，可能被裁剪，出现"字体不可见/背景不生效"等问题。
  - **建议**：
    - 对动态拼接 class 或少量偶发类，维护 `tailwind.config.js` 的 `safelist`。
    - UI 按钮样式尽量复用项目中已稳定存在的类组合（例如 `bg-primary`/`bg-red-50` 等）。

### 19.5 数据清理（清缓存）

- **避免误清设置**：建议"清缓存"提供范围选择（仅清项目 / 清全部），并确保设置页文案与行为一致。
