# 详细问题清单和解决方案

## 问题1: 架构系统未被充分利用

### 问题描述
项目已实现了完整的架构系统（NamespaceManager、DIContainer、ModuleManager），但大量代码仍然使用全局变量，架构系统的优势未能发挥。

### 具体表现

**文件**: `public/app/services/storage/storage-manager.js`
```javascript
// 直接创建全局实例，未通过DI容器
const storageManager = new StorageManager();
```

**文件**: `public/app/services/translation-service.js`
```javascript
// 直接创建全局实例
const translationService = new TranslationService();
```

**文件**: `public/app/features/translations/actions.js`
```javascript
// 直接使用全局AppState，未通过依赖注入
function rebuildFilteredTranslationItems(options = {}) {
  const all = Array.isArray(AppState.project?.translationItems) ? ... : [];
  // 隐式依赖AppState、translationService等
}
```

### 影响
- 难以进行单元测试（无法注入mock对象）
- 全局变量污染
- 模块间耦合度高
- 难以进行模块替换

### 解决方案

**步骤1**: 在bootstrap.js中注册所有服务
```javascript
// public/app/core/bootstrap.js
async function __appBootstrap() {
  // 注册核心服务
  diContainer.registerSingleton('appState', () => window.AppState);
  diContainer.registerSingleton('storageManager', () => window.storageManager);
  diContainer.registerSingleton('translationService', () => window.translationService);
  
  // 注册功能模块
  diContainer.registerSingleton('translationActions', TranslationActions, {
    dependencies: ['appState', 'translationService', 'errorManager']
  });
}
```

**步骤2**: 修改使用处，通过依赖注入获取服务
```javascript
// 修改前
function rebuildFilteredTranslationItems(options = {}) {
  const all = Array.isArray(AppState.project?.translationItems) ? ... : [];
}

// 修改后
function rebuildFilteredTranslationItems(options = {}, deps = {}) {
  const appState = deps.appState || getService('appState');
  const all = Array.isArray(appState.project?.translationItems) ? ... : [];
}
```

---

## 问题2: 错误处理代码重复

### 问题描述
翻译完成后的错误处理代码在多个函数中重复出现，导致代码冗余和维护困难。

### 具体表现

**文件**: `public/app/features/translations/actions.js`

**重复1** (第571-590行):
```javascript
if (!AppState.translations.isInProgress && cancelledCount > 0) {
  showNotification("info", "翻译已取消", `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`);
} else if (actualErrors.length === 0) {
  showNotification("success", "翻译完成", `已成功翻译 ${results.length} 项`);
} else {
  const firstErr = actualErrors[0];
  const f = formatTranslationError(firstErr, engine);
  showNotification("warning", "翻译部分完成", `成功 ${results.length} 项，失败 ${actualErrors.length} 项`);
}
```

**重复2** (第716-740行): 在`translateAll`函数中重复

**重复3** (第870-890行): 在`retryFailedTranslations`函数中重复

### 影响
- 代码维护困难
- 修改错误处理逻辑需要改多个地方
- 容易产生不一致

### 解决方案

**创建通用的翻译结果处理函数**:
```javascript
// public/app/features/translations/result-handler.js
function handleTranslationResults(results, errors, engine, context = {}) {
  const actualErrors = errors.filter((e) => e.error !== "用户取消");
  const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
  
  AppState.translations.lastFailedItems = actualErrors
    .map((e) => e?.item)
    .filter(Boolean);

  if (!AppState.translations.isInProgress && cancelledCount > 0) {
    showNotification(
      "info",
      "翻译已取消",
      `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
    );
  } else if (actualErrors.length === 0) {
    showNotification(
      "success",
      context.successTitle || "翻译完成",
      `已成功翻译 ${results.length} 项`
    );
  } else {
    const firstErr = actualErrors[0];
    const f = formatTranslationError(firstErr, engine);
    showNotification(
      "warning",
      context.warningTitle || "翻译部分完成",
      `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
    );
    showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
  }
  
  return { actualErrors, cancelledCount };
}
```

**使用通用函数**:
```javascript
async function translateSelected() {
  try {
    const { results, errors } = await translationService.translateBatch(...);
    hideTranslationProgress();
    
    handleTranslationResults(results, errors, engine, {
      successTitle: "翻译完成",
      warningTitle: "翻译部分完成"
    });
    
    autoSaveManager.markDirty();
    updateTranslationUI();
  } catch (error) {
    // 错误处理
  }
}
```

---

## 问题3: UI更新代码重复

### 问题描述
翻译完成后的UI更新代码在多个函数中重复出现。

### 具体表现

**重复模式**:
```javascript
// 在translateSelected、translateAll、retryFailedTranslations中重复
rebuildFilteredTranslationItems();
updateTranslationLists();
updateCounters();
updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
```

### 解决方案

**创建通用的UI更新函数**:
```javascript
// public/app/features/translations/ui-updates.js
function updateTranslationUI(options = {}) {
  const {
    selectedFile = null,
    shouldScroll = false,
    shouldFocusTextarea = false
  } = options;
  
  if (selectedFile) {
    rebuildFilteredTranslationItems({ selectedFile });
  } else {
    rebuildFilteredTranslationItems();
  }
  
  updateTranslationLists();
  updateCounters();
  updateSelectionStyles({ shouldScroll, shouldFocusTextarea });
}
```

**使用**:
```javascript
async function translateAll() {
  try {
    const { results, errors } = await translationService.translateBatch(...);
    hideTranslationProgress();
    handleTranslationResults(results, errors, engine);
    autoSaveManager.markDirty();
    updateTranslationUI({ selectedFile: AppState?.translations?.selectedFile });
  } catch (error) {
    // 错误处理
  }
}
```

---

## 问题4: 验证逻辑重复

### 问题描述
项目中存在多处相同的验证逻辑，如检查项目是否存在、检查翻译项是否存在等。

### 具体表现

**重复1** (多处出现):
```javascript
if (!AppState.project || !Array.isArray(AppState.project.translationItems)) {
  showNotification("warning", "无项目", "请先上传文件或打开项目");
  return;
}
```

**重复2** (多处出现):
```javascript
if (AppState.translations.selected === -1 || !AppState.project) {
  showNotification("warning", "未选择项", "请先选择要翻译的项");
  return;
}
```

### 解决方案

**创建验证工具模块**:
```javascript
// public/app/features/translations/validators.js
class TranslationValidators {
  static validateProjectExists() {
    if (!AppState.project) {
      throw errorManager.createError(
        ERROR_CODES.INVALID_INPUT,
        '请先上传文件或打开项目'
      );
    }
  }
  
  static validateTranslationItems() {
    this.validateProjectExists();
    if (!Array.isArray(AppState.project.translationItems)) {
      throw errorManager.createError(
        ERROR_CODES.INVALID_INPUT,
        '翻译项数据异常'
      );
    }
  }
  
  static validateItemSelected() {
    if (AppState.translations.selected === -1) {
      throw errorManager.createError(
        ERROR_CODES.INVALID_INPUT,
        '请先选择要翻译的项'
      );
    }
  }
  
  static validateFileSelected() {
    const selectedFile = AppState?.translations?.selectedFile;
    if (!selectedFile) {
      throw errorManager.createError(
        ERROR_CODES.INVALID_INPUT,
        '请先在左侧文件列表选择要翻译的文件'
      );
    }
  }
}

// 使用
async function translateAll() {
  try {
    TranslationValidators.validateProjectExists();
    TranslationValidators.validateTranslationItems();
    TranslationValidators.validateFileSelected();
    
    // 业务逻辑
  } catch (error) {
    errorManager.handleError(error);
  }
}
```

---

## 问题5: 存储后端自动降级导致数据不一致

### 问题描述
当IndexedDB失败时，存储管理器自动降级到localStorage，可能导致数据分散在不同的后端。

### 具体表现

**文件**: `public/app/services/storage/storage-manager.js` (第900-950行)
```javascript
async saveCurrentProject(project) {
  try {
    return await this.saveProject(project);
  } catch (e) {
    // 自动降级到localStorage
    this.preferredBackendId = "localStorage";
    this.indexedDbAvailable = false;
    return await this.saveProject(project);
  }
}
```

### 影响
- 数据可能分散在IndexedDB和localStorage中
- 难以追踪数据位置
- 可能导致数据丢失

### 解决方案

**实现明确的后端选择策略**:
```javascript
class StorageManager {
  async ensureBackendConsistency() {
    // 检查数据是否分散
    const idbData = await this.backends.indexeddb.loadCurrentProject();
    const lsData = await this.backends.localStorage.loadCurrentProject();
    
    if (idbData && lsData && idbData.id !== lsData.id) {
      // 数据不一致，需要用户选择
      const choice = await showStorageConflictDialog(idbData, lsData);
      if (choice === 'idb') {
        await this.backends.localStorage.clearCurrentProject();
      } else {
        await this.backends.indexeddb.clearCurrentProject();
      }
    }
  }
  
  async saveCurrentProject(project) {
    const backend = this.getPreferredBackend();
    
    try {
      return await backend.saveCurrentProject(project);
    } catch (error) {
      // 不自动降级，而是通知用户
      const handled = errorManager.handleError(error, {
        context: 'saveCurrentProject',
        backend: backend.backendId,
        recoverable: true
      });
      
      if (handled.recoverable) {
        // 询问用户是否切换后端
        const switchBackend = await showStorageSwitchDialog(backend.backendId);
        if (switchBackend) {
          this.preferredBackendId = switchBackend;
          return await this.saveCurrentProject(project);
        }
      }
      
      throw error;
    }
  }
}
```

---

## 问题6: 缺少请求去重和缓存

### 问题描述
网络请求没有去重机制，相同的请求可能被发送多次。

### 解决方案

**实现请求去重**:
```javascript
// public/app/network/request-deduplicator.js
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }
  
  async execute(key, requestFn) {
    // 如果已有相同的请求在进行，返回现有的Promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // 创建新请求
    const promise = requestFn()
      .finally(() => {
        this.pendingRequests.delete(key);
      });
    
    this.pendingRequests.set(key, promise);
    return promise;
  }
}

// 使用
const deduplicator = new RequestDeduplicator();

async function translateBatch(items, sourceLang, targetLang, engine) {
  const key = `translate:${sourceLang}:${targetLang}:${engine}:${items.map(i => i.id).join(',')}`;
  
  return deduplicator.execute(key, async () => {
    // 实际的翻译请求
    return await translationService.translateBatch(items, sourceLang, targetLang, engine);
  });
}
```

---

## 问题7: 事件监听器未清理

### 问题描述
注册的事件监听器没有对应的清理机制，长期运行时可能导致内存泄漏。

### 具体表现

**文件**: `public/app/ui/event-listeners.js`
```javascript
function initEventListeners() {
  // 注册事件监听器，但没有清理机制
  registerEventListenersKeyboard(ctx);
  registerEventListenersTranslationLists(ctx);
  // ...
}
```

### 解决方案

**实现事件监听器管理**:
```javascript
// public/app/core/event-manager.js (扩展)
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  on(target, event, handler, options = {}) {
    const key = `${target}:${event}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    target.addEventListener(event, handler, options);
    this.listeners.get(key).push({ target, handler, options });
  }
  
  off(target, event, handler) {
    target.removeEventListener(event, handler);
    
    const key = `${target}:${event}`;
    const listeners = this.listeners.get(key);
    if (listeners) {
      const index = listeners.findIndex(l => l.handler === handler);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
  
  removeAll() {
    this.listeners.forEach((listeners, key) => {
      listeners.forEach(({ target, handler, options }) => {
        target.removeEventListener(key.split(':')[1], handler, options);
      });
    });
    this.listeners.clear();
  }
}

// 使用
function initEventListeners() {
  const eventManager = getService('eventManager');
  
  eventManager.on(document, 'click', handleClick);
  eventManager.on(window, 'resize', handleResize);
}

// 清理
function cleanup() {
  const eventManager = getService('eventManager');
  eventManager.removeAll();
}
```

---

## 问题8: 缺少类型安全

### 问题描述
没有使用TypeScript或JSDoc类型注解，容易产生类型相关的bug。

### 解决方案

**添加JSDoc类型注解**:
```javascript
/**
 * 重建过滤后的翻译项列表
 * @param {Object} options - 选项
 * @param {string} [options.selectedFile] - 选中的文件
 * @returns {void}
 */
function rebuildFilteredTranslationItems(options = {}) {
  const all = Array.isArray(AppState.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  // ...
}

/**
 * 翻译所有项
 * @async
 * @returns {Promise<void>}
 * @throws {TranslationToolError} 翻译失败时抛出
 */
async function translateAll() {
  // ...
}
```

---

## 问题9: 缺少性能监控

### 问题描述
没有性能监控机制，难以发现性能问题。

### 解决方案

**实现性能监控**:
```javascript
// public/app/core/performance-monitor.js
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(duration);
    
    if (duration > 1000) {
      console.warn(`⚠️ 性能警告: ${name} 耗时 ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }
  
  async measureAsync(name, fn) {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(duration);
    
    if (duration > 1000) {
      console.warn(`⚠️ 性能警告: ${name} 耗时 ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }
  
  getReport() {
    const report = {};
    this.metrics.forEach((durations, name) => {
      report[name] = {
        count: durations.length,
        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations)
      };
    });
    return report;
  }
}

// 使用
const perfMonitor = new PerformanceMonitor();

async function translateAll() {
  return perfMonitor.measureAsync('translateAll', async () => {
    // 业务逻辑
  });
}
```

---

## 问题10: 缺少错误追踪

### 问题描述
错误日志缺少追踪ID，难以定位问题。

### 解决方案

**实现错误追踪**:
```javascript
// public/app/core/error-tracker.js
class ErrorTracker {
  constructor() {
    this.traceId = this.generateTraceId();
    this.errorLog = [];
  }
  
  generateTraceId() {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  trackError(error, context = {}) {
    const entry = {
      traceId: this.traceId,
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code,
      context,
      stack: error.stack
    };
    
    this.errorLog.push(entry);
    
    // 发送到远程日志服务
    if (error.severity === ERROR_SEVERITY.CRITICAL) {
      this.reportToServer(entry);
    }
    
    return entry.traceId;
  }
  
  async reportToServer(entry) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  }
}

// 使用
const errorTracker = new ErrorTracker();

try {
  // 业务逻辑
} catch (error) {
  const traceId = errorTracker.trackError(error, {
    function: 'translateAll',
    userId: getCurrentUserId()
  });
  
  showNotification('error', '翻译失败', `错误ID: ${traceId}`);
}
```

---

## 优先级排序

| 优先级 | 问题 | 预计工作量 | 影响 |
|------|------|---------|------|
| P0 | 统一错误处理 | 2天 | 高 |
| P0 | 消除代码重复 | 3天 | 高 |
| P1 | 完善架构系统集成 | 3天 | 中 |
| P1 | 添加类型安全 | 2天 | 中 |
| P2 | 实现性能监控 | 1天 | 低 |
| P2 | 实现错误追踪 | 1天 | 低 |
| P3 | 添加测试 | 5天+ | 中 |
| P3 | 改进文档 | 2天 | 低 |

