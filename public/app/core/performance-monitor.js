// ==================== 性能监控系统 ====================
/**
 * 性能监控系统：跟踪和分析应用性能
 * 提供操作耗时统计、资源使用监控和性能警告
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      translation: 5000,    // 单次翻译超过5秒告警
      fileLoad: 3000,       // 文件加载超过3秒告警
      uiUpdate: 100,        // UI更新超过100ms告警
      apiRequest: 10000     // API请求超过10秒告警
    };
    this.history = [];
    this.maxHistorySize = 100;
    this.enabled = true;
  }
  
  /**
   * 开始计时
   * @param {string} operation - 操作名称
   * @param {Object} metadata - 额外元数据
   * @returns {string} 计时器ID
   */
  start(operation, metadata = {}) {
    if (!this.enabled) return null;
    
    const id = `${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.metrics.set(id, {
      operation,
      startTime: performance.now(),
      metadata
    });
    
    return id;
  }
  
  /**
   * 结束计时
   * @param {string} id - 计时器ID
   * @returns {Object} 性能数据
   */
  end(id) {
    if (!this.enabled || !id) return null;
    
    const metric = this.metrics.get(id);
    if (!metric) return null;
    
    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    const result = {
      id,
      operation: metric.operation,
      duration,
      startTime: metric.startTime,
      endTime,
      metadata: metric.metadata,
      timestamp: new Date().toISOString()
    };
    
    // 检查是否超过阈值
    const threshold = this.thresholds[metric.operation];
    if (threshold && duration > threshold) {
      result.warning = true;
      result.warningMessage = `操作 "${metric.operation}" 耗时 ${duration.toFixed(2)}ms，超过阈值 ${threshold}ms`;
      
      if (typeof console !== 'undefined' && isDevelopment) {
        console.warn(`⚠️ 性能警告: ${result.warningMessage}`);
      }
    }
    
    // 记录历史
    this.history.push(result);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    // 清理
    this.metrics.delete(id);
    
    return result;
  }
  
  /**
   * 包装异步函数进行性能监控
   * @param {string} operation - 操作名称
   * @param {Function} fn - 要执行的异步函数
   * @param {Object} metadata - 额外元数据
   * @returns {Promise<*>} 函数返回值
   */
  async measure(operation, fn, metadata = {}) {
    const id = this.start(operation, metadata);
    try {
      const result = await fn();
      this.end(id);
      return result;
    } catch (error) {
      const metric = this.end(id);
      if (metric) {
        metric.error = error.message;
      }
      throw error;
    }
  }
  
  /**
   * 包装同步函数进行性能监控
   * @param {string} operation - 操作名称
   * @param {Function} fn - 要执行的同步函数
   * @param {Object} metadata - 额外元数据
   * @returns {*} 函数返回值
   */
  measureSync(operation, fn, metadata = {}) {
    const id = this.start(operation, metadata);
    try {
      const result = fn();
      this.end(id);
      return result;
    } catch (error) {
      const metric = this.end(id);
      if (metric) {
        metric.error = error.message;
      }
      throw error;
    }
  }
  
  /**
   * 设置阈值
   * @param {string} operation - 操作名称
   * @param {number} threshold - 阈值（毫秒）
   */
  setThreshold(operation, threshold) {
    this.thresholds[operation] = threshold;
  }
  
  /**
   * 获取统计信息
   * @param {string} [operation] - 可选的操作名称过滤
   * @returns {Object} 统计信息
   */
  getStats(operation = null) {
    let history = this.history;
    
    if (operation) {
      history = history.filter(m => m.operation === operation);
    }
    
    if (history.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        warnings: 0
      };
    }
    
    const durations = history.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      count: history.length,
      avg: sum / history.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      warnings: history.filter(m => m.warning).length,
      lastDuration: history[history.length - 1]?.duration
    };
  }
  
  /**
   * 获取完整报告
   * @returns {Object} 性能报告
   */
  getReport() {
    const operations = [...new Set(this.history.map(m => m.operation))];
    const report = {
      summary: this.getStats(),
      byOperation: {},
      warnings: this.history.filter(m => m.warning),
      memory: this._getMemoryInfo()
    };
    
    for (const op of operations) {
      report.byOperation[op] = this.getStats(op);
    }
    
    return report;
  }
  
  /**
   * 获取内存信息
   * @private
   */
  _getMemoryInfo() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        usedHeap: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        totalHeap: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        heapLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
        usage: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
      };
    }
    return null;
  }
  
  /**
   * 清除历史记录
   */
  clearHistory() {
    this.history = [];
  }
  
  /**
   * 启用/禁用监控
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  /**
   * 打印性能报告到控制台
   */
  printReport() {
    const report = this.getReport();
    
    console.group('📊 性能报告');
    console.log('📈 总计:', report.summary);
    
    console.group('📋 按操作类型');
    for (const [op, stats] of Object.entries(report.byOperation)) {
      console.log(`${op}:`, stats);
    }
    console.groupEnd();
    
    if (report.warnings.length > 0) {
      console.group('⚠️ 警告');
      for (const warning of report.warnings) {
        console.warn(warning.warningMessage);
      }
      console.groupEnd();
    }
    
    if (report.memory) {
      console.log('💾 内存:', report.memory);
    }
    
    console.groupEnd();
    
    return report;
  }
}

// 创建全局实例
const performanceMonitor = new PerformanceMonitor();

// 暴露到全局
if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
  window.performanceMonitor = performanceMonitor;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceMonitor, performanceMonitor };
}
