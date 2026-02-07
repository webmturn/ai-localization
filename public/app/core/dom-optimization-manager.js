// ==================== DOM优化管理器 ====================
/**
 * DOM优化管理器：MutationObserver 管理 + 虚拟滚动
 * 元素缓存、批量更新、DocumentFragment 对象池已统一委托给 DOMCache 单例
 */

/**
 * DOM优化管理器类
 */
class DOMOptimizationManager {
  constructor() {
    this.observers = new Map();
    this.options = {
      enableVirtualScrolling: true
    };
  }

  // ======================== 委托给 DOMCache ========================

  /**
   * 获取缓存的DOM元素（委托给 DOMCache.query）
   * @param {string} selector - CSS选择器
   * @param {Element} context - 上下文元素
   * @returns {Element|null} DOM元素
   */
  getCachedElement(selector, context = document) {
    return DOMCache.query(selector, context);
  }

  /**
   * 获取缓存的DOM元素列表（委托给 DOMCache.queryAll）
   * @param {string} selector - CSS选择器
   * @param {Element} context - 上下文元素
   * @returns {NodeList} DOM元素列表
   */
  getCachedElements(selector, context = document) {
    return DOMCache.queryAll(selector, context);
  }

  /**
   * 批量DOM更新（委托给 DOMCache.batchUpdate）
   * @param {string} groupKey - 分组键
   * @param {Function} updateFn - 更新函数
   * @param {Object} options - 选项
   */
  batchUpdate(groupKey, updateFn, options = {}) {
    DOMCache.batchUpdate(groupKey, updateFn, options);
  }

  /**
   * 获取文档片段（委托给 DOMCache.getFragment）
   * @returns {DocumentFragment} 文档片段
   */
  getDocumentFragment() {
    return DOMCache.getFragment();
  }

  /**
   * 回收文档片段（委托给 DOMCache.recycleFragment）
   * @param {DocumentFragment} fragment - 文档片段
   */
  recycleDocumentFragment(fragment) {
    DOMCache.recycleFragment(fragment);
  }

  /**
   * 清除所有缓存（委托给 DOMCache.clear）
   */
  clearCache() {
    DOMCache.clear();
  }

  // ======================== 虚拟滚动（独有功能） ========================

  /**
   * 创建虚拟滚动管理器
   * @param {Element} container - 容器元素
   * @param {Object} options - 配置选项
   * @returns {Object} 虚拟滚动管理器
   */
  createVirtualScrollManager(container, options = {}) {
    const {
      itemHeight = 50,
      buffer = 5,
      renderItem = null
    } = options;

    if (!this.options.enableVirtualScrolling) {
      return null;
    }

    return new DOMVirtualScrollManager(container, {
      itemHeight,
      buffer,
      renderItem,
      domManager: this
    });
  }

  // ======================== MutationObserver 管理（独有功能） ========================

  /**
   * 观察DOM变化
   * @param {Element} target - 目标元素
   * @param {Function} callback - 回调函数
   * @param {Object} options - 观察选项
   * @returns {string} 观察器ID
   */
  observeChanges(target, callback, options = {}) {
    if (!window.MutationObserver) {
      return null;
    }

    const observerId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const observer = new MutationObserver((mutations) => {
      DOMCache.batchUpdate(`mutation_${observerId}`, () => {
        callback(mutations);
      }, { priority: 'low' });
    });

    const observerOptions = {
      childList: true,
      subtree: true,
      ...options
    };

    observer.observe(target, observerOptions);

    this.observers.set(observerId, {
      observer,
      target,
      callback,
      options: observerOptions
    });

    return observerId;
  }

  /**
   * 停止观察DOM变化
   * @param {string} observerId - 观察器ID
   */
  unobserveChanges(observerId) {
    const observerData = this.observers.get(observerId);
    if (observerData) {
      observerData.observer.disconnect();
      this.observers.delete(observerId);
    }
  }

  // ======================== 统计与生命周期 ========================

  /**
   * 获取性能统计（合并 DOMCache 统计）
   */
  getStats() {
    const cacheStats = DOMCache.getStats();
    return {
      ...cacheStats,
      observersCount: this.observers.size,
    };
  }

  /**
   * 配置选项
   * @param {Object} options - 配置选项
   */
  configure(options) {
    this.options = { ...this.options, ...options };
  }

  /**
   * 清理资源
   */
  dispose() {
    for (const [id] of this.observers) {
      this.unobserveChanges(id);
    }
    DOMCache.clear();
    (loggers.app || console).debug('DOM优化管理器已清理');
  }
}

/**
 * DOM虚拟滚动管理器类（旧版本，保留兼容性）
 */
class DOMVirtualScrollManager {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.itemHeight = options.itemHeight || 50;
    this.buffer = options.buffer || 5;
    this.renderItem = options.renderItem;
    this.domManager = options.domManager;
    
    this.items = [];
    this.visibleStart = 0;
    this.visibleEnd = 0;
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.init();
  }
  
  init() {
    this.updateContainerHeight();
    this.bindEvents();
    this.render();
  }
  
  updateContainerHeight() {
    this.containerHeight = this.container.clientHeight;
  }
  
  bindEvents() {
    this._onScroll = () => this.handleScroll();
    this._onResize = () => {
      this.updateContainerHeight();
      this.render();
    };
    this.container.addEventListener('scroll', this._onScroll);
    window.addEventListener('resize', this._onResize);
  }
  
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.calculateVisibleRange();
    this.render();
  }
  
  calculateVisibleRange() {
    const start = Math.floor(this.scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    
    this.visibleStart = Math.max(0, start - this.buffer);
    this.visibleEnd = Math.min(this.items.length, start + visibleCount + this.buffer);
  }
  
  setItems(items) {
    this.items = items;
    this.calculateVisibleRange();
    this.render();
  }
  
  render() {
    if (!this.renderItem) {
      return;
    }
    
    const fragment = document.createDocumentFragment();
    
    // 创建占位元素
    const topSpacer = document.createElement('div');
    topSpacer.style.height = `${this.visibleStart * this.itemHeight}px`;
    fragment.appendChild(topSpacer);
    
    // 渲染可见项
    for (let i = this.visibleStart; i < this.visibleEnd; i++) {
      const itemElement = this.renderItem(this.items[i], i);
      if (itemElement) {
        fragment.appendChild(itemElement);
      }
    }
    
    // 底部占位元素
    const bottomSpacerHeight = (this.items.length - this.visibleEnd) * this.itemHeight;
    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    fragment.appendChild(bottomSpacer);
    
    // 清空容器并添加新内容
    this.container.replaceChildren(fragment);
  }
  dispose() {
    if (this._onScroll) {
      this.container.removeEventListener('scroll', this._onScroll);
      this._onScroll = null;
    }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }
    this.items = [];
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOMOptimizationManager, DOMVirtualScrollManager };
} else {
  // 浏览器环境，暴露到全局
  window.DOMOptimizationManager = DOMOptimizationManager;
  window.DOMVirtualScrollManager = DOMVirtualScrollManager;
  
  // 创建全局实例
  window.domOptimizationManager = new DOMOptimizationManager();
  
  (loggers.app || console).debug('DOM优化管理器已加载');
}
