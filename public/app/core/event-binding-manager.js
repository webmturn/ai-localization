// ==================== 事件绑定管理器 ====================
/**
 * 事件绑定管理器：统一管理事件监听器的绑定和清理
 * 消除事件绑定代码重复，提供一致的事件管理体验
 */

/**
 * 事件绑定管理器类
 */
class EventBindingManager {
  constructor() {
    this.boundEvents = new Map();
    this.eventGroups = new Map();
    this.options = {
      autoCleanup: true,
      debugMode: false
    };
  }
  
  /**
   * 绑定事件监听器
   * @param {Element|Window|Document} target - 目标元素
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 选项
   * @param {string} options.group - 事件组名（用于批量管理）
   * @param {boolean} options.once - 是否只执行一次
   * @param {boolean} options.passive - 是否为被动监听器
   * @param {string} options.label - 事件标签（用于调试）
   */
  bind(target, event, handler, options = {}) {
    const {
      group = 'default',
      once = false,
      passive = false,
      label = `${event}_${Date.now()}`
    } = options;
    
    if (!target || typeof handler !== 'function') {
      (loggers.app || console).error('EventBindingManager: 无效的目标或处理函数');
      return null;
    }
    
    const eventId = this.generateEventId(target, event, label);
    const eventOptions = { once, passive };
    
    // 创建包装处理函数（支持自动清理）
    const wrappedHandler = once 
      ? (...args) => {
          try {
            const result = handler.apply(target, args);
            this.unbind(eventId);
            return result;
          } catch (error) {
            (loggers.app || console).error(`事件处理函数执行错误 (${label}):`, error);
            this.unbind(eventId);
          }
        }
      : (...args) => {
          try {
            return handler.apply(target, args);
          } catch (error) {
            (loggers.app || console).error(`事件处理函数执行错误 (${label}):`, error);
          }
        };
    
    // 绑定事件 - 添加类型检查
    if (target && typeof target.addEventListener === 'function') {
      target.addEventListener(event, wrappedHandler, eventOptions);
    } else {
      throw new Error(`目标对象不支持addEventListener: ${target}`);
    }
    
    // 记录事件信息
    const eventInfo = {
      id: eventId,
      target,
      event,
      handler: wrappedHandler,
      originalHandler: handler,
      options: eventOptions,
      group,
      label,
      bindTime: Date.now()
    };
    
    this.boundEvents.set(eventId, eventInfo);
    
    // 添加到事件组
    if (!this.eventGroups.has(group)) {
      this.eventGroups.set(group, new Set());
    }
    this.eventGroups.get(group).add(eventId);
    
    if (this.options.debugMode) {
      console.log(`🎯 事件已绑定: ${label} (${event}) -> 组: ${group}`);
    }
    
    return eventId;
  }
  
  /**
   * 解绑事件监听器
   * @param {string} eventId - 事件ID
   */
  unbind(eventId) {
    const eventInfo = this.boundEvents.get(eventId);
    if (!eventInfo) {
      (loggers.app || console).warn(`EventBindingManager: 事件ID ${eventId} 不存在`);
      return false;
    }
    
    const { target, event, handler, options, group, label } = eventInfo;
    
    // 解绑事件
    target.removeEventListener(event, handler, options);
    
    // 清理记录
    this.boundEvents.delete(eventId);
    
    // 从事件组中移除
    if (this.eventGroups.has(group)) {
      this.eventGroups.get(group).delete(eventId);
      if (this.eventGroups.get(group).size === 0) {
        this.eventGroups.delete(group);
      }
    }
    
    if (this.options.debugMode) {
      console.log(`🗑️ 事件已解绑: ${label} (${event})`);
    }
    
    return true;
  }
  
  /**
   * 批量解绑事件组
   * @param {string} group - 事件组名
   */
  unbindGroup(group) {
    const eventIds = this.eventGroups.get(group);
    if (!eventIds) {
      (loggers.app || console).warn(`EventBindingManager: 事件组 ${group} 不存在`);
      return 0;
    }
    
    let unboundCount = 0;
    const eventIdsCopy = Array.from(eventIds);
    
    eventIdsCopy.forEach(eventId => {
      if (this.unbind(eventId)) {
        unboundCount++;
      }
    });
    
    if (this.options.debugMode) {
      console.log(`🗑️ 批量解绑事件组: ${group} (${unboundCount} 个事件)`);
    }
    
    return unboundCount;
  }
  
  /**
   * 解绑所有事件
   */
  unbindAll() {
    let unboundCount = 0;
    const eventIds = Array.from(this.boundEvents.keys());
    
    eventIds.forEach(eventId => {
      if (this.unbind(eventId)) {
        unboundCount++;
      }
    });
    
    (loggers.app || console).debug(`清理所有事件绑定: ${unboundCount} 个事件`);
    return unboundCount;
  }
  
  /**
   * 委托事件绑定（适用于动态元素）
   * @param {Element} container - 容器元素
   * @param {string} selector - 目标元素选择器
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - 选项
   */
  delegate(container, selector, event, handler, options = {}) {
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    };
    
    return this.bind(container, event, delegatedHandler, {
      ...options,
      label: `delegate_${selector}_${event}`
    });
  }
  
  /**
   * 节流事件绑定
   * @param {Element} target - 目标元素
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   * @param {number} delay - 节流延迟（毫秒）
   * @param {Object} options - 选项
   */
  throttle(target, event, handler, delay = 100, options = {}) {
    let lastCall = 0;
    
    const throttledHandler = (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return handler.apply(target, args);
      }
    };
    
    return this.bind(target, event, throttledHandler, {
      ...options,
      label: `throttled_${event}_${delay}ms`
    });
  }
  
  /**
   * 防抖事件绑定
   * @param {Element} target - 目标元素
   * @param {string} event - 事件名称
   * @param {Function} handler - 事件处理函数
   * @param {number} delay - 防抖延迟（毫秒）
   * @param {Object} options - 选项
   */
  debounce(target, event, handler, delay = 300, options = {}) {
    let timeout;
    
    const debouncedHandler = (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        handler.apply(target, args);
      }, delay);
    };
    
    return this.bind(target, event, debouncedHandler, {
      ...options,
      label: `debounced_${event}_${delay}ms`
    });
  }
  
  /**
   * 生成事件ID
   * @param {Element} target - 目标元素
   * @param {string} event - 事件名称
   * @param {string} label - 标签
   */
  generateEventId(target, event, label) {
    const targetId = target.id || target.tagName || 'unknown';
    const timestamp = Date.now();
    return `${targetId}_${event}_${label}_${timestamp}`;
  }
  
  /**
   * 获取事件统计
   */
  getStats() {
    return {
      totalEvents: this.boundEvents.size,
      eventGroups: Array.from(this.eventGroups.keys()),
      groupSizes: Object.fromEntries(
        Array.from(this.eventGroups.entries()).map(([group, ids]) => [group, ids.size])
      ),
      oldestEvent: this.getOldestEvent(),
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * 获取最老的事件
   */
  getOldestEvent() {
    let oldestTime = Date.now();
    let oldestEvent = null;
    
    this.boundEvents.forEach((eventInfo) => {
      if (eventInfo.bindTime < oldestTime) {
        oldestTime = eventInfo.bindTime;
        oldestEvent = eventInfo;
      }
    });
    
    return oldestEvent ? {
      label: oldestEvent.label,
      age: Date.now() - oldestEvent.bindTime
    } : null;
  }
  
  /**
   * 估算内存使用
   */
  estimateMemoryUsage() {
    return {
      boundEvents: this.boundEvents.size * 200, // 估算每个事件200字节
      eventGroups: this.eventGroups.size * 50,  // 估算每个组50字节
      total: (this.boundEvents.size * 200) + (this.eventGroups.size * 50)
    };
  }
  
  /**
   * 设置选项
   * @param {Object} options - 选项
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * 清理长时间未使用的事件（防止内存泄漏）
   * @param {number} maxAge - 最大年龄（毫秒）
   */
  cleanupOldEvents(maxAge = 60 * 60 * 1000) { // 默认1小时
    const now = Date.now();
    let cleanedCount = 0;
    
    const toClean = [];
    this.boundEvents.forEach((eventInfo, eventId) => {
      if (now - eventInfo.bindTime > maxAge) {
        toClean.push(eventId);
      }
    });
    
    toClean.forEach(eventId => {
      if (this.unbind(eventId)) {
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      (loggers.app || console).debug(`清理过期事件: ${cleanedCount} 个事件`);
    }
    
    return cleanedCount;
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建便捷的事件绑定函数
 * @param {EventBindingManager} manager - 事件管理器实例
 */
function createConvenienceMethods(manager) {
  return {
    // 常用事件的便捷方法
    onClick: (target, handler, options) => manager.bind(target, 'click', handler, options),
    onLoad: (target, handler, options) => manager.bind(target, 'load', handler, options),
    onResize: (target, handler, options) => manager.throttle(target, 'resize', handler, 100, options),
    onScroll: (target, handler, options) => manager.throttle(target, 'scroll', handler, 50, options),
    onInput: (target, handler, options) => manager.debounce(target, 'input', handler, 300, options),
    onKeyup: (target, handler, options) => manager.debounce(target, 'keyup', handler, 200, options),
    
    // 生命周期事件
    onBeforeUnload: (handler, options) => manager.bind(window, 'beforeunload', handler, options),
    onDOMContentLoaded: (handler, options) => manager.bind(document, 'DOMContentLoaded', handler, options),
    onVisibilityChange: (handler, options) => manager.bind(document, 'visibilitychange', handler, options)
  };
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventBindingManager, createConvenienceMethods };
} else {
  // 浏览器环境，暴露到全局
  window.EventBindingManager = EventBindingManager;
  window.createConvenienceMethods = createConvenienceMethods;
  
  // 创建全局实例
  window.eventBindingManager = new EventBindingManager();
  window.eventBindings = createConvenienceMethods(window.eventBindingManager);
}
