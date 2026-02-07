// ==================== 架构集成助手函数 ====================
/**
 * 架构集成助手函数集合
 * 提供架构系统集成的高级工具和便捷函数
 * 支持调试、监控和系统健康检查
 */

class ArchitectureIntegrationHelpers {
  constructor() {
    this.integrationStatus = new Map();
    this.performanceMetrics = new Map();
    this.errorLog = [];
    this.maxErrorLogSize = 100;
  }

  /**
   * 检查架构系统健康状态
   * @returns {Object} 系统健康报告
   */
  checkArchitectureHealth() {
    const report = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      components: {},
      issues: [],
      recommendations: []
    };

    try {
      // 检查依赖注入系统
      const diStatus = this.checkDIContainer();
      report.components.dependencyInjection = diStatus;
      
      // 检查服务注册状态
      const serviceStatus = this.checkServiceRegistration();
      report.components.services = serviceStatus;
      
      // 检查DOM优化系统
      const domStatus = this.checkDOMOptimization();
      report.components.domOptimization = domStatus;
      
      // 检查错误管理系统
      const errorStatus = this.checkErrorManagement();
      report.components.errorManagement = errorStatus;
      
      // 检查性能监控系统
      const perfStatus = this.checkPerformanceMonitoring();
      report.components.performance = perfStatus;

      // 计算整体健康状态
      const componentScores = Object.values(report.components).map(c => c.score);
      const avgScore = componentScores.reduce((a, b) => a + b, 0) / componentScores.length;
      
      if (avgScore >= 0.9) {
        report.overall = 'excellent';
      } else if (avgScore >= 0.7) {
        report.overall = 'good';
      } else if (avgScore >= 0.5) {
        report.overall = 'fair';
      } else {
        report.overall = 'poor';
      }

      // 收集问题和建议
      Object.values(report.components).forEach(component => {
        if (component.issues) {
          report.issues.push(...component.issues);
        }
        if (component.recommendations) {
          report.recommendations.push(...component.recommendations);
        }
      });

    } catch (error) {
      report.overall = 'error';
      report.issues.push(`健康检查执行失败: ${error.message}`);
      (loggers.architecture || console).error('架构健康检查失败:', error);
    }

    return report;
  }

  /**
   * 检查依赖注入容器状态
   * @returns {Object} DI容器状态报告
   */
  checkDIContainer() {
    const status = {
      name: '依赖注入容器',
      available: false,
      score: 0,
      details: {},
      issues: [],
      recommendations: []
    };

    try {
      // 检查DI容器是否存在
      if (window.diContainer) {
        status.available = true;
        status.details.containerExists = true;
        
        // 检查核心方法
        const methods = ['registerSingleton', 'get', 'has', 'dispose'];
        const availableMethods = methods.filter(method => 
          typeof window.diContainer[method] === 'function'
        );
        
        status.details.availableMethods = availableMethods;
        status.details.methodsScore = availableMethods.length / methods.length;
        
        // 检查getServiceSafely函数
        if (typeof getServiceSafely === 'function') {
          status.details.getServiceSafelyAvailable = true;
        } else {
          status.issues.push('getServiceSafely函数不可用');
          status.recommendations.push('确保加载架构系统初始化代码');
        }
        
        status.score = 0.3 + (status.details.methodsScore * 0.7);
        
      } else {
        status.issues.push('DI容器未初始化');
        status.recommendations.push('检查bootstrap.js是否正确加载并执行');
      }

    } catch (error) {
      status.issues.push(`DI容器检查失败: ${error.message}`);
    }

    return status;
  }

  /**
   * 检查核心服务注册状态
   * @returns {Object} 服务注册状态报告
   */
  checkServiceRegistration() {
    const status = {
      name: '服务注册',
      score: 0,
      details: {},
      issues: [],
      recommendations: []
    };

    const requiredServices = [
      'appState',
      'errorManager', 
      'storageManager',
      'translationService',
      'domOptimizationManager',
      'performanceMonitor',
      'eventManager'
    ];

    try {
      const registeredServices = [];
      const missingServices = [];

      requiredServices.forEach(serviceName => {
        const service = getServiceSafely ? getServiceSafely(serviceName) : null;
        if (service) {
          registeredServices.push(serviceName);
        } else {
          missingServices.push(serviceName);
        }
      });

      status.details.registeredServices = registeredServices;
      status.details.missingServices = missingServices;
      status.details.registrationRate = registeredServices.length / requiredServices.length;
      
      status.score = status.details.registrationRate;

      if (missingServices.length > 0) {
        status.issues.push(`缺少服务注册: ${missingServices.join(', ')}`);
        status.recommendations.push('检查 dependency-injection.js 的 registerCoreServices 或 bootstrap.js 的 registerFallbackCoreServices');
      }

    } catch (error) {
      status.issues.push(`服务注册检查失败: ${error.message}`);
    }

    return status;
  }

  /**
   * 检查DOM优化系统状态
   * @returns {Object} DOM优化状态报告
   */
  checkDOMOptimization() {
    const status = {
      name: 'DOM优化系统',
      score: 0,
      details: {},
      issues: [],
      recommendations: []
    };

    try {
      // 检查DOM优化管理器
      const domOptMgr = getServiceSafely ? getServiceSafely('domOptimizationManager') : null;
      if (domOptMgr) {
        status.details.domOptimizationManager = true;
        status.score += 0.4;
      } else {
        status.issues.push('DOM优化管理器不可用');
      }

      // 检查DOM缓存
      const domCache = getServiceSafely ? getServiceSafely('domCache', 'DOMCache') : null;
      if (domCache) {
        status.details.domCache = true;
        status.score += 0.3;
      } else {
        status.issues.push('DOM缓存不可用');
      }

      // 检查DOM缓存集成
      if (typeof getDOMCacheIntegration === 'function') {
        status.details.domCacheIntegration = true;
        status.score += 0.3;
        
        // 测试集成功能
        try {
          const integration = getDOMCacheIntegration();
          const stats = integration.getCacheStats();
          status.details.integrationStats = stats;
        } catch (error) {
          status.issues.push(`DOM缓存集成测试失败: ${error.message}`);
        }
      } else {
        status.issues.push('DOM缓存集成不可用');
        status.recommendations.push('确保加载dom-cache-integration.js');
      }

    } catch (error) {
      status.issues.push(`DOM优化检查失败: ${error.message}`);
    }

    return status;
  }

  /**
   * 检查错误管理系统状态
   * @returns {Object} 错误管理状态报告
   */
  checkErrorManagement() {
    const status = {
      name: '错误管理系统',
      score: 0,
      details: {},
      issues: [],
      recommendations: []
    };

    try {
      // 检查错误管理器
      const errorMgr = getServiceSafely ? getServiceSafely('errorManager') : null;
      if (errorMgr) {
        status.details.errorManager = true;
        status.score += 0.4;
        
        // 检查错误管理器方法
        const methods = ['handleError', 'getStats', 'clearErrors'];
        const availableMethods = methods.filter(method => 
          typeof errorMgr[method] === 'function'
        );
        status.details.errorManagerMethods = availableMethods;
        status.score += (availableMethods.length / methods.length) * 0.3;
      } else {
        status.issues.push('错误管理器不可用');
      }

      // 检查验证器系统
      if (typeof getUniversalValidators === 'function') {
        status.details.validators = true;
        status.score += 0.3;
        
        try {
          const validators = getUniversalValidators();
          if (validators && typeof validators.safeValidate === 'function') {
            status.details.safeValidateAvailable = true;
          }
        } catch (error) {
          status.issues.push(`验证器测试失败: ${error.message}`);
        }
      } else {
        status.issues.push('统一验证器不可用');
        status.recommendations.push('确保加载validators-v2.js');
      }

    } catch (error) {
      status.issues.push(`错误管理检查失败: ${error.message}`);
    }

    return status;
  }

  /**
   * 检查性能监控系统状态
   * @returns {Object} 性能监控状态报告
   */
  checkPerformanceMonitoring() {
    const status = {
      name: '性能监控系统',
      score: 0,
      details: {},
      issues: [],
      recommendations: []
    };

    try {
      // 检查性能监控器
      const perfMonitor = getServiceSafely ? getServiceSafely('performanceMonitor') : null;
      if (perfMonitor) {
        status.details.performanceMonitor = true;
        status.score += 0.5;
        
        // 检查性能监控方法
        const methods = ['start', 'end', 'measure', 'getStats'];
        const availableMethods = methods.filter(method => 
          typeof perfMonitor[method] === 'function'
        );
        status.details.performanceMethods = availableMethods;
        status.score += (availableMethods.length / methods.length) * 0.3;
      } else {
        status.issues.push('性能监控器不可用');
        status.recommendations.push('检查性能监控器初始化');
      }

      // 检查浏览器性能API
      if (typeof performance !== 'undefined' && performance.now) {
        status.details.browserPerformanceAPI = true;
        status.score += 0.2;
      } else {
        status.issues.push('浏览器性能API不可用');
      }

    } catch (error) {
      status.issues.push(`性能监控检查失败: ${error.message}`);
    }

    return status;
  }

  /**
   * 验证架构集成完整性
   * @returns {Object} 集成验证报告
   */
  validateArchitectureIntegration() {
    const validation = {
      timestamp: new Date().toISOString(),
      passed: false,
      score: 0,
      tests: [],
      summary: ''
    };

    const tests = [
      {
        name: '依赖注入系统可用性',
        test: () => {
          return window.diContainer && typeof getServiceSafely === 'function';
        },
        weight: 0.2
      },
      {
        name: '核心服务注册完整性',
        test: () => {
          const services = ['appState', 'errorManager', 'translationService'];
          return services.every(service => getServiceSafely(service));
        },
        weight: 0.25
      },
      {
        name: '统一验证器功能',
        test: () => {
          if (typeof getUniversalValidators !== 'function') return false;
          const validators = getUniversalValidators();
          return validators && typeof validators.safeValidate === 'function';
        },
        weight: 0.2
      },
      {
        name: '结果处理器功能',
        test: () => {
          if (typeof getTranslationResultHandler !== 'function') return false;
          const handler = getTranslationResultHandler();
          return handler && typeof handler.handleTranslationResults === 'function';
        },
        weight: 0.2
      },
      {
        name: 'DOM缓存集成功能',
        test: () => {
          if (typeof getDOMCacheIntegration !== 'function') return false;
          const integration = getDOMCacheIntegration();
          return integration && typeof integration.getCachedElement === 'function';
        },
        weight: 0.15
      }
    ];

    let totalScore = 0;
    let passedTests = 0;

    tests.forEach(test => {
      try {
        const result = test.test();
        const testResult = {
          name: test.name,
          passed: result,
          weight: test.weight,
          score: result ? test.weight : 0
        };
        
        validation.tests.push(testResult);
        totalScore += testResult.score;
        
        if (result) {
          passedTests++;
        }
      } catch (error) {
        validation.tests.push({
          name: test.name,
          passed: false,
          weight: test.weight,
          score: 0,
          error: error.message
        });
      }
    });

    validation.score = totalScore;
    validation.passed = validation.score >= 0.8; // 80%通过率
    validation.summary = `通过 ${passedTests}/${tests.length} 项测试，综合评分: ${(totalScore * 100).toFixed(1)}%`;

    return validation;
  }

  /**
   * 获取架构性能基准测试
   * @returns {Promise<Object>} 性能基准报告
   */
  async performanceBenchmark() {
    const benchmark = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };

    try {
      // 测试DI容器性能
      const diTest = await this.benchmarkDI();
      benchmark.tests.push(diTest);

      // 测试DOM缓存性能
      const domTest = await this.benchmarkDOMCache();
      benchmark.tests.push(domTest);

      // 测试验证器性能
      const validatorTest = await this.benchmarkValidators();
      benchmark.tests.push(validatorTest);

      // 计算汇总
      const avgTime = benchmark.tests.reduce((sum, test) => sum + test.avgTime, 0) / benchmark.tests.length;
      benchmark.summary = {
        averageTime: avgTime,
        totalTests: benchmark.tests.length,
        performance: avgTime < 1 ? 'excellent' : avgTime < 5 ? 'good' : 'needs improvement'
      };

    } catch (error) {
      benchmark.error = error.message;
    }

    return benchmark;
  }

  /**
   * 基准测试DI容器性能
   */
  async benchmarkDI() {
    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      getServiceSafely('appState');
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      name: 'DI容器服务获取',
      iterations,
      totalTime,
      avgTime: totalTime / iterations,
      opsPerSecond: 1000 / (totalTime / iterations)
    };
  }

  /**
   * 基准测试DOM缓存性能
   */
  async benchmarkDOMCache() {
    if (typeof getDOMCacheIntegration !== 'function') {
      return { name: 'DOM缓存', error: '不可用' };
    }

    const integration = getDOMCacheIntegration();
    const iterations = 500;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      integration.getCachedElement('body');
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      name: 'DOM缓存查询',
      iterations,
      totalTime,
      avgTime: totalTime / iterations,
      opsPerSecond: 1000 / (totalTime / iterations)
    };
  }

  /**
   * 基准测试验证器性能
   */
  async benchmarkValidators() {
    if (typeof getUniversalValidators !== 'function') {
      return { name: '验证器', error: '不可用' };
    }

    const validators = getUniversalValidators();
    const iterations = 500;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      try {
        validators.validateProjectExists();
      } catch (error) {
        // 忽略验证错误，只测试性能
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    return {
      name: '验证器执行',
      iterations,
      totalTime,
      avgTime: totalTime / iterations,
      opsPerSecond: 1000 / (totalTime / iterations)
    };
  }

  /**
   * 记录错误到集成日志
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   */
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context,
      id: this.generateErrorId()
    };

    this.errorLog.push(errorEntry);

    // 保持日志大小限制
    if (this.errorLog.length > this.maxErrorLogSize) {
      this.errorLog.shift();
    }

    (loggers.architecture || console).error('架构集成错误:', errorEntry);
  }

  /**
   * 生成错误ID
   */
  generateErrorId() {
    return `ARC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计信息
   */
  getErrorStats() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recent = this.errorLog.filter(entry => new Date(entry.timestamp) > last24Hours);

    return {
      total: this.errorLog.length,
      last24Hours: recent.length,
      recentErrors: this.errorLog.slice(-5),
      errorRate: recent.length / 24 // 每小时错误数
    };
  }
}

// ==================== 全局实例和便捷函数 ====================

let globalArchIntegrationHelpers = null;

/**
 * 获取架构集成助手实例
 * @returns {ArchitectureIntegrationHelpers} 助手实例
 */
function getArchitectureHelpers() {
  if (!globalArchIntegrationHelpers) {
    globalArchIntegrationHelpers = new ArchitectureIntegrationHelpers();
  }
  return globalArchIntegrationHelpers;
}

/**
 * 检查架构系统健康状态的便捷函数
 * @returns {Object} 健康报告
 */
function checkArchHealth() {
  const helpers = getArchitectureHelpers();
  return helpers.checkArchitectureHealth();
}

/**
 * 验证架构集成完整性的便捷函数
 * @returns {Object} 验证报告
 */
function validateArchIntegration() {
  const helpers = getArchitectureHelpers();
  return helpers.validateArchitectureIntegration();
}

/**
 * 性能基准测试的便捷函数
 * @returns {Promise<Object>} 性能报告
 */
async function benchmarkArchPerformance() {
  const helpers = getArchitectureHelpers();
  return helpers.performanceBenchmark();
}

/**
 * 显示架构状态到控制台
 */
function showArchitectureStatus() {
  console.group('🏗️ 架构系统状态');
  
  const health = checkArchHealth();
  (loggers.architecture || console).info('整体状态:', health.overall);
  (loggers.architecture || console).info('组件状态:', health.components);
  
  if (health.issues.length > 0) {
    console.group('⚠️ 发现问题');
    health.issues.forEach(issue => (loggers.architecture || console).warn(issue));
    console.groupEnd();
  }
  
  if (health.recommendations.length > 0) {
    console.group('💡 改进建议');
    health.recommendations.forEach(rec => console.info(rec));
    console.groupEnd();
  }
  
  const validation = validateArchIntegration();
  (loggers.architecture || console).info('集成验证:', validation.summary);
  
  console.groupEnd();
  
  return health;
}

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ArchitectureIntegrationHelpers,
    getArchitectureHelpers,
    checkArchHealth,
    validateArchIntegration,
    benchmarkArchPerformance,
    showArchitectureStatus
  };
} else {
  // 浏览器环境
  window.ArchitectureIntegrationHelpers = ArchitectureIntegrationHelpers;
  window.getArchitectureHelpers = getArchitectureHelpers;
  window.checkArchHealth = checkArchHealth;
  window.validateArchIntegration = validateArchIntegration;
  window.benchmarkArchPerformance = benchmarkArchPerformance;
  window.showArchitectureStatus = showArchitectureStatus;
  
  // 注册到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.core', 'ArchitectureIntegrationHelpers', ArchitectureIntegrationHelpers);
      namespaceManager.addToNamespace('App.debug', 'checkArchHealth', checkArchHealth);
      namespaceManager.addToNamespace('App.debug', 'showArchitectureStatus', showArchitectureStatus);
    } catch (error) {
      (loggers.architecture || console).warn('架构集成助手命名空间注册失败:', error.message);
    }
  }
}

(loggers.architecture || console).debug('架构集成助手已加载');
