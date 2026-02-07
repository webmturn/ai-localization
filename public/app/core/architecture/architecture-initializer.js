// ==================== 架构初始化器 ====================
/**
 * 架构初始化器：统一管理整个应用的架构初始化
 * 解决模块加载顺序、依赖管理和全局变量污染问题
 */

/**
 * 架构初始化器类
 */
class ArchitectureInitializer {
  constructor() {
    this.initialized = false;
    this.servicesRegistered = false;

    this.initializationSteps = [];
    this.initializationOrder = [
      'namespace',
      'dependencyInjection', 
      'moduleManager',
      'errorSystem',
      'coreServices',
      'storageServices',
      'networkServices',
      'translationServices',
      'uiServices',
      'finalization'
    ];
    this.stepStatus = new Map();
    this.startTime = null;
    this.endTime = null;
  }
  
  /**
   * 初始化整个架构
   * @param {Object} options - 初始化选项
   */
  async initialize(options = {}) {
    try {
      var architectureInitialized = window.ArchDebug
        ? window.ArchDebug.getFlag('architectureInitialized')
        : false;

      if (architectureInitialized) {
        this.initialized = true;
        return this.getInitializationReport();
      }
    } catch (_) {
      (loggers.architecture || console).debug("architecture init guard check:", _);
    }

    if (this.initialized) {
      (loggers.architecture || console).warn('架构已经初始化');
      return this.getInitializationReport();
    }
    
    this.startTime = performance.now();
    
    const {
      enableLogging = true,
      enablePerformanceMonitoring = true,
      enableErrorReporting = true,
      skipSteps = [],
      customSteps = {}
    } = options;
    
    try {
      (loggers.architecture || console).info('开始架构初始化...');
      
      // 执行初始化步骤
      for (const stepName of this.initializationOrder) {
        if (skipSteps.includes(stepName)) {
          (loggers.architecture || console).debug(`跳过步骤: ${stepName}`);
          this.stepStatus.set(stepName, { status: 'skipped', duration: 0 });
          continue;
        }
        
        const stepStart = performance.now();
        
        try {
          // 只在开发模式下显示详细步骤日志
          if (typeof isDevelopment !== 'undefined' && isDevelopment) {
            (loggers.architecture || console).info(`🔧 执行步骤: ${stepName}`);
          }
          
          // 执行自定义步骤或默认步骤
          if (customSteps[stepName]) {
            await customSteps[stepName](this);
          } else {
            await this.executeStep(stepName, options);
          }
          
          const stepDuration = performance.now() - stepStart;
          this.stepStatus.set(stepName, { 
            status: 'completed', 
            duration: stepDuration 
          });
          
          // 只在开发模式下显示详细步骤完成日志
          if (typeof isDevelopment !== 'undefined' && isDevelopment) {
            (loggers.architecture || console).info(`✅ 步骤完成: ${stepName} (${stepDuration.toFixed(2)}ms)`);
          }
          
        } catch (error) {
          const stepDuration = performance.now() - stepStart;
          this.stepStatus.set(stepName, { 
            status: 'failed', 
            duration: stepDuration,
            error: error.message 
          });
          
          (loggers.architecture || console).error(`步骤失败: ${stepName}`, error);
          
          // 对于非关键步骤，允许继续初始化
          const criticalSteps = ['namespace', 'dependencyInjection'];
          if (criticalSteps.includes(stepName)) {
            throw new Error(`架构初始化在关键步骤 ${stepName} 失败: ${error.message}`);
          } else {
            (loggers.architecture || console).warn(`非关键步骤 ${stepName} 失败，继续初始化其他步骤`);
          }
        }
      }
      
      this.endTime = performance.now();
      this.initialized = true;
      
      // 设置架构命名空间结构，供bootstrap等待
      if (!window.Architecture) {
        window.Architecture = {};
      }
      if (!window.Architecture.initializer) {
        window.Architecture.initializer = {};
      }
      window.Architecture.initializer.initialized = true;

      try {
        if (window.ArchDebug) {
          window.ArchDebug.setFlag('architectureInitialized', true, {
            mirrorWindow: false,
          });
        }
      } catch (_) {
        (loggers.architecture || console).debug("ArchDebug setFlag architectureInitialized:", _);
      }
      
      const totalDuration = this.endTime - this.startTime;
      (loggers.architecture || console).info(`架构初始化完成 (总耗时: ${totalDuration.toFixed(2)}ms)`);
      
      // 显示初始化报告
      if (enableLogging) {
        this.logInitializationReport();
      }
      
      // 启用性能监控
      if (enablePerformanceMonitoring) {
        this.enablePerformanceMonitoring();
      }
      
      // 启用错误报告
      if (enableErrorReporting) {
        this.enableErrorReporting();
      }
      
      return this.getInitializationReport();
      
    } catch (error) {
      this.endTime = performance.now();
      (loggers.architecture || console).error('架构初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 执行初始化步骤
   * @param {string} stepName - 步骤名称
   * @param {Object} options - 选项
   */
  async executeStep(stepName, options) {
    switch (stepName) {
      case 'namespace':
        await this.initializeNamespaceSystem(options);
        break;
        
      case 'dependencyInjection':
        await this.initializeDependencyInjection(options);
        break;
        
      case 'moduleManager':
        await this.initializeModuleManager(options);
        break;
        
      case 'errorSystem':
        await this.initializeErrorSystem(options);
        break;
        
      case 'coreServices':
        await this.initializeCoreServices(options);
        break;
        
      case 'storageServices':
        await this.initializeStorageServices(options);
        break;
        
      case 'networkServices':
        await this.initializeNetworkServices(options);
        break;
        
      case 'translationServices':
        await this.initializeTranslationServices(options);
        break;
        
      case 'uiServices':
        await this.initializeUIServices(options);
        break;
        
      case 'finalization':
        await this.finalizeInitialization(options);
        break;
        
      default:
        throw new Error(`未知的初始化步骤: ${stepName}`);
    }
  }
  
  /**
   * 初始化命名空间系统
   */
  async initializeNamespaceSystem(options) {
    if (!window.namespaceManager) {
      throw new Error('NamespaceManager 未加载');
    }
    
    // 命名空间系统应该已经自动初始化
    if (!window.namespaceManager.initialized) {
      window.namespaceManager.initialize();
    }
    
    // 创建应用特定的命名空间
    window.namespaceManager.createNamespace('App.architecture', {
      description: '架构管理模块'
    });
    
    window.namespaceManager.createNamespace('App.runtime', {
      description: '运行时管理模块'
    });
  }
  
  /**
   * 初始化依赖注入系统
   */
  async initializeDependencyInjection(options) {
    if (!window.diContainer) {
      throw new Error('DIContainer 未加载');
    }
    
    // 配置核心服务
    if (typeof window.registerCoreServices === 'function') {
      window.registerCoreServices();
      this.servicesRegistered = true;
    } else if (typeof window.configureCoreServices === 'function') {
      window.configureCoreServices(window.diContainer);
    }
    
    // 添加架构服务
    window.diContainer.registerValue('architectureInitializer', this);
    window.diContainer.registerValue('namespaceManager', window.namespaceManager);
    window.diContainer.registerValue('moduleManager', window.moduleManager);
  }
  
  /**
   * 初始化模块管理器
   */
  async initializeModuleManager(options) {
    if (!window.moduleManager) {
      throw new Error('ModuleManager 未加载');
    }
    
    // 注册核心模块
    this.registerCoreModules();

    // 初始化模块系统
    await window.moduleManager.initialize();
  }

  async initializeErrorSystem(options) {
    if (!window.errorSystemIntegrator) {
      throw new Error('ErrorSystemIntegrator 未加载');
    }

    if (window.errorSystemIntegrator.initialized) {
      try {
        if (window.ArchDebug) {
          window.ArchDebug.setFlag('errorSystemInitialized', true, {
            mirrorWindow: false,
          });
        }
      } catch (_) {
        (loggers.architecture || console).debug("ArchDebug setFlag errorSystemInitialized:", _);
      }
      return;
    }
    
    await window.errorSystemIntegrator.initialize({
      notificationHandler: options.notificationHandler,
      enableGlobalHandlers: true,
      enablePerformanceMonitoring: true,
      maxHistorySize: options.maxErrorHistory || 100,
    });

    try {
      if (window.ArchDebug) {
        window.ArchDebug.setFlag('errorSystemInitialized', true, {
          mirrorWindow: false,
        });
      }
    } catch (_) {
      (loggers.architecture || console).debug("ArchDebug setFlag errorSystemInitialized:", _);
    }
  }

  async initializeCoreServices(options) {
    const coreServices = ['errorManager', 'eventManager', 'appState', 'notificationService'];

    for (const serviceName of coreServices) {
      if (!window.diContainer.has(serviceName)) {
        (loggers.architecture || console).warn(`核心服务 ${serviceName} 未注册`);
      } else {
        window.diContainer.resolve(serviceName);
      }
    }
  }
  
  /**
   * 初始化存储服务
   */
  async initializeStorageServices(options) {
    if (!this.servicesRegistered && typeof window.configureStorageServices === 'function') {
      window.configureStorageServices(window.diContainer);
    }
    
    // 预热存储服务
    if (window.diContainer.has('storageManager')) {
      window.diContainer.resolve('storageManager');
    }
    
    // 运行存储健康检查
    if (window.StorageErrorHandler?.checkStorageHealth) {
      const health = await window.StorageErrorHandler.checkStorageHealth();
      if (health.issues.length > 0) {
        (loggers.architecture || console).warn('存储系统健康检查发现问题:', health.issues);
      }
    }
  }

  /**
   * 初始化网络服务
   */
  async initializeNetworkServices(options) {
    if (!this.servicesRegistered && typeof window.configureNetworkServices === 'function') {
      window.configureNetworkServices(window.diContainer);
    }
    
    // 预热网络服务
    if (window.diContainer.has('networkUtils')) {
      window.diContainer.resolve('networkUtils');
    }
    
    // 运行网络连接检查
    if (window.NetworkErrorHandler?.checkNetworkConnectivity) {
      const connectivity = await window.NetworkErrorHandler.checkNetworkConnectivity();
      const issues = connectivity?.issues || [];
      const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:';
      const isOnlyFileProtocolSkip =
        isFileProtocol &&
        issues.length === 1 &&
        typeof issues[0] === 'string' &&
        issues[0].includes('file://');

      if (issues.length > 0 && !isOnlyFileProtocolSkip) {
        (loggers.architecture || console).warn('网络连接检查发现问题:', issues);
      } else if (isOnlyFileProtocolSkip) {
        try {
          const alreadyNotified = window.ArchDebug
            ? window.ArchDebug.getFlag('fileProtocolNetworkCheckNotified')
            : false;

          if (!alreadyNotified) {
            if (window.ArchDebug) {
              window.ArchDebug.setFlag('fileProtocolNetworkCheckNotified', true, {
                mirrorWindow: false,
              });
            }

            if (typeof isDevelopment !== 'undefined' && isDevelopment) {
              (loggers.architecture || console).info('网络连接检查:', issues[0]);
            }

            if (typeof showNotification === 'function') {
              showNotification('info', '本地文件模式', '已跳过网络连接测试');
            }
          }
        } catch (_) {
          (loggers.architecture || console).debug("network services init:", _);
        }
      }
    }
  }

  /**
   * 初始化翻译服务
   */
  async initializeTranslationServices(options) {
    if (!this.servicesRegistered && typeof window.configureTranslationServices === 'function') {
      window.configureTranslationServices(window.diContainer);
    }
    
    // 预热翻译服务
    if (window.diContainer.has('translationService')) {
      window.diContainer.resolve('translationService');
    }
  }
  
  /**
   * 初始化UI服务
   */
  async initializeUIServices(options) {
    // 注册UI相关服务
    window.diContainer.registerSingleton('uiManager', () => ({
      showNotification: window.showNotification || ((t,ti,m) => (loggers.app || console).info(`${t}: ${ti} - ${m}`)),
      updateProgress: window.updateProgress || (() => {}),
      showDialog: window.showDialog || window.alert,
      showConfirm: window.showConfirm || window.confirm
    }), {
      dependencies: ['notificationService']
    });
  }
  
  /**
   * 完成初始化
   */
  async finalizeInitialization(options) {
    // 设置全局快捷访问
    this.setupGlobalShortcuts();
    
    // 运行最终验证
    await this.runFinalValidation();
    
    // 触发初始化完成事件
    this.triggerInitializationComplete();
  }
  
  /**
   * 注册核心模块
   */
  registerCoreModules() {
    const moduleConfigs = {
      // 核心模块
      state: defineModule({
        dependencies: [],
        factory: () => window.AppState,
        globalExports: ['AppState']
      }),
      
      utils: defineModule({
        dependencies: [],
        factory: () => window.Utils || {},
        globalExports: ['Utils']
      }),
      
      errorManager: defineModule({
        dependencies: [],
        factory: () => window.errorManager,
        globalExports: ['errorManager']
      }),
      
      eventManager: defineModule({
        dependencies: [],
        factory: () => window.eventManager,
        globalExports: ['eventManager']
      }),
      
      // 服务模块
      storageManager: defineService({
        dependencies: ['errorManager'],
        factory: (deps) => window.storageManager,
        globalExports: ['storageManager']
      }),
      
      translationService: defineService({
        dependencies: ['errorManager', 'storageManager'],
        factory: (deps) => window.translationService,
        globalExports: ['translationService']
      }),
      
      // 网络模块
      networkUtils: defineService({
        dependencies: ['errorManager'],
        factory: (deps) => window.networkUtilsV2 || window.NetworkUtils,
        globalExports: ['networkUtils']
      })
    };
    
    window.moduleManager.registerModules(moduleConfigs);
  }
  
  /**
   * 设置全局快捷访问
   */
  setupGlobalShortcuts() {
    // 创建全局架构访问点
    const architectureGlobal = {
      initializer: this,
      moduleManager: window.moduleManager,
      namespaceManager: window.namespaceManager,
      diContainer: window.diContainer,
      serviceLocator: window.serviceLocator,
      
      // 便捷方法
      getModule: (name) => window.moduleManager.getModule(name),
      getService: (name) => window.serviceLocator.get(name),
      getNamespace: (path) => window.namespaceManager.getNamespace(path),
      
      // 状态查询
      getStatus: () => this.getSystemStatus(),
      getReport: () => this.getInitializationReport()
    };

    // 挂载到命名空间（App.architecture.Architecture）
    window.createSafeGlobal('Architecture', architectureGlobal, {
      readonly: true,
      namespace: 'App.architecture'
    });

    // 同时提供全局访问点，供 waitForArchitecture 等使用
    if (!window.Architecture) {
      window.Architecture = architectureGlobal;
    }
  }
  
  /**
   * 运行最终验证
   */
  async runFinalValidation() {
    const validations = [];
    
    // 验证核心系统
    validations.push(this.validateCoreSystem());
    
    // 验证服务系统
    validations.push(this.validateServiceSystem());
    
    // 验证模块系统
    validations.push(this.validateModuleSystem());
    
    const results = await Promise.allSettled(validations);
    const failures = results.filter(r => r.status === 'rejected');
    
    if (failures.length > 0) {
      (loggers.architecture || console).warn('架构验证发现问题:', failures);
    } else {
      (loggers.architecture || console).info('架构验证通过');
    }
  }
  
  /**
   * 验证核心系统
   */
  validateCoreSystem() {
    const required = ['errorManager', 'eventManager', 'AppState'];
    const missing = required.filter(name => !window[name]);
    
    if (missing.length > 0) {
      throw new Error(`缺少核心组件: ${missing.join(', ')}`);
    }
    
    return true;
  }
  
  /**
   * 验证服务系统
   */
  validateServiceSystem() {
    if (!window.diContainer.has('errorManager')) {
      throw new Error('错误管理服务未注册');
    }
    
    if (!window.diContainer.has('notificationService')) {
      throw new Error('通知服务未注册');
    }
    
    return true;
  }
  
  /**
   * 验证模块系统
   */
  validateModuleSystem() {
    if (!window.moduleManager.initialized) {
      throw new Error('模块管理器未初始化');
    }
    
    const status = window.moduleManager.getSystemStatus();
    if (status.loadedModules < status.totalModules * 0.8) {
      throw new Error('模块加载率过低');
    }
    
    return true;
  }
  
  /**
   * 触发初始化完成事件
   */
  triggerInitializationComplete() {
    // 触发自定义事件
    if (typeof window.CustomEvent === 'function') {
      const event = new CustomEvent('architectureInitialized', {
        detail: this.getInitializationReport()
      });
      window.dispatchEvent(event);
    }
    
    // 调用回调函数
    if (typeof window.onArchitectureInitialized === 'function') {
      window.onArchitectureInitialized(this.getInitializationReport());
    }
  }
  
  /**
   * 启用性能监控
   */
  enablePerformanceMonitoring() {
    // 监控模块加载性能
    const originalLoadModule = window.moduleManager.loadModule;
    window.moduleManager.loadModule = async function(name) {
      const start = performance.now();
      const result = await originalLoadModule.call(this, name);
      const duration = performance.now() - start;
      
      if (duration > 100) {
        (loggers.architecture || console).warn(`模块 ${name} 加载耗时过长: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    };
    
    // 监控服务解析性能
    const originalResolve = window.diContainer.resolve;
    window.diContainer.resolve = function(name, context) {
      const start = performance.now();
      const result = originalResolve.call(this, name, context);
      const duration = performance.now() - start;
      
      if (duration > 50) {
        (loggers.architecture || console).warn(`服务 ${name} 解析耗时过长: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    };
  }
  
  /**
   * 启用错误报告
   */
  enableErrorReporting() {
    // 仅在开发模式下注册架构专用错误监听
    // 生产模式由 ErrorManager + error-production.js 统一处理，避免重复捕获
    if (typeof isDevelopment !== 'undefined' && isDevelopment) {
      window.addEventListener('error', (event) => {
        if (event.filename?.includes('/app/core/')) {
          (loggers.architecture || console).error('架构核心模块错误:', event);
        }
      });
      
      window.addEventListener('unhandledrejection', (event) => {
        (loggers.architecture || console).error('架构相关Promise拒绝:', event.reason);
      });
    }
  }
  
  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      initializationTime: this.endTime ? this.endTime - this.startTime : null,
      namespace: window.namespaceManager?.getNamespaceReport() || null,
      modules: window.moduleManager?.getSystemStatus() || null,
      services: window.diContainer?.getStatus() || null,
      errors: window.errorManager?.getErrorStats() || null
    };
  }
  
  /**
   * 获取初始化报告
   */
  getInitializationReport() {
    const totalDuration = this.endTime ? this.endTime - this.startTime : null;
    
    return {
      timestamp: new Date().toISOString(),
      initialized: this.initialized,
      totalDuration,
      steps: Object.fromEntries(this.stepStatus),
      systemStatus: this.getSystemStatus()
    };
  }
  
  /**
   * 记录初始化报告
   */
  logInitializationReport() {
    const report = this.getInitializationReport();
    
    // 简化的初始化报告
    (loggers.architecture || console).info(`架构初始化完成 (${report.totalDuration?.toFixed(2)}ms)`);
    
    // 只在开发模式且日志级别允许时显示详细报告
    if (typeof isDevelopment !== 'undefined' && isDevelopment &&
        typeof loggerConfig !== 'undefined' && loggerConfig.shouldLog(LOG_LEVELS.INFO, 'architecture')) {
      (loggers.architecture || console).info('📊 架构初始化报告');
      (loggers.architecture || console).info('总耗时:', `${report.totalDuration?.toFixed(2)}ms`);
      (loggers.architecture || console).info('初始化状态:', report.initialized ? '✅ 成功' : '❌ 失败');
      
      (loggers.architecture || console).info('步骤详情:');
      Object.entries(report.steps).forEach(([step, info]) => {
        const status = info.status === 'completed' ? '✅' : 
                      info.status === 'failed' ? '❌' : 
                      info.status === 'skipped' ? '⏭️' : '❓';
        (loggers.architecture || console).info(`${status} ${step}: ${info.duration?.toFixed(2)}ms`);
      });
    }
  }
}

// ==================== 便捷初始化函数 ====================

/**
 * 快速初始化架构
 * @param {Object} options - 初始化选项
 */
async function initializeArchitecture(options = {}) {
  const initializer = new ArchitectureInitializer();
  return await initializer.initialize(options);
}

/**
 * 等待架构就绪
 * @param {number} timeout - 超时时间
 */
function waitForArchitecture(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (window.Architecture?.initializer?.initialized) {
      resolve(true);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.Architecture?.initializer?.initialized) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('等待架构初始化超时'));
      }
    }, 100);
  });
}

// ==================== 全局实例 ====================
const architectureInitializer = new ArchitectureInitializer();

// ==================== 导出接口 ====================
window.ArchitectureInitializer = ArchitectureInitializer;
window.architectureInitializer = architectureInitializer;
window.initializeArchitecture = initializeArchitecture;
window.waitForArchitecture = waitForArchitecture;