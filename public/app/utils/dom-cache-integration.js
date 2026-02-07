// ==================== DOM缓存集成管理器 ====================
/**
 * DOM缓存优化集成管理器（轻量包装层）
 * 所有缓存、批量更新、DocumentFragment 操作均委托给 DOMCache 单例
 * 保留向后兼容的 API 接口
 */

class DOMCacheIntegration {
  constructor() {
    // 预缓存常用元素
    this._warmUpCommonElements();
  }

  /**
   * 预缓存常用元素到 DOMCache
   * @private
   */
  _warmUpCommonElements() {
    var ids = [
      "translationScrollWrapper", "searchInput", "searchResultsPanel",
      "fileTree", "sourceLanguage", "targetLanguage",
      "defaultEngine", "translationModel",
    ];
    for (var i = 0; i < ids.length; i++) {
      try { DOMCache.get(ids[i]); } catch (_) { /* ignore */ }
    }
  }

  /**
   * 获取缓存的DOM元素
   * @param {string} selector - CSS选择器（支持 #id 和任意选择器）
   * @param {Element} [context=document] - 查找上下文
   * @returns {Element|null} DOM元素
   */
  getCachedElement(selector, context) {
    if (!context) context = document;
    // #id 快捷路径 → DOMCache.get
    if (selector.charAt(0) === "#" && selector.indexOf(" ") === -1) {
      return DOMCache.get(selector.slice(1)) || null;
    }
    return DOMCache.query(selector, context);
  }

  /**
   * 获取缓存的DOM元素列表
   * @param {string} selector - CSS选择器
   * @param {Element} [context=document] - 查找上下文
   * @returns {NodeList} DOM元素列表
   */
  getCachedElements(selector, context) {
    return DOMCache.queryAll(selector, context);
  }

  /**
   * 批量DOM操作
   * @param {Function} operations - 要执行的DOM操作函数
   * @returns {*} 操作结果
   */
  batchDOMUpdate(operations) {
    if (typeof operations === "function") {
      DOMCache.batchUpdate("integration_" + Date.now(), operations, { immediate: true });
    }
  }

  /**
   * 高性能DOM创建
   * @param {string} tagName - 标签名
   * @param {Object} attributes - 属性对象
   * @param {string} textContent - 文本内容
   * @returns {Element} 创建的DOM元素
   */
  createElement(tagName, attributes, textContent) {
    var element = document.createElement(tagName || "div");
    if (attributes) {
      var keys = Object.keys(attributes);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = attributes[key];
        if (key === "className") {
          element.className = value;
        } else if (key === "style" && typeof value === "object") {
          Object.assign(element.style, value);
        } else {
          element.setAttribute(key, value);
        }
      }
    }
    if (textContent) element.textContent = textContent;
    return element;
  }

  /**
   * 清理缓存
   * @param {string} [selector] - 特定选择器（#id 或任意），不指定则清理所有
   */
  clearCache(selector) {
    if (selector) {
      if (selector.charAt(0) === "#") {
        DOMCache.remove(selector.slice(1));
      }
    } else {
      DOMCache.clear();
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object}
   */
  getCacheStats() {
    return DOMCache.getStats();
  }
}

// ==================== 快捷函数和全局集成 ====================

let globalDOMCacheIntegration = null;

/**
 * 获取DOM缓存集成管理器实例
 * @param {Object} dependencies - 依赖注入
 * @returns {DOMCacheIntegration} 管理器实例
 */
function getDOMCacheIntegration() {
  if (!globalDOMCacheIntegration) {
    globalDOMCacheIntegration = new DOMCacheIntegration();
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
      (loggers.app || console).warn('DOM缓存集成管理器命名空间注册失败:', error.message);
    }
  }
}

(loggers.app || console).debug('DOM缓存集成管理器已加载');
