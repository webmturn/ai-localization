# 错误处理系统使用示例

## 基本使用

### 1. 创建和处理错误

```javascript
// 创建标准化错误
const error = errorManager.createError(
  ERROR_CODES.NETWORK_ERROR, 
  '无法连接到翻译服务器',
  { url: 'https://api.openai.com', timeout: 30000 }
);

// 处理任意错误
try {
  await someAsyncOperation();
} catch (error) {
  const handledError = errorManager.handleError(error, {
    operation: 'translation',
    engine: 'openai',
    itemIndex: 5
  });
  // 错误已被自动分类、记录、通知和尝试恢复
}
```

### 2. 安全的异步操作

```javascript
// 基本用法
const result = await safeAsync(async () => {
  const response = await fetch('/api/translate');
  return await response.json();
});

if (result.success) {
  console.log('翻译结果:', result.data);
} else {
  console.error('翻译失败:', result.error);
}

// 带重试的用法
const result = await safeAsync(
  () => translateText('Hello', 'zh'),
  {
    retryCount: 3,
    retryDelay: 1000,
    context: { text: 'Hello', target: 'zh' }
  }
);
```

### 3. 批量操作错误处理

```javascript
async function batchTranslate(items, engine) {
  const collector = new BatchErrorCollector();
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    const result = await safeAsync(
      () => translateItem(items[i], engine),
      {
        context: { itemIndex: i, engine },
        retryCount: 2
      }
    );
    
    if (result.success) {
      collector.addSuccess(i, result.data, items[i]);
      results.push(result.data);
    } else {
      collector.addError(i, result.error, items[i]);
      results.push(null);
    }
  }
  
  const summary = collector.getSummary();
  console.log(`批量翻译完成: 成功 ${summary.successCount}, 失败 ${summary.errorCount}`);
  
  return { results, summary };
}
```

## 模块特定用法

### 1. 翻译模块

```javascript
// 使用增强版的批量翻译处理器
const result = await TranslationErrorHandler.handleBatchTranslation(
  translationItems,
  'openai',
  translateWithOpenAI,
  (current, total, status) => {
    console.log(`进度: ${current}/${total} - ${status}`);
  }
);

// 处理翻译响应
try {
  const translatedText = TranslationErrorHandler.processTranslationResponse(
    apiResponse, 
    'openai'
  );
  console.log('翻译结果:', translatedText);
} catch (error) {
  console.error('响应处理失败:', error.message);
}

// 创建重试策略
const retryStrategy = TranslationErrorHandler.createRetryStrategy({
  maxRetries: 5,
  baseDelay: 2000,
  retryableErrors: [ERROR_CODES.API_RATE_LIMITED, ERROR_CODES.NETWORK_ERROR]
});

const result = await retryStrategy(
  () => callTranslationAPI(text),
  { text, engine: 'openai' }
);
```

### 2. 存储模块

```javascript
// 安全的文件存储
const success = await StorageErrorHandler.putFileContentSafe(
  'project_123',
  projectData
);

if (success) {
  console.log('项目保存成功');
} else {
  console.error('项目保存失败');
}

// 存储健康检查
const health = await StorageErrorHandler.checkStorageHealth();
if (health.issues.length > 0) {
  console.warn('存储问题:', health.issues);
  console.log('建议:', health.recommendations);
}

// 清理存储空间
const cleanupResult = await StorageErrorHandler.cleanupStorage({
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
  maxItems: 50,
  dryRun: false
});
console.log(`清理完成: 删除 ${cleanupResult.cleaned} 项，释放 ${cleanupResult.freed} 字节`);
```

### 3. 网络模块

```javascript
// 使用增强版的网络工具
// NetworkUtilsV2 由 public/app/network/error-handler.js 暴露为 window.networkUtilsV2
// NetworkErrorHandler 也同样挂载在 window 上（window.NetworkErrorHandler）
const networkUtils = window.networkUtilsV2;

// 带错误处理的请求
try {
  const response = await networkUtils.fetchWithErrorHandling(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(requestData)
    },
    30000
  );
  
  const data = await response.json();
  console.log('API响应:', data);
} catch (error) {
  console.error('请求失败:', error.message);
  // 错误已被自动分类和处理
}

// 批量网络请求
const requests = [
  { url: '/api/translate/1', options: { method: 'POST' } },
  { url: '/api/translate/2', options: { method: 'POST' } },
  { url: '/api/translate/3', options: { method: 'POST' } }
];

const batchResult = await networkUtils.batchRequest(requests, {
  concurrency: 2,
  retryCount: 3,
  onProgress: (current, total) => console.log(`${current}/${total}`)
});

console.log('批量请求结果:', batchResult.summary);

// 网络连接检查
const connectivity = await window.NetworkErrorHandler.checkNetworkConnectivity();
if (connectivity.issues.length > 0) {
  console.warn('网络问题:', connectivity.issues);
}
```

### 4. 文件处理模块

```javascript
// 文件验证
const fileInput = document.getElementById('fileInput');
const files = fileInput.files;

const validation = FileErrorHandler.validateFilesV2(files, {
  maxSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  allowedExtensions: ['json', 'xliff', 'po']
});

if (validation.invalid.length > 0) {
  validation.invalid.forEach(({ file, error }) => {
    console.error(`文件 ${file?.name} 验证失败:`, error.message);
  });
}

// 安全的文件读取
for (const { file } of validation.valid) {
  try {
    const readResult = await FileErrorHandler.readFileV2(file, {
      encoding: 'auto',
      timeout: 30000
    });
    
    console.log(`文件 ${file.name} 读取成功:`, {
      size: readResult.size,
      encoding: readResult.encoding
    });
    
    // 解析文件
    const parseResult = await FileErrorHandler.parseFileV2(
      readResult.content,
      file.name,
      { format: 'auto', maxItems: 5000 }
    );
    
    console.log(`解析成功: ${parseResult.items.length} 个翻译项`);
    
  } catch (error) {
    console.error(`处理文件 ${file.name} 失败:`, error.message);
  }
}
```

## 系统管理

### 1. 初始化和配置

```javascript
// 自定义初始化
await initializeErrorSystem({
  notificationHandler: (type, title, message) => {
    // 自定义通知处理
    showToast(type, title, message);
  },
  enableGlobalHandlers: true,
  enablePerformanceMonitoring: true,
  maxHistorySize: 200
});

// 检查系统状态
const status = window.errorSystemIntegrator.getSystemStatus();
console.log('错误处理系统状态:', status);
```

### 2. 监控和统计

```javascript
// 获取错误统计
const stats = errorManager.getErrorStats();
console.log('错误统计:', {
  总数: stats.total,
  按分类: stats.byCategory,
  按严重程度: stats.bySeverity,
  最近错误: stats.recent.slice(0, 5)
});

// 导出错误日志
errorManager.exportErrorLog();

// 清理历史记录
errorManager.clearErrorHistory();
```

### 3. 测试和健康检查

```javascript
// 快速健康检查
const health = quickHealthCheck();
console.log('系统健康状态:', health.status);

if (health.status !== 'healthy') {
  console.warn('发现问题:', health.issues);
}

// 运行完整测试套件
const testResult = await runErrorSystemTest();
console.log('测试结果:', {
  通过率: `${testResult.summary.passRate}%`,
  通过: testResult.summary.passed,
  失败: testResult.summary.failed
});

// 如果测试失败，查看详细信息
if (testResult.summary.failed > 0) {
  testResult.results
    .filter(r => !r.passed)
    .forEach(r => console.error(`测试失败: ${r.name} - ${r.error}`));
}
```

## 高级用法

### 1. 自定义错误类型

```javascript
// 扩展错误代码
const CUSTOM_ERROR_CODES = {
  ...ERROR_CODES,
  CUSTOM_VALIDATION_ERROR: 'CUSTOM_VALIDATION_ERROR',
  CUSTOM_BUSINESS_ERROR: 'CUSTOM_BUSINESS_ERROR'
};

// 创建自定义错误
const customError = errorManager.createError(
  CUSTOM_ERROR_CODES.CUSTOM_VALIDATION_ERROR,
  '自定义验证失败',
  { field: 'email', value: 'invalid-email' }
);
```

### 2. 错误恢复策略

```javascript
// 自定义恢复策略
const customRecoveryStrategy = async (error, context) => {
  if (error.code === ERROR_CODES.API_RATE_LIMITED) {
    // 等待更长时间
    await new Promise(resolve => setTimeout(resolve, 60000));
    return true; // 表示可以重试
  }
  
  if (error.code === ERROR_CODES.STORAGE_QUOTA_EXCEEDED) {
    // 自动清理存储
    await StorageErrorHandler.cleanupStorage();
    return true;
  }
  
  return false; // 无法恢复
};

// 注册恢复策略
errorManager.addRecoveryStrategy(customRecoveryStrategy);
```

### 3. 性能监控

```javascript
// 监控错误处理性能
const originalHandleError = errorManager.handleError;
errorManager.handleError = function(error, context) {
  const start = performance.now();
  const result = originalHandleError.call(this, error, context);
  const duration = performance.now() - start;
  
  if (duration > 50) {
    console.warn(`错误处理耗时: ${duration.toFixed(2)}ms`, { error, context });
  }
  
  return result;
};
```

## 最佳实践

### 1. 错误上下文

```javascript
// 提供丰富的错误上下文
const context = {
  operation: 'batchTranslation',
  engine: 'openai',
  batchSize: items.length,
  currentIndex: i,
  userId: getCurrentUserId(),
  timestamp: Date.now()
};

const handledError = errorManager.handleError(error, context);
```

### 2. 错误分级处理

```javascript
// 根据错误严重程度采取不同行动
const error = errorManager.handleError(originalError, context);

switch (error.severity) {
  case ERROR_SEVERITY.LOW:
    // 记录日志，继续执行
    console.info('轻微错误:', error.message);
    break;
    
  case ERROR_SEVERITY.MEDIUM:
    // 显示警告，提供替代方案
    showWarning(error.message);
    tryAlternativeApproach();
    break;
    
  case ERROR_SEVERITY.HIGH:
    // 停止当前操作，要求用户干预
    stopCurrentOperation();
    showErrorDialog(error);
    break;
    
  case ERROR_SEVERITY.CRITICAL:
    // 保存状态，重启应用
    saveApplicationState();
    showCriticalErrorDialog(error);
    break;
}
```

### 3. 错误预防

```javascript
// 在操作前进行预检查
async function safeTranslation(text, engine) {
  // 1. 验证输入
  if (!text || typeof text !== 'string') {
    throw errorManager.createError(ERROR_CODES.INVALID_INPUT, '文本不能为空');
  }
  
  // 2. 检查API密钥
  const keyError = ErrorUtils.validateApiKey(getApiKey(engine), engine);
  if (keyError) {
    throw keyError;
  }
  
  // 3. 检查网络连接
  const connectivity = await window.NetworkErrorHandler.checkNetworkConnectivity();
  if (!connectivity.online) {
    throw errorManager.createError(ERROR_CODES.NETWORK_ERROR, '网络连接不可用');
  }
  
  // 4. 执行翻译
  return await safeAsync(() => translateText(text, engine), {
    retryCount: 3,
    context: { text, engine }
  });
}
```

这些示例展示了如何有效使用修复后的错误处理系统，实现健壮、可靠的错误管理。