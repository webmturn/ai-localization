# API 参考文档

**项目**: 智能翻译工具 (AI Localization)  
**版本**: 1.2.1  
**更新日期**: 2026-02-16

---

## 目录

1. [核心服务](#核心服务)
2. [依赖注入系统](#依赖注入系统)
3. [错误管理](#错误管理)
4. [性能监控](#性能监控)
5. [网络工具](#网络工具)
6. [验证器](#验证器)
7. [翻译服务](#翻译服务)
8. [存储管理](#存储管理)
9. [事件管理](#事件管理)

---

## 核心服务

### 获取服务

```javascript
// 获取单个服务
const service = getService('serviceName');

// 检查服务是否存在
if (hasService('serviceName')) {
  // 使用服务
}

// 获取多个服务
const services = getAllServices(['service1', 'service2']);

// 检查架构状态
checkArchitectureStatus();
```

> 说明：上述便捷函数由 `public/app/core/architecture/dependency-injection.js` 暴露到 `window`。
> `getService(...)` 在服务未注册且无全局备用时会返回 `null`（不会抛错），调用方需自行判空。

### 可用服务列表

| 服务名 | 说明 | 全局备用 |
|--------|------|----------|
| `appState` | 应用状态 | `AppState` |
| `errorManager` | 错误管理器 | `errorManager` |
| `logger` | 日志系统 | `loggers` |
| `storageManager` | 存储管理器 | `storageManager` |
| `autoSaveManager` | 自动保存 | `autoSaveManager` |
| `translationService` | 翻译服务 | `translationService` |
| `translationBusinessLogic` | 翻译业务逻辑 | `translationBusinessLogic` |
| `translationUIController` | 翻译UI控制器 | `translationUIController` |
| `translationResultHandler` | 翻译结果处理器 | — (工厂) |
| `translationUIUpdater` | 翻译UI更新器 | `TranslationUIUpdater` |
| `universalValidators` | 通用验证器 | — (工厂) |
| `translationValidators` | 翻译验证器 | `TranslationValidators` |
| `domOptimizationManager` | DOM优化管理器 | `domOptimizationManager` |
| `domCache` | DOM缓存 | `DOMCache` |
| `eventManager` | 事件管理器 | `EventManager` |
| `eventBindingManager` | 事件绑定管理器 | `eventBindingManager` |
| `notificationService` | 通知服务 | `showNotification` |
| `networkUtils` | 网络工具 | `networkUtils` |
| `performanceMonitor` | 性能监控 | `performanceMonitor` |

---

## 依赖注入系统

### DIContainer

```javascript
// 注册服务
diContainer.register('serviceName', ServiceClass, {
  singleton: true,            // true=单例（默认） | false=瞬态
  factory: false,             // true=工厂注册（implementation 作为工厂函数）
  dependencies: ['dep1', 'dep2'],
  lazy: false,                // true=延迟实例化
  tags: []                    // 可选：标签
});

// 注册工厂
diContainer.registerFactory('serviceName', () => new Service());

// 解析服务
const service = diContainer.resolve('serviceName');

// 检查服务
const exists = diContainer.has('serviceName');

// 获取状态
const status = diContainer.getStatus();
```

### ServiceLocator

```javascript
// 获取服务
const service = serviceLocator.get('serviceName');

// 检查服务
const exists = serviceLocator.has('serviceName');

// 批量获取
const services = serviceLocator.getAll(['service1', 'service2']);
```

---

## 错误管理

### TranslationToolError

```javascript
// 创建错误
const error = new TranslationToolError(
  ERROR_CODES.API_KEY_MISSING,
  '自定义消息',
  { customDetail: 'value' }
);

// 错误属性
error.traceId;      // 追踪ID: "ERR-20250205-123456-0001-ABCD"
error.code;         // 错误代码
error.message;      // 错误消息
error.severity;     // 严重级别: 'low' | 'medium' | 'high' | 'critical'
error.category;     // 分类: 'network' | 'api' | 'storage' | 'file' | 'translation' | 'user' | 'system'
error.recoverable;  // 是否可恢复
error.timestamp;    // ISO时间戳

// 方法
error.toJSON();       // 序列化
error.toLogString();  // 日志格式: "[ERR-xxx] CODE: message"
```

### ErrorManager

```javascript
// 创建标准化错误
const error = errorManager.createError(ERROR_CODES.NETWORK_ERROR);

// 处理错误
const handled = errorManager.handleError(error, {
  context: 'translation',
  recoverable: true
});

// 获取错误统计
const stats = errorManager.getErrorStats();

// 获取错误历史
const history = errorManager.errorHistory;

// 清理错误历史
errorManager.clearErrorHistory();
```

### 错误代码常量

```javascript
ERROR_CODES = {
  // 网络
  NETWORK_ERROR, TIMEOUT, CONNECTION_FAILED, CORS_ERROR,
  
  // API
  API_KEY_MISSING, API_KEY_INVALID, API_UNAUTHORIZED,
  API_FORBIDDEN, API_RATE_LIMITED, API_SERVER_ERROR,
  
  // 存储
  STORAGE_QUOTA_EXCEEDED, STORAGE_ACCESS_DENIED, STORAGE_CORRUPTED,
  
  // 文件
  FILE_TOO_LARGE, FILE_INVALID_FORMAT, FILE_PARSE_ERROR,
  
  // 翻译
  TRANSLATION_FAILED, TRANSLATION_CANCELLED, TRANSLATION_PAUSED,
  
  // 用户
  USER_CANCELLED, INVALID_INPUT,
  
  // 系统
  UNKNOWN_ERROR, INTERNAL_ERROR
}
```

---

## 性能监控

### PerformanceMonitor

```javascript
// 开始计时
const id = performanceMonitor.start('operation', { meta: 'data' });

// 结束计时
const result = performanceMonitor.end(id);
// result = { id, operation, duration, startTime, endTime, ... }

// 包装异步函数
const data = await performanceMonitor.measure('fetchData', async () => {
  return await fetch('/api/data');
});

// 包装同步函数
const result = performanceMonitor.measureSync('compute', () => {
  return heavyComputation();
});

// 设置阈值（毫秒）
performanceMonitor.setThreshold('translation', 5000);

// 获取统计
const stats = performanceMonitor.getStats('operation');
// stats = { count, avg, min, max, warnings, lastDuration }

// 获取完整报告
const report = performanceMonitor.getReport();

// 打印报告到控制台
performanceMonitor.printReport();

// 清除历史
performanceMonitor.clearHistory();
```

---

## 网络工具

### NetworkUtils

```javascript
// 带超时的fetch
const response = await networkUtils.fetchWithTimeout(url, options, timeout);

// 带去重的fetch（相同请求复用结果）
const response = await networkUtils.fetchWithDedupe(url, options, {
  timeout: 30000,
  dedupe: true,   // 启用去重
  cache: false    // 启用缓存
});

// 取消所有请求
networkUtils.cancelAll();

// 验证请求大小
networkUtils.validateRequestSize(data, maxSizeKB);

// 获取统计
const stats = networkUtils.getStats();
// stats = { activeRequests, pendingDedupe, cachedResponses }

// 清除缓存
networkUtils.clearCache();
```

---

## 验证器

### TranslationValidators

```javascript
// 验证项目存在
TranslationValidators.validateProjectExists();

// 验证翻译项存在
TranslationValidators.validateTranslationItems();

// 验证已选择项目
TranslationValidators.validateItemSelected();

// 验证已选择文件
TranslationValidators.validateFileSelected();

// 验证翻译配置
TranslationValidators.validateTranslationConfig({
  sourceLang: 'en',
  targetLang: 'zh',
  engine: 'deepseek'
});

// 验证引擎配置
TranslationValidators.validateEngineConfig('deepseek');

// 验证批量翻译
TranslationValidators.validateBatchTranslation(items);

// 验证未在进行中
TranslationValidators.validateNotInProgress();

// 组合验证
TranslationValidators.validateBeforeTranslation(config, items);
```

### FileValidators

```javascript
// 验证文件大小
FileValidators.validateFileSize(file, maxSizeBytes);

// 验证文件类型
FileValidators.validateFileType(file, ['xml', 'json', 'xliff']);

// 验证文件内容
FileValidators.validateFileContent(content);
```

### StorageValidators

```javascript
// 验证存储可用性
StorageValidators.validateStorageAvailable();

// 验证存储空间
await StorageValidators.validateStorageSpace(requiredBytes);
```

### ValidationUtils

```javascript
// 安全执行验证
const isValid = ValidationUtils.safeValidate(
  () => TranslationValidators.validateProjectExists(),
  'projectCheck'
);

// 批量验证
const allValid = ValidationUtils.validateAll([
  () => TranslationValidators.validateProjectExists(),
  () => TranslationValidators.validateItemSelected()
], 'batchCheck');
```

---

## 翻译服务

### translationService

```javascript
// 翻译文本（单条，带重试）
const translated = await translationService.translate(
  text,
  sourceLang,
  targetLang,
  engine,    // 'deepseek' | 'openai' | 'gemini' | 'claude' | 'google'
  context,   // { elementType, xmlPath, parentText, key }
  maxRetries // 可选，默认读取设置
);

// 批量翻译
const { results, errors } = await translationService.translateBatch(
  items,
  sourceLang,
  targetLang,
  engine,
  onProgress  // (completed, total, message) => {}
);

// 取消翻译
translationService.cancelAll();

// 获取活跃请求数
const count = translationService.activeRequests?.size;
```

### 翻译结果处理

```javascript
// 统一处理翻译结果
const stats = handleTranslationResults(results, errors, engine, {
  successTitle: '翻译完成',
  warningTitle: '翻译部分完成',
  operation: 'batchTranslation'
});
// stats = { successCount, errorCount, cancelledCount, totalCount }

// 处理翻译进度
handleTranslationProgress(completed, total, '翻译中...');

// 处理翻译错误
handleTranslationError(error, {
  operation: '批量翻译',
  engine: 'deepseek'
});

// 更新翻译UI
updateTranslationUI({
  selectedFile: 'file.xml',
  shouldScroll: false,
  shouldFocusTextarea: false
});
```

---

## 存储管理

### StorageManager

```javascript
// 加载当前项目
const project = await storageManager.loadCurrentProject();

// 保存项目
await storageManager.saveProject(project);

// 保存当前项目
await storageManager.saveCurrentProject(project);

// 删除项目
await storageManager.deleteProject(projectId);

// 重命名项目
await storageManager.renameProject(projectId, newName);

// 列出所有项目
const projects = await storageManager.listProjects();

// 按ID加载项目
const project = await storageManager.loadProjectById(projectId);

// 获取/设置活动项目ID
const activeId = await storageManager.getActiveProjectId();
await storageManager.setActiveProjectId(projectId);

// 检查IndexedDB可用性
const available = await storageManager.checkIndexedDbAvailability();
```

---

## 事件管理

### EventManager

```javascript
// 添加事件监听器
const listenerId = EventManager.add(
  element,
  'click',
  handler,
  {
    tag: 'translation',
    scope: 'panel:main',
    label: 'translateButton'
  }
);

// 移除监听器
EventManager.removeById(listenerId);

// 按条件移除
EventManager.removeByTag('translation');
EventManager.removeByTarget(element);
EventManager.removeByEvent('click');

// 移除所有
EventManager.removeAll();

// 获取统计
const stats = EventManager.getStats();
// stats = { total, byEvent, byTarget, byTag }
```

---

## DOM缓存

### DOMCache

```javascript
// 按 ID 获取元素（缓存）
const element = DOMCache.get('elementId');

// 按选择器查询单个元素（缓存）
const el = DOMCache.query('.my-class');

// 按选择器查询多个元素（不缓存，因 NodeList 是 live 的）
const els = DOMCache.queryAll('.items');

// 移除缓存
DOMCache.remove('elementId');

// 清除所有缓存
DOMCache.clear();
```

#### 常用 DOMCache ID

| ID | 元素 | 用途 |
|----|------|------|
| `settingsPanel` | 右侧设置面板容器 | 标签页切换时隐藏/显示 |
| `exportBtnContainer` | 右侧导出按钮容器 | 标签页切换时隐藏/显示 |
| `searchResultsPanel` | 翻译搜索结果面板 | 搜索时显示/隐藏 |
| `translationProgressModal` | 翻译进度模态框 | 翻译进度UI |
| `progressBar` | 进度条 | 翻译进度百分比 |
| `progressPercentage` | 进度百分比文本 | 翻译进度UI |
| `progressStatus` | 进度状态文本 | 翻译进度UI |
| `progressLog` | 进度日志容器 | 翻译进度UI |
| `sidebarBackdrop` | 移动端侧边栏遮罩层 | z-[41]，覆盖底部工具栏 |

> **注意**：使用 `DOMCache.get()` 返回值前应判空，避免元素不存在时的 TypeError。

### SettingsCache

```javascript
// 获取设置（从缓存或 localStorage）
const settings = SettingsCache.get();

// 保存设置（同时更新缓存和 localStorage）
SettingsCache.save(settings);

// 清除缓存（下次 get 会重新读取 localStorage）
SettingsCache.clear();
```

---

## 全局状态

### AppState

```javascript
// 项目
AppState.project           // 当前项目
AppState.project.id        // 项目ID
AppState.project.name      // 项目名称
AppState.project.translationItems  // 翻译项列表

// 翻译状态
AppState.translations.items        // 翻译项
AppState.translations.filtered     // 过滤后的项
AppState.translations.selected     // 选中索引
AppState.translations.currentPage  // 当前页
AppState.translations.isInProgress // 是否正在翻译
AppState.translations.isPaused     // 是否暂停

// 术语库
AppState.terminology.list      // 术语列表
AppState.terminology.filtered  // 过滤后的术语

// 质量检查
AppState.qualityCheckResults.overallScore    // 总分
AppState.qualityCheckResults.translatedCount // 已翻译数
AppState.qualityCheckResults.issues          // 问题列表
```

---

## AI 翻译设置

通过 `SettingsCache` 读写，存储在 localStorage `translatorSettings` 中。

### API 密钥（按引擎区分）

| 设置项 | 类型 | 说明 |
|----------|------|------|
| `deepseekApiKey` | string | DeepSeek API 密钥（加密存储） |
| `openaiApiKey` | string | OpenAI API 密钥（加密存储） |
| `geminiApiKey` | string | Gemini API 密钥（加密存储） |
| `claudeApiKey` | string | Claude API 密钥（加密存储） |
| `googleApiKey` | string | Google Translate API 密钥（加密存储） |

### AI 增强功能（统一前缀 `ai*`，适用于所有 AI 引擎）

| 设置项 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| `aiUseKeyContext` | boolean | false | 翻译时参考 key/字段名 |
| `aiContextAwareEnabled` | boolean | false | 上下文感知翻译 |
| `aiContextWindowSize` | number | 3 | 前后各取多少条相邻条目 (1-10) |
| `aiPrimingEnabled` | boolean | false | 启用 Priming 样本 |
| `aiPrimingSampleCount` | number | 3 | Priming 样本数 |
| `aiPrimingSampleIds` | string[] | [] | 手选的样本 ID |
| `aiConversationEnabled` | boolean | false | 多轮会话记忆 |
| `aiConversationScope` | string | 'project' | 会话范围: project/fileType/file |
| `aiBatchMaxItems` | number | 40 | 每批次最大条目数 (5-100) |
| `aiBatchMaxChars` | number | 6000 | 每批次最大字符数 (1000-20000) |
| `translationRequestCacheEnabled` | boolean | false | 请求缓存 |
| `translationRequestCacheTTLSeconds` | number | 5 | 缓存 TTL (1-600秒) |

---

## 调试工具

```javascript
// 内存调试（开发模式）
debugMemory();

// 架构状态检查
checkArchitectureStatus();

// 性能报告
performanceMonitor.printReport();

// 事件监听器统计
EventManager.getStats();

// 网络请求统计
networkUtils.getStats();

// 错误统计
errorManager.getErrorStats();
```

---

## 类型定义

```typescript
// TranslationItem
interface TranslationItem {
  sourceText: string;
  targetText: string;
  status: 'pending' | 'translated' | 'edited' | 'error';
  qualityScore: number;
  context?: string;
  metadata?: {
    file?: string;
    resourceId?: string;
  };
}

// Project
interface Project {
  id: string;
  name: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationItems: TranslationItem[];
  createdAt: string;
  updatedAt: string;
}

// TerminologyEntry
interface TerminologyEntry {
  id: number;
  source: string;
  target: string;
  partOfSpeech?: string;
  definition?: string;
}
```
