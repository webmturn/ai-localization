# 错误处理系统快速上手指南

## 立即开始

### 1. 验证系统是否正常工作

打开浏览器控制台，运行以下命令：

```javascript
// 快速验证核心功能
quickValidation()

// 运行完整测试
testErrorHandlingFixes()

// 查看错误统计
errorManager.getErrorStats()
```

> 说明：`quickValidation/testErrorHandlingFixes/demonstrateUsage/runErrorHandlingDemo/showErrorHandlingHelp/errorDashboard` 位于 `public/app/dev-tools/*`，仅在加载这些脚本后可用（通常依赖 `public/app.js` 的开发模式加载逻辑）。

### 2. 基本使用示例

#### 创建和处理错误
```javascript
// 创建标准化错误
const error = errorManager.createError(
  ERROR_CODES.API_KEY_MISSING,
  '请配置API密钥'
);

// 处理任意错误
const handledError = errorManager.handleError(originalError, {
  operation: 'translation',
  context: { engine: 'OpenAI' }
});
```

#### 安全执行异步操作
```javascript
const result = await safeAsync(
  () => fetch('/api/data'),
  {
    retryCount: 3,
    retryDelay: 1000,
    fallbackValue: null
  }
);

if (result.success) {
  console.log('请求成功:', result.data);
} else {
  console.error('请求失败:', result.error.message);
}
```

#### 批量操作错误处理
```javascript
const collector = new BatchErrorCollector();

// 处理批量操作
for (let i = 0; i < items.length; i++) {
  try {
    const result = await processItem(items[i]);
    collector.addSuccess(i, result, items[i]);
  } catch (error) {
    collector.addError(i, error, items[i]);
  }
}

// 获取汇总结果
const summary = collector.getSummary();
console.log(`成功: ${summary.successCount}, 失败: ${summary.errorCount}`);
```

### 3. 常用错误代码

```javascript
// 网络相关
ERROR_CODES.NETWORK_ERROR        // 网络连接失败
ERROR_CODES.TIMEOUT              // 请求超时
ERROR_CODES.CONNECTION_FAILED    // 连接失败

// API相关
ERROR_CODES.API_KEY_MISSING      // API密钥缺失
ERROR_CODES.API_KEY_INVALID      // API密钥无效
ERROR_CODES.API_RATE_LIMITED     // API限流

// 存储相关
ERROR_CODES.STORAGE_QUOTA_EXCEEDED  // 存储空间不足
ERROR_CODES.STORAGE_ACCESS_DENIED   // 存储访问被拒绝

// 文件相关
ERROR_CODES.FILE_TOO_LARGE       // 文件过大
ERROR_CODES.FILE_PARSE_ERROR     // 文件解析错误

// 翻译相关
ERROR_CODES.TRANSLATION_FAILED   // 翻译失败
ERROR_CODES.TRANSLATION_CANCELLED // 翻译取消
```

### 4. 实用工具函数

#### 包装函数添加错误处理
```javascript
const safeTranslate = withErrorHandling(translateFunction, {
  retryCount: 2,
  context: { operation: 'translation' }
});

const result = await safeTranslate(text, 'en', 'zh');
```

#### 创建错误边界
```javascript
const safeUserAction = createErrorBoundary(userActionFunction, {
  fallback: null,
  onError: (error) => {
    showNotification('error', '操作失败', error.message);
  }
});
```

### 5. 监控和调试

#### 查看错误统计
```javascript
const stats = errorManager.getErrorStats();
console.log('错误统计:', stats);
```

#### 导出错误日志
```javascript
errorManager.exportErrorLog();
```

#### 生成错误报告
```javascript
errorDashboard.generateReport();
```

#### 清理错误历史
```javascript
errorManager.clearErrorHistory();
```

### 6. 演示和测试

#### 运行完整演示
```javascript
await runErrorHandlingDemo();
```

#### 测试特定错误
```javascript
testSpecificError(ERROR_CODES.NETWORK_ERROR, '网络连接失败');
```

#### 查看使用示例
```javascript
await demonstrateUsage();
```

#### 显示帮助信息
```javascript
showErrorHandlingHelp();
```

## 🔧 实际应用场景

### 场景1: 翻译功能错误处理

```javascript
async function translateText(text, engine) {
  try {
    // 验证API密钥
    const apiKey = getApiKey(engine);
    const keyError = ErrorUtils.validateApiKey(apiKey, engine);
    if (keyError) throw keyError;
    
    // 安全执行翻译
    const result = await safeAsync(
      () => callTranslationAPI(text, engine, apiKey),
      { retryCount: 3, context: { engine } }
    );
    
    return result.success ? result.data : null;
  } catch (error) {
    errorManager.handleError(error, { operation: 'translation', engine });
    return null;
  }
}
```

### 场景2: 文件处理错误处理

```javascript
async function processFile(file) {
  try {
    // 验证文件
    const validationError = ErrorUtils.validateFile(file, {
      maxSize: 10 * 1024 * 1024,
      allowedExtensions: ['json', 'xml']
    });
    if (validationError) throw validationError;
    
    // 安全读取和解析
    const fileData = await FileErrorHandler.readFileV2(file);
    const parseResult = await FileErrorHandler.parseFileV2(
      fileData.content, 
      file.name
    );
    
    return parseResult;
  } catch (error) {
    errorManager.handleError(error, { 
      operation: 'fileProcessing',
      fileName: file.name 
    });
    return null;
  }
}
```

### 场景3: 存储操作错误处理

```javascript
async function saveProject(projectData) {
  try {
    // 检查存储健康状态
    const health = await StorageErrorHandler.checkStorageHealth();
    if (health.issues.length > 0) {
      console.warn('存储问题:', health.issues);
    }
    
    // 安全保存
    const result = await safeAsync(
      () => StorageErrorHandler.putProjectSafe('project', projectData),
      { retryCount: 3, context: { operation: 'saveProject' } }
    );
    
    return result.success;
  } catch (error) {
    errorManager.handleError(error, { operation: 'saveProject' });
    return false;
  }
}
```

## 🎯 最佳实践

1. **统一使用错误代码** - 不要使用字符串比较，使用 `ERROR_CODES` 常量
2. **提供上下文信息** - 在处理错误时提供操作类型、参数等上下文
3. **合理设置重试** - 根据操作类型设置合适的重试次数和延迟
4. **监控错误趋势** - 定期查看错误统计，识别问题模式
5. **用户友好提示** - 确保错误消息对用户有意义并提供解决方案

## 🆘 故障排除

### 问题1: 错误通知不显示
```javascript
// 检查通知函数是否可用
if (typeof showNotification === 'function') {
  console.log('通知函数可用');
} else {
  console.error('通知函数不可用');
}
```

### 问题2: 重试不工作
```javascript
// 检查错误是否可恢复
const error = errorManager.createError(ERROR_CODES.NETWORK_ERROR, '测试');
console.log('错误可恢复:', error.recoverable);
```

### 问题3: 存储操作失败
```javascript
// 运行存储健康检查
const health = await StorageErrorHandler.checkStorageHealth();
console.log('存储健康状态:', health);
```

## 📚 更多资源

- [完整使用指南](ERROR-HANDLING-GUIDE.md) - 详细的API文档和高级用法
- [错误代码参考](ERROR-HANDLING-GUIDE.md#错误代码体系) - 所有错误代码的说明
- [架构设计](ERROR-HANDLING-GUIDE.md#系统架构) - 系统设计原理和组件说明

---

🎉 **恭喜！** 你已经掌握了错误处理系统的基本用法。现在可以开始在项目中使用统一的错误处理机制了！