// ==================== 模块管理系统 ====================
/**
 * 模块管理系统：解决全局变量污染和依赖管理问题
 * 提供统一的模块注册、依赖解析和生命周期管理
 */

/**
 * 模块管理器类
 */
class ModuleManager {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Map();
    this.loadOrder = [];
    this.loadedModules = new Set();
    this.loadingModules = new Set();
    this.moduleInstances = new Map();
    this.globalExports = new Map();
    this.initialized = false;
  }
  
  /**
   * 注册模块
   * @param {string} name - 模块名称
   * @param {Object} config - 模块配置
   */
  registerModule(name, config) {
    const moduleConfig = {
      name,
      dependencies: config.dependencies || [],
      factory: config.factory || (() => ({})),
      singleton: config.singleton !== false,
      exports: config.exports || [],
      globalExports: config.globalExports || [],
      initialized: false,
      instance: null,
      ...config
    };
    
    this.modules.set(name, moduleConfig);
    this.dependencies.set(name, moduleConfig.dependencies);
    
    // 只在开发模式下显示详细日志
    if (typeof isDevelopment !== 'undefined' && isDevelopment) {
      console.log(`📦 已注册模块: ${name}`);
    }
    return this;
  }
  
  /**
   * 批量注册模块
   * @param {Object} moduleConfigs - 模块配置对象
   */
  registerModules(moduleConfigs) {
    Object.entries(moduleConfigs).forEach(([name, config]) => {
      this.registerModule(name, config);
    });
    return this;
  }
  
  /**
   * 解析依赖顺序
   */
  resolveDependencies() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];
    
    const visit = (moduleName) => {
      if (visiting.has(moduleName)) {
        throw new Error(`检测到循环依赖: ${moduleName}`);
      }
      
      if (visited.has(moduleName)) {
        return;
      }
      
      visiting.add(moduleName);
      
      const deps = this.dependencies.get(moduleName) || [];
      deps.forEach(dep => {
        if (!this.modules.has(dep)) {
          throw new Error(`模块 ${moduleName} 依赖的模块 ${dep} 未注册`);
        }
        visit(dep);
      });
      
      visiting.delete(moduleName);
      visited.add(moduleName);
      order.push(moduleName);
    };
    
    // 访问所有模块
    for (const moduleName of this.modules.keys()) {
      visit(moduleName);
    }
    
    this.loadOrder = order;
    // 使用日志系统
    const logger = window.loggers?.modules || console;
    logger.debug?.('模块加载顺序:', order) || (typeof isDevelopment !== 'undefined' && isDevelopment && console.log('📋 模块加载顺序:', order));
    return order;
  }
  
  /**
   * 初始化模块系统
   */
  async initialize() {
    if (this.initialized) {
      console.warn('模块系统已经初始化');
      return;
    }
    
    try {
      // 使用日志系统
      const logger = window.loggers?.modules || console;
      logger.info?.('初始化模块系统...') || console.log('🚀 初始化模块系统...');
      
      // 解析依赖
      this.resolveDependencies();
      
      // 按顺序加载模块
      for (const moduleName of this.loadOrder) {
        await this.loadModule(moduleName);
      }
      
      // 设置全局导出
      this.setupGlobalExports();
      
      this.initialized = true;
      logger.info?.('模块系统初始化完成') || console.log('✅ 模块系统初始化完成');
      
    } catch (error) {
      console.error('❌ 模块系统初始化失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载单个模块
   * @param {string} name - 模块名称
   */
  async loadModule(name) {
    if (this.loadedModules.has(name)) {
      return this.moduleInstances.get(name);
    }
    
    if (this.loadingModules.has(name)) {
      throw new Error(`模块 ${name} 正在加载中，可能存在循环依赖`);
    }
    
    const config = this.modules.get(name);
    if (!config) {
      throw new Error(`模块 ${name} 未注册`);
    }
    
    this.loadingModules.add(name);
    
    try {
      // 使用日志系统
      const logger = window.loggers?.modules || console;
      logger.debug?.(`加载模块: ${name}`) || (typeof isDevelopment !== 'undefined' && isDevelopment && console.log(`📥 加载模块: ${name}`));
      
      // 加载依赖
      const dependencies = {};
      for (const depName of config.dependencies) {
        dependencies[depName] = await this.loadModule(depName);
      }
      
      // 创建模块实例
      let instance;
      if (config.singleton && config.instance) {
        instance = config.instance;
      } else {
        instance = await config.factory(dependencies, this);
        if (config.singleton) {
          config.instance = instance;
        }
      }
      
      // 存储实例
      this.moduleInstances.set(name, instance);
      
      // 标记为已加载
      this.loadedModules.add(name);
      this.loadingModules.delete(name);
      config.initialized = true;
      
      // 使用日志系统
      logger.debug?.(`模块加载完成: ${name}`) || (typeof isDevelopment !== 'undefined' && isDevelopment && console.log(`✅ 模块加载完成: ${name}`));
      return instance;
      
    } catch (error) {
      this.loadingModules.delete(name);
      console.error(`❌ 模块加载失败: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * 获取模块实例
   * @param {string} name - 模块名称
   */
  getModule(name) {
    return this.moduleInstances.get(name);
  }
  
  /**
   * 检查模块是否已加载
   * @param {string} name - 模块名称
   */
  isModuleLoaded(name) {
    return this.loadedModules.has(name);
  }
  
  /**
   * 设置全局导出
   */
  setupGlobalExports() {
    this.modules.forEach((config, name) => {
      const instance = this.moduleInstances.get(name);
      if (!instance) return;
      
      // 设置模块级别的全局导出
      if (config.globalExports && config.globalExports.length > 0) {
        config.globalExports.forEach(exportName => {
          if (instance[exportName] !== undefined) {
            window[exportName] = instance[exportName];
            this.globalExports.set(exportName, { module: name, value: instance[exportName] });
            console.log(`🌐 全局导出: ${exportName} (来自 ${name})`);
          }
        });
      }
      
      // 设置到App命名空间
      const namespace = this.getNamespaceForModule(name);
      if (namespace) {
        this.setNestedProperty(window.App, namespace, instance);
        // 使用日志系统
        const logger = window.loggers?.modules || console;
        logger.debug?.(`命名空间导出: App.${namespace} (${name})`) || (typeof isDevelopment !== 'undefined' && isDevelopment && console.log(`📁 命名空间导出: App.${namespace} (${name})`));
      }
    });
  }
  
  /**
   * 获取模块的命名空间路径
   * @param {string} moduleName - 模块名称
   */
  getNamespaceForModule(moduleName) {
    const namespaceMap = {
      // 核心模块
      'state': 'core.state',
      'utils': 'core.utils',
      'domCache': 'core.domCache',
      'errorManager': 'core.errorManager',
      'eventManager': 'core.eventManager',
      
      // 服务模块
      'storageManager': 'services.storage',
      'translationService': 'services.translation',
      'securityUtils': 'services.security',
      'autoSaveManager': 'services.autoSave',
      
      // 网络模块
      'networkUtils': 'network.utils',
      
      // 解析器模块
      'jsonParser': 'parsers.json',
      'xliffParser': 'parsers.xliff',
      'poParser': 'parsers.po',
      'xmlAndroidParser': 'parsers.xmlAndroid',
      'resxParser': 'parsers.resx',
      'qtTsParser': 'parsers.qtTs',
      'iosStringsParser': 'parsers.iosStrings',
      'textParser': 'parsers.text',
      
      // 功能模块
      'fileFeatures': 'features.files',
      'translationFeatures': 'features.translations',
      'qualityFeatures': 'features.quality',
      'terminologyFeatures': 'features.terminology',
      'projectManager': 'features.projects',
      
      // UI模块
      'fileTree': 'ui.fileTree',
      'notification': 'ui.notification',
      'charts': 'ui.charts',
      'settings': 'ui.settings',
      'eventListeners': 'ui.eventListeners'
    };
    
    return namespaceMap[moduleName];
  }
  
  /**
   * 设置嵌套属性
   * @param {Object} obj - 目标对象
   * @param {string} path - 属性路径
   * @param {any} value - 值
   */
  setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * 获取系统状态
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      totalModules: this.modules.size,
      loadedModules: this.loadedModules.size,
      loadOrder: this.loadOrder,
      globalExports: Array.from(this.globalExports.keys()),
      moduleStatus: Array.from(this.modules.entries()).map(([name, config]) => ({
        name,
        loaded: this.loadedModules.has(name),
        initialized: config.initialized,
        dependencies: config.dependencies,
        hasInstance: this.moduleInstances.has(name)
      }))
    };
  }
  
  /**
   * 重新加载模块
   * @param {string} name - 模块名称
   */
  async reloadModule(name) {
    if (!this.modules.has(name)) {
      throw new Error(`模块 ${name} 未注册`);
    }
    
    // 清除加载状态
    this.loadedModules.delete(name);
    this.moduleInstances.delete(name);
    
    const config = this.modules.get(name);
    config.initialized = false;
    config.instance = null;
    
    // 重新加载
    return await this.loadModule(name);
  }
  
  /**
   * 卸载模块
   * @param {string} name - 模块名称
   */
  unloadModule(name) {
    const config = this.modules.get(name);
    if (!config) return;
    
    // 清理全局导出
    config.globalExports?.forEach(exportName => {
      if (this.globalExports.has(exportName)) {
        delete window[exportName];
        this.globalExports.delete(exportName);
      }
    });
    
    // 清理实例
    this.loadedModules.delete(name);
    this.moduleInstances.delete(name);
    config.initialized = false;
    config.instance = null;
    
    console.log(`🗑️ 模块已卸载: ${name}`);
  }
  
  /**
   * 清理所有模块
   */
  cleanup() {
    // 清理全局导出
    this.globalExports.forEach((info, exportName) => {
      delete window[exportName];
    });
    
    // 清理状态
    this.loadedModules.clear();
    this.moduleInstances.clear();
    this.globalExports.clear();
    this.initialized = false;
    
    // 重置模块状态
    this.modules.forEach(config => {
      config.initialized = false;
      config.instance = null;
    });
    
    console.log('🧹 模块系统已清理');
  }
}

// ==================== 模块定义辅助函数 ====================

/**
 * 创建模块定义
 * @param {Object} config - 模块配置
 */
function defineModule(config) {
  return {
    dependencies: [],
    singleton: true,
    exports: [],
    globalExports: [],
    ...config
  };
}

/**
 * 创建服务模块
 * @param {Object} config - 服务配置
 */
function defineService(config) {
  return defineModule({
    ...config,
    singleton: true,
    type: 'service'
  });
}

/**
 * 创建工具模块
 * @param {Object} config - 工具配置
 */
function defineUtility(config) {
  return defineModule({
    ...config,
    singleton: true,
    type: 'utility'
  });
}

/**
 * 创建UI组件模块
 * @param {Object} config - 组件配置
 */
function defineComponent(config) {
  return defineModule({
    ...config,
    singleton: false,
    type: 'component'
  });
}

// ==================== 全局模块管理器实例 ====================
const moduleManager = new ModuleManager();

// ==================== 导出接口 ====================
window.ModuleManager = ModuleManager;
window.moduleManager = moduleManager;
window.defineModule = defineModule;
window.defineService = defineService;
window.defineUtility = defineUtility;
window.defineComponent = defineComponent;

// 便捷函数
window.getModule = (name) => moduleManager.getModule(name);
window.isModuleLoaded = (name) => moduleManager.isModuleLoaded(name);
window.getModuleSystemStatus = () => moduleManager.getSystemStatus();