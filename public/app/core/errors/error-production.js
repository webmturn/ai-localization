// ==================== 生产环境错误处理工具 ====================
/**
 * 生产环境下的精简错误处理工具
 * 只包含必要的诊断和监控功能
 */

/**
 * 生产环境错误监控
 */
class ProductionErrorMonitor {
  constructor() {
    this.isEnabled = false;
    this.reportEndpoint = null;
  }
  
  /**
   * 启用生产监控
   * @param {Object} config - 配置选项
   */
  enable(config = {}) {
    this.isEnabled = true;
    this.reportEndpoint = config.reportEndpoint;
    this.maxReports = config.maxReports || 10;
    this.reportInterval = config.reportInterval || 60000; // 1分钟
    
    console.log('🔍 生产环境错误监控已启用');
  }
  
  /**
   * 禁用监控
   */
  disable() {
    this.isEnabled = false;
    console.log('🔍 生产环境错误监控已禁用');
  }
  
  /**
   * 获取系统健康状态
   */
  getHealthStatus() {
    const stats = errorManager.getErrorStats();
    const recentErrors = stats.recent.slice(0, 5);
    
    // 计算错误率
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical').length;
    const highErrors = recentErrors.filter(e => e.severity === 'high').length;
    
    let status = 'healthy';
    if (criticalErrors > 0) {
      status = 'critical';
    } else if (highErrors > 2) {
      status = 'warning';
    } else if (stats.total > 50) {
      status = 'degraded';
    }
    
    return {
      status,
      totalErrors: stats.total,
      criticalErrors,
      highErrors,
      recentErrors: recentErrors.length,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 快速诊断
   */
  quickDiagnosis() {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      errorManager: typeof errorManager !== 'undefined',
      errorCodes: typeof ERROR_CODES !== 'undefined',
      errorUtils: typeof ErrorUtils !== 'undefined',
      batchCollector: typeof BatchErrorCollector !== 'undefined',
      networkUtils: typeof networkUtilsV2 !== 'undefined'
    };
    
    const issues = [];
    
    if (!diagnosis.errorManager) issues.push('ErrorManager未加载');
    if (!diagnosis.errorCodes) issues.push('ERROR_CODES未定义');
    if (!diagnosis.errorUtils) issues.push('ErrorUtils未加载');
    
    diagnosis.issues = issues;
    diagnosis.healthy = issues.length === 0;
    
    return diagnosis;
  }
  
  /**
   * 生成简化报告
   */
  generateReport() {
    const health = this.getHealthStatus();
    const diagnosis = this.quickDiagnosis();
    
    const report = {
      timestamp: new Date().toISOString(),
      health,
      diagnosis,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.log('📊 生产环境错误报告:', report);
    
    // 如果配置了报告端点，发送报告
    if (this.isEnabled && this.reportEndpoint) {
      this.sendReport(report);
    }
    
    return report;
  }
  
  /**
   * 发送报告到服务器
   */
  async sendReport(report) {
    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });
      console.log('📤 错误报告已发送');
    } catch (error) {
      console.warn('📤 错误报告发送失败:', error.message);
    }
  }
}

/**
 * 紧急错误处理
 * 当主要错误处理系统失效时的备用方案
 */
class EmergencyErrorHandler {
  constructor() {
    this.fallbackErrors = [];
    this.maxFallbackErrors = 20;
  }
  
  /**
   * 处理紧急错误
   */
  handleEmergencyError(error, context = {}) {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // 添加到备用错误列表
    this.fallbackErrors.unshift(errorInfo);
    if (this.fallbackErrors.length > this.maxFallbackErrors) {
      this.fallbackErrors = this.fallbackErrors.slice(0, this.maxFallbackErrors);
    }
    
    // 尝试显示用户友好的错误消息
    if (typeof showNotification === 'function') {
      showNotification('error', '系统错误', '发生了意外错误，请刷新页面重试');
    } else {
      console.error('系统错误:', errorInfo);
    }
    
    return errorInfo;
  }
  
  /**
   * 获取备用错误列表
   */
  getFallbackErrors() {
    return [...this.fallbackErrors];
  }
  
  /**
   * 清理备用错误
   */
  clearFallbackErrors() {
    this.fallbackErrors = [];
  }
}

/**
 * 生产环境工具函数
 */
const ProductionErrorUtils = {
  /**
   * 检查错误处理系统是否正常
   */
  isErrorSystemHealthy() {
    try {
      return typeof errorManager !== 'undefined' && 
             typeof errorManager.handleError === 'function' &&
             typeof ERROR_CODES !== 'undefined';
    } catch (error) {
      return false;
    }
  },
  
  /**
   * 安全执行函数（生产版）
   */
  safeExecute(fn, fallback = null) {
    try {
      return fn();
    } catch (error) {
      if (this.isErrorSystemHealthy()) {
        errorManager.handleError(error, { production: true });
      } else {
        emergencyHandler.handleEmergencyError(error, { function: fn.name });
      }
      return fallback;
    }
  },
  
  /**
   * 获取错误摘要（生产版）
   */
  getErrorSummary() {
    if (!this.isErrorSystemHealthy()) {
      return {
        available: false,
        fallbackErrors: emergencyHandler.getFallbackErrors().length
      };
    }
    
    const stats = errorManager.getErrorStats();
    return {
      available: true,
      total: stats.total,
      critical: stats.bySeverity.critical || 0,
      high: stats.bySeverity.high || 0,
      recent: stats.recent.slice(0, 3).map(e => ({
        code: e.code,
        severity: e.severity,
        timestamp: e.timestamp
      }))
    };
  }
};

// 创建全局实例
const productionMonitor = new ProductionErrorMonitor();
const emergencyHandler = new EmergencyErrorHandler();

// 导出到全局
window.ProductionErrorMonitor = ProductionErrorMonitor;
window.EmergencyErrorHandler = EmergencyErrorHandler;
window.productionMonitor = productionMonitor;
window.emergencyHandler = emergencyHandler;
window.ProductionErrorUtils = ProductionErrorUtils;

// 生产环境下的全局错误捕获
if (typeof isDevelopment === 'undefined' || !isDevelopment) {
  // 捕获未处理的Promise拒绝
  window.addEventListener('unhandledrejection', (event) => {
    if (ProductionErrorUtils.isErrorSystemHealthy()) {
      errorManager.handleError(event.reason, { 
        type: 'unhandledPromiseRejection',
        production: true 
      });
    } else {
      emergencyHandler.handleEmergencyError(event.reason, { 
        type: 'unhandledPromiseRejection' 
      });
    }
    event.preventDefault();
  });
  
  // 捕获全局JavaScript错误
  window.addEventListener('error', (event) => {
    if (ProductionErrorUtils.isErrorSystemHealthy()) {
      errorManager.handleError(event.error || event.message, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        production: true
      });
    } else {
      emergencyHandler.handleEmergencyError(event.error || event.message, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    }
  });
  
  console.log('🛡️ 生产环境错误处理已启用');
}