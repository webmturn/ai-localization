// ==================== 服务启动顺序管理器 ====================
/**
 * 服务启动顺序管理器
 * 管理服务的依赖关系和启动顺序，确保架构系统正确初始化
 * 支持依赖检查、启动重试和错误恢复
 */

class ServiceStartupManager {
  constructor() {
    this.services = new Map();
    this.startupOrder = [];
    this.startedServices = new Set();
    this.failedServices = new Set();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.startupTimeout = 10000; // 10秒超时
    this.eventListeners = new Map();
  }

  /**
   * 注册服务及其依赖关系
   * @param {string} name - 服务名称
   * @param {Object} config - 服务配置
   */
  registerService(name, config = {}) {
    const serviceConfig = {
      name,
      dependencies: config.dependencies || [],
      factory: config.factory || null,
      singleton: config.singleton !== false,
      priority: config.priority || 0,
      timeout: config.timeout || this.startupTimeout,
      retryable: config.retryable !== false,
      critical: config.critical !== false,
      healthCheck: config.healthCheck || null,
      onStart: config.onStart || null,
      onStop: config.onStop || null,
      onError: config.onError || null
    };

    this.services.set(name, serviceConfig);
    this.calculateStartupOrder();
    
    (loggers.startup || console).info(`已注册服务: ${name}`, serviceConfig);
  }

  /**
   * 批量注册核心服务
   */
  registerCoreServices() {
    // 错误管理器 - 最高优先级，无依赖
    this.registerService('errorManager', {
      priority: 100,
      critical: true,
      factory: () => {
        if (!window.errorManager && typeof ErrorManager !== 'undefined') {
          window.errorManager = new ErrorManager();
        }
        return window.errorManager;
      },
      healthCheck: (service) => service && typeof service.handleError === 'function'
    });

    // 应用状态 - 高优先级，无依赖
    this.registerService('appState', {
      priority: 90,
      critical: true,
      factory: () => window.AppState,
      healthCheck: (service) => service && typeof service === 'object'
    });

    // 性能监控器
    this.registerService('performanceMonitor', {
      priority: 80,
      factory: () => {
        if (!window.performanceMonitor && typeof PerformanceMonitor !== 'undefined') {
          window.performanceMonitor = new PerformanceMonitor();
        }
        return window.performanceMonitor;
      }
    });

    // 事件管理器
    this.registerService('eventManager', {
      priority: 70,
      dependencies: ['errorManager'],
      factory: () => {
        if (!window.eventManager && typeof EventManager !== 'undefined') {
          window.eventManager = new EventManager();
        }
        return window.eventManager;
      }
    });

    // DOM缓存
    this.registerService('domCache', {
      priority: 60,
      factory: () => window.DOMCache,
      healthCheck: (service) => service && typeof service.get === 'function'
    });

    // DOM优化管理器
    this.registerService('domOptimizationManager', {
      priority: 60,
      dependencies: ['domCache'],
      factory: () => window.domOptimizationManager
    });

    // 存储管理器
    this.registerService('storageManager', {
      priority: 50,
      dependencies: ['errorManager'],
      factory: () => window.storageManager,
      healthCheck: (service) => service && typeof service.saveCurrentProject === 'function'
    });

    // 翻译服务
    this.registerService('translationService', {
      priority: 40,
      dependencies: ['errorManager', 'storageManager'],
      factory: () => window.translationService,
      healthCheck: (service) => service && typeof service.translateBatch === 'function'
    });

    // 自动保存管理器
    this.registerService('autoSaveManager', {
      priority: 30,
      dependencies: ['storageManager', 'appState'],
      factory: () => window.autoSaveManager
    });

    // 网络工具
    this.registerService('networkUtils', {
      priority: 20,
      dependencies: ['errorManager'],
      factory: () => window.networkUtils
    });

    // 统一验证器
    this.registerService('universalValidators', {
      priority: 10,
      dependencies: ['appState', 'errorManager'],
      factory: () => {
        if (typeof getUniversalValidators === 'function') {
          return getUniversalValidators();
        }
        return null;
      }
    });

    // 翻译结果处理器
    this.registerService('translationResultHandler', {
      priority: 10,
      dependencies: ['appState', 'errorManager', 'performanceMonitor'],
      factory: () => {
        if (typeof getTranslationResultHandler === 'function') {
          return getTranslationResultHandler();
        }
        return null;
      }
    });

    // DOM缓存集成
    this.registerService('domCacheIntegration', {
      priority: 10,
      dependencies: ['domOptimizationManager', 'domCache', 'performanceMonitor'],
      factory: () => {
        if (typeof getDOMCacheIntegration === 'function') {
          return getDOMCacheIntegration();
        }
        return null;
      }
    });

    (loggers.startup || console).info('核心服务注册完成');
  }

  /**
   * 计算服务启动顺序
   */
  calculateStartupOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (visiting.has(serviceName)) {
        throw new Error(`服务依赖循环: ${serviceName}`);
      }
      
      if (visited.has(serviceName)) {
        return;
      }

      const service = this.services.get(serviceName);
      if (!service) {
        (loggers.startup || console).warn(`未找到服务配置: ${serviceName}`);
        return;
      }

      visiting.add(serviceName);

      // 先访问依赖的服务
      service.dependencies.forEach(dep => visit(dep));

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // 按优先级排序后计算依赖顺序
    const servicesByPriority = Array.from(this.services.entries())
      .sort((a, b) => b[1].priority - a[1].priority);

    servicesByPriority.forEach(([name]) => visit(name));

    this.startupOrder = order;
    (loggers.startup || console).debug('服务启动顺序:', this.startupOrder);
  }

  /**
   * 启动所有服务
   * @returns {Promise<Object>} 启动结果
   */
  async startAllServices() {
    const startTime = performance.now();
    const results = {
      started: [],
      failed: [],
      skipped: [],
      totalTime: 0,
      success: false
    };

    (loggers.startup || console).info('开始启动服务...');
    
    try {
      this.emit('startupBegin', { order: this.startupOrder });

      for (const serviceName of this.startupOrder) {
        try {
          await this.startService(serviceName);
          results.started.push(serviceName);
          this.emit('serviceStarted', { serviceName });
        } catch (error) {
          (loggers.startup || console).error(`服务启动失败: ${serviceName}`, error);
          results.failed.push({ serviceName, error: error.message });
          
          const service = this.services.get(serviceName);
          if (service && service.critical) {
            // 关键服务失败，中止启动
            throw new Error(`关键服务 ${serviceName} 启动失败: ${error.message}`);
          }
          
          this.emit('serviceFailed', { serviceName, error });
        }
      }

      const endTime = performance.now();
      results.totalTime = endTime - startTime;
      results.success = results.failed.length === 0 || 
        results.failed.every(f => !this.services.get(f.serviceName)?.critical);

      (loggers.startup || console).info(`服务启动完成 (${results.totalTime.toFixed(2)}ms)`, results);
      this.emit('startupComplete', results);

      return results;

    } catch (error) {
      const endTime = performance.now();
      results.totalTime = endTime - startTime;
      results.success = false;
      
      (loggers.startup || console).error('服务启动过程失败:', error);
      this.emit('startupFailed', { error, results });
      
      throw error;
    }
  }

  /**
   * 启动单个服务
   * @param {string} serviceName - 服务名称
   * @returns {Promise<*>} 服务实例
   */
  async startService(serviceName) {
    if (this.startedServices.has(serviceName)) {
      (loggers.startup || console).debug(`服务已启动: ${serviceName}`);
      return this.getService(serviceName);
    }

    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`未找到服务配置: ${serviceName}`);
    }

    (loggers.startup || console).debug(`启动服务: ${serviceName}`);
    
    // 检查依赖
    for (const dep of service.dependencies) {
      if (!this.startedServices.has(dep)) {
        if (this.failedServices.has(dep)) {
          throw new Error(`依赖服务 ${dep} 启动失败`);
        }
        await this.startService(dep);
      }
    }

    try {
      // 创建服务实例
      let instance = null;
      
      if (service.factory) {
        const startTime = performance.now();
        instance = await Promise.race([
          Promise.resolve(service.factory()),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('启动超时')), service.timeout)
          )
        ]);
        const endTime = performance.now();
        
        (loggers.startup || console).debug(`${serviceName} 启动耗时: ${(endTime - startTime).toFixed(2)}ms`);
      }

      // 健康检查
      if (service.healthCheck && !service.healthCheck(instance)) {
        throw new Error(`健康检查失败: ${serviceName}`);
      }

      // 注册到DI容器
      if (window.diContainer && instance) {
        window.diContainer.registerSingleton(serviceName, () => instance);
      }

      // 调用启动回调
      if (service.onStart) {
        await service.onStart(instance);
      }

      this.startedServices.add(serviceName);
      this.retryAttempts.delete(serviceName);
      
      (loggers.startup || console).info(`服务启动成功: ${serviceName}`);
      return instance;

    } catch (error) {
      this.failedServices.add(serviceName);
      
      // 调用错误回调
      if (service.onError) {
        try {
          await service.onError(error);
        } catch (callbackError) {
          (loggers.startup || console).error(`服务错误回调失败: ${serviceName}`, callbackError);
        }
      }

      // 重试逻辑
      if (service.retryable && this.shouldRetry(serviceName)) {
        const attempts = (this.retryAttempts.get(serviceName) || 0) + 1;
        this.retryAttempts.set(serviceName, attempts);
        
        (loggers.startup || console).warn(`重试启动服务: ${serviceName} (第${attempts}次)`);
        await this.delay(1000 * attempts); // 递增延迟
        
        this.failedServices.delete(serviceName);
        return this.startService(serviceName);
      }

      throw error;
    }
  }

  /**
   * 停止所有服务
   */
  async stopAllServices() {
    (loggers.startup || console).info('开始停止服务...');
    
    // 逆序停止服务
    const stopOrder = [...this.startupOrder].reverse();
    
    for (const serviceName of stopOrder) {
      try {
        await this.stopService(serviceName);
      } catch (error) {
        (loggers.startup || console).error(`停止服务失败: ${serviceName}`, error);
      }
    }
    
    (loggers.startup || console).info('所有服务已停止');
  }

  /**
   * 停止单个服务
   * @param {string} serviceName - 服务名称
   */
  async stopService(serviceName) {
    if (!this.startedServices.has(serviceName)) {
      return;
    }

    const service = this.services.get(serviceName);
    if (service && service.onStop) {
      const instance = this.getService(serviceName);
      await service.onStop(instance);
    }

    this.startedServices.delete(serviceName);
    (loggers.startup || console).info(`服务已停止: ${serviceName}`);
  }

  /**
   * 获取服务实例
   * @param {string} serviceName - 服务名称
   * @returns {*} 服务实例
   */
  getService(serviceName) {
    if (window.diContainer && window.diContainer.has(serviceName)) {
      return window.diContainer.get(serviceName);
    }
    
    // 备用方案：从全局获取
    const service = this.services.get(serviceName);
    if (service && service.factory) {
      try {
        return service.factory();
      } catch (error) {
        (loggers.startup || console).error(`获取服务实例失败: ${serviceName}`, error);
      }
    }
    
    return null;
  }

  /**
   * 检查是否应该重试
   * @param {string} serviceName - 服务名称
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(serviceName) {
    const attempts = this.retryAttempts.get(serviceName) || 0;
    return attempts < this.maxRetries;
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取启动状态
   * @returns {Object} 启动状态信息
   */
  getStartupStatus() {
    return {
      totalServices: this.services.size,
      startedServices: this.startedServices.size,
      failedServices: this.failedServices.size,
      startupOrder: this.startupOrder,
      started: Array.from(this.startedServices),
      failed: Array.from(this.failedServices),
      retryAttempts: Object.fromEntries(this.retryAttempts)
    };
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   */
  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(listener);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {Function} listener - 监听器函数
   */
  off(event, listener) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          (loggers.startup || console).error(`事件监听器执行失败: ${event}`, error);
        }
      });
    }
  }
}

// ==================== 全局实例和便捷函数 ====================

let globalServiceStartupManager = null;

/**
 * 获取服务启动管理器实例
 * @returns {ServiceStartupManager} 管理器实例
 */
function getServiceStartupManager() {
  if (!globalServiceStartupManager) {
    globalServiceStartupManager = new ServiceStartupManager();
  }
  return globalServiceStartupManager;
}

/**
 * 初始化并启动所有核心服务
 * @returns {Promise<Object>} 启动结果
 */
async function initializeCoreServices() {
  const manager = getServiceStartupManager();
  
  // 注册核心服务
  manager.registerCoreServices();
  
  // 启动所有服务
  return await manager.startAllServices();
}

/**
 * 获取服务启动状态
 * @returns {Object} 状态信息
 */
function getServiceStartupStatus() {
  const manager = getServiceStartupManager();
  return manager.getStartupStatus();
}

/**
 * 显示服务启动状态到控制台
 */
function showServiceStatus() {
  const status = getServiceStartupStatus();
  
  console.group('🔧 服务启动状态');
  (loggers.startup || console).info('总服务数:', status.totalServices);
  (loggers.startup || console).info('已启动:', status.startedServices);
  (loggers.startup || console).info('失败服务:', status.failedServices);
  
  if (status.started.length > 0) {
    (loggers.startup || console).info('已启动的服务:', status.started);
  }
  
  if (status.failed.length > 0) {
    (loggers.startup || console).warn('失败的服务:', status.failed);
  }
  
  if (Object.keys(status.retryAttempts).length > 0) {
    (loggers.startup || console).debug('重试记录:', status.retryAttempts);
  }
  
  console.groupEnd();
  
  return status;
}

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    ServiceStartupManager,
    getServiceStartupManager,
    initializeCoreServices,
    getServiceStartupStatus,
    showServiceStatus
  };
} else {
  // 浏览器环境
  window.ServiceStartupManager = ServiceStartupManager;
  window.getServiceStartupManager = getServiceStartupManager;
  window.initializeCoreServices = initializeCoreServices;
  window.getServiceStartupStatus = getServiceStartupStatus;
  window.showServiceStatus = showServiceStatus;
  
  // 注册到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.core', 'ServiceStartupManager', ServiceStartupManager);
      namespaceManager.addToNamespace('App.core', 'initializeCoreServices', initializeCoreServices);
      namespaceManager.addToNamespace('App.debug', 'showServiceStatus', showServiceStatus);
    } catch (error) {
      (loggers.startup || console).warn('服务启动管理器命名空间注册失败:', error.message);
    }
  }
}

(loggers.startup || console).debug('服务启动管理器已加载');
