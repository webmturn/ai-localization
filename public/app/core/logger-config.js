// ==================== 日志配置系统 ====================
/**
 * 日志配置系统：根据环境动态调整日志输出级别
 */

/**
 * 日志级别枚举
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  VERBOSE: 4
};

/**
 * 日志配置类
 */
class LoggerConfig {
  constructor() {
    this.currentLevel = this.detectLogLevel();
    this.categories = new Map();
    this.initialized = false;
  }
  
  /**
   * 检测当前日志级别
   */
  detectLogLevel() {
    // 开发模式 - 适度减少日志
    if (typeof isDevelopment !== 'undefined' && isDevelopment) {
      return LOG_LEVELS.INFO; // 从DEBUG降低到INFO
    }
    
    // 本地文件协议 - 更严格的日志级别
    if (window.location.protocol === 'file:') {
      return LOG_LEVELS.ERROR; // 从WARN降低到ERROR
    }
    
    // localhost - 更严格的日志级别
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return LOG_LEVELS.ERROR; // 从WARN降低到ERROR
    }
    
    // 生产环境
    return LOG_LEVELS.ERROR;
  }
  
  /**
   * 设置日志级别
   */
  setLevel(level) {
    this.currentLevel = level;
  }
  
  /**
   * 设置分类日志级别
   */
  setCategoryLevel(category, level) {
    this.categories.set(category, level);
  }
  
  /**
   * 检查是否应该输出日志
   */
  shouldLog(level, category = 'default') {
    const categoryLevel = this.categories.get(category) || this.currentLevel;
    return level <= categoryLevel;
  }
  
  /**
   * 创建日志函数
   */
  createLogger(category = 'default') {
    return {
      error: (...args) => {
        if (this.shouldLog(LOG_LEVELS.ERROR, category)) {
          console.error(`[${category}]`, ...args);
        }
      },
      
      warn: (...args) => {
        if (this.shouldLog(LOG_LEVELS.WARN, category)) {
          console.warn(`[${category}]`, ...args);
        }
      },
      
      info: (...args) => {
        if (this.shouldLog(LOG_LEVELS.INFO, category)) {
          console.log(`[${category}]`, ...args);
        }
      },
      
      debug: (...args) => {
        if (this.shouldLog(LOG_LEVELS.DEBUG, category)) {
          console.log(`[${category}]`, ...args);
        }
      },
      
      verbose: (...args) => {
        if (this.shouldLog(LOG_LEVELS.VERBOSE, category)) {
          console.log(`[${category}]`, ...args);
        }
      }
    };
  }
  
  /**
   * 初始化日志配置
   */
  initialize() {
    if (this.initialized) return;
    
    // 设置分类日志级别 - 大幅减少日志输出
    this.setCategoryLevel('architecture', LOG_LEVELS.ERROR);
    this.setCategoryLevel('modules', LOG_LEVELS.ERROR);
    this.setCategoryLevel('services', LOG_LEVELS.ERROR);
    this.setCategoryLevel('scripts', LOG_LEVELS.WARN);
    this.setCategoryLevel('errors', LOG_LEVELS.WARN);
    this.setCategoryLevel('namespace', LOG_LEVELS.ERROR); // 新增：命名空间管理器
    this.setCategoryLevel('performance', LOG_LEVELS.ERROR); // 新增：性能监控
    this.setCategoryLevel('storage', LOG_LEVELS.ERROR); // 新增：存储系统
    this.setCategoryLevel('di', LOG_LEVELS.ERROR); // 新增：依赖注入
    
    // 在开发模式下适度显示关键日志
    if (this.currentLevel >= LOG_LEVELS.INFO) {
      this.setCategoryLevel('scripts', LOG_LEVELS.INFO); // 只保留脚本加载进度
      this.setCategoryLevel('errors', LOG_LEVELS.INFO);  // 保留错误信息
    }
    
    this.initialized = true;
    
    // 显示当前日志配置
    const levelName = Object.keys(LOG_LEVELS)[Object.values(LOG_LEVELS).indexOf(this.currentLevel)];
    console.log(`📋 日志级别: ${levelName} (${this.currentLevel})`);
  }
  
  /**
   * 获取配置状态
   */
  getStatus() {
    return {
      currentLevel: this.currentLevel,
      categories: Object.fromEntries(this.categories),
      initialized: this.initialized
    };
  }
}

// ==================== 全局日志配置 ====================
const loggerConfig = new LoggerConfig();

// 创建分类日志器
const loggers = {
  architecture: loggerConfig.createLogger('architecture'),
  modules: loggerConfig.createLogger('modules'),
  services: loggerConfig.createLogger('services'),
  scripts: loggerConfig.createLogger('scripts'),
  errors: loggerConfig.createLogger('errors'),
  app: loggerConfig.createLogger('app')
};

// ==================== 导出接口 ====================
window.LoggerConfig = LoggerConfig;
window.LOG_LEVELS = LOG_LEVELS;
window.loggerConfig = loggerConfig;
window.loggers = loggers;

// 便捷函数
window.createLogger = (category) => loggerConfig.createLogger(category);
window.setLogLevel = (level) => loggerConfig.setLevel(level);
window.setCategoryLogLevel = (category, level) => loggerConfig.setCategoryLevel(category, level);

// 自动初始化
loggerConfig.initialize();