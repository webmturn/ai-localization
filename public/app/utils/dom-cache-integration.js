// ==================== DOM缓存集成管理器 ====================
/**
 * DOM缓存优化集成管理器
 * 统一DOM查询和缓存管理，提供简化的API接口
 * 集成项目现有的DOM优化工具，消除重复的DOM查询
 */

class DOMCacheIntegration {
  constructor(dependencies = {}) {
    // 使用依赖注入获取服务
    this.domOptimizationManager = dependencies.domOptimizationManager || this.getService('domOptimizationManager');
    this.domCache = dependencies.domCache || this.getService('domCache', 'DOMCache');
    this.performanceMonitor = dependencies.performanceMonitor || this.getService('performanceMonitor');
    
    // 常用DOM元素缓存
    this.elementCache = new Map();
    this.lastCacheTime = 0;
    this.cacheTimeout = 300000; // 5分钟缓存超时
    
    // 初始化常用元素缓存
    this.initializeCommonElements();
  }

  /**
   * 安全获取服务的辅助方法
   */
  getService(serviceName, fallbackGlobal = null) {
    if (typeof getServiceSafely === 'function') {
      return getServiceSafely(serviceName, fallbackGlobal);
    }
    
    // 备用方案：直接从全局获取
    if (fallbackGlobal && window[fallbackGlobal]) {
      return window[fallbackGlobal];
    }
    
    return null;
  }

  /**
   * 初始化常用元素缓存
   */
  initializeCommonElements() {
    const commonSelectors = [
      // 翻译界面核心元素
      'translationScrollWrapper',
      'translationProgressContainer',
      'translationControlButtons',
      'searchInput',
      'searchResultsPanel',
      
      // 文件操作元素
      'fileTree',
      'fileUpload',
      'fileExport',
      
      // 设置界面元素
      'sourceLanguage',
      'targetLanguage',
      'defaultEngine',
      'translationModel',
      
      // 通知和进度元素
      'notificationContainer',
      'progressBar',
      'statusDisplay'
    ];

    // 预缓存常用元素
    commonSelectors.forEach(selector => {
      try {
        this.getCachedElement(`#${selector}`);
      } catch (error) {
        // 忽略不存在的元素
      }
    });
  }

  /**
   * 获取缓存的DOM元素（优化版本）
   * @param {string} selector - CSS选择器
   * @param {Element} context - 查找上下文，默认为document
   * @returns {Element|null} DOM元素
   */
  getCachedElement(selector, context = document) {
    const startTime = this.performanceMonitor ? performance.now() : null;
    
    try {
      // 1. 优先使用DOMOptimizationManager
      if (this.domOptimizationManager && this.domOptimizationManager.getCachedElement) {
        const element = this.domOptimizationManager.getCachedElement(selector, context);
        if (element) {
          this.recordPerformance('getCachedElement', startTime, 'domOptimization');
          return element;
        }
      }

      // 2. 使用全局DOMCache
      if (this.domCache && this.domCache.get) {
        // 将选择器转换为缓存键
        const cacheKey = selector.startsWith('#') ? selector.slice(1) : selector;
        const element = this.domCache.get(cacheKey);
        if (element) {
          this.recordPerformance('getCachedElement', startTime, 'domCache');
          return element;
        }
      }

      // 3. 本地缓存查找
      const cacheKey = this.generateCacheKey(selector, context);
      if (this.elementCache.has(cacheKey)) {
        const cached = this.elementCache.get(cacheKey);
        if (this.isCacheValid(cached)) {
          this.recordPerformance('getCachedElement', startTime, 'localCache');
          return cached.element;
        } else {
          this.elementCache.delete(cacheKey);
        }
      }

      // 4. 执行DOM查询并缓存
      const element = context.querySelector(selector);
      if (element) {
        this.cacheElement(cacheKey, element);
      }

      this.recordPerformance('getCachedElement', startTime, 'domQuery');
      return element;

    } catch (error) {
      console.warn('DOM元素查询失败:', selector, error);
      return null;
    }
  }

  /**
   * 获取多个缓存的DOM元素
   * @param {string} selector - CSS选择器
   * @param {Element} context - 查找上下文
   * @returns {NodeList} DOM元素列表
   */
  getCachedElements(selector, context = document) {
    const startTime = this.performanceMonitor ? performance.now() : null;
    
    try {
      // 1. 优先使用DOMOptimizationManager
      if (this.domOptimizationManager && this.domOptimizationManager.getCachedElements) {
        const elements = this.domOptimizationManager.getCachedElements(selector, context);
        if (elements && elements.length > 0) {
          this.recordPerformance('getCachedElements', startTime, 'domOptimization');
          return elements;
        }
      }

      // 2. 执行DOM查询
      const elements = context.querySelectorAll(selector);
      this.recordPerformance('getCachedElements', startTime, 'domQuery');
      return elements;

    } catch (error) {
      console.warn('DOM元素列表查询失败:', selector, error);
      return document.createDocumentFragment().childNodes; // 返回空NodeList
    }
  }

  /**
   * 批量DOM操作（使用优化管理器）
   * @param {Function} operations - 要执行的DOM操作函数
   * @returns {*} 操作结果
   */
  batchDOMUpdate(operations) {
    const startTime = this.performanceMonitor ? performance.now() : null;
    
    try {
      // 1. 优先使用DOMOptimizationManager的批量更新
      if (this.domOptimizationManager && this.domOptimizationManager.batchUpdate) {
        const result = this.domOptimizationManager.batchUpdate(operations);
        this.recordPerformance('batchDOMUpdate', startTime, 'domOptimization');
        return result;
      }

      // 2. 使用全局批量管理器
      if (typeof DOMBatchManager !== 'undefined' && DOMBatchManager.batch) {
        const result = DOMBatchManager.batch(operations);
        this.recordPerformance('batchDOMUpdate', startTime, 'batchManager');
        return result;
      }

      // 3. 备用方案：直接执行
      const result = operations();
      this.recordPerformance('batchDOMUpdate', startTime, 'direct');
      return result;

    } catch (error) {
      console.error('批量DOM更新失败:', error);
      this.recordPerformance('batchDOMUpdate', startTime, 'error');
      throw error;
    }
  }

  /**
   * 高性能DOM创建
   * @param {string} tagName - 标签名
   * @param {Object} attributes - 属性对象
   * @param {string} textContent - 文本内容
   * @returns {Element} 创建的DOM元素
   */
  createElement(tagName, attributes = {}, textContent = '') {
    try {
      // 1. 优先使用文档片段对象池
      if (this.domOptimizationManager && this.domOptimizationManager.getDocumentFragment) {
        const fragment = this.domOptimizationManager.getDocumentFragment();
        const element = document.createElement(tagName);
        
        // 设置属性
        Object.entries(attributes).forEach(([key, value]) => {
          if (key === 'className') {
            element.className = value;
          } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
          } else {
            element.setAttribute(key, value);
          }
        });

        // 设置文本内容
        if (textContent) {
          element.textContent = textContent;
        }

        return element;
      }

      // 2. 备用方案：直接创建
      const element = document.createElement(tagName);
      
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.assign(element.style, value);
        } else {
          element.setAttribute(key, value);
        }
      });

      if (textContent) {
        element.textContent = textContent;
      }

      return element;

    } catch (error) {
      console.error('DOM元素创建失败:', error);
      return document.createElement('div'); // 返回备用元素
    }
  }

  /**
   * 清理缓存
   * @param {string} selector - 特定选择器，不指定则清理所有缓存
   */
  clearCache(selector = null) {
    try {
      if (selector) {
        const cacheKey = this.generateCacheKey(selector, document);
        this.elementCache.delete(cacheKey);
        
        // 清理DOMOptimizationManager缓存
        if (this.domOptimizationManager && this.domOptimizationManager.clearCache) {
          this.domOptimizationManager.clearCache(selector);
        }
        
        // 清理全局DOMCache
        if (this.domCache && this.domCache.clear) {
          const cacheKey = selector.startsWith('#') ? selector.slice(1) : selector;
          this.domCache.delete(cacheKey);
        }
      } else {
        // 清理所有缓存
        this.elementCache.clear();
        
        if (this.domOptimizationManager && this.domOptimizationManager.clearAllCache) {
          this.domOptimizationManager.clearAllCache();
        }
        
        if (this.domCache && this.domCache.clear) {
          this.domCache.clear();
        }
      }

      console.log('DOM缓存已清理:', selector || '全部');

    } catch (error) {
      console.error('清理DOM缓存失败:', error);
    }
  }

  /**
   * 生成缓存键
   * @param {string} selector - 选择器
   * @param {Element} context - 上下文
   * @returns {string} 缓存键
   */
  generateCacheKey(selector, context) {
    const contextId = context === document ? 'document' : 
      (context.id || context.className || 'element');
    return `${contextId}::${selector}`;
  }

  /**
   * 缓存DOM元素
   * @param {string} cacheKey - 缓存键
   * @param {Element} element - DOM元素
   */
  cacheElement(cacheKey, element) {
    this.elementCache.set(cacheKey, {
      element,
      timestamp: Date.now()
    });
  }

  /**
   * 检查缓存是否有效
   * @param {Object} cached - 缓存对象
   * @returns {boolean} 是否有效
   */
  isCacheValid(cached) {
    if (!cached || !cached.element) {
      return false;
    }

    // 检查元素是否还在DOM中
    if (!document.contains(cached.element)) {
      return false;
    }

    // 检查时间戳
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      return false;
    }

    return true;
  }

  /**
   * 记录性能指标
   * @param {string} operation - 操作名称
   * @param {number} startTime - 开始时间
   * @param {string} method - 使用的方法
   */
  recordPerformance(operation, startTime, method) {
    if (this.performanceMonitor && startTime) {
      const duration = performance.now() - startTime;
      this.performanceMonitor.measure(`DOM_${operation}_${method}`, startTime);
      
      // 如果操作超过阈值，记录警告
      if (duration > 16) { // 超过一帧时间
        console.warn(`DOM操作性能警告: ${operation} (${method}) 耗时 ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getCacheStats() {
    return {
      localCacheSize: this.elementCache.size,
      cacheTimeout: this.cacheTimeout,
      lastCacheTime: this.lastCacheTime,
      domOptimizationAvailable: !!this.domOptimizationManager,
      domCacheAvailable: !!this.domCache,
      performanceMonitorAvailable: !!this.performanceMonitor
    };
  }
}

// ==================== 快捷函数和全局集成 ====================

let globalDOMCacheIntegration = null;

/**
 * 获取DOM缓存集成管理器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {DOMCacheIntegration} 管理器实例
 */
function getDOMCacheIntegration(dependencies = {}) {
  if (!globalDOMCacheIntegration) {
    globalDOMCacheIntegration = new DOMCacheIntegration(dependencies);
  }
  return globalDOMCacheIntegration;
}

/**
 * 优化的DOM元素查询函数（向后兼容）
 * @param {string} selector - CSS选择器
 * @param {Element} context - 查找上下文
 * @returns {Element|null} DOM元素
 */
function $(selector, context = document) {
  const integration = getDOMCacheIntegration();
  return integration.getCachedElement(selector, context);
}

/**
 * 优化的DOM元素列表查询函数
 * @param {string} selector - CSS选择器
 * @param {Element} context - 查找上下文
 * @returns {NodeList} DOM元素列表
 */
function $$(selector, context = document) {
  const integration = getDOMCacheIntegration();
  return integration.getCachedElements(selector, context);
}

/**
 * 批量DOM更新函数
 * @param {Function} operations - DOM操作函数
 * @returns {*} 操作结果
 */
function batchDOM(operations) {
  const integration = getDOMCacheIntegration();
  return integration.batchDOMUpdate(operations);
}

/**
 * 高性能DOM元素创建
 * @param {string} tagName - 标签名
 * @param {Object} attributes - 属性
 * @param {string} textContent - 文本内容
 * @returns {Element} DOM元素
 */
function createOptimizedElement(tagName, attributes, textContent) {
  const integration = getDOMCacheIntegration();
  return integration.createElement(tagName, attributes, textContent);
}

/**
 * 清理DOM缓存
 * @param {string} selector - 选择器
 */
function clearDOMCache(selector = null) {
  const integration = getDOMCacheIntegration();
  integration.clearCache(selector);
}

// ==================== 模块导出 ====================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    DOMCacheIntegration,
    getDOMCacheIntegration,
    $,
    $$,
    batchDOM,
    createOptimizedElement,
    clearDOMCache
  };
} else {
  // 浏览器环境
  window.DOMCacheIntegration = DOMCacheIntegration;
  window.getDOMCacheIntegration = getDOMCacheIntegration;
  
  // 只有在不存在时才设置快捷函数，避免覆盖其他库
  if (!window.$optimized) {
    window.$optimized = $;
    window.$$optimized = $$;
    window.batchDOM = batchDOM;
    window.createOptimizedElement = createOptimizedElement;
    window.clearDOMCache = clearDOMCache;
  }
  
  // 注册到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.utils', 'DOMCacheIntegration', DOMCacheIntegration);
      namespaceManager.addToNamespace('App.utils', 'getDOMCacheIntegration', getDOMCacheIntegration);
      namespaceManager.addToNamespace('App.utils.dom', '$', $);
      namespaceManager.addToNamespace('App.utils.dom', '$$', $$);
      namespaceManager.addToNamespace('App.utils.dom', 'batchDOM', batchDOM);
    } catch (error) {
      console.warn('DOM缓存集成管理器命名空间注册失败:', error.message);
    }
  }
}

console.log('🔧 DOM缓存集成管理器已加载');
