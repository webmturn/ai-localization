// ==================== 错误处理系统集成器 ====================
/**
 * 错误处理系统集成器：统一初始化和配置所有错误处理组件
 * 解决循环依赖和初始化顺序问题
 */

/**
 * 错误处理系统初始化器
 */
class ErrorSystemIntegrator {
  constructor() {
    this.initialized = false;
    this.modules = new Map();
    this.dependencies = new Map();
    this.notificationHandler = null;
  }
  
  /**
   * 初始化错误处理系统
   * @param {Object} options - 初始化选项
   */
  async initialize(options = {}) {
    if (this.initialized) {
      return;
    }
    
    const {
      notificationHandler = null,
      enableGlobalHandlers = true,
      enablePerformanceMonitoring = true,
      enableErrorReporting = false,
      maxHistorySize = 100
    } = options;
    
    try {
      // 使用日志系统
      (loggers.errors || console).info('初始化错误处理系统...');
      
      // 1. 设置通知处理器
      this._setupNotificationHandler(notificationHandler);
      
      // 2. 验证核心依赖
      this._validateCoreDependencies();
      
      // 3. 初始化核心错误管理器
      this._initializeErrorManager({ maxHistorySize });
      
      // 4. 注册模块错误处理器
      this._registerModuleHandlers();
      
      // 5. 设置全局错误处理
      if (enableGlobalHandlers) {
        this._setupGlobalErrorHandlers();
      }
      
      // 6. 启用性能监控
      if (enablePerformanceMonitoring) {
        this._enablePerformanceMonitoring();
      }
      
      // 7. 配置错误报告
      if (enableErrorReporting) {
        this._configureErrorReporting();
      }
      
      // 8. 运行健康检查
      await this._runHealthCheck();
      
      this.initialized = true;
      (loggers.errors || console).info('错误处理系统初始化完成');
      
    } catch (error) {
      (loggers.errors || console).error('错误处理系统初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 设置通知处理器
   */
  _setupNotificationHandler(handler) {
    if (handler && typeof handler === 'function') {
      this.notificationHandler = handler;
      window.showNotification = handler;
    } else if (typeof window.showNotification === 'function') {
      this.notificationHandler = window.showNotification;
    } else {
      // 创建默认的通知处理器
      this.notificationHandler = this._createDefaultNotificationHandler();
      window.showNotification = this.notificationHandler;
    }
  }
  
  /**
   * 创建默认通知处理器
   */
  _createDefaultNotificationHandler() {
    return (type, title, message, options = {}) => {
      const logLevel = type === 'error' ? 'error' : 
                     type === 'warning' ? 'warn' : 'info';
      
      (loggers.errors || console)[logLevel](`[${title}] ${message}`);
      
      // 如果有UI通知系统，可以在这里调用
      if (typeof window.showUINotification === 'function') {
        window.showUINotification(type, title, message, options);
      }
    };
  }
  
  /**
   * 验证核心依赖
   */
  _validateCoreDependencies() {
    const requiredGlobals = [
      'ErrorManager',
      'TranslationToolError',
      'ERROR_CODES',
      'ERROR_SEVERITY',
      'ERROR_CATEGORIES'
    ];
    
    const missing = requiredGlobals.filter(name => !(name in window));
    if (missing.length > 0) {
      throw new Error(`缺少核心依赖: ${missing.join(', ')}`);
    }
  }
  
  /**
   * 初始化错误管理器
   */
  _initializeErrorManager(options) {
    // 如果错误管理器实例不存在，尝试创建它
    if (!window.errorManager) {
      if (window.initializeErrorManager && typeof window.initializeErrorManager === 'function') {
        try {
          window.initializeErrorManager();
          (loggers.errors || console).debug('错误管理器实例已创建');
        } catch (error) {
          (loggers.errors || console).error('创建错误管理器实例失败:', error);
          throw new Error('ErrorManager实例创建失败');
        }
      } else {
        throw new Error('ErrorManager实例未找到');
      }
    }
    
    // 配置错误管理器
    if (options.maxHistorySize) {
      window.errorManager.maxHistorySize = options.maxHistorySize;
    }
    
    // 注入通知处理器
    window.errorManager.notificationHandler = this.notificationHandler;
  }
  
  /**
   * 注册模块错误处理器
   */
  _registerModuleHandlers() {
    const modules = [
      'TranslationErrorHandler',
      'StorageErrorHandler', 
      'NetworkErrorHandler',
      'FileErrorHandler'
    ];
    
    modules.forEach(moduleName => {
      if (window[moduleName]) {
        this.modules.set(moduleName, window[moduleName]);
        // 使用日志系统
        (loggers.errors || console).debug(`已注册模块: ${moduleName}`);
      } else {
        (loggers.errors || console).warn(`模块未找到: ${moduleName}`);
      }
    });
  }
  
  /**
   * 设置全局错误处理
   */
  _setupGlobalErrorHandlers() {
    // 这些处理器已经在ErrorManager中设置，这里只是确认
    // 使用日志系统
    (loggers.errors || console).debug('全局错误处理器已激活');
  }
  
  /**
   * 启用性能监控
   */
  _enablePerformanceMonitoring() {
    // 监控错误处理性能
    const originalHandleError = window.errorManager.handleError;
    
    window.errorManager.handleError = function(error, context = {}) {
      const start = performance.now();
      const result = originalHandleError.call(this, error, context);
      const duration = performance.now() - start;
      
      // 如果错误处理耗时过长，记录警告
      if (duration > 100) {
        (loggers.errors || console).warn(`错误处理耗时过长: ${duration.toFixed(2)}ms`, { error, context });
      }
      
      return result;
    };
    
    // 使用日志系统
    (loggers.errors || console).debug('性能监控已启用');
  }
  
  /**
   * 配置错误报告
   */
  _configureErrorReporting() {
    // 这里可以配置远程错误报告服务
    (loggers.errors || console).debug('错误报告已配置');
  }
  
  /**
   * 运行健康检查
   */
  async _runHealthCheck() {
    const checks = [];
    
    // 检查错误管理器
    checks.push(this._checkErrorManager());
    
    // 检查存储系统
    if (this.modules.has('StorageErrorHandler')) {
      checks.push(this._checkStorageSystem());
    }
    
    // 检查网络系统
    if (this.modules.has('NetworkErrorHandler')) {
      checks.push(this._checkNetworkSystem());
    }
    
    const results = await Promise.allSettled(checks);
    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      (loggers.errors || console).warn('健康检查发现问题:', failures);
    } else {
      (loggers.errors || console).debug('所有健康检查通过');
    }
  }
  
  /**
   * 检查错误管理器
   */
  _checkErrorManager() {
    return new Promise((resolve, reject) => {
      try {
        // 测试错误创建
        const testError = window.errorManager.createError(
          window.ERROR_CODES.UNKNOWN_ERROR, 
          '健康检查测试'
        );
        
        if (!(testError instanceof window.TranslationToolError)) {
          throw new Error('错误创建失败');
        }
        
        resolve('ErrorManager健康检查通过');
      } catch (error) {
        reject(`ErrorManager健康检查失败: ${error.message}`);
      }
    });
  }
  
  /**
   * 检查存储系统
   */
  _checkStorageSystem() {
    return new Promise((resolve, reject) => {
      try {
        if ('indexedDB' in window && 'localStorage' in window) {
          resolve('存储系统健康检查通过');
        } else {
          throw new Error('存储API不可用');
        }
      } catch (error) {
        reject(`存储系统健康检查失败: ${error.message}`);
      }
    });
  }
  
  /**
   * 检查网络系统
   */
  _checkNetworkSystem() {
    return new Promise((resolve, reject) => {
      try {
        if ('fetch' in window && navigator.onLine) {
          resolve('网络系统健康检查通过');
        } else {
          throw new Error('网络API不可用或离线');
        }
      } catch (error) {
        reject(`网络系统健康检查失败: ${error.message}`);
      }
    });
  }
  
  /**
   * 显示通知
   */
  _showNotification(type, title, message) {
    if (this.notificationHandler) {
      this.notificationHandler(type, title, message);
    }
  }
  
  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      hasNotificationHandler: !!this.notificationHandler,
      errorStats: window.errorManager?.getErrorStats() || null
    };
  }
  
  /**
   * 重置系统
   */
  reset() {
    if (window.errorManager) {
      window.errorManager.clearErrorHistory();
    }
    
    this.modules.clear();
    (loggers.errors || console).debug('错误处理系统已重置');
  }
}

// ==================== 便捷初始化函数 ====================

/**
 * 快速初始化错误处理系统
 * @param {Object} options - 初始化选项
 * @returns {Promise<ErrorSystemIntegrator>} 集成器实例
 */
async function initializeErrorSystem(options = {}) {
  const integrator = new ErrorSystemIntegrator();
  await integrator.initialize(options);
  return integrator;
}

/**
 * 检查错误处理系统是否就绪
 * @returns {boolean} 是否就绪
 */
function isErrorSystemReady() {
  return !!(
    window.errorManager &&
    window.ErrorManager &&
    window.TranslationToolError &&
    window.ERROR_CODES
  );
}

/**
 * 等待错误处理系统就绪
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>} 是否就绪
 */
function waitForErrorSystem(timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (isErrorSystemReady()) {
      resolve(true);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isErrorSystemReady()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('等待错误处理系统就绪超时'));
      }
    }, 100);
  });
}

// ==================== 导出接口 ====================
window.ErrorSystemIntegrator = ErrorSystemIntegrator;
window.initializeErrorSystem = initializeErrorSystem;
window.isErrorSystemReady = isErrorSystemReady;
window.waitForErrorSystem = waitForErrorSystem;

// 创建全局集成器实例
window.errorSystemIntegrator = new ErrorSystemIntegrator();

// 自动初始化（如果在浏览器环境中）
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // 当架构初始化器存在时，由架构步骤统一触发错误系统初始化，避免重复初始化
  const shouldAutoInit = !(window.architectureInitializer || window.ArchitectureInitializer);

  if (!shouldAutoInit) {
    setTimeout(() => {
      try {
        if (window.errorSystemIntegrator?.initialized) return;
        if (window.Architecture?.initializer?.initialized) return;
        window.errorSystemIntegrator.initialize().catch((error) => {
          (loggers.errors || console).error('自动初始化错误处理系统失败:', error);
        });
      } catch (error) {
        (loggers.errors || console).error('自动初始化错误处理系统失败:', error);
      }
    }, 5000);
  } else {
  // 等待DOM加载完成后自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // 延迟初始化，确保所有模块都已加载
      setTimeout(() => {
        if (!window.errorSystemIntegrator.initialized) {
          window.errorSystemIntegrator.initialize().catch(error => {
            (loggers.errors || console).error('自动初始化错误处理系统失败:', error);
          });
        }
      }, 100);
    });
  } else {
    // DOM已经加载完成，立即初始化
    setTimeout(() => {
      if (!window.errorSystemIntegrator.initialized) {
        window.errorSystemIntegrator.initialize().catch(error => {
          (loggers.errors || console).error('自动初始化错误处理系统失败:', error);
        });
      }
    }, 100);
  }
  }
}