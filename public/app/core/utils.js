// ==================== 工具函数 ====================

/**
 * 防抖函数：延迟执行，频繁调用时只执行最后一次
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 * 应用场景：搜索框输入、窗口resize等
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数：限制执行频率，在指定时间内最多执行一次
 * @param {Function} func - 需要节流的函数
 * @param {number} limit - 时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 * 应用场景：滚动事件、高频UI更新等
 */
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("JSON parse failed, fallback used:", error);
    return fallback;
  }
}

/**
 * 统一的搜索过滤函数
 * @param {Array} items - 需要过滤的项目数组
 * @param {string} query - 搜索关键词
 * @param {Array<string>} fields - 需要搜索的字段名，支持嵌套字段（如 'metadata.resourceId'）
 * @returns {Array} 过滤后的项目数组
 */
function filterItems(
  items,
  query,
  fields = ["sourceText", "targetText", "context"]
) {
  if (!query || !query.trim()) return [...items];

  const lowerQuery = query.toLowerCase();
  return items.filter((item) => {
    return fields.some((field) => {
      // 支持嵌套字段访问，如 'metadata.resourceId'
      const value = field.includes(".")
        ? field.split(".").reduce((obj, key) => obj?.[key], item)
        : item[field];
      return value?.toString().toLowerCase().includes(lowerQuery);
    });
  });
}

(function () {
  var App = (window.App = window.App || {});
  App.services = App.services || {};

  if (typeof App.services.loadScriptOnce === "function") return;

  var inflight = Object.create(null);

  App.services.loadScriptOnce = function (src, options) {
    var key = String(src || "");
    if (!key) return Promise.reject(new Error("loadScriptOnce: empty src"));

    if (inflight[key]) return inflight[key];

    inflight[key] = new Promise(function (resolve, reject) {
      try {
        var existing = document.querySelector('script[data-app-src="' + key.replace(/"/g, "\\\"") + '"]');
        if (existing) {
          resolve();
          return;
        }

        var s = document.createElement("script");
        s.async = false;
        s.dataset.appSrc = key;

        if (options && options.defer) s.defer = true;

        var suffix = "";
        try {
          var appScriptSuffix = window.ArchDebug
            ? window.ArchDebug.getFlag('appScriptSuffix')
            : (function () {
                try {
                  var App = window.App;
                  if (App && typeof App.__appScriptSuffix === 'string') {
                    return App.__appScriptSuffix;
                  }
                } catch (_) {}
                try {
                  return window.__appScriptSuffix;
                } catch (_) {
                  return undefined;
                }
              })();
          suffix = typeof appScriptSuffix === "string" ? appScriptSuffix : "";
        } catch (_) {}

        s.src = key + suffix;

        s.onload = function () {
          resolve();
        };
        s.onerror = function () {
          reject(new Error("Failed to load script: " + s.src));
        };

        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    }).finally(function () {
      delete inflight[key];
    });

    return inflight[key];
  };

  App.services.ensureChartJs = function () {
    if (typeof window.Chart === "function") return Promise.resolve();
    return App.services.loadScriptOnce("lib/chart.js/chart.umd.min.js").then(function () {
      if (typeof window.Chart !== "function") {
        throw new Error("Chart.js loaded but window.Chart is not available");
      }
    });
  };

  App.services.ensureSheetJs = function () {
    if (typeof window.XLSX !== "undefined") return Promise.resolve();
    return App.services.loadScriptOnce("lib/sheetjs/xlsx.full.min.js").then(function () {
      if (typeof window.XLSX === "undefined") {
        throw new Error("SheetJS loaded but window.XLSX is not available");
      }
    });
  };

  var qualityModulePromise = null;
  App.services.ensureQualityModule = function () {
    if (App.services.__qualityModuleLoaded) return Promise.resolve();
    if (qualityModulePromise) return qualityModulePromise;

    var parts = [
      "app/features/quality/checks.js",
      "app/features/quality/scoring.js",
      "app/features/quality/charts.js",
      "app/features/quality/ui.js",
      "app/features/quality/export.js",
      "app/features/quality/run.js",
    ];

    qualityModulePromise = parts
      .reduce(function (p, src) {
        return p.then(function () {
          return App.services.loadScriptOnce(src);
        });
      }, Promise.resolve())
      .then(function () {
        App.services.__qualityModuleLoaded = true;
      })
      .catch(function (e) {
        qualityModulePromise = null;
        throw e;
      });

    return qualityModulePromise;
  };

  var translationsExportPromise = null;
  App.services.ensureTranslationsExportModule = function () {
    if (App.services.__translationsExportLoaded) return Promise.resolve();
    if (translationsExportPromise) return translationsExportPromise;

    var parts = [
      "app/features/translations/export/translation-formats.js",
      "app/features/translations/export/translation-original.js",
      "app/features/translations/export/translation-entry.js",
    ];

    translationsExportPromise = parts
      .reduce(function (p, src) {
        return p.then(function () {
          return App.services.loadScriptOnce(src);
        });
      }, Promise.resolve())
      .then(function () {
        App.services.__translationsExportLoaded = true;
      })
      .catch(function (e) {
        translationsExportPromise = null;
        throw e;
      });

    return translationsExportPromise;
  };

  var terminologyIoPromise = null;
  App.services.ensureTerminologyImportExportModule = function () {
    if (App.services.__terminologyImportExportLoaded) return Promise.resolve();
    if (terminologyIoPromise) return terminologyIoPromise;

    var parts = [
      "app/features/translations/export/terminology-import.js",
      "app/features/translations/export/terminology-export.js",
    ];

    terminologyIoPromise = parts
      .reduce(function (p, src) {
        return p.then(function () {
          return App.services.loadScriptOnce(src);
        });
      }, Promise.resolve())
      .then(function () {
        App.services.__terminologyImportExportLoaded = true;
      })
      .catch(function (e) {
        terminologyIoPromise = null;
        throw e;
      });

    return terminologyIoPromise;
  };
})();

// ==================== 服务获取辅助函数 ====================

/**
 * 安全地从DI容器获取服务
 * @param {string} serviceName - 服务名称
 * @param {string} [fallbackGlobal] - 备用全局变量名（用于向后兼容）
 * @returns {*} 服务实例，如果未找到则返回 null
 */
function getServiceSafely(serviceName, fallbackGlobal) {
  try {
    // 优先从DI容器获取
    if (window.diContainer && window.diContainer.has(serviceName)) {
      return window.diContainer.resolve(serviceName);
    }

    // 尝试从服务定位器获取
    if (window.serviceLocator && window.serviceLocator.has(serviceName)) {
      return window.serviceLocator.get(serviceName);
    }
  } catch (error) {
    const logger = window.loggers?.service || console;
    logger.warn?.(`获取服务 ${serviceName} 失败:`, error);
  }

  // 备用方案：从全局变量获取
  if (fallbackGlobal) {
    const globalValue = window[fallbackGlobal];
    if (globalValue !== undefined) {
      return globalValue;
    }
  }

  // 最后尝试直接从 serviceName 获取
  const directValue = window[serviceName];
  if (directValue !== undefined) {
    return directValue;
  }

  return null;
}

/**
 * 获取服务（如果不存在则抛出错误）
 * @param {string} serviceName - 服务名称
 * @returns {*} 服务实例
 * @throws {Error} 如果服务未找到
 */
function getService(serviceName) {
  const service = getServiceSafely(serviceName, serviceName);
  if (service === null) {
    throw new Error(`服务 ${serviceName} 未注册或不可用`);
  }
  return service;
}

/**
 * 检查服务是否存在
 * @param {string} serviceName - 服务名称
 * @returns {boolean} 服务是否存在
 */
function hasService(serviceName) {
  try {
    if (window.diContainer && window.diContainer.has(serviceName)) {
      return true;
    }
    if (window.serviceLocator && window.serviceLocator.has(serviceName)) {
      return true;
    }
    return window[serviceName] !== undefined;
  } catch {
    return false;
  }
}

/**
 * 批量获取服务
 * @param {string[]} serviceNames - 服务名称数组
 * @returns {Object} 服务名称到实例的映射
 */
function getServices(serviceNames) {
  const services = {};
  serviceNames.forEach(name => {
    try {
      services[name] = getServiceSafely(name, name);
    } catch (error) {
      services[name] = null;
    }
  });
  return services;
}

/**
 * 创建服务依赖注入包装器
 * @param {Function} fn - 需要依赖注入的函数
 * @param {string[]} dependencies - 依赖的服务名称列表
 * @returns {Function} 包装后的函数
 */
function withDependencies(fn, dependencies) {
  return function(...args) {
    const services = getServices(dependencies);
    return fn.call(this, services, ...args);
  };
}

// 暴露到全局
window.getServiceSafely = getServiceSafely;
window.getService = getService;
window.hasService = hasService;
window.getServices = getServices;
window.withDependencies = withDependencies;

