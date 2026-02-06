// ==================== 增强性能监控系统 ====================
/**
 * P2改进：详细性能指标收集和监控系统
 * 提供更全面的性能数据收集、分析和可视化功能
 */

/**
 * 增强性能监控器
 * @class
 */
class EnhancedPerformanceMonitor {
  constructor() {
    /** @type {Map<string, PerformanceMetric[]>} */
    this.metrics = new Map();
    /** @type {Map<string, number>} */
    this.counters = new Map();
    /** @type {Map<string, number>} */
    this.timers = new Map();
    /** @type {Array<PerformanceAlert>} */
    this.alerts = [];
    /** @type {boolean} */
    this.enabled = true;
    /** @type {number} */
    this.maxMetricsHistory = 1000;
    /** @type {Object} */
    this.thresholds = {
      memoryUsage: 100 * 1024 * 1024, // 100MB
      responseTime: 5000, // 5秒
      errorRate: 0.05, // 5%
      cpuUsage: 80 // 80%
    };
    
    this.initializeMonitoring();
  }

  /**
   * 初始化监控系统
   * @private
   */
  initializeMonitoring() {
    // 启动定期收集
    this.startPeriodicCollection();
    
    // 监听页面性能事件
    this.setupPerformanceObservers();
    
    // 监听用户交互
    this.setupUserInteractionMonitoring();
    
    console.log('🚀 增强性能监控系统已启动');
  }

  /**
   * 启动定期数据收集
   * @private
   */
  startPeriodicCollection() {
    // 性能优化：调整数据收集频率，减少内存占用
    // 每10秒收集系统指标（从5秒延长）
    this.metricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // 每60秒进行性能分析（从30秒延长）
    this.analysisTimer = setInterval(() => {
      this.analyzePerformance();
    }, 60000);

    // 每30秒清理旧数据（从60秒缩短，更频繁清理）
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics();
    }, 30000);
  }

  /**
   * 收集系统指标
   * @private
   */
  collectSystemMetrics() {
    if (!this.enabled) return;

    const timestamp = Date.now();

    // 内存使用情况
    if (performance.memory) {
      this.recordMetric('memory.used', performance.memory.usedJSHeapSize, timestamp, 'bytes');
      this.recordMetric('memory.total', performance.memory.totalJSHeapSize, timestamp, 'bytes');
      this.recordMetric('memory.limit', performance.memory.jsHeapSizeLimit, timestamp, 'bytes');
    }

    // DOM节点数量
    const domNodes = document.getElementsByTagName('*').length;
    this.recordMetric('dom.nodeCount', domNodes, timestamp, 'count');

    // 网络连接信息
    if (navigator.connection) {
      const connection = navigator.connection;
      this.recordMetric('network.downlink', connection.downlink || 0, timestamp, 'mbps');
      this.recordMetric('network.rtt', connection.rtt || 0, timestamp, 'ms');
      this.recordMetric('network.effectiveType', this.connectionTypeToNumber(connection.effectiveType), timestamp, 'level');
    }

    // 用户代理信息
    this.recordMetric('viewport.width', window.innerWidth, timestamp, 'px');
    this.recordMetric('viewport.height', window.innerHeight, timestamp, 'px');

    // 错误率统计
    this.updateErrorRate();
  }

  /**
   * 设置性能观察器
   * @private
   */
  setupPerformanceObservers() {
    // 观察导航性能
    if ('PerformanceObserver' in window) {
      try {
        // 导航时间
        const navObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.entryType === 'navigation') {
              this.recordNavigationMetrics(entry);
            }
          });
        });
        navObserver.observe({ entryTypes: ['navigation'] });

        // 资源加载时间
        const resourceObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            if (entry.entryType === 'resource') {
              this.recordResourceMetrics(entry);
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });

        // 长任务监控
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            this.recordMetric('performance.longTask', entry.duration, entry.startTime, 'ms', {
              name: entry.name,
              attribution: entry.attribution
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

      } catch (error) {
        console.warn('性能观察器设置失败:', error);
      }
    }
  }

  /**
   * 记录导航性能指标
   * @private
   * @param {PerformanceNavigationTiming} entry - 导航时间条目
   */
  recordNavigationMetrics(entry) {
    const timestamp = Date.now();

    // 关键时间节点
    this.recordMetric('navigation.dns', entry.domainLookupEnd - entry.domainLookupStart, timestamp, 'ms');
    this.recordMetric('navigation.connect', entry.connectEnd - entry.connectStart, timestamp, 'ms');
    this.recordMetric('navigation.ttfb', entry.responseStart - entry.requestStart, timestamp, 'ms');
    this.recordMetric('navigation.domReady', entry.domContentLoadedEventEnd - entry.navigationStart, timestamp, 'ms');
    this.recordMetric('navigation.load', entry.loadEventEnd - entry.navigationStart, timestamp, 'ms');
    this.recordMetric('navigation.fcp', entry.firstContentfulPaint || 0, timestamp, 'ms');
  }

  /**
   * 记录资源加载性能
   * @private
   * @param {PerformanceResourceTiming} entry - 资源时间条目
   */
  recordResourceMetrics(entry) {
    const resourceType = this.getResourceType(entry.name);
    const duration = entry.responseEnd - entry.startTime;
    
    this.recordMetric(`resource.${resourceType}.duration`, duration, entry.startTime, 'ms', {
      url: entry.name,
      size: entry.transferSize || 0
    });

    // 统计不同类型资源的加载时间
    this.incrementCounter(`resource.${resourceType}.count`);
  }

  /**
   * 设置用户交互监控
   * @private
   */
  setupUserInteractionMonitoring() {
    // 点击事件性能
    document.addEventListener('click', (event) => {
      const startTime = performance.now();
      
      // 使用 requestAnimationFrame 测量渲染延迟
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        this.recordMetric('interaction.click.renderDelay', renderTime, Date.now(), 'ms', {
          target: event.target.tagName
        });
      });
    }, { passive: true });

    // 滚动性能监控
    let scrollStartTime = 0;
    document.addEventListener('scroll', () => {
      if (scrollStartTime === 0) {
        scrollStartTime = performance.now();
      }
    }, { passive: true });

    document.addEventListener('scrollend', () => {
      if (scrollStartTime > 0) {
        const scrollDuration = performance.now() - scrollStartTime;
        this.recordMetric('interaction.scroll.duration', scrollDuration, Date.now(), 'ms');
        scrollStartTime = 0;
      }
    }, { passive: true });
  }

  /**
   * 记录性能指标
   * @param {string} name - 指标名称
   * @param {number} value - 指标值
   * @param {number} [timestamp] - 时间戳
   * @param {string} [unit=''] - 单位
   * @param {Object} [metadata={}] - 元数据
   */
  recordMetric(name, value, timestamp = Date.now(), unit = '', metadata = {}) {
    if (!this.enabled || typeof value !== 'number' || isNaN(value)) {
      return;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metric = {
      name,
      value,
      timestamp,
      unit,
      metadata
    };

    const metrics = this.metrics.get(name);
    metrics.push(metric);

    // 限制历史记录数量
    if (metrics.length > this.maxMetricsHistory) {
      metrics.shift();
    }

    // 检查阈值报警
    this.checkThreshold(name, value);
  }

  /**
   * 增加计数器
   * @param {string} name - 计数器名称
   * @param {number} [increment=1] - 增量
   */
  incrementCounter(name, increment = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + increment);
  }

  /**
   * 开始计时器
   * @param {string} name - 计时器名称
   * @returns {string} 计时器ID
   */
  startTimer(name) {
    const timerId = `${name}_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, performance.now());
    return timerId;
  }

  /**
   * 结束计时器并记录耗时
   * @param {string} timerId - 计时器ID
   * @param {Object} [metadata={}] - 元数据
   */
  endTimer(timerId, metadata = {}) {
    const startTime = this.timers.get(timerId);
    if (startTime !== undefined) {
      const duration = performance.now() - startTime;
      const name = timerId.split('_')[0];
      this.recordMetric(`timer.${name}`, duration, Date.now(), 'ms', metadata);
      this.timers.delete(timerId);
      return duration;
    }
    return 0;
  }

  /**
   * 性能分析
   * @private
   */
  analyzePerformance() {
    // 分析内存使用趋势
    this.analyzeMemoryTrend();
    
    // 分析响应时间趋势
    this.analyzeResponseTimes();
    
    // 分析用户体验指标
    this.analyzeUserExperience();
  }

  /**
   * 分析内存使用趋势
   * @private
   */
  analyzeMemoryTrend() {
    const memoryMetrics = this.metrics.get('memory.used');
    if (!memoryMetrics || memoryMetrics.length < 2) return;

    const recent = memoryMetrics.slice(-10);
    const trend = this.calculateTrend(recent.map(m => m.value));
    
    if (trend > 0.1) { // 内存增长超过10%
      this.addAlert('memory_growth', `内存使用增长趋势: +${(trend * 100).toFixed(1)}%`, 'warning');
    }
  }

  /**
   * 分析响应时间趋势
   * @private
   */
  analyzeResponseTimes() {
    // 分析网络响应时间
    const networkMetrics = this.metrics.get('navigation.ttfb');
    if (networkMetrics && networkMetrics.length > 5) {
      const recent = networkMetrics.slice(-10);
      const avgResponseTime = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
      const trend = this.calculateTrend(recent.map(m => m.value));
      
      if (avgResponseTime > this.thresholds.responseTime) {
        this.addAlert('slow_response', `平均响应时间过长: ${avgResponseTime.toFixed(1)}ms`, 'warning');
      }
      
      if (trend > 0.2) { // 响应时间恶化超过20%
        this.addAlert('response_degrading', `响应时间恶化趋势: +${(trend * 100).toFixed(1)}%`, 'warning');
      }
    }
    
    // 分析计时器性能
    const timerMetrics = Array.from(this.metrics.keys()).filter(key => key.startsWith('timer.'));
    timerMetrics.forEach(timerKey => {
      const metrics = this.metrics.get(timerKey);
      if (metrics && metrics.length > 3) {
        const recent = metrics.slice(-5);
        const avgTime = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        
        // 根据计时器类型设置不同的阈值
        let threshold = 1000; // 默认1秒
        if (timerKey.includes('render')) threshold = 16; // 渲染操作16ms
        if (timerKey.includes('api')) threshold = 2000; // API调用2秒
        if (timerKey.includes('storage')) threshold = 100; // 存储操作100ms
        
        if (avgTime > threshold) {
          this.addAlert(`slow_${timerKey.replace('timer.', '')}`, 
            `${timerKey} 平均耗时过长: ${avgTime.toFixed(1)}ms`, 'warning');
        }
      }
    });
    
    // 分析资源加载时间
    const resourceTypes = ['script', 'stylesheet', 'image', 'font'];
    resourceTypes.forEach(type => {
      const resourceMetrics = this.metrics.get(`resource.${type}.duration`);
      if (resourceMetrics && resourceMetrics.length > 0) {
        const recent = resourceMetrics.slice(-10);
        const avgLoadTime = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
        
        // 设置不同资源类型的阈值
        const thresholds = {
          script: 3000,
          stylesheet: 2000,
          image: 5000,
          font: 3000
        };
        
        if (avgLoadTime > thresholds[type]) {
          this.addAlert(`slow_${type}_loading`, 
            `${type} 资源平均加载时间过长: ${avgLoadTime.toFixed(1)}ms`, 'warning');
        }
      }
    });
  }

  /**
   * 分析用户体验指标
   * @private
   */
  analyzeUserExperience() {
    const clickMetrics = this.metrics.get('interaction.click.renderDelay');
    if (clickMetrics && clickMetrics.length > 0) {
      const recent = clickMetrics.slice(-20);
      const avgDelay = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
      
      if (avgDelay > 100) { // 平均渲染延迟超过100ms
        this.addAlert('slow_interaction', `交互响应延迟: ${avgDelay.toFixed(1)}ms`, 'warning');
      }
    }
  }

  /**
   * 计算趋势
   * @private
   * @param {Array<number>} values - 数值数组
   * @returns {number} 趋势值
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    
    return (last - first) / first;
  }

  /**
   * 检查阈值报警
   * @private
   * @param {string} name - 指标名称
   * @param {number} value - 指标值
   */
  checkThreshold(name, value) {
    const threshold = this.thresholds[name];
    if (threshold && value > threshold) {
      this.addAlert(`threshold_${name}`, `${name} 超过阈值: ${value} > ${threshold}`, 'error');
    }
  }

  /**
   * 添加报警
   * @private
   * @param {string} id - 报警ID
   * @param {string} message - 报警消息
   * @param {string} level - 报警级别
   */
  addAlert(id, message, level = 'info') {
    // 避免重复报警
    const existing = this.alerts.find(alert => alert.id === id && alert.resolved === false);
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastSeen = Date.now();
      return;
    }

    this.alerts.push({
      id,
      message,
      level,
      timestamp: Date.now(),
      resolved: false,
      count: 1,
      lastSeen: Date.now()
    });

    // 输出到控制台
    const logMethod = level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info';
    console[logMethod](`🚨 性能报警: ${message}`);

    // 限制报警数量
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  /**
   * 获取性能摘要
   * @returns {PerformanceSummary} 性能摘要
   */
  getSummary() {
    return {
      timestamp: Date.now(),
      metrics: this.getMetricsSummary(),
      counters: Object.fromEntries(this.counters),
      alerts: this.alerts.filter(alert => !alert.resolved),
      systemInfo: this.getSystemInfo()
    };
  }

  /**
   * 获取指标摘要
   * @private
   * @returns {Object} 指标摘要
   */
  getMetricsSummary() {
    const summary = {};
    
    this.metrics.forEach((values, name) => {
      if (values.length === 0) return;
      
      const recent = values.slice(-10);
      const latest = recent[recent.length - 1];
      const average = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
      const min = Math.min(...recent.map(m => m.value));
      const max = Math.max(...recent.map(m => m.value));
      
      summary[name] = {
        latest: latest.value,
        average: Number(average.toFixed(2)),
        min,
        max,
        unit: latest.unit,
        count: values.length
      };
    });
    
    return summary;
  }

  /**
   * 获取系统信息
   * @private
   * @returns {Object} 系统信息
   */
  getSystemInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency || 'unknown',
      memory: navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'unknown',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  /**
   * 获取资源类型
   * @private
   * @param {string} url - 资源URL
   * @returns {string} 资源类型
   */
  getResourceType(url) {
    if (url.endsWith('.js')) return 'script';
    if (url.endsWith('.css')) return 'stylesheet';
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image';
    if (url.match(/\.(mp4|webm|ogg)$/i)) return 'video';
    if (url.match(/\.(mp3|wav|ogg)$/i)) return 'audio';
    if (url.match(/\.(woff|woff2|ttf|eot)$/i)) return 'font';
    return 'other';
  }

  /**
   * 连接类型转数字
   * @private
   * @param {string} type - 连接类型
   * @returns {number} 数字等级
   */
  connectionTypeToNumber(type) {
    const types = { 'slow-2g': 1, '2g': 2, '3g': 3, '4g': 4, '5g': 5 };
    return types[type] || 0;
  }

  /**
   * 更新错误率
   * @private
   */
  updateErrorRate() {
    const totalErrors = this.counters.get('errors.total') || 0;
    const totalRequests = this.counters.get('requests.total') || 1;
    const errorRate = totalErrors / totalRequests;
    
    this.recordMetric('errors.rate', errorRate, Date.now(), 'ratio');
  }

  /**
   * 清理旧指标 - 内存优化版本
   * @private
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (2 * 60 * 60 * 1000); // 改为2小时前（减少内存占用）
    const maxEntriesPerMetric = 100; // 每个指标最多保留100个条目
    
    this.metrics.forEach((values, name) => {
      // 先按时间过滤
      let filtered = values.filter(metric => metric.timestamp > cutoffTime);
      
      // 再按数量限制（保留最新的条目）
      if (filtered.length > maxEntriesPerMetric) {
        filtered = filtered.slice(-maxEntriesPerMetric);
      }
      
      this.metrics.set(name, filtered);
    });
    
    // 更积极地清理已解决的旧报警 - 减少到30分钟
    this.alerts = this.alerts.filter(alert => 
      !alert.resolved || (Date.now() - alert.timestamp < 30 * 60 * 1000)
    );
    
    // 限制报警总数，避免内存泄漏
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  /**
   * 启用/禁用监控
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`🚀 增强性能监控${enabled ? '已启用' : '已禁用'}`);
  }
}

// ==================== 类型定义 ====================

/**
 * @typedef {Object} PerformanceMetric
 * @property {string} name - 指标名称
 * @property {number} value - 指标值
 * @property {number} timestamp - 时间戳
 * @property {string} unit - 单位
 * @property {Object} metadata - 元数据
 */

/**
 * @typedef {Object} PerformanceAlert
 * @property {string} id - 报警ID
 * @property {string} message - 报警消息
 * @property {string} level - 报警级别
 * @property {number} timestamp - 时间戳
 * @property {boolean} resolved - 是否已解决
 * @property {number} count - 发生次数
 * @property {number} lastSeen - 最后发生时间
 */

/**
 * @typedef {Object} PerformanceSummary
 * @property {number} timestamp - 时间戳
 * @property {Object} metrics - 指标摘要
 * @property {Object} counters - 计数器
 * @property {Array<PerformanceAlert>} alerts - 报警列表
 * @property {Object} systemInfo - 系统信息
 */

// ==================== 全局实例 ====================
const enhancedPerformanceMonitor = new EnhancedPerformanceMonitor();

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnhancedPerformanceMonitor, enhancedPerformanceMonitor };
} else {
  // 浏览器环境
  window.EnhancedPerformanceMonitor = EnhancedPerformanceMonitor;
  window.enhancedPerformanceMonitor = enhancedPerformanceMonitor;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.core', 'EnhancedPerformanceMonitor', EnhancedPerformanceMonitor);
      namespaceManager.addToNamespace('App.core', 'enhancedPerformanceMonitor', enhancedPerformanceMonitor);
    } catch (error) {
      console.warn('增强性能监控器命名空间注册失败:', error.message);
    }
  }
}

console.log('🚀 增强性能监控系统已加载');
