# 错误处理系统使用指南

## 概述

本项目实现了一套完整的统一错误处理系统，用于替换原有分散的错误处理逻辑。新系统提供了错误分类、统一处理、用户友好提示、错误恢复和统计分析等功能。

## 系统架构

### 核心组件

1. **ErrorManager** (`app/core/error-manager.js`)
   - 统一错误管理器
   - 错误分类和标准化
   - 错误通知和日志记录
   - 错误统计和分析

2. **ErrorUtils** (`app/core/error-utils.js`)
   - 错误处理工具函数
   - 异步操作包装器
   - 重试机制
   - 批量操作错误收集

3. **模块专用错误处理器**
   - `app/features/translations/error-handler.js` - 翻译模块
   - `app/services/storage/error-handler.js` - 存储模块
   - `app/network/error-handler.js` - 网络模块
   - `app/features/files/error-handler.js` - 文件处理模块

## 错误代码体系

### 错误分类

```javascript
const ERROR_CATEGORIES = {
  NETWORK: 'network',      // 网络相关
  API: 'api',             // API相关
  STORAGE: 'storage',     // 存储相关
  FILE: 'file',           // 文件处理
  TRANSLATION: 'translation', // 翻译相关
  USER: 'user',           // 用户操作
  SYSTEM: 'system'        // 系统错误
};
```

### 严重级别

```javascript
const ERROR_SEVERITY = {
  LOW: 'low',        // 信息性错误，不影响核心功能
  MEDIUM: 'medium',  // 影响部分功能，但有替代方案
  HIGH: 'high',      // 影响核心功能，需要用户干预
  CRITICAL: 'critical' // 系统级错误，可能导致数据丢失
};
```

### 常用错误代码

```javascript
// 网络相关
ERROR_CODES.NETWORK_ERROR
ERROR_CODES.TIMEOUT
ERROR_CODES.CONNECTION_FAILED

// API相关
ERROR_CODES.API_KEY_MISSING
ERROR_CODES.API_KEY_INVALID
ERROR_CODES.API_RATE_LIMITED

// 存储相关
ERROR_CODES.STORAGE_QUOTA_EXCEEDED
ERROR_CODES.STORAGE_ACCESS_DENIED

// 文件相关
ERROR_CODES.FILE_TOO_LARGE
ERROR_CODES.FILE_PARSE_ERROR

// 翻译相关
ERROR_CODES.TRANSLATION_FAILED
ERROR_CODES.TRANSLATION_CANCELLED
```

## 使用方法

### 1. 创建和处理错误

```javascript
// 创建标准化错误
const error = errorManager.createError(
  ERROR_CODES.API_KEY_MISSING,
  '请配置OpenAI API密钥',
  { engine: 'OpenAI' }
);

// 处理任意错误
const handledError = errorManager.handleError(originalError, {
  operation: 'translation',
  context: { itemId: 123 }
});
```

### 2. 安全执行异步操作

```javascript
// 基本用法
const result = await safeAsync(
  () => fetch('/api/translate'),
  {
    retryCount: 3,
    retryDelay: 1000,
    fallbackValue: null
  }
);

if (result.success) {
  console.log('请求成功:', result.data);
} else {
  console.error('请求失败:', result.error);
}

// 包装函数
const safeTranslate = withErrorHandling(translateFunction, {
  retryCount: 2,
  context: { operation: 'translation' }
});
```

### 3. 批量操作错误处理

```javascript
const collector = new BatchErrorCollector();

for (let i = 0; i < items.length; i++) {
  try {
    const result = await processItem(items[i]);
    collector.addSuccess(i, result, items[i]);
  } catch (error) {
    collector.addError(i, error, items[i]);
  }
}

const summary = collector.getSummary();
console.log(`成功: ${summary.successCount}, 失败: ${summary.errorCount}`);

// 获取可重试的错误
const retryableErrors = collector.getRetryableErrors();
```

### 4. 网络请求错误处理

```javascript
// 使用增强版NetworkUtils
// NetworkUtilsV2 由 public/app/network/error-handler.js 暴露为 window.networkUtilsV2
// 同时为向后兼容，window.NetworkUtils 会被指向 NetworkUtilsV2
const networkUtils = window.networkUtilsV2;

try {
  const response = await networkUtils.fetchWithErrorHandling(
    'https://api.example.com/data',
    { method: 'POST', body: JSON.stringify(data) },
    30000 // 超时时间
  );
  
  const result = await response.json();
} catch (error) {
  // 错误已被自动处理和分类
  console.error('请求失败:', error.code, error.message);
}

// 批量请求
const requests = [
  { url: '/api/item1', options: {} },
  { url: '/api/item2', options: {} }
];

const batchResult = await networkUtils.batchRequest(requests, {
  concurrency: 3,
  retryCount: 2
});
```

### 5. 文件处理错误

```javascript
// 文件验证
const validation = validateFilesV2(files, {
  maxSize: 10 * 1024 * 1024,
  allowedExtensions: ['json', 'xml', 'po']
});

if (validation.invalid.length > 0) {
  validation.invalid.forEach(({ file, error }) => {
    console.error(`文件 ${file.name} 验证失败:`, error.message);
  });
}

// 安全文件读取
try {
  const fileData = await readFileV2(file, {
    encoding: 'auto',
    maxSize: 50 * 1024 * 1024
  });
  
  console.log('文件读取成功:', fileData.name, fileData.encoding);
} catch (error) {
  console.error('文件读取失败:', error.message);
}
```

### 6. 存储操作错误处理

```javascript
// 安全的IndexedDB操作
const result = await putFileContentSafe('project-123', projectData);
if (!result) {
  console.error('项目保存失败');
}

// 存储健康检查
const health = await StorageErrorHandler.checkStorageHealth();
if (health.issues.length > 0) {
  console.warn('存储问题:', health.issues);
  console.log('建议:', health.recommendations);
}

// 存储清理
const cleanupResult = await StorageErrorHandler.cleanupStorage({
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30天
  maxItems: 100
});
```

## 错误恢复策略

### 自动恢复

系统会自动尝试恢复以下类型的错误：

1. **网络错误** - 指数退避重试
2. **API限流** - 延迟重试
3. **存储配额超出** - 自动清理
4. **临时服务不可用** - 重试机制

### 手动恢复

```javascript
// 创建重试策略
const retryStrategy = TranslationErrorHandler.createRetryStrategy({
  maxRetries: 5,
  baseDelay: 2000,
  backoffFactor: 2
});

// 使用重试策略
const result = await retryStrategy(
  () => callUnreliableAPI(),
  { operation: 'apiCall' }
);
```

## 错误监控和分析

### 获取错误统计

```javascript
const stats = errorManager.getErrorStats();
console.log('错误统计:', {
  总数: stats.total,
  按类别: stats.byCategory,
  按严重程度: stats.bySeverity,
  最近错误: stats.recent
});
```

### 导出错误日志

```javascript
// 导出完整错误日志
errorManager.exportErrorLog();

// 获取网络请求统计
const networkStats = window.networkUtilsV2.getRequestStats();
console.log('网络请求统计:', networkStats);
```

### 错误历史管理

```javascript
// 清理错误历史
errorManager.clearErrorHistory();

// 重置网络统计
window.networkUtilsV2.resetStats();
```

## 开发和调试

### 演示和测试

```javascript
// 运行完整的错误处理演示
await runErrorHandlingDemo();

// 测试特定错误类型
testSpecificError(ERROR_CODES.NETWORK_ERROR, '网络连接失败');

// 显示帮助信息
showErrorHandlingHelp();
```

> 说明：`runErrorHandlingDemo/testErrorHandlingFixes/quickValidation/demonstrateUsage/showErrorHandlingHelp/errorDashboard` 位于
> `public/app/dev-tools/*`，仅在加载这些脚本后可用（通常依赖 `public/app.js` 的开发模式加载逻辑）。

### 开发模式功能

在开发模式下，系统提供额外的调试功能：

1. 详细的控制台日志
2. 错误堆栈跟踪
3. 性能监控
4. 错误统计实时更新

## 迁移指南

### 从旧错误处理迁移

1. **替换错误格式化函数**
   ```javascript
   // 旧代码
   const errorInfo = formatTranslationError(error, engine);
   
   // 新代码
   const errorInfo = formatTranslationErrorV2(error, engine);
   ```

2. **使用新的存储错误处理**
   ```javascript
   // 旧代码
   notifyIndexedDbFileContentErrorOnce(error, 'save');
   
   // 新代码
   notifyStorageErrorV2(error, 'save');
   ```

3. **网络请求升级**
   ```javascript
   // 旧代码
   const networkUtils = new NetworkUtils();
   
   // 新代码
   const networkUtils = window.networkUtilsV2;
   ```

### 向后兼容性

新系统保持了与现有代码的向后兼容性：

- 原有函数名仍然可用（内部调用新实现）
- 错误对象格式保持一致
- 通知系统接口不变

## 最佳实践

### 1. 错误处理原则

- **统一性**: 使用统一的错误代码和处理方式
- **用户友好**: 提供清晰的错误消息和解决方案
- **可恢复性**: 优先尝试自动恢复
- **可观测性**: 记录详细的错误信息用于分析

### 2. 代码示例

```javascript
// ✅ 好的做法
async function translateText(text, engine) {
  // 验证输入
  if (!text) {
    throw errorManager.createError(ERROR_CODES.INVALID_INPUT, '文本不能为空');
  }
  
  // 验证API密钥
  const apiKey = getApiKey(engine);
  const keyError = ErrorUtils.validateApiKey(apiKey, engine);
  if (keyError) {
    throw keyError;
  }
  
  // 安全执行翻译
  const result = await safeAsync(
    () => callTranslationAPI(text, engine, apiKey),
    {
      retryCount: 3,
      context: { engine, textLength: text.length }
    }
  );
  
  if (!result.success) {
    throw result.error;
  }
  
  return result.data;
}

// ❌ 避免的做法
async function translateTextOld(text, engine) {
  try {
    const result = await fetch('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, engine })
    });
    
    if (!result.ok) {
      throw new Error('Translation failed');
    }
    
    return await result.json();
  } catch (error) {
    console.error('Error:', error);
    showNotification('error', '翻译失败', error.message);
    throw error;
  }
}
```

### 3. 性能考虑

- 使用批量错误收集器处理大量操作
- 合理设置重试次数和延迟
- 定期清理错误历史避免内存泄漏
- 使用熔断器防止级联失败

## 故障排除

### 常见问题

1. **错误通知不显示**
   - 检查 `showNotification` 函数是否可用
   - 确认错误管理器已正确初始化

2. **重试机制不工作**
   - 检查错误是否被标记为可恢复
   - 确认重试配置参数正确

3. **存储操作失败**
   - 检查浏览器存储权限
   - 运行存储健康检查
   - 清理存储空间

4. **网络请求错误**
   - 检查网络连接
   - 验证API密钥配置
   - 查看熔断器状态

### 调试技巧

```javascript
// 启用详细日志
localStorage.setItem('errorHandlingDebug', 'true');

// 查看错误详情
console.log(errorManager.getErrorStats());

// 检查网络状态
const connectivity = await checkNetworkConnectivity();
console.log('网络状态:', connectivity);

// 运行诊断
await runErrorHandlingDemo();
```

## 总结

新的错误处理系统提供了：

- ✅ 统一的错误分类和处理机制
- ✅ 用户友好的错误消息和解决方案
- ✅ 自动错误恢复和重试策略
- ✅ 完整的错误监控和分析功能
- ✅ 向后兼容的迁移路径
- ✅ 丰富的开发和调试工具

通过使用这套系统，可以显著提高应用的稳定性和用户体验，同时简化错误处理的开发和维护工作。