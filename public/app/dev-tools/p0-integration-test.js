// ==================== P0修复效果验证测试 ====================
/**
 * P0优先级修复效果验证测试
 * 验证DI集成、代码重复消除、统一处理器等功能是否正常工作
 */

/**
 * P0集成测试套件
 */
class P0IntegrationTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }
  
  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🧪 开始P0修复效果验证测试...');
    
    try {
      // 测试DI系统集成
      await this.testDISystemIntegration();
      
      // 测试服务获取
      await this.testServiceRetrieval();
      
      // 测试验证器集成
      await this.testValidatorIntegration();
      
      // 测试统一处理器
      await this.testUnifiedHandlers();
      
      // 测试事件绑定管理
      await this.testEventBindingManager();
      
      // 测试存储错误处理
      await this.testStorageErrorHandler();
      
      // 输出测试结果
      this.outputTestResults();
      
    } catch (error) {
      console.error('❌ P0测试运行失败:', error);
      this.addResult('P0测试运行', false, `测试运行失败: ${error.message}`);
    }
  }
  
  /**
   * 测试DI系统集成
   */
  async testDISystemIntegration() {
    this.addTestSection('DI系统集成测试');
    
    // 测试DI容器存在
    const diContainerExists = typeof window.diContainer !== 'undefined' && window.diContainer !== null;
    this.addResult('DI容器存在', diContainerExists, 'window.diContainer应该存在');
    
    // 测试服务定位器存在
    const serviceLocatorExists = typeof window.serviceLocator !== 'undefined' && window.serviceLocator !== null;
    this.addResult('服务定位器存在', serviceLocatorExists, 'window.serviceLocator应该存在');
    
    // 测试getServiceSafely函数
    const getServiceSafelyExists = typeof window.getServiceSafely === 'function';
    this.addResult('getServiceSafely函数存在', getServiceSafelyExists, 'getServiceSafely应该是函数');
    
    // 测试架构状态检查
    if (typeof window.checkArchitectureStatus === 'function') {
      try {
        const status = window.checkArchitectureStatus();
        const statusValid = status && typeof status === 'object' && status.diContainer;
        this.addResult('架构状态检查', statusValid, '架构状态应该包含必要信息');
      } catch (error) {
        this.addResult('架构状态检查', false, `状态检查失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 测试服务获取
   */
  async testServiceRetrieval() {
    this.addTestSection('服务获取测试');
    
    const testServices = [
      'appState',
      'errorManager', 
      'translationValidators',
      'translationResultHandler',
      'storageErrorHandler',
      'eventBindingManager'
    ];
    
    for (const serviceName of testServices) {
      try {
        const service = typeof getServiceSafely === 'function' 
          ? getServiceSafely(serviceName, serviceName)
          : window[serviceName];
        
        const serviceExists = service !== null && service !== undefined;
        this.addResult(`服务获取: ${serviceName}`, serviceExists, `${serviceName}服务应该可获取`);
        
      } catch (error) {
        this.addResult(`服务获取: ${serviceName}`, false, `获取失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 测试验证器集成
   */
  async testValidatorIntegration() {
    this.addTestSection('验证器集成测试');
    
    // 测试TranslationValidators存在
    const validatorsExist = typeof window.TranslationValidators !== 'undefined';
    this.addResult('TranslationValidators存在', validatorsExist, 'TranslationValidators应该存在');
    
    if (validatorsExist) {
      // 测试验证器方法
      const methods = [
        'validateProjectExists',
        'validateTranslationItems', 
        'validateItemSelected',
        'validateFileSelected'
      ];
      
      for (const method of methods) {
        const methodExists = typeof window.TranslationValidators[method] === 'function';
        this.addResult(`验证器方法: ${method}`, methodExists, `${method}应该是函数`);
      }
    }
  }
  
  /**
   * 测试统一处理器
   */
  async testUnifiedHandlers() {
    this.addTestSection('统一处理器测试');
    
    // 测试翻译结果处理器
    const resultHandlerExists = typeof window.handleTranslationResults === 'function';
    this.addResult('翻译结果处理器存在', resultHandlerExists, 'handleTranslationResults应该是函数');
    
    // 测试UI更新器
    const uiUpdaterExists = typeof window.updateTranslationUI === 'function';
    this.addResult('UI更新器存在', uiUpdaterExists, 'updateTranslationUI应该是函数');
    
    // 测试验证工具
    const validationUtilsExist = typeof window.ValidationUtils !== 'undefined';
    this.addResult('验证工具存在', validationUtilsExist, 'ValidationUtils应该存在');
  }
  
  /**
   * 测试事件绑定管理器
   */
  async testEventBindingManager() {
    this.addTestSection('事件绑定管理器测试');
    
    // 测试EventBindingManager类存在
    const managerClassExists = typeof window.EventBindingManager !== 'undefined';
    this.addResult('EventBindingManager类存在', managerClassExists, 'EventBindingManager类应该存在');
    
    // 测试全局实例存在
    const instanceExists = typeof window.eventBindingManager !== 'undefined';
    this.addResult('事件绑定管理器实例存在', instanceExists, 'eventBindingManager实例应该存在');
    
    // 测试便捷方法存在
    const convenienceMethodsExist = typeof window.eventBindings !== 'undefined';
    this.addResult('事件绑定便捷方法存在', convenienceMethodsExist, 'eventBindings便捷方法应该存在');
    
    if (instanceExists && window.eventBindingManager) {
      // 测试基本方法
      const methods = ['bind', 'unbind', 'unbindGroup', 'delegate', 'throttle', 'debounce'];
      for (const method of methods) {
        const methodExists = typeof window.eventBindingManager[method] === 'function';
        this.addResult(`事件管理器方法: ${method}`, methodExists, `${method}方法应该存在`);
      }
    }
  }
  
  /**
   * 测试存储错误处理器
   */
  async testStorageErrorHandler() {
    this.addTestSection('存储错误处理器测试');
    
    // 测试StorageErrorHandler类存在
    const handlerClassExists = typeof window.StorageErrorHandler !== 'undefined';
    this.addResult('StorageErrorHandler类存在', handlerClassExists, 'StorageErrorHandler类应该存在');
    
    // 测试全局实例存在
    const instanceExists = typeof window.storageErrorHandler !== 'undefined';
    this.addResult('存储错误处理器实例存在', instanceExists, 'storageErrorHandler实例应该存在');
    
    if (instanceExists && window.storageErrorHandler) {
      // 测试基本方法
      const methods = [
        'handleError',
        'handleQuotaError',
        'handlePermissionError',
        'handleGenericStorageError'
      ];
      
      for (const method of methods) {
        const methodExists = typeof window.storageErrorHandler[method] === 'function';
        this.addResult(`存储错误处理方法: ${method}`, methodExists, `${method}方法应该存在`);
      }
    }
  }
  
  /**
   * 添加测试部分标题
   */
  addTestSection(title) {
    console.log(`\n📝 ${title}`);
    this.testResults.details.push({ type: 'section', title });
  }
  
  /**
   * 添加测试结果
   */
  addResult(testName, passed, message = '') {
    this.testResults.total++;
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}: ${message}`);
    }
    
    this.testResults.details.push({
      type: 'test',
      name: testName,
      passed,
      message
    });
  }
  
  /**
   * 输出测试结果
   */
  outputTestResults() {
    console.log('\n📊 P0修复效果验证测试结果');
    console.log('='.repeat(50));
    console.log(`总计: ${this.testResults.total} 个测试`);
    console.log(`通过: ${this.testResults.passed} 个 ✅`);
    console.log(`失败: ${this.testResults.failed} 个 ❌`);
    
    const successRate = ((this.testResults.passed / this.testResults.total) * 100).toFixed(1);
    console.log(`成功率: ${successRate}%`);
    
    if (this.testResults.failed > 0) {
      console.log('\n⚠️ 失败的测试:');
      this.testResults.details
        .filter(item => item.type === 'test' && !item.passed)
        .forEach(item => {
          console.log(`  • ${item.name}: ${item.message}`);
        });
    }
    
    console.log('\n🎯 P0修复状态:');
    if (successRate >= 90) {
      console.log('✅ P0修复基本成功，系统集成良好');
    } else if (successRate >= 70) {
      console.log('⚠️ P0修复部分成功，需要关注失败项目');
    } else {
      console.log('❌ P0修复存在重大问题，需要修复');
    }
    
    return {
      success: successRate >= 90,
      successRate,
      ...this.testResults
    };
  }
  
  /**
   * 获取测试报告
   */
  getReport() {
    return this.testResults;
  }
}

// ==================== 导出和自动运行 ====================

// 创建全局测试实例
window.P0IntegrationTest = P0IntegrationTest;
window.p0IntegrationTest = new P0IntegrationTest();

// 提供便捷的测试运行函数
window.runP0Tests = () => {
  return window.p0IntegrationTest.runAllTests();
};

// 在开发模式下自动运行测试
if (typeof isDevelopment !== 'undefined' && isDevelopment) {
  // 延迟执行，确保所有脚本都已加载
  setTimeout(() => {
    if (document.readyState === 'complete') {
      console.log('🔧 开发模式：自动运行P0集成测试');
      window.runP0Tests();
    }
  }, 2000);
}

// 也可以手动运行测试
console.log('💡 使用 runP0Tests() 手动运行P0修复效果验证测试');
