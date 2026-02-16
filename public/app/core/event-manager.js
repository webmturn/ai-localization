// ==================== 事件监听器管理 ====================
/**
 * 事件管理器：统一管理所有事件监听器，防止内存泄漏
 * 功能：
 * 1. 自动跟踪所有添加的监听器
 * 2. 支持按目标、事件类型筛选移除
 * 3. 页面卸载时自动清理所有监听器
 */
const EventManager = {
  listeners: [],
  /** @type {Map<string, Object>} ID → 监听器条目索引 */
  _byId: new Map(),
  /** @type {Map<string, Object[]>} label → 监听器条目列表索引 */
  _byLabel: new Map(),

  /**
   * 添加事件监听器
   * @param {EventTarget} target - 目标元素（window, document, HTMLElement等）
   * @param {string} event - 事件类型（'click', 'resize'等）
   * @param {Function} handler - 事件处理函数
   * @param {Object} options - addEventListener 的选项参数
   * @returns {string} 返回监听器ID，用于后续移除
   */
  add(target, event, handler, options) {
    if (!target || !event || !handler) {
      (loggers.app || console).warn("EventManager.add: 参数不完整", { target, event, handler });
      return null;
    }

    this._addsSincePrune = (this._addsSincePrune || 0) + 1;
    if (this._addsSincePrune >= 200 || this.listeners.length >= 2000) {
      this._addsSincePrune = 0;
      this.pruneDisconnected();
    }

    let listenerOptions = options;
    let tag;
    let scope;
    let label;

    if (options && typeof options === "object") {
      const hasMeta =
        "tag" in options ||
        "scope" in options ||
        "label" in options ||
        "listenerOptions" in options ||
        "options" in options;
      if (hasMeta) {
        tag = options.tag;
        scope = options.scope;
        label = options.label;
        listenerOptions = options.listenerOptions ?? options.options;

        if (listenerOptions === undefined) {
          const {
            tag: _tag,
            scope: _scope,
            label: _label,
            listenerOptions: _listenerOptions,
            options: _options,
            ...rest
          } = options;
          listenerOptions = rest;
        }
      }
    }

    // 去重：如果存在相同 target+event+label 的监听器，先移除旧的避免重复绑定（O(1) 查找）
    if (label) {
      const existing = this._byLabel.get(label);
      if (existing && existing.length > 0) {
        const dupes = existing.filter((l) => l.target === target && l.event === event);
        if (dupes.length > 0) {
          dupes.forEach((l) => {
            try { l.target.removeEventListener(l.event, l.handler, l.options); } catch (_) {}
            this._byId.delete(l.id);
          });
          const dupeIds = new Set(dupes.map((l) => l.id));
          this.listeners = this.listeners.filter((l) => !dupeIds.has(l.id));
          this._byLabel.set(label, existing.filter((l) => !dupeIds.has(l.id)));
        }
      }
    }

    const listenerId = `${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // 检测 once 选项：包装 handler 使其在触发后自动从 listeners 数组中清除
    const hasOnce = listenerOptions && typeof listenerOptions === "object" && listenerOptions.once;
    let actualHandler = handler;
    if (hasOnce) {
      const self = this;
      actualHandler = function onceWrapper(e) {
        handler.call(this, e);
        // 浏览器已自动移除原生监听器，仅清理 EventManager 跟踪条目
        const entry = self._byId.get(listenerId);
        if (entry) {
          self._byId.delete(listenerId);
          self._removeFromLabel(entry);
          const idx = self.listeners.indexOf(entry);
          if (idx !== -1) self.listeners.splice(idx, 1);
        }
      };
      // 移除 once 标记，由 wrapper 自行管理生命周期
      if (typeof listenerOptions === "object") {
        const { once: _once, ...rest } = listenerOptions;
        listenerOptions = Object.keys(rest).length > 0 ? rest : undefined;
      } else {
        listenerOptions = undefined;
      }
    }

    target.addEventListener(event, actualHandler, listenerOptions);

    const entry = {
      id: listenerId,
      target,
      event,
      handler: actualHandler,
      options: listenerOptions,
      tag,
      scope,
      label,
    };

    this.listeners.push(entry);
    this._byId.set(listenerId, entry);
    if (label) {
      const arr = this._byLabel.get(label);
      if (arr) { arr.push(entry); } else { this._byLabel.set(label, [entry]); }
    }

    return listenerId;
  },

  /**
   * 移除指定监听器（按ID）
   * @param {string} listenerId - 监听器ID
   * @returns {boolean} 是否成功移除
   */
  removeById(listenerId) {
    const listener = this._byId.get(listenerId);
    if (!listener) return false;

    listener.target.removeEventListener(
      listener.event,
      listener.handler,
      listener.options
    );
    this._byId.delete(listenerId);
    this._removeFromLabel(listener);
    const index = this.listeners.indexOf(listener);
    if (index !== -1) this.listeners.splice(index, 1);
    return true;
  },

  /**
   * 移除指定目标的所有监听器
   * @param {EventTarget} target - 目标元素
   * @returns {number} 移除的监听器数量
   */
  removeByTarget(target) {
    const toRemove = this.listeners.filter((l) => l.target === target);
    toRemove.forEach((listener) => {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this._byId.delete(listener.id);
      this._removeFromLabel(listener);
    });
    this.listeners = this.listeners.filter((l) => l.target !== target);
    return toRemove.length;
  },

  /**
   * 移除指定事件类型的所有监听器
   * @param {string} event - 事件类型
   * @returns {number} 移除的监听器数量
   */
  removeByEvent(event) {
    const toRemove = this.listeners.filter((l) => l.event === event);
    toRemove.forEach((listener) => {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this._byId.delete(listener.id);
      this._removeFromLabel(listener);
    });
    this.listeners = this.listeners.filter((l) => l.event !== event);
    return toRemove.length;
  },

  removeByTag(tag) {
    const toRemove = this.listeners.filter((l) => l.tag === tag);
    toRemove.forEach((listener) => {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this._byId.delete(listener.id);
      this._removeFromLabel(listener);
    });
    this.listeners = this.listeners.filter((l) => l.tag !== tag);
    return toRemove.length;
  },

  removeByScope(scope) {
    const toRemove = this.listeners.filter((l) => l.scope === scope);
    toRemove.forEach((listener) => {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this._byId.delete(listener.id);
      this._removeFromLabel(listener);
    });
    this.listeners = this.listeners.filter((l) => l.scope !== scope);
    return toRemove.length;
  },

  /**
   * 移除指定目标和事件类型的监听器
   * @param {EventTarget} target - 目标元素
   * @param {string} event - 事件类型
   * @returns {number} 移除的监听器数量
   */
  remove(target, event) {
    const toRemove = this.listeners.filter(
      (l) => l.target === target && l.event === event
    );
    toRemove.forEach((listener) => {
      listener.target.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
      this._byId.delete(listener.id);
      this._removeFromLabel(listener);
    });
    this.listeners = this.listeners.filter(
      (l) => !(l.target === target && l.event === event)
    );
    return toRemove.length;
  },

  /**
   * 移除所有监听器
   * @returns {number} 移除的监听器数量
   */
  removeAll() {
    const count = this.listeners.length;
    this.listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    this.listeners = [];
    this._byId.clear();
    this._byLabel.clear();
    return count;
  },

  /**
   * 清空所有监听器（removeAll 的别名）
   */
  clear() {
    return this.removeAll();
  },

  /**
   * 从 _byLabel 索引中移除指定条目
   * @param {Object} entry - 监听器条目
   */
  _removeFromLabel(entry) {
    if (!entry || !entry.label) return;
    const arr = this._byLabel.get(entry.label);
    if (!arr) return;
    const idx = arr.indexOf(entry);
    if (idx !== -1) arr.splice(idx, 1);
    if (arr.length === 0) this._byLabel.delete(entry.label);
  },

  pruneDisconnected() {
    if (!Array.isArray(this.listeners) || this.listeners.length === 0) return 0;

    const disconnected = this.listeners.filter((l) => {
      const t = l && l.target;
      return (
        t &&
        typeof t === "object" &&
        "isConnected" in t &&
        t.isConnected === false
      );
    });

    disconnected.forEach((l) => {
      try {
        l.target.removeEventListener(l.event, l.handler, l.options);
      } catch (e) {
        // ignore
      }
      this._byId.delete(l.id);
      this._removeFromLabel(l);
    });

    this.listeners = this.listeners.filter((l) => {
      const t = l && l.target;
      return !(
        t &&
        typeof t === "object" &&
        "isConnected" in t &&
        t.isConnected === false
      );
    });

    return disconnected.length;
  },

  /**
   * 获取当前监听器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      total: this.listeners.length,
      byEvent: {},
      byTarget: {},
      byTag: {},
      byScope: {},
    };

    this.listeners.forEach((l) => {
      // 按事件类型统计
      stats.byEvent[l.event] = (stats.byEvent[l.event] || 0) + 1;

      // 按目标类型统计
      const targetType =
        l.target === window
          ? "window"
          : l.target === document
          ? "document"
          : l.target.tagName || "unknown";
      stats.byTarget[targetType] = (stats.byTarget[targetType] || 0) + 1;

      const tagKey = l.tag || "untagged";
      stats.byTag[tagKey] = (stats.byTag[tagKey] || 0) + 1;

      const scopeKey = l.scope || "unscope";
      stats.byScope[scopeKey] = (stats.byScope[scopeKey] || 0) + 1;
    });

    return stats;
  },
};

// ==================== 全局导出 ====================
if (typeof window !== "undefined") {
  // 兼容新旧代码，以及DI / 架构验证对全局的访问
  window.EventManager = EventManager;
  window.eventManager = EventManager;
}

// DOM 加载完成后执行
