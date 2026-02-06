// ==================== DOM性能优化工具 ====================
/**
 * DOM性能优化工具集
 * 提供批量DOM操作、虚拟化渲染和性能监控功能
 */

/**
 * DOM批量操作管理器
 * @class
 */
class DOMBatchManager {
  constructor() {
    /** @type {Array<Function>} */
    this.pendingOperations = [];
    /** @type {number|null} */
    this.rafId = null;
    /** @type {boolean} */
    this.isProcessing = false;
  }

  /**
   * 添加DOM操作到批次
   * @param {Function} operation - DOM操作函数
   */
  addOperation(operation) {
    this.pendingOperations.push(operation);
    this.scheduleFlush();
  }

  /**
   * 计划执行批量操作
   * @private
   */
  scheduleFlush() {
    if (this.rafId || this.isProcessing) return;
    
    this.rafId = requestAnimationFrame(() => {
      this.flush();
    });
  }

  /**
   * 执行批量操作
   * @private
   */
  flush() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.rafId = null;
    
    const operations = this.pendingOperations.splice(0);
    const startTime = performance.now();
    
    try {
      // 批量执行DOM操作
      operations.forEach(operation => {
        try {
          operation();
        } catch (error) {
          console.warn('DOM操作执行失败:', error);
        }
      });
      
      const duration = performance.now() - startTime;
      if (duration > 16.67) { // 超过1帧时间
        console.warn(`DOM批量操作耗时过长: ${duration.toFixed(2)}ms`);
      }
      
    } finally {
      this.isProcessing = false;
      
      // 如果有新的操作加入，继续处理
      if (this.pendingOperations.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * 立即执行所有待处理的操作
   */
  forceFlush() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.flush();
  }
}

/**
 * 虚拟滚动管理器
 * @class
 */
class VirtualScrollManager {
  constructor(options = {}) {
    this.container = options.container;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5;
    this.items = [];
    this.visibleRange = { start: 0, end: 0 };
    this.scrollTop = 0;
    
    this.setupScrollListener();
  }

  /**
   * 设置滚动监听
   * @private
   */
  setupScrollListener() {
    if (!this.container) return;
    
    let ticking = false;
    
    this.container.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * 处理滚动事件
   * @private
   */
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    const newRange = this.calculateVisibleRange();
    
    if (newRange.start !== this.visibleRange.start || 
        newRange.end !== this.visibleRange.end) {
      this.visibleRange = newRange;
      this.updateVisibleItems();
    }
  }

  /**
   * 计算可见范围
   * @private
   * @returns {Object} 可见范围
   */
  calculateVisibleRange() {
    const containerHeight = this.container.clientHeight;
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(containerHeight / this.itemHeight) + this.bufferSize * 2;
    const end = Math.min(this.items.length, start + visibleCount);
    
    return { start, end };
  }

  /**
   * 更新可见项目
   * @private
   */
  updateVisibleItems() {
    // 这个方法需要由具体实现类重写
    console.log(`更新可见范围: ${this.visibleRange.start}-${this.visibleRange.end}`);
  }

  /**
   * 设置数据
   * @param {Array} items - 数据项数组
   */
  setItems(items) {
    this.items = items;
    this.updateVisibleItems();
  }
}

/**
 * DOM性能工具
 * @class
 */
class DOMPerformanceUtils {
  /**
   * 测量DOM操作性能
   * @param {string} name - 操作名称
   * @param {Function} operation - DOM操作函数
   * @returns {*} 操作结果
   */
  static measureDOMOperation(name, operation) {
    const startTime = performance.now();
    
    try {
      const result = operation();
      const duration = performance.now() - startTime;
      
      if (duration > 16.67) { // 超过1帧
        console.warn(`DOM操作 '${name}' 耗时过长: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      console.error(`DOM操作 '${name}' 失败:`, error);
      throw error;
    }
  }

  /**
   * 优化的元素查找
   * @param {string} selector - CSS选择器
   * @param {Element} [context=document] - 查找上下文
   * @returns {Element|null} 找到的元素
   */
  static findElement(selector, context = document) {
    // 使用缓存优化重复查询
    const cacheKey = `${context === document ? 'doc' : context.id || 'ctx'}:${selector}`;
    
    if (!this._elementCache) {
      this._elementCache = new Map();
    }
    
    if (this._elementCache.has(cacheKey)) {
      const cached = this._elementCache.get(cacheKey);
      if (cached && cached.parentNode) { // 检查元素是否还在DOM中
        return cached;
      } else {
        this._elementCache.delete(cacheKey);
      }
    }
    
    const element = context.querySelector(selector);
    if (element) {
      this._elementCache.set(cacheKey, element);
    }
    
    return element;
  }

  /**
   * 清理元素缓存
   */
  static clearElementCache() {
    if (this._elementCache) {
      this._elementCache.clear();
    }
  }

  /**
   * 批量设置样式
   * @param {Element} element - 目标元素
   * @param {Object} styles - 样式对象
   */
  static setStyles(element, styles) {
    if (!element || !styles) return;
    
    // 使用cssText批量设置样式，性能更好
    const cssText = Object.entries(styles)
      .map(([property, value]) => {
        const cssProperty = property.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
        return `${cssProperty}: ${value}`;
      })
      .join('; ');
    
    element.style.cssText += '; ' + cssText;
  }

  /**
   * 高效的元素创建
   * @param {string} tagName - 标签名
   * @param {Object} options - 配置选项
   * @returns {Element} 创建的元素
   */
  static createElement(tagName, options = {}) {
    const element = document.createElement(tagName);
    
    // 批量设置属性
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    
    // 批量设置样式
    if (options.styles) {
      this.setStyles(element, options.styles);
    }
    
    // 设置内容
    if (options.textContent !== undefined) {
      element.textContent = options.textContent;
    } else if (options.innerHTML !== undefined) {
      element.innerHTML = options.innerHTML;
    }
    
    // 添加事件监听器
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => {
        element.addEventListener(event, handler, { passive: true });
      });
    }
    
    return element;
  }
}

/**
 * 翻译列表虚拟化渲染器
 * @class
 */
class TranslationListVirtualRenderer extends VirtualScrollManager {
  constructor(options) {
    super(options);
    this.renderItem = options.renderItem || this.defaultRenderItem;
    this.itemContainer = options.itemContainer;
    this.renderedItems = new Map();
  }

  /**
   * 默认项目渲染器
   * @param {Object} item - 数据项
   * @param {number} index - 索引
   * @returns {Element} 渲染的元素
   */
  defaultRenderItem(item, index) {
    return DOMPerformanceUtils.createElement('div', {
      textContent: `Item ${index}`,
      styles: {
        height: `${this.itemHeight}px`,
        padding: '10px',
        borderBottom: '1px solid #eee'
      }
    });
  }

  /**
   * 更新可见项目
   * @private
   */
  updateVisibleItems() {
    if (!this.itemContainer) return;
    
    const fragment = document.createDocumentFragment();
    const { start, end } = this.visibleRange;
    
    // 清理不可见的项目
    this.renderedItems.forEach((element, index) => {
      if (index < start || index >= end) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.renderedItems.delete(index);
      }
    });
    
    // 渲染可见的项目
    for (let i = start; i < end; i++) {
      if (!this.renderedItems.has(i) && this.items[i]) {
        const element = this.renderItem(this.items[i], i);
        element.style.position = 'absolute';
        element.style.top = `${i * this.itemHeight}px`;
        element.style.width = '100%';
        
        this.renderedItems.set(i, element);
        fragment.appendChild(element);
      }
    }
    
    if (fragment.children.length > 0) {
      this.itemContainer.appendChild(fragment);
    }
    
    // 更新容器高度
    this.itemContainer.style.height = `${this.items.length * this.itemHeight}px`;
  }
}

// ==================== 全局实例 ====================
const domBatchManager = new DOMBatchManager();

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    DOMBatchManager, 
    VirtualScrollManager, 
    DOMPerformanceUtils,
    TranslationListVirtualRenderer,
    domBatchManager 
  };
} else {
  // 浏览器环境
  window.DOMBatchManager = DOMBatchManager;
  window.VirtualScrollManager = VirtualScrollManager;
  window.DOMPerformanceUtils = DOMPerformanceUtils;
  window.TranslationListVirtualRenderer = TranslationListVirtualRenderer;
  window.domBatchManager = domBatchManager;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.utils', 'DOMBatchManager', DOMBatchManager);
      namespaceManager.addToNamespace('App.utils', 'VirtualScrollManager', VirtualScrollManager);
      namespaceManager.addToNamespace('App.utils', 'DOMPerformanceUtils', DOMPerformanceUtils);
      namespaceManager.addToNamespace('App.utils', 'TranslationListVirtualRenderer', TranslationListVirtualRenderer);
      namespaceManager.addToNamespace('App.utils', 'domBatchManager', domBatchManager);
    } catch (error) {
      console.warn('DOM性能优化工具命名空间注册失败:', error.message);
    }
  }
}

console.log('⚡ DOM性能优化工具已加载');
