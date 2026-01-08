// ==================== 错误处理系统测试套件（开发工具） ====================
// 从 core/error-system-test.js 移动至 dev-tools 目录，仅在开发环境使用

/**
 * 错误处理系统测试类
 */
class ErrorSystemTest {
  constructor() {
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
  }
  
  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始错误处理系统测试...');
    
    try {
      // 等待错误系统就绪
      await waitForErrorSystem(3000);
      
      // 运行测试套件
      await this.testErrorCreation();
      await this.testErrorHandling();
      await this.testErrorUtils();
      await this.testModuleHandlers();
      await this.testBatchErrorCollector();
      await this.testErrorRecovery();
      await this.testNotificationSystem();
      
      // 显示测试结果
      this.showTestResults();
      
    } catch (error) {
      console.error('❌ 测试运行失败:', error);
      this.addResult('系统初始化', false, error.message);
      this.showTestResults();
    }
  }
  
  /**
   * 测试错误创建
   */
  async testErrorCreation() {
    try {
      // 测试基本错误创建
      const error1 = errorManager.createError(ERROR_CODES.NETWORK_ERROR, '测试网络错误');
      this.assert(error1 instanceof TranslationToolError, '错误对象类型正确');
      this.assert(error1.code === ERROR_CODES.NETWORK_ERROR, '错误代码正确');
      this.assert(error1.category === ERROR_CATEGORIES.NETWORK, '错误分类正确');
      this.assert(error1.severity === ERROR_SEVERITY.MEDIUM, '错误严重级别正确');
      
      // 测试自定义消息
      const error2 = errorManager.createError(ERROR_CODES.API_KEY_MISSING, '自定义API密钥错误');
      this.assert(error2.message === '自定义API密钥错误', '自定义消息正确');
      
      // 测试错误详情
      const error3 = errorManager.createError(ERROR_CODES.FILE_TOO_LARGE, null, {
        fileName: 'test.json',
        fileSize: 1024000
      });
      this.assert(error3.details.fileName === 'test.json', '错误详情正确');
      
      this.addResult('错误创建', true);
    } catch (error) {
      this.addResult('错误创建', false, error.message);
    }
  }
  
  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    try {
      // 测试JavaScript错误处理
      const jsError = new Error('测试JavaScript错误');
      const handled1 = errorManager.handleError(jsError, { test: true });
      this.assert(handled1 instanceof TranslationToolError, '处理JavaScript错误正确');
      
      // 测试网络错误处理
      const networkError = new Error('Failed to fetch');
      const handled2 = errorManager.handleError(networkError);
      this.assert(handled2.code === ERROR_CODES.NETWORK_ERROR, '网络错误识别正确');
      
      // 测试API错误处理
      const apiError = { status: 401, message: 'Unauthorized' };
      const handled3 = errorManager.handleError(apiError);
      this.assert(handled3.code === ERROR_CODES.API_UNAUTHORIZED, 'API错误识别正确');
      
      this.addResult('错误处理', true);
    } catch (error) {
      this.addResult('错误处理', false, error.message);
    }
  }
  
  /**
   * 测试错误工具函数
   */
  async testErrorUtils() {
    try {
      // 测试safeAsync
      const successResult = await safeAsync(async () => 'success');
      this.assert(successResult.success === true, 'safeAsync成功情况正确');
      this.assert(successResult.data === 'success', 'safeAsync返回数据正确');
      
      const failResult = await safeAsync(async () => {
        throw new Error('test error');
      }, { suppressError: true });
      this.assert(failResult.success === false, 'safeAsync失败情况正确');
      this.assert(failResult.error !== null, 'safeAsync错误处理正确');
      
      // 测试API密钥验证
      const keyError1 = ErrorUtils.validateApiKey('', 'openai');
      this.assert(keyError1 && keyError1.code === ERROR_CODES.API_KEY_MISSING, 'API密钥缺失检测正确');
      
      const keyError2 = ErrorUtils.validateApiKey('invalid-key', 'openai');
      this.assert(keyError2 && keyError2.code === ERROR_CODES.API_KEY_INVALID, 'API密钥格式检测正确');
      
      const keyError3 = ErrorUtils.validateApiKey('sk-1234567890123456789012345678901234567890123456789012345678', 'openai');
      this.assert(keyError3 === null, '有效API密钥验证正确');
      
      this.addResult('错误工具函数', true);
    } catch (error) {
      this.addResult('错误工具函数', false, error.message);
    }
  }
  
  /**
   * 测试模块错误处理器
   */
  async testModuleHandlers() {
    try {
      // 测试翻译错误处理器
      if (window.TranslationErrorHandler) {
        const translationError = TranslationErrorHandler.formatTranslationErrorV2(
          new Error('translation failed'), 'openai'
        );
        this.assert(translationError.type !== undefined, '翻译错误格式化正确');
      }
      
      // 测试存储错误处理器
      if (window.StorageErrorHandler) {
        const storageError = new Error('QuotaExceededError');
        storageError.name = 'QuotaExceededError';
        const handled = StorageErrorHandler.notifyStorageErrorV2(storageError, 'put');
        this.assert(handled.code === ERROR_CODES.STORAGE_QUOTA_EXCEEDED, '存储错误处理正确');
      }
      
      // 测试文件错误处理器
      if (window.FileErrorHandler) {
        const nameError = FileErrorHandler.validateFileName('invalid<name>');
        this.assert(nameError && nameError.code === ERROR_CODES.INVALID_INPUT, '文件名验证正确');
      }
      
      this.addResult('模块错误处理器', true);
    } catch (error) {
      this.addResult('模块错误处理器', false, error.message);
    }
  }
  
  /**
   * 测试批量错误收集器
   */
  async testBatchErrorCollector() {
    try {
      const collector = new BatchErrorCollector();
      
      // 添加成功和错误
      collector.addSuccess(0, 'result1', 'item1');
      collector.addError(1, new Error('test error'), 'item2');
      collector.addSuccess(2, 'result2', 'item3');
      
      const summary = collector.getSummary();
      this.assert(summary.total === 3, '批量收集器总数正确');
      this.assert(summary.successCount === 2, '批量收集器成功数正确');
      this.assert(summary.errorCount === 1, '批量收集器错误数正确');
      this.assert(summary.successRate === 2/3, '批量收集器成功率正确');
      
      const retryable = collector.getRetryableErrors();
      this.assert(Array.isArray(retryable), '可重试错误列表正确');
      
      this.addResult('批量错误收集器', true);
    } catch (error) {
      this.addResult('批量错误收集器', false, error.message);
    }
  }
  
  /**
   * 测试错误恢复
   */
  async testErrorRecovery() {
    try {
      // 创建可恢复的错误
      const recoverableError = errorManager.createError(ERROR_CODES.NETWORK_ERROR);
      this.assert(recoverableError.recoverable === true, '可恢复错误标记正确');
      
      // 创建不可恢复的错误
      const nonRecoverableError = errorManager.createError(ERROR_CODES.STORAGE_CORRUPTED);
      this.assert(nonRecoverableError.recoverable === false, '不可恢复错误标记正确');
      
      this.addResult('错误恢复', true);
    } catch (error) {
      this.addResult('错误恢复', false, error.message);
    }
  }
  
  /**
   * 测试通知系统
   */
  async testNotificationSystem() {
    try {
      // 测试通知函数存在
      this.assert(typeof window.showNotification === 'function', '通知函数存在');
      
      // 测试通知调用（不会实际显示）
      let notificationCalled = false;
      const originalNotification = window.showNotification;
      
      window.showNotification = (type, title, message) => {
        notificationCalled = true;
        this.assert(typeof type === 'string', '通知类型正确');
        this.assert(typeof title === 'string', '通知标题正确');
        this.assert(typeof message === 'string', '通知消息正确');
      };
      
      // 触发一个错误来测试通知
      errorManager.handleError(new Error('test notification'));
      
      // 等待通知处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.assert(notificationCalled, '通知系统被调用');
      
      // 恢复原始通知函数
      window.showNotification = originalNotification;
      
      this.addResult('通知系统', true);
    } catch (error) {
      this.addResult('通知系统', false, error.message);
    }
  }
  
  /**
   * 断言函数
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(`断言失败: ${message}`);
    }
  }
  
  /**
   * 添加测试结果
   */
  addResult(testName, passed, error = null) {
    this.testResults.push({
      name: testName,
      passed,
      error,
      timestamp: new Date().toISOString()
    });
    
    if (passed) {
      this.passed++;
      console.log(`✅ ${testName}: 通过`);
    } else {
      this.failed++;
      console.error(`❌ ${testName}: 失败 - ${error}`);
    }
  }
  
  /**
   * 显示测试结果
   */
  showTestResults() {
    const total = this.passed + this.failed;
    const passRate = total > 0 ? (this.passed / total * 100).toFixed(1) : 0;
    
    console.log('\n📊 错误处理系统测试结果:');
    console.log(`总计: ${total}, 通过: ${this.passed}, 失败: ${this.failed}`);
    console.log(`通过率: ${passRate}%`);
    
    if (this.failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
    
    // 显示通知
    if (typeof window.showNotification === 'function') {
      const type = this.failed === 0 ? 'success' : 'warning';
      const title = '错误处理系统测试完成';
      const message = `通过率: ${passRate}% (${this.passed}/${total})`;
      window.showNotification(type, title, message);
    }
    
    return {
      total,
      passed: this.passed,
      failed: this.failed,
      passRate: parseFloat(passRate),
      results: this.testResults
    };
  }
  
  /**
   * 获取测试报告
   */
  getTestReport() {
    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.passed + this.failed,
        passed: this.passed,
        failed: this.failed,
        passRate: this.passed + this.failed > 0 ? (this.passed / (this.passed + this.failed) * 100) : 0
      },
      results: this.testResults,
      systemStatus: window.errorSystemIntegrator?.getSystemStatus() || null
    };
  }
}

// ==================== 便捷测试函数 ====================

/**
 * 运行错误处理系统测试
 * @returns {Promise<Object>} 测试结果
 */
async function runErrorSystemTest() {
  const test = new ErrorSystemTest();
  await test.runAllTests();
  return test.getTestReport();
}

/**
 * 快速健康检查
 * @returns {Object} 健康检查结果
 */
function quickHealthCheck() {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'unknown',
    issues: [],
    components: {}
  };
  
  try {
    // 检查核心组件
    health.components.errorManager = !!window.errorManager;
    health.components.errorUtils = !!window.ErrorUtils;
    health.components.integrator = !!window.errorSystemIntegrator;
    
    // 检查模块
    health.components.translationHandler = !!window.TranslationErrorHandler;
    health.components.storageHandler = !!window.StorageErrorHandler;
    health.components.networkHandler = !!window.NetworkErrorHandler;
    health.components.fileHandler = !!window.FileErrorHandler;
    
    // 检查通知系统
    health.components.notification = typeof window.showNotification === 'function';
    
    // 统计问题
    const componentCount = Object.keys(health.components).length;
    const workingCount = Object.values(health.components).filter(Boolean).length;
    
    if (workingCount === componentCount) {
      health.status = 'healthy';
    } else if (workingCount >= componentCount * 0.8) {
      health.status = 'warning';
      health.issues.push(`${componentCount - workingCount} 个组件不可用`);
    } else {
      health.status = 'error';
      health.issues.push(`多个关键组件不可用 (${workingCount}/${componentCount})`);
    }
    
  } catch (error) {
    health.status = 'error';
    health.issues.push(`健康检查失败: ${error.message}`);
  }
  
  return health;
}

// ==================== 导出接口 ====================
window.ErrorSystemTest = ErrorSystemTest;
window.runErrorSystemTest = runErrorSystemTest;
window.quickHealthCheck = quickHealthCheck;

// 开发模式下自动运行测试（保持与原逻辑一致）
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  // 延迟运行测试，确保所有模块都已加载
  setTimeout(() => {
    if (isErrorSystemReady()) {
      console.log('🔍 开发模式：运行错误处理系统快速健康检查...');
      const health = quickHealthCheck();
      console.log('健康检查结果:', health);
      
      if (health.status !== 'healthy') {
        console.warn('⚠️ 错误处理系统存在问题，建议运行完整测试');
      }
    }
  }, 2000);
}

