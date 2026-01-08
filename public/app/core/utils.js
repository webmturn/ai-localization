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
          suffix = typeof window.__appScriptSuffix === "string" ? window.__appScriptSuffix : "";
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
