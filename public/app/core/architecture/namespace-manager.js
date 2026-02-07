// ==================== 命名空间管理系统（修复版） ====================
/**
 * 命名空间管理系统：解决全局变量污染问题
 * 提供统一的命名空间创建、管理和隔离机制
 */

/**
 * 命名空间管理器类
 */
class NamespaceManager {
  constructor() {
    this.namespaces = new Map();
    this.globalRegistry = new Map();
    this.reservedNames = new Set([
      'window', 'document', 'console', 'setTimeout', 'setInterval',
      'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
      'indexedDB', 'navigator', 'location', 'history'
    ]);
    this.initialized = false;
  }
  
  /**
   * 初始化命名空间系统
   */
  initialize() {
    if (this.initialized) {
      (loggers.architecture || console).warn('命名空间系统已经初始化');
      return;
    }
    
    (loggers.architecture || console).info('初始化命名空间系统...');
    
    // 创建主命名空间
    this.createMainNamespace();
    
    // 设置全局变量保护
    this.setupGlobalProtection();
    
    this.initialized = true;
    (loggers.architecture || console).info('命名空间系统初始化完成');
  }
  
  /**
   * 创建主命名空间
   */
  createMainNamespace() {
    // 确保App命名空间存在且结构完整
    if (!window.App) {
      window.App = {};
    }
    
    // 只有在还没有__namespace__属性时才设置
    if (!window.App.__namespace__) {
      // 创建标准的子命名空间
      const standardNamespaces = {
        core: { description: '核心功能模块', modules: {} },
        services: { description: '服务层模块', modules: {} },
        features: { description: '功能模块', modules: {} },
        ui: { description: 'UI组件模块', modules: {} },
        parsers: { description: '解析器模块', modules: {} },
        network: { description: '网络相关模块', modules: {} },
        utils: { description: '工具函数模块', modules: {} },
        constants: { description: '常量定义', modules: {} },
        types: { description: '类型定义', modules: {} }
      };
      
      Object.entries(standardNamespaces).forEach(([name, config]) => {
        this.createNamespace(`App.${name}`, config);
      });
      
      // 设置命名空间元信息
      try {
        Object.defineProperty(window.App, '__namespace__', {
          value: {
            name: 'App',
            type: 'root',
            created: new Date().toISOString(),
            manager: this
          },
          writable: false,
          enumerable: false,
          configurable: false
        });
      } catch (error) {
        (loggers.architecture || console).warn('App.__namespace__已存在，跳过设置');
      }
    }
  }
  
  /**
   * 创建命名空间
   */
  createNamespace(path, config = {}) {
    const {
      description = '',
      sealed = false,
      frozen = false,
      modules = {}
    } = config;
    
    const parts = path.split('.');
    let current = window;
    let fullPath = '';
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      fullPath = fullPath ? `${fullPath}.${part}` : part;
      
      if (!(part in current)) {
        current[part] = {};
        
        // 添加命名空间元信息
        try {
          Object.defineProperty(current[part], '__namespace__', {
            value: {
              name: fullPath,
              path: parts.slice(0, i + 1),
              description,
              created: new Date().toISOString(),
              sealed,
              frozen,
              modules: new Set()
            },
            writable: false,
            enumerable: false,
            configurable: false
          });
        } catch (error) {
          // 如果属性已存在，跳过
          (loggers.architecture || console).warn(`命名空间 ${fullPath} 的__namespace__属性已存在`);
        }
      }
      
      current = current[part];
    }
    
    // 初始化模块
    Object.entries(modules).forEach(([moduleName, moduleValue]) => {
      this.addToNamespace(path, moduleName, moduleValue);
    });
    
    // 应用保护措施
    if (sealed) {
      Object.seal(current);
    }
    if (frozen) {
      Object.freeze(current);
    }
    
    this.namespaces.set(path, current);
    
    (loggers.architecture || console).debug(`创建命名空间: ${path}`);
    
    return current;
  }
  
  /**
   * 添加模块到命名空间
   */
  addToNamespace(namespacePath, moduleName, moduleValue, options = {}) {
    const {
      overwrite = false,
      readonly = false,
      enumerable = true
    } = options;
    
    const namespace = this.getNamespace(namespacePath);
    if (!namespace) {
      throw new Error(`命名空间 ${namespacePath} 不存在`);
    }
    
    // 检查是否已存在
    if (moduleName in namespace && !overwrite) {
      (loggers.architecture || console).warn(`模块 ${moduleName} 已存在于命名空间 ${namespacePath}`);
      return false;
    }
    
    // 添加模块
    const descriptor = {
      value: moduleValue,
      enumerable,
      configurable: !readonly
    };
    
    if (!readonly) {
      descriptor.writable = true;
    }
    
    Object.defineProperty(namespace, moduleName, descriptor);
    
    // 更新命名空间元信息
    if (namespace.__namespace__) {
      namespace.__namespace__.modules.add(moduleName);
    }
    
    // 使用日志系统 - 减少日志输出
    const logger = window.loggers?.namespace || console;
    logger.debug?.(`添加模块到命名空间: ${namespacePath}.${moduleName}`);
    return true;
  }
  
  /**
   * 获取命名空间
   */
  getNamespace(path) {
    return this.namespaces.get(path) || this.resolveNamespacePath(path);
  }
  
  /**
   * 解析命名空间路径
   */
  resolveNamespacePath(path) {
    const parts = path.split('.');
    let current = window;
    
    for (const part of parts) {
      if (!(part in current)) {
        return null;
      }
      current = current[part];
    }
    
    return current;
  }
  
  /**
   * 设置全局变量保护
   */
  setupGlobalProtection() {
    // 仅在开发模式下启用全局变量监控
    if (typeof isDevelopment === 'undefined' || !isDevelopment) {
      return;
    }

    // 记录现有的全局变量
    const existingGlobals = new Set(Object.getOwnPropertyNames(window));
    
    // 监控新全局变量的添加（通过定期检查实现）
    const self = this;
    this._globalProtectionIntervalId = setInterval(() => {
      try {
        const currentGlobals = Object.getOwnPropertyNames(window);
        currentGlobals.forEach(propertyStr => {
          // 检查是否为新的全局变量
          if (!existingGlobals.has(propertyStr) && 
              !propertyStr.startsWith('__') && 
              !self.isAllowedGlobal(propertyStr)) {
            // 使用日志系统减少输出 - 只记录不显示
            const logger = window.loggers?.namespace || console;
            logger.debug?.(`检测到新的全局变量: ${propertyStr}，建议使用命名空间`);
            
            // 记录全局变量（不捕获堆栈以避免性能开销）
            if (!self.globalRegistry.has(propertyStr)) {
              self.globalRegistry.set(propertyStr, {
                created: new Date().toISOString()
              });
            }
            existingGlobals.add(propertyStr);
          }
        });
      } catch (error) {
        (loggers.architecture || console).warn('全局变量保护检查失败:', error);
      }
    }, 10000); // 每10秒检查一次，减少频率
  }
  
  /**
   * 清理命名空间管理器资源
   */
  cleanup() {
    if (this._globalProtectionIntervalId) {
      clearInterval(this._globalProtectionIntervalId);
      this._globalProtectionIntervalId = null;
    }
  }
  
  /**
   * 检查是否为允许的全局变量
   */
  isAllowedGlobal(name) {
    const allowedPatterns = [
      /^App$/,                    // App命名空间
      /^[A-Z][a-zA-Z]*Error$/,   // 错误类
      /^[A-Z][a-zA-Z]*Manager$/, // 管理器类
      /^[a-z][a-zA-Z]*Manager$/, // 管理器实例
      /^ERROR_/,                 // 错误常量
      /^[A-Z_]+$/,              // 其他常量
      /^define[A-Z]/,           // 定义函数
      /^create[A-Z]/,           // 创建函数
      /^get[A-Z]/,              // 获取函数
      /^is[A-Z]/,               // 判断函数
      /^show[A-Z]/,             // 显示函数
      /^handle[A-Z]/            // 处理函数
    ];
    
    return allowedPatterns.some(pattern => pattern.test(name));
  }

  /**
   * 获取命名空间报告
   * @returns {Object} 命名空间报告
   */
  getNamespaceReport() {
    const report = {
      totalNamespaces: this.namespaces.size,
      registeredGlobals: this.globalRegistry.size,
      namespaceList: Array.from(this.namespaces.keys()),
      globalList: Array.from(this.globalRegistry.keys()).slice(0, 10), // 只显示前10个
      statistics: {
        averageModulesPerNamespace: 0,
        oldestNamespace: null,
        newestNamespace: null
      }
    };

    // 计算统计信息
    if (this.namespaces.size > 0) {
      let totalModules = 0;
      let oldestTime = Date.now();
      let newestTime = 0;
      let oldestName = '';
      let newestName = '';

      this.namespaces.forEach((nsInfo, name) => {
        if (nsInfo.modules) {
          totalModules += nsInfo.modules.size;
        }
        
        const createTime = nsInfo.created ? new Date(nsInfo.created).getTime() : Date.now();
        if (createTime < oldestTime) {
          oldestTime = createTime;
          oldestName = name;
        }
        if (createTime > newestTime) {
          newestTime = createTime;
          newestName = name;
        }
      });

      report.statistics.averageModulesPerNamespace = Math.round(totalModules / this.namespaces.size);
      report.statistics.oldestNamespace = oldestName;
      report.statistics.newestNamespace = newestName;
    }

    return report;
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建安全的全局变量
 */
function createSafeGlobal(name, value, options = {}) {
  const {
    overwrite = false,
    readonly = false,
    namespace = null
  } = options;
  
  if (namespace) {
    return namespaceManager.addToNamespace(namespace, name, value, {
      overwrite,
      readonly
    });
  }
  
  if (name in window && !overwrite) {
    (loggers.architecture || console).warn(`全局变量 ${name} 已存在`);
    return false;
  }
  
  const descriptor = {
    value,
    enumerable: true,
    configurable: !readonly
  };
  
  if (!readonly) {
    descriptor.writable = true;
  }
  
  Object.defineProperty(window, name, descriptor);
  
  namespaceManager.globalRegistry.set(name, {
    value,
    created: new Date().toISOString(),
    readonly
  });
  
  return true;
}

/**
 * 获取命名空间中的模块
 */
function getFromNamespace(path) {
  const parts = path.split('.');
  let current = window;
  
  for (const part of parts) {
    if (!(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

// ==================== 全局实例 ====================
const namespaceManager = new NamespaceManager();

// ==================== 导出接口 ====================
window.NamespaceManager = NamespaceManager;
window.namespaceManager = namespaceManager;
window.createSafeGlobal = createSafeGlobal;
window.getFromNamespace = getFromNamespace;

// 延迟初始化命名空间系统，避免过早初始化
setTimeout(() => {
  try {
    namespaceManager.initialize();
  } catch (error) {
    (loggers.architecture || console).error('命名空间系统初始化失败:', error);
  }
}, 0);
