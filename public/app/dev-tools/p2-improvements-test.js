// ==================== P2改进验证测试 ====================
/**
 * P2优先级改进验证测试
 * 验证类型安全系统、性能监控增强、存储优化等功能是否正常工作
 */

/**
 * P2改进测试套件
 */
class P2ImprovementsTest {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }
  
  /**
   * 运行所有P2测试
   */
  async runAllTests() {
    console.log('🚀 开始P2改进验证测试...');
    
    try {
      // 测试类型安全系统
      await this.testTypeSafetySystem();
      
      // 测试运行时类型检查
      await this.testRuntimeTypeChecker();
      
      // 测试增强性能监控
      await this.testEnhancedPerformanceMonitor();
      
      // 测试JSDoc类型注解
      await this.testJSDocTypeAnnotations();
      
      // 测试系统集成
      await this.testSystemIntegration();
      
      // 输出测试结果
      this.outputTestResults();
      
    } catch (error) {
      console.error('❌ P2改进测试运行失败:', error);
      this.addResult('P2测试运行', false, `测试运行失败: ${error.message}`);
    }
  }
  
  /**
   * 测试类型安全系统
   */
  async testTypeSafetySystem() {
    this.addTestSection('类型安全系统测试');
    
    // 测试核心类型定义是否存在
    const coreTypesExists = typeof window.TypeChecker !== 'undefined';
    this.addResult('核心类型定义存在', coreTypesExists, 'TypeChecker类应该存在');
    
    const typeAssertExists = typeof window.TypeAssert !== 'undefined';
    this.addResult('类型断言工具存在', typeAssertExists, 'TypeAssert类应该存在');
    
    if (coreTypesExists) {
      try {
        // 测试基本类型检查
        const stringCheck = window.TypeChecker.checkType('hello', 'string');
        this.addResult('字符串类型检查', stringCheck, '字符串类型检查应该通过');
        
        const numberCheck = window.TypeChecker.checkType(42, 'number');
        this.addResult('数字类型检查', numberCheck, '数字类型检查应该通过');
        
        const arrayCheck = window.TypeChecker.checkType(['a', 'b'], 'array');
        this.addResult('数组类型检查', arrayCheck, '数组类型检查应该通过');
        
        // 测试复杂类型检查
        const arrayElementCheck = window.TypeChecker.checkType(['hello', 'world'], 'Array<string>');
        this.addResult('数组元素类型检查', arrayElementCheck, '字符串数组类型检查应该通过');
        
        // 测试对象结构验证
        const testObj = {
          id: 'test-123',
          name: 'Test Object',
          value: 42
        };
        
        const schema = {
          id: 'string',
          name: 'string',
          value: 'number',
          optional: 'string?'
        };
        
        const schemaCheck = window.TypeChecker.validateSchema(testObj, schema);
        this.addResult('对象结构验证', schemaCheck, '对象结构验证应该通过');
        
      } catch (error) {
        this.addResult('类型安全系统功能测试', false, `类型检查失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 测试运行时类型检查器
   */
  async testRuntimeTypeChecker() {
    this.addTestSection('运行时类型检查器测试');
    
    const runtimeCheckerExists = typeof window.runtimeTypeChecker !== 'undefined';
    this.addResult('运行时类型检查器存在', runtimeCheckerExists, 'runtimeTypeChecker实例应该存在');
    
    if (runtimeCheckerExists) {
      const checker = window.runtimeTypeChecker;
      
      // 测试基本功能
      const hasCheckType = typeof checker.checkType === 'function';
      this.addResult('类型检查方法存在', hasCheckType, 'checkType方法应该存在');
      
      const hasValidateSchema = typeof checker.validateSchema === 'function';
      this.addResult('结构验证方法存在', hasValidateSchema, 'validateSchema方法应该存在');
      
      const hasCreateTypedFunction = typeof checker.createTypedFunction === 'function';
      this.addResult('类型安全函数创建方法存在', hasCreateTypedFunction, 'createTypedFunction方法应该存在');
      
      try {
        // 测试运行时检查
        const result = checker.checkType('test', 'string', 'runtime-test');
        this.addResult('运行时类型检查功能', result.valid, '运行时类型检查应该正常工作');
        
        // 测试统计信息
        const stats = checker.getStats();
        const hasValidStats = stats && typeof stats.enabled === 'boolean';
        this.addResult('统计信息获取', hasValidStats, '应该能获取统计信息');
        
        // 测试类型安全函数包装
        const testFunc = function(name, age) {
          return `${name} is ${age} years old`;
        };
        
        const typedFunc = checker.createTypedFunction(testFunc, {
          name: 'string',
          age: 'number'
        }, 'string');
        
        const funcResult = typedFunc('Alice', 30);
        const funcWorks = funcResult === 'Alice is 30 years old';
        this.addResult('类型安全函数包装', funcWorks, '类型安全函数应该正常工作');
        
      } catch (error) {
        this.addResult('运行时类型检查功能测试', false, `运行时检查失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 测试增强性能监控
   */
  async testEnhancedPerformanceMonitor() {
    this.addTestSection('增强性能监控系统测试');
    
    const enhancedMonitorExists = typeof window.enhancedPerformanceMonitor !== 'undefined';
    this.addResult('增强性能监控器存在', enhancedMonitorExists, 'enhancedPerformanceMonitor实例应该存在');
    
    if (enhancedMonitorExists) {
      const monitor = window.enhancedPerformanceMonitor;
      
      // 测试核心方法
      const methods = [
        'recordMetric',
        'incrementCounter', 
        'startTimer',
        'endTimer',
        'getSummary',
        'setEnabled'
      ];
      
      methods.forEach(method => {
        const methodExists = typeof monitor[method] === 'function';
        this.addResult(`性能监控方法: ${method}`, methodExists, `${method}方法应该存在`);
      });
      
      try {
        // 测试指标记录
        monitor.recordMetric('test.metric', 100, Date.now(), 'ms', { test: true });
        this.addResult('指标记录功能', true, '指标记录应该成功');
        
        // 测试计数器
        monitor.incrementCounter('test.counter', 5);
        this.addResult('计数器功能', true, '计数器增加应该成功');
        
        // 测试计时器
        const timerId = monitor.startTimer('test.timer');
        const timerStarted = typeof timerId === 'string';
        this.addResult('计时器启动', timerStarted, '计时器应该成功启动');
        
        if (timerStarted) {
          // 模拟一些工作
          await new Promise(resolve => setTimeout(resolve, 10));
          
          const duration = monitor.endTimer(timerId, { test: true });
          const timerWorked = typeof duration === 'number' && duration > 0;
          this.addResult('计时器功能', timerWorked, '计时器应该正确记录耗时');
        }
        
        // 测试摘要获取
        const summary = monitor.getSummary();
        const hasSummary = summary && typeof summary.timestamp === 'number';
        this.addResult('性能摘要获取', hasSummary, '应该能获取性能摘要');
        
        if (hasSummary) {
          const hasMetrics = summary.metrics && typeof summary.metrics === 'object';
          const hasCounters = summary.counters && typeof summary.counters === 'object';
          const hasSystemInfo = summary.systemInfo && typeof summary.systemInfo === 'object';
          
          this.addResult('摘要包含指标', hasMetrics, '摘要应该包含指标数据');
          this.addResult('摘要包含计数器', hasCounters, '摘要应该包含计数器数据');
          this.addResult('摘要包含系统信息', hasSystemInfo, '摘要应该包含系统信息');
        }
        
      } catch (error) {
        this.addResult('增强性能监控功能测试', false, `性能监控失败: ${error.message}`);
      }
    }
  }
  
  /**
   * 测试JSDoc类型注解
   */
  async testJSDocTypeAnnotations() {
    this.addTestSection('JSDoc类型注解测试');
    
    // 测试DI容器的类型注解
    const diContainerExists = typeof window.DIContainer !== 'undefined';
    this.addResult('DI容器类存在', diContainerExists, 'DIContainer类应该存在');
    
    if (diContainerExists) {
      try {
        // 测试类型化的DI容器方法
        const container = new window.DIContainer();
        
        // 测试类型安全的服务注册
        container.registerValue('testService', { name: 'test', value: 42 });
        this.addResult('类型安全服务注册', true, '服务注册应该成功');
        
        // 测试类型安全的服务解析
        const service = container.resolve('testService');
        const serviceValid = service && service.name === 'test' && service.value === 42;
        this.addResult('类型安全服务解析', serviceValid, '服务解析应该返回正确数据');
        
        // 测试方法链式调用
        const chainResult = container
          .registerValue('chainTest1', 'value1')
          .registerValue('chainTest2', 'value2');
        
        const chainingWorks = chainResult === container;
        this.addResult('方法链式调用', chainingWorks, 'DI容器方法应该支持链式调用');
        
      } catch (error) {
        this.addResult('JSDoc类型注解功能测试', false, `类型注解测试失败: ${error.message}`);
      }
    }
    
    // 测试类型模式定义
    const hasTranslationItemSchema = typeof window.TranslationItemSchema !== 'undefined';
    this.addResult('翻译项类型模式存在', hasTranslationItemSchema, 'TranslationItemSchema应该存在');
    
    const hasServiceConfigSchema = typeof window.ServiceConfigSchema !== 'undefined'; 
    this.addResult('服务配置类型模式存在', hasServiceConfigSchema, 'ServiceConfigSchema应该存在');
  }
  
  /**
   * 测试系统集成
   */
  async testSystemIntegration() {
    this.addTestSection('P2系统集成测试');
    
    // 测试所有P2组件是否正确加载
    const p2Components = {
      'TypeChecker': 'window.TypeChecker',
      'TypeAssert': 'window.TypeAssert', 
      'runtimeTypeChecker': 'window.runtimeTypeChecker',
      'enhancedPerformanceMonitor': 'window.enhancedPerformanceMonitor'
    };
    
    Object.entries(p2Components).forEach(([name, path]) => {
      const exists = this.checkGlobalPath(path);
      this.addResult(`P2组件加载: ${name}`, exists, `${name}应该正确加载`);
    });
    
    // 测试命名空间集成
    if (typeof window.namespaceManager !== 'undefined') {
      try {
        const typesNamespace = window.namespaceManager.getNamespace('App.types');
        const hasTypesNamespace = typesNamespace !== null;
        this.addResult('类型命名空间集成', hasTypesNamespace, 'App.types命名空间应该存在');
        
        const coreNamespace = window.namespaceManager.getNamespace('App.core');
        const hasCoreNamespace = coreNamespace !== null;
        this.addResult('核心命名空间集成', hasCoreNamespace, 'App.core命名空间应该存在');
        
      } catch (error) {
        this.addResult('命名空间集成测试', false, `命名空间集成失败: ${error.message}`);
      }
    }
    
    // 测试DI系统集成
    if (typeof getServiceSafely === 'function') {
      try {
        // 尝试通过DI系统获取P2服务
        const typeChecker = getServiceSafely('runtimeTypeChecker', null);
        const perfMonitor = getServiceSafely('enhancedPerformanceMonitor', null);
        
        this.addResult('类型检查器DI集成', typeChecker !== null, '类型检查器应该通过DI系统可用');
        this.addResult('性能监控器DI集成', perfMonitor !== null, '性能监控器应该通过DI系统可用');
        
      } catch (error) {
        this.addResult('DI系统集成测试', false, `DI集成失败: ${error.message}`);
      }
    }
    
    // 测试P2功能与现有系统的兼容性
    this.testBackwardCompatibility();
  }
  
  /**
   * 测试向后兼容性
   */
  testBackwardCompatibility() {
    // 测试现有功能是否仍然正常工作
    const existingFeatures = [
      'errorManager',
      'diContainer', 
      'namespaceManager',
      'domOptimizationManager',
      'requestDeduplicationManager'
    ];
    
    existingFeatures.forEach(feature => {
      const exists = typeof window[feature] !== 'undefined';
      this.addResult(`兼容性: ${feature}`, exists, `现有${feature}应该仍然可用`);
    });
    
    // 测试P1功能是否正常
    const p1Features = [
      'TranslationBusinessLogic',
      'TranslationUIController', 
      'getServiceSafely'
    ];
    
    p1Features.forEach(feature => {
      const exists = typeof window[feature] !== 'undefined';
      this.addResult(`P1兼容性: ${feature}`, exists, `P1功能${feature}应该仍然可用`);
    });
  }
  
  /**
   * 检查全局路径
   */
  checkGlobalPath(path) {
    try {
      const parts = path.split('.');
      let current = window;
      
      for (const part of parts) {
        if (part === 'window') continue;
        current = current[part];
        if (current === undefined) {
          return false;
        }
      }
      
      return current !== undefined;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 添加测试部分标题
   */
  addTestSection(title) {
    console.log(`\n📋 ${title}`);
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
    console.log('\n📊 P2改进验证测试结果');
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
    
    console.log('\n🎯 P2改进状态:');
    if (successRate >= 95) {
      console.log('✅ P2改进完全成功，所有功能正常工作');
    } else if (successRate >= 85) {
      console.log('⚠️ P2改进基本成功，少量功能需要关注');
    } else {
      console.log('❌ P2改进存在问题，需要修复');
    }
    
    return {
      success: successRate >= 95,
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
window.P2ImprovementsTest = P2ImprovementsTest;
window.p2ImprovementsTest = new P2ImprovementsTest();

// 提供便捷的测试运行函数
window.runP2ImprovementsTests = () => {
  return window.p2ImprovementsTest.runAllTests();
};

// 在开发模式下延迟自动运行测试
if (typeof isDevelopment !== 'undefined' && isDevelopment) {
  setTimeout(() => {
    if (document.readyState === 'complete') {
      console.log('🔧 开发模式：自动运行P2改进验证测试');
      window.runP2ImprovementsTests();
    }
  }, 6000);
}

// 手动运行提示
console.log('💡 使用 runP2ImprovementsTests() 手动运行P2改进验证测试');
