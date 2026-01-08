// ==================== 错误处理系统演示和测试（开发工具） ====================
// 从 core/error-demo.js 移动至 dev-tools 目录，仅在开发环境使用

/**
 * 错误处理系统的演示和测试功能
 * 用于验证错误处理系统是否正常工作
 */

/**
 * 错误处理演示类
 */
class ErrorHandlingDemo {
  constructor() {
    this.demoResults = [];
  }
  
  /**
   * 运行所有演示
   */
  async runAllDemos() {
    console.log('🚀 开始错误处理系统演示...');
    
    const demos = [
      { name: '网络错误演示', fn: () => this.demoNetworkErrors() },
      { name: 'API错误演示', fn: () => this.demoApiErrors() },
      { name: '存储错误演示', fn: () => this.demoStorageErrors() },
      { name: '文件处理错误演示', fn: () => this.demoFileErrors() },
      { name: '批量操作错误演示', fn: () => this.demoBatchErrors() },
      { name: '错误恢复演示', fn: () => this.demoErrorRecovery() }
    ];
    
    for (const demo of demos) {
      try {
        console.log(`\n📋 ${demo.name}`);
        await demo.fn();
        this.demoResults.push({ name: demo.name, status: 'success' });
      } catch (error) {
        console.error(`❌ ${demo.name} 失败:`, error);
        this.demoResults.push({ name: demo.name, status: 'failed', error });
      }
    }
    
    this.showDemoSummary();
  }
  
  /**
   * 网络错误演示
   */
  async demoNetworkErrors() {
    console.log('  测试网络超时错误...');
    
    try {
      // 模拟超时错误
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      timeoutError.code = 'TIMEOUT';
      
      const handledError = errorManager.handleError(timeoutError, {
        operation: 'networkRequest',
        url: 'https://api.example.com/test'
      });
      
      console.log('  ✅ 超时错误处理正常:', handledError.code);
    } catch (error) {
      console.error('  ❌ 超时错误处理失败:', error);
    }
    
    console.log('  测试网络连接错误...');
    
    try {
      // 模拟连接失败
      const networkError = new Error('Failed to fetch');
      const handledError = ErrorUtils.analyzeNetworkError(networkError, {
        url: 'https://api.example.com/test',
        method: 'POST'
      });
      
      console.log('  ✅ 网络错误分析正常:', handledError.code);
    } catch (error) {
      console.error('  ❌ 网络错误分析失败:', error);
    }
  }
  
  /**
   * API错误演示
   */
  async demoApiErrors() {
    console.log('  测试API密钥验证...');
    
    // 测试缺失的API密钥
    const missingKeyError = ErrorUtils.validateApiKey('', 'OpenAI');
    if (missingKeyError && missingKeyError.code === ERROR_CODES.API_KEY_MISSING) {
      console.log('  ✅ API密钥缺失检测正常');
    } else {
      console.error('  ❌ API密钥缺失检测失败');
    }
    
    // 测试无效的API密钥格式
    const invalidKeyError = ErrorUtils.validateApiKey('invalid-key', 'OpenAI');
    if (invalidKeyError && invalidKeyError.code === ERROR_CODES.API_KEY_INVALID) {
      console.log('  ✅ API密钥格式验证正常');
    } else {
      console.error('  ❌ API密钥格式验证失败');
    }
    
    // 测试有效的API密钥
    const validKey = 'sk-' + 'a'.repeat(48);
    const validKeyError = ErrorUtils.validateApiKey(validKey, 'OpenAI');
    if (!validKeyError) {
      console.log('  ✅ 有效API密钥验证正常');
    } else {
      console.error('  ❌ 有效API密钥验证失败');
    }
  }
  
  /**
   * 存储错误演示
   */
  async demoStorageErrors() {
    console.log('  测试存储配额错误...');
    
    try {
      // 模拟配额超出错误
      const quotaError = new Error('QuotaExceededError');
      quotaError.name = 'QuotaExceededError';
      
      const handledError = ErrorUtils.analyzeStorageError(quotaError, 'saveProject');
      
      if (handledError.code === ERROR_CODES.STORAGE_QUOTA_EXCEEDED) {
        console.log('  ✅ 存储配额错误处理正常');
      } else {
        console.error('  ❌ 存储配额错误处理失败');
      }
    } catch (error) {
      console.error('  ❌ 存储错误演示失败:', error);
    }
    
    console.log('  测试存储健康检查...');
    
    try {
      const health = await StorageErrorHandler.checkStorageHealth();
      console.log('  ✅ 存储健康检查完成:', {
        indexedDB: health.indexedDB.available,
        localStorage: health.localStorage.available,
        issues: health.issues.length
      });
    } catch (error) {
      console.error('  ❌ 存储健康检查失败:', error);
    }
  }
  
  /**
   * 文件处理错误演示
   */
  async demoFileErrors() {
    console.log('  测试文件验证...');
    
    try {
      // 创建更真实的模拟文件对象
      const mockFile = new File(['test content'], 'test.json', {
        type: 'application/json',
        lastModified: Date.now()
      });
      
      const validationError = ErrorUtils.validateFile(mockFile, {
        maxSize: 10 * 1024 * 1024,
        allowedExtensions: ['json', 'xml']
      });
      
      if (!validationError) {
        console.log('  ✅ 文件验证正常');
      } else {
        console.error('  ❌ 文件验证失败:', validationError);
      }
    } catch (error) {
      // 如果浏览器不支持File构造函数，使用备用方案
      console.log('  ⚠️ 浏览器不支持File构造函数，跳过文件验证测试');
    }
    
    console.log('  测试文件名验证...');
    
    try {
      // 测试危险文件名
      const dangerousNameError = FileErrorHandler.validateFileName('test<script>.json');
      if (dangerousNameError && dangerousNameError.code === ERROR_CODES.INVALID_INPUT) {
        console.log('  ✅ 危险文件名检测正常');
      } else {
        console.error('  ❌ 危险文件名检测失败');
      }
      
      // 测试正常文件名
      const normalNameError = FileErrorHandler.validateFileName('test.json');
      if (!normalNameError) {
        console.log('  ✅ 正常文件名验证正常');
      } else {
        console.error('  ❌ 正常文件名验证失败');
      }
    } catch (error) {
      console.error('  ❌ 文件名验证演示失败:', error);
    }
  }
  
  /**
   * 批量操作错误演示
   */
  async demoBatchErrors() {
    console.log('  测试批量错误收集器...');
    
    try {
      const collector = new BatchErrorCollector();
      
      // 添加一些成功和失败的结果
      collector.addSuccess(0, 'success result 1', { id: 1 });
      collector.addSuccess(1, 'success result 2', { id: 2 });
      
      const error1 = errorManager.createError(ERROR_CODES.NETWORK_ERROR, '网络错误');
      const error2 = errorManager.createError(ERROR_CODES.API_RATE_LIMITED, '限流错误');
      
      collector.addError(2, error1, { id: 3 });
      collector.addError(3, error2, { id: 4 });
      
      const summary = collector.getSummary();
      
      if (summary.successCount === 2 && summary.errorCount === 2) {
        console.log('  ✅ 批量错误收集器正常');
      } else {
        console.error('  ❌ 批量错误收集器异常:', summary);
      }
      
      const retryableErrors = collector.getRetryableErrors();
      console.log('  📊 可重试错误数量:', retryableErrors.length);
      
    } catch (error) {
      console.error('  ❌ 批量错误演示失败:', error);
    }
  }
  
  /**
   * 错误恢复演示
   */
  async demoErrorRecovery() {
    console.log('  测试错误恢复策略...');
    
    try {
      let attemptCount = 0;
      
      // 创建一个会失败几次然后成功的函数
      const unreliableFunction = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return 'Success after retries';
      };
      
      const result = await safeAsync(unreliableFunction, {
        retryCount: 3,
        retryDelay: 100,
        context: { operation: 'errorRecoveryDemo' }
      });
      
      if (result.success && result.data === 'Success after retries') {
        console.log('  ✅ 错误恢复策略正常，重试次数:', attemptCount);
      } else {
        console.error('  ❌ 错误恢复策略失败:', result);
      }
      
    } catch (error) {
      console.error('  ❌ 错误恢复演示失败:', error);
    }
  }
  
  /**
   * 显示演示总结
   */
  showDemoSummary() {
    console.log('\n📊 错误处理系统演示总结:');
    
    const successCount = this.demoResults.filter(r => r.status === 'success').length;
    const failedCount = this.demoResults.filter(r => r.status === 'failed').length;
    
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failedCount}`);
    
    if (failedCount > 0) {
      console.log('\n失败的演示:');
      this.demoResults
        .filter(r => r.status === 'failed')
        .forEach(r => console.log(`  - ${r.name}: ${r.error?.message || '未知错误'}`));
    }
    
    // 显示错误统计
    const stats = errorManager.getErrorStats();
    console.log('\n📈 错误统计:', {
      总错误数: stats.total,
      按类别: stats.byCategory,
      按严重程度: stats.bySeverity
    });
  }
  
  /**
   * 测试错误通知系统
   */
  async testNotificationSystem() {
    console.log('\n🔔 测试错误通知系统...');
    
    // 测试不同严重级别的错误通知
    const errors = [
      errorManager.createError(ERROR_CODES.USER_CANCELLED, '用户取消操作'),
      errorManager.createError(ERROR_CODES.API_RATE_LIMITED, 'API限流'),
      errorManager.createError(ERROR_CODES.API_KEY_MISSING, 'API密钥缺失'),
      errorManager.createError(ERROR_CODES.STORAGE_CORRUPTED, '存储损坏')
    ];
    
    for (let i = 0; i < errors.length; i++) {
      setTimeout(() => {
        errorManager.handleError(errors[i], { demo: true, index: i });
      }, i * 2000); // 每2秒显示一个错误
    }
    
    console.log('  📝 错误通知已排队，请观察通知显示');
  }
  
  /**
   * 导出错误日志
   */
  exportErrorLog() {
    console.log('\n📤 导出错误日志...');
    errorManager.exportErrorLog();
    console.log('  ✅ 错误日志已导出');
  }
  
  /**
   * 清理演示数据
   */
  cleanup() {
    console.log('\n🧹 清理演示数据...');
    this.demoResults = [];
    errorManager.clearErrorHistory();
    console.log('  ✅ 清理完成');
  }
}

// ==================== 全局演示函数 ====================

/**
 * 运行错误处理演示
 */
async function runErrorHandlingDemo() {
  const demo = new ErrorHandlingDemo();
  await demo.runAllDemos();
  return demo;
}

/**
 * 测试特定错误类型
 */
function testSpecificError(errorCode, message, details = {}) {
  console.log(`🧪 测试错误: ${errorCode}`);
  
  try {
    const error = errorManager.createError(errorCode, message, details);
    const handledError = errorManager.handleError(error, { test: true });
    
    console.log('  ✅ 错误处理成功:', {
      code: handledError.code,
      severity: handledError.severity,
      category: handledError.category,
      recoverable: handledError.recoverable
    });
    
    return handledError;
  } catch (error) {
    console.error('  ❌ 错误处理失败:', error);
    return null;
  }
}

/**
 * 显示错误处理帮助信息
 */
function showErrorHandlingHelp() {
  console.log(`
🔧 错误处理系统使用指南

📋 可用的演示函数:
  runErrorHandlingDemo()           - 运行完整的错误处理演示
  testSpecificError(code, msg)     - 测试特定错误类型
  showErrorHandlingHelp()          - 显示此帮助信息

🎯 错误代码示例:
  ERROR_CODES.NETWORK_ERROR        - 网络错误
  ERROR_CODES.API_KEY_MISSING      - API密钥缺失
  ERROR_CODES.STORAGE_QUOTA_EXCEEDED - 存储配额超出
  ERROR_CODES.FILE_TOO_LARGE       - 文件过大
  ERROR_CODES.TRANSLATION_FAILED   - 翻译失败

📊 统计和管理:
  errorManager.getErrorStats()     - 获取错误统计
  errorManager.exportErrorLog()    - 导出错误日志
  errorManager.clearErrorHistory() - 清理错误历史

🔍 工具函数:
  safeAsync(fn, options)           - 安全执行异步函数
  withErrorHandling(fn, options)   - 包装函数添加错误处理
  BatchErrorCollector              - 批量错误收集器

示例用法:
  // 测试网络错误
  testSpecificError(ERROR_CODES.NETWORK_ERROR, '连接失败', { url: 'https://api.example.com' });
  
  // 运行完整演示
  runErrorHandlingDemo().then(demo => {
    console.log('演示完成');
    demo.exportErrorLog();
  });
`);
}

// ==================== 导出接口 ====================
window.ErrorHandlingDemo = ErrorHandlingDemo;
window.runErrorHandlingDemo = runErrorHandlingDemo;
window.testSpecificError = testSpecificError;
window.showErrorHandlingHelp = showErrorHandlingHelp;

// 在开发模式下自动显示帮助信息
if (typeof isDevelopment !== 'undefined' && isDevelopment) {
  console.log('🔧 错误处理系统已加载！输入 showErrorHandlingHelp() 查看使用指南');
}

