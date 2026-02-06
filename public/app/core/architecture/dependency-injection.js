// ==================== 依赖注入系统 ====================
/**
 * 依赖注入系统：解决模块间依赖和耦合问题
 * 提供服务注册、依赖解析和生命周期管理
 */

/**
 * 依赖注入容器类
 * @class
 */
class DIContainer {
  constructor() {
    /** @type {Map<string, ServiceConfig>} */
    this.services = new Map();
    /** @type {Map<string, any>} */
    this.instances = new Map();
    /** @type {Map<string, Function>} */
    this.factories = new Map();
    /** @type {Set<string>} */
    this.singletons = new Set();
    /** @type {Set<string>} */
    this.resolving = new Set();
    /** @type {Map<string, Function[]>} */
    this.interceptors = new Map();
    /** @type {boolean} */
    this.initialized = false;
  }
  
  /**
   * 注册服务
   * @param {string} name - 服务名称
   * @param {Function|Object} implementation - 服务实现
   * @param {ServiceRegistrationOptions} [options={}] - 注册选项
   * @throws {Error} 当服务名称已存在时
   */
  register(name, implementation, options = {}) {
    const {
      singleton = true,
      factory = false,
      dependencies = [],
      lazy = false,
      tags = []
    } = options;
    
    const serviceConfig = {
      name,
      implementation,
      singleton,
      factory,
      dependencies,
      lazy,
      tags,
      registered: new Date().toISOString()
    };
    
    this.services.set(name, serviceConfig);
    
    if (singleton) {
      this.singletons.add(name);
    }
    
    if (factory) {
      this.factories.set(name, implementation);
    }
    
    // 使用日志系统 - 减少日志输出
    const logger = window.loggers?.di || console;
    logger.debug?.(`注册服务: ${name} (${singleton ? 'singleton' : 'transient'})`);
    return this;
  }
  
  /**
   * 注册单例服务
   * @param {string} name - 服务名称
   * @param {Function|Object} implementation - 服务实现
   * @param {ServiceRegistrationOptions} [options={}] - 注册选项
   * @returns {DIContainer} 返回容器实例以支持链式调用
   */
  registerSingleton(name, implementation, options = {}) {
    return this.register(name, implementation, { ...options, singleton: true });
  }
  
  /**
   * 注册瞬态服务
   * @param {string} name - 服务名称
   * @param {Function|Object} implementation - 服务实现
   * @param {ServiceRegistrationOptions} [options={}] - 注册选项
   * @returns {DIContainer} 返回容器实例以支持链式调用
   */
  registerTransient(name, implementation, options = {}) {
    return this.register(name, implementation, { ...options, singleton: false });
  }
  
  /**
   * 注册工厂服务
   * @param {string} name - 服务名称
   * @param {Function} factory - 工厂函数
   * @param {ServiceRegistrationOptions} [options={}] - 注册选项
   * @returns {DIContainer} 返回容器实例以支持链式调用
   */
  registerFactory(name, factory, options = {}) {
    return this.register(name, factory, { ...options, factory: true });
  }
  
  /**
   * 注册值服务
   * @param {string} name - 服务名称
   * @param {*} value - 值
   * @returns {DIContainer} 返回容器实例以支持链式调用
   */
  registerValue(name, value) {
    this.instances.set(name, value);
    return this.register(name, () => value, { singleton: true, lazy: false });
  }
  
  /**
   * 解析服务
   * @param {string} name - 服务名称
   * @param {ServiceResolutionContext} [context={}] - 解析上下文
   * @returns {*} 解析后的服务实例
   * @throws {Error} 当服务未注册或解析失败时
   */
  resolve(name, context = {}) {
    // 检查循环依赖
    if (this.resolving.has(name)) {
      throw new Error(`检测到循环依赖: ${name}`);
    }
    
    // 检查是否已有实例
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }
    
    // 获取服务配置
    const config = this.services.get(name);
    if (!config) {
      throw new Error(`服务 ${name} 未注册`);
    }
    
    this.resolving.add(name);
    
    try {
      // 解析依赖
      const dependencies = this.resolveDependencies(config.dependencies, context);
      
      // 创建实例
      let instance;
      if (config.factory) {
        // 工厂模式：直接调用实现函数
        instance = config.implementation(dependencies, this, context);
      } else if (typeof config.implementation === 'function') {
        // 构造函数模式：优先尝试作为构造函数
        try {
          instance = new config.implementation(dependencies, this, context);
        } catch (error) {
          // 兼容旧代码：如果实现并非真正的构造函数（例如返回实例的工厂函数），
          // 则回退为普通函数调用，避免 "is not a constructor" 错误
          if (error instanceof TypeError && /not a constructor/i.test(error.message)) {
            instance = config.implementation(dependencies, this, context);
          } else {
            throw error;
          }
        }
      } else {
        // 非函数实现：直接作为实例使用
        instance = config.implementation;
      }
      
      // 应用拦截器
      instance = this.applyInterceptors(name, instance, context);
      
      // 缓存单例
      if (config.singleton) {
        this.instances.set(name, instance);
      }
      
      this.resolving.delete(name);
      
      // 使用日志系统 - 减少日志输出
      const logger = window.loggers?.di || console;
      logger.debug?.(`解析服务: ${name}`);
      return instance;
      
    } catch (error) {
      this.resolving.delete(name);
      console.error(`❌ 解析服务失败: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * 解析依赖列表
   * @param {Array} dependencies - 依赖列表
   * @param {Object} context - 上下文
   */
  resolveDependencies(dependencies, context) {
    const resolved = {};
    
    dependencies.forEach(dep => {
      if (typeof dep === 'string') {
        resolved[dep] = this.resolve(dep, context);
      } else if (typeof dep === 'object') {
        const { name, alias, optional = false } = dep;
        try {
          resolved[alias || name] = this.resolve(name, context);
        } catch (error) {
          if (!optional) {
            throw error;
          }
          resolved[alias || name] = null;
        }
      }
    });
    
    return resolved;
  }
  
  /**
   * 批量解析服务
   * @param {Array} names - 服务名称列表
   * @param {Object} context - 上下文
   */
  resolveAll(names, context = {}) {
    const resolved = {};
    
    names.forEach(name => {
      try {
        resolved[name] = this.resolve(name, context);
      } catch (error) {
        console.error(`解析服务 ${name} 失败:`, error);
        resolved[name] = null;
      }
    });
    
    return resolved;
  }
  
  /**
   * 检查服务是否已注册
   * @param {string} name - 服务名称
   */
  has(name) {
    return this.services.has(name);
  }
  
  /**
   * 获取服务配置
   * @param {string} name - 服务名称
   */
  getServiceConfig(name) {
    return this.services.get(name);
  }
  
  /**
   * 添加拦截器
   * @param {string} serviceName - 服务名称
   * @param {Function} interceptor - 拦截器函数
   */
  addInterceptor(serviceName, interceptor) {
    if (!this.interceptors.has(serviceName)) {
      this.interceptors.set(serviceName, []);
    }
    this.interceptors.get(serviceName).push(interceptor);
    return this;
  }
  
  /**
   * 应用拦截器
   * @param {string} serviceName - 服务名称
   * @param {any} instance - 服务实例
   * @param {Object} context - 上下文
   */
  applyInterceptors(serviceName, instance, context) {
    const interceptors = this.interceptors.get(serviceName);
    if (!interceptors || interceptors.length === 0) {
      return instance;
    }
    
    return interceptors.reduce((current, interceptor) => {
      return interceptor(current, serviceName, context, this);
    }, instance);
  }
  
  /**
   * 创建子容器
   * @param {Object} options - 选项
   */
  createChild(options = {}) {
    const child = new DIContainer();
    
    // 继承父容器的服务
    if (options.inherit !== false) {
      this.services.forEach((config, name) => {
        child.services.set(name, { ...config });
      });
      
      this.singletons.forEach(name => {
        child.singletons.add(name);
      });
      
      this.factories.forEach((factory, name) => {
        child.factories.set(name, factory);
      });
    }
    
    // 设置父容器引用
    child.parent = this;
    
    return child;
  }
  
  /**
   * 清理容器
   */
  dispose() {
    // 清理实例
    this.instances.forEach((instance, name) => {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`清理服务 ${name} 失败:`, error);
        }
      }
    });
    
    // 清理状态
    this.services.clear();
    this.instances.clear();
    this.factories.clear();
    this.singletons.clear();
    this.resolving.clear();
    this.interceptors.clear();
    
    console.log('🧹 DI容器已清理');
  }
  
  /**
   * 获取容器状态
   */
  getStatus() {
    return {
      services: this.services.size,
      instances: this.instances.size,
      singletons: this.singletons.size,
      factories: this.factories.size,
      resolving: Array.from(this.resolving),
      serviceList: Array.from(this.services.keys()),
      instanceList: Array.from(this.instances.keys())
    };
  }
}

// ==================== 服务装饰器 ====================

/**
 * 创建服务装饰器
 * @param {Object} options - 装饰器选项
 */
function createServiceDecorator(options = {}) {
  return function serviceDecorator(target) {
    const serviceName = options.name || target.name;
    
    // 自动注册服务
    if (typeof window !== 'undefined' && window.diContainer) {
      window.diContainer.register(serviceName, target, options);
    }
    
    // 添加服务元信息
    target.__serviceMetadata__ = {
      name: serviceName,
      ...options,
      registered: new Date().toISOString()
    };
    
    return target;
  };
}

/**
 * 注入装饰器
 * @param {string} serviceName - 服务名称
 */
function inject(serviceName) {
  return function injectDecorator(target, propertyKey) {
    if (!target.__injections__) {
      target.__injections__ = [];
    }
    
    target.__injections__.push({
      property: propertyKey,
      service: serviceName
    });
  };
}

// ==================== 服务定位器 ====================

/**
 * 服务定位器类
 */
class ServiceLocator {
  constructor(container) {
    this.container = container;
  }
  
  /**
   * 获取服务
   * @param {string} name - 服务名称
   */
  get(name) {
    return this.container.resolve(name);
  }
  
  /**
   * 检查服务是否存在
   * @param {string} name - 服务名称
   */
  has(name) {
    return this.container.has(name);
  }
  
  /**
   * 获取所有服务
   * @param {Array} names - 服务名称列表
   */
  getAll(names) {
    return this.container.resolveAll(names);
  }
}

// ==================== 配置构建器 ====================

/**
 * 容器配置构建器
 */
class ContainerBuilder {
  constructor() {
    this.configurations = [];
  }
  
  /**
   * 添加服务配置
   * @param {Function} configFn - 配置函数
   */
  configure(configFn) {
    this.configurations.push(configFn);
    return this;
  }
  
  /**
   * 构建容器
   */
  build() {
    const container = new DIContainer();
    
    this.configurations.forEach(configFn => {
      configFn(container);
    });
    
    return container;
  }
}

// ==================== 预定义配置 ====================

/**
 * 核心服务配置
 * @param {DIContainer} container - 容器实例
 */
function configureCoreServices(container) {
  // 错误管理服务
  container.registerFactory('errorManager', () => window.errorManager, {
    dependencies: []
  });
  
  // 事件管理服务
  container.registerFactory('eventManager', () => window.eventManager, {
    dependencies: []
  });
  
  // 状态管理服务
  container.registerFactory('appState', () => window.AppState, {
    dependencies: []
  });
  
  // 通知服务
  container.registerFactory('notificationService', () => ({
    show: window.showNotification || console.log,
    showError: (title, message) => window.showNotification?.('error', title, message),
    showWarning: (title, message) => window.showNotification?.('warning', title, message),
    showSuccess: (title, message) => window.showNotification?.('success', title, message),
    showInfo: (title, message) => window.showNotification?.('info', title, message)
  }), {
    dependencies: []
  });
}

/**
 * 存储服务配置
 * @param {DIContainer} container - 容器实例
 */
function configureStorageServices(container) {
  container.registerFactory('storageManager', () => window.storageManager, {
    dependencies: ['errorManager']
  });
  
  container.registerFactory('storageErrorHandler', () => window.StorageErrorHandler, {
    dependencies: ['errorManager', 'storageManager']
  });
}

/**
 * 网络服务配置
 * @param {DIContainer} container - 容器实例
 */
function configureNetworkServices(container) {
  container.registerFactory('networkUtils', () => window.networkUtilsV2 || window.NetworkUtils, {
    dependencies: ['errorManager']
  });
  
  container.registerFactory('networkErrorHandler', () => window.NetworkErrorHandler, {
    dependencies: ['errorManager', 'networkUtils']
  });
}

/**
 * 翻译服务配置
 * @param {DIContainer} container - 容器实例
 */
function configureTranslationServices(container) {
  container.registerFactory('translationService', () => window.translationService, {
    dependencies: ['errorManager', 'networkUtils', 'storageManager']
  });
  
  container.registerFactory('translationErrorHandler', () => window.TranslationErrorHandler, {
    dependencies: ['errorManager', 'translationService']
  });
}

// ==================== 导出接口 ====================
window.DIContainer = DIContainer;
window.ServiceLocator = ServiceLocator;
window.ContainerBuilder = ContainerBuilder;
// diContainer 和 serviceLocator 将在 initializeDI() 中设置

// 装饰器
window.createServiceDecorator = createServiceDecorator;
window.inject = inject;

// 配置函数
window.configureCoreServices = configureCoreServices;
window.configureStorageServices = configureStorageServices;
window.configureNetworkServices = configureNetworkServices;
window.configureTranslationServices = configureTranslationServices;

// 便捷函数（统一走安全获取逻辑，避免未注册服务导致异常泛滥）
window.getService = (name) => getServiceSafely(name, name);
window.hasService = (name) => {
  try {
    if (serviceLocator && serviceLocator.has(name)) {
      return true;
    }
  } catch (error) {
    // 忽略定位器错误，退回到全局检查
  }
  return !!window[name];
};
window.getAllServices = (names) => {
  const services = {};
  names.forEach((n) => {
    try {
      services[n] = getServiceSafely(n, n);
    } catch (e) {
      services[n] = null;
    }
  });
  return services;
};

// ==================== 全局DI容器和服务定位器 ====================

// 立即创建全局实例并暴露到 window，供架构初始化器使用
let diContainer = new DIContainer();
let serviceLocator = new ServiceLocator(diContainer);
window.diContainer = diContainer;
window.serviceLocator = serviceLocator;

/**
 * 初始化依赖注入系统（统一入口，可重复调用）
 */
function initializeDI() {
  // 提供便捷的全局函数
  window.getService = (name) => getServiceSafely(name, name);
  window.hasService = (name) => {
    try {
      return serviceLocator && serviceLocator.has(name);
    } catch (error) {
      return !!window[name];
    }
  };
  window.registerService = (name, impl, options) => diContainer.register(name, impl, options);
  
  console.log('✅ 依赖注入系统初始化完成');
  
  return { diContainer, serviceLocator };
}

/**
 * 注册核心服务（统一入口，合并了 configureCoreServices 的功能）
 * 调用所有 configure*Services 函数注册完整的服务集
 */
function registerCoreServices() {
  if (!diContainer) {
    initializeDI();
  }
  
  // 调用各模块的配置函数
  configureCoreServices(diContainer);
  configureStorageServices(diContainer);
  configureNetworkServices(diContainer);
  configureTranslationServices(diContainer);
  
  // 注册额外的验证器和处理器
  diContainer.registerFactory('universalValidators', () => {
    if (typeof getUniversalValidators === 'function') {
      return getUniversalValidators();
    }

    if (typeof window.UniversalValidators === 'function') {
      return new window.UniversalValidators();
    }

    return null;
  });
  diContainer.registerFactory('translationValidators', () => window.TranslationValidators);
  diContainer.registerFactory('fileValidators', () => window.FileValidators);
  diContainer.registerFactory('storageValidators', () => window.StorageValidators);
  diContainer.registerFactory('validationUtils', () => window.ValidationUtils);
  
  diContainer.registerFactory('translationResultHandler', () => {
    if (typeof getTranslationResultHandler === 'function') {
      return getTranslationResultHandler();
    }

    return {
      handleTranslationComplete: window.handleTranslationComplete,
      handleTranslationResults: window.handleTranslationResults,
      handleResults: window.handleTranslationResults,
      handleProgress: window.handleTranslationProgress,
      handleError: window.handleTranslationError,
      updateTranslationUI: window.updateTranslationUI,
      updateUI: window.updateTranslationUI
    };
  });

  diContainer.registerFactory('translationUIUpdater', () => {
    if (window.TranslationUIUpdater) {
      return window.TranslationUIUpdater;
    }

    if (typeof window.updateTranslationUI === 'function') {
      return {
        update: window.updateTranslationUI,
        updateProgress: window.updateTranslationProgressUI,
        updateItemsStatus: window.updateTranslationItemsStatus
      };
    }

    return null;
  });
  
  // 注册性能监控服务
  diContainer.registerFactory('performanceMonitor', () => window.performanceMonitor);
  
  // 注册网络工具服务
  if (!diContainer.has('networkUtils')) {
    diContainer.registerFactory(
      'networkUtils',
      () => window.networkUtilsV2 || window.NetworkUtils || window.networkUtils
    );
  }
  
  // 注册DOM缓存服务
  diContainer.registerFactory('domCache', () => window.DOMCache);
  
  // 注册自动保存管理器
  diContainer.registerFactory('autoSaveManager', () => window.autoSaveManager);
  
  // 注册存储错误处理器
  if (!diContainer.has('storageErrorHandler')) {
    diContainer.registerFactory(
      'storageErrorHandler',
      () => window.storageErrorHandler || window.StorageErrorHandler
    );
  }
  
  // 注册事件绑定管理器
  diContainer.registerFactory('eventBindingManager', () => window.eventBindingManager || window.EventBindingManager);
  
  // 注册事件绑定便捷方法
  diContainer.registerFactory('eventBindings', () => window.eventBindings);
  
  // 注册P1新增的分层架构服务
  diContainer.registerFactory('translationBusinessLogic', () => window.translationBusinessLogic || window.TranslationBusinessLogic);
  diContainer.registerFactory('translationUIController', () => window.translationUIController || window.TranslationUIController);
  
  // 注册P1新增的性能优化服务
  diContainer.registerFactory('domOptimizationManager', () => window.domOptimizationManager || window.DOMOptimizationManager);
  // requestDeduplicationManager、unifiedErrorHandler 已从生产加载移除
  
  console.log('✅ 核心服务注册完成');
}

/**
 * 创建服务代理，支持依赖注入
 */
function createServiceProxy(serviceName, fallbackGlobal = null) {
  return new Proxy({}, {
    get(target, prop) {
      try {
        // 优先使用服务定位器
        const locator = serviceLocator;
        if (locator) {
          const service = locator.get(serviceName);
          if (service && typeof service[prop] !== 'undefined') {
            const value = service[prop];
            return typeof value === 'function' ? value.bind(service) : value;
          }
        }
      } catch (error) {
        console.warn(`服务 ${serviceName} 不可用，使用备用方案:`, error);
      }
      
      // 备用方案：使用全局对象
      if (fallbackGlobal && window[fallbackGlobal]) {
        const value = window[fallbackGlobal][prop];
        return typeof value === 'function' ? value.bind(window[fallbackGlobal]) : value;
      }
      
      throw new Error(`服务 ${serviceName} 和备用方案 ${fallbackGlobal} 都不可用`);
    }
  });
}

/**
 * 架构集成：将现有全局变量迁移到DI系统
 */
function integrateWithArchitecture() {
  // 确保DI容器已初始化
  if (!diContainer) {
    initializeDI();
  }
  
  // 注册核心服务
  registerCoreServices();
  
  // 注意：不再用 Proxy 覆盖 window 上的全局变量
  // 这会导致循环依赖问题（Proxy 尝试获取服务，服务工厂又检查 window.xxx）
  // 改为只提供 getService/hasService 接口，保持原有全局变量不变
  
  console.log('✅ 架构系统集成完成（保持原有全局变量）');
  
  // 添加架构状态检查
  window.checkArchitectureStatus = () => {
    const status = {
      diContainer: !!diContainer,
      serviceLocator: !!serviceLocator,
      services: diContainer ? diContainer.getStatus() : null,
      integration: 'active'
    };
    
    console.log('🏗️ 架构状态:', status);
    return status;
  };
  
  console.log('✅ 架构系统集成完成');
}

/**
 * 统一的服务获取函数（支持依赖注入和备用方案）
 */
function getServiceSafely(serviceName, fallbackGlobal = null) {
  try {
    // 优先使用服务定位器
    const locator = serviceLocator;
    if (locator && locator.has(serviceName)) {
      return locator.get(serviceName);
    }
  } catch (error) {
    // 静默处理，使用备用方案
  }
  
  // 备用方案
  if (fallbackGlobal && window[fallbackGlobal]) {
    return window[fallbackGlobal];
  }
  
  // 返回 null 而不是抛出错误，让调用方处理
  return null;
}

/**
 * 批量服务操作
 */
function withServices(serviceNames, callback) {
  try {
    const services = {};
    serviceNames.forEach(name => {
      services[name] = getServiceSafely(name, name);
    });
    
    return callback(services);
  } catch (error) {
    if (window.errorManager) {
      window.errorManager.handleError(error, { context: 'withServices' });
    } else {
      console.error('批量服务操作失败:', error);
    }
    throw error;
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DIContainer,
    ServiceLocator,
    createServiceDecorator,
    inject,
    initializeDI,
    registerCoreServices,
    integrateWithArchitecture,
    getServiceSafely,
    withServices
  };
} else {
  // 浏览器环境，暴露到全局
  window.DIContainer = DIContainer;
  window.ServiceLocator = ServiceLocator;
  window.createServiceDecorator = createServiceDecorator;
  window.inject = inject;
  window.initializeDI = initializeDI;
  window.registerCoreServices = registerCoreServices;
  window.integrateWithArchitecture = integrateWithArchitecture;
  window.getServiceSafely = getServiceSafely;
  window.withServices = withServices;
}