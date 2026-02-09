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

/**
 * 移动端断点阈值（px）
 * 统一管理，避免分散硬编码
 */
var MOBILE_BREAKPOINT = 768;

/**
 * 判断当前视口是否为移动端
 * @returns {boolean}
 */
function isMobileViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    (loggers.app || console).warn("JSON parse failed, fallback used:", error);
    return fallback;
  }
}

/**
 * translatorSettings 缓存访问器（单例）
 * 避免 26+ 处重复 localStorage.getItem("translatorSettings") + JSON.parse
 * 写入时自动同步缓存，保证一致性
 * @namespace SettingsCache
 */
var SettingsCache = {
  _key: "translatorSettings",
  _cache: null,
  _dirty: true,

  /**
   * 读取设置（带缓存）
   * @returns {Object} 设置对象（永远返回普通对象，不返回null）
   */
  get: function () {
    if (!this._dirty && this._cache) return this._cache;
    var raw = localStorage.getItem(this._key);
    this._cache = raw ? safeJsonParse(raw, {}) : {};
    this._dirty = false;
    return this._cache;
  },

  /**
   * 保存设置（写入 localStorage 并更新缓存）
   * @param {Object} settings - 完整的设置对象
   */
  save: function (settings) {
    if (!settings || typeof settings !== "object") return;
    localStorage.setItem(this._key, JSON.stringify(settings));
    this._cache = settings;
    this._dirty = false;
  },

  /**
   * 读取 → 修改 → 保存 的快捷方法
   * @param {Function} mutator - 接收当前settings的函数，直接修改即可
   */
  update: function (mutator) {
    var s = this.get();
    mutator(s);
    this.save(s);
  },

  /**
   * 标记缓存失效（下次 get 时重新从 localStorage 读取）
   */
  invalidate: function () {
    this._dirty = true;
    this._cache = null;
  },
};

/**
 * 通用标签页切换工具
 * @param {string} tabSelector - 标签按钮的CSS选择器
 * @param {string} panelSelector - 面板的CSS选择器
 * @param {string} tabName - 要激活的标签名（匹配 data-tab 属性）
 * @param {Object} [options] - 可选配置
 * @param {string[]} [options.activeClasses] - 激活状态的类名
 * @param {string[]} [options.inactiveClasses] - 非激活状态的类名
 * @param {string} [options.activePanelId] - 要显示的面板ID（如果不通过 data-tab 匹配）
 */
function switchTabState(tabSelector, panelSelector, tabName, options) {
  var opts = options || {};
  var activeClasses = opts.activeClasses || ["active", "bg-primary", "text-white", "border-primary"];
  var inactiveClasses = opts.inactiveClasses || [
    "bg-gray-50", "dark:bg-gray-900", "text-gray-700", "dark:text-gray-200",
    "border-gray-300", "dark:border-gray-600", "hover:bg-gray-100", "dark:hover:bg-gray-700"
  ];

  DOMCache.queryAll(tabSelector).forEach(function (tab) {
    tab.classList.remove.apply(tab.classList, activeClasses);
    tab.classList.add.apply(tab.classList, inactiveClasses);

    if (tab.dataset.tab === tabName) {
      tab.classList.add.apply(tab.classList, activeClasses);
      tab.classList.remove.apply(tab.classList, inactiveClasses);
    }
  });

  DOMCache.queryAll(panelSelector).forEach(function (panel) {
    panel.classList.remove("active", "block");
    panel.classList.add("hidden");
  });

  if (opts.activePanelId) {
    var activePanel = DOMCache.get(opts.activePanelId);
    if (activePanel) {
      activePanel.classList.remove("hidden");
      activePanel.classList.add("active", "block");
    }
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
  const App = (window.App = window.App || {});
  App.services = App.services || {};

  if (typeof App.services.loadScriptOnce === "function") return;

  const inflight = Object.create(null);

  App.services.loadScriptOnce = function (src, options) {
    const key = String(src || "");
    if (!key) return Promise.reject(new Error("loadScriptOnce: empty src"));

    if (inflight[key]) return inflight[key];

    inflight[key] = new Promise(function (resolve, reject) {
      try {
        const existing = document.querySelector('script[data-app-src="' + key.replace(/"/g, "\\\"") + '"]');
        if (existing) {
          resolve();
          return;
        }

        const s = document.createElement("script");
        s.async = false;
        s.dataset.appSrc = key;

        if (options && options.defer) s.defer = true;

        let suffix = "";
        try {
          const appScriptSuffix = window.ArchDebug
            ? window.ArchDebug.getFlag('appScriptSuffix')
            : (function () {
                try {
                  const App2 = window.App;
                  if (App2 && typeof App2.__appScriptSuffix === 'string') {
                    return App2.__appScriptSuffix;
                  }
                } catch (_) {
                  // property access guard - safe to ignore
                }
                try {
                  return window.__appScriptSuffix;
                } catch (_) {
                  return undefined;
                }
              })();
          suffix = typeof appScriptSuffix === "string" ? appScriptSuffix : "";
        } catch (_) {
          // suffix detection guard - safe to ignore
        }

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

  let qualityModulePromise = null;
  App.services.ensureQualityModule = function () {
    if (App.services.__qualityModuleLoaded) return Promise.resolve();
    if (qualityModulePromise) return qualityModulePromise;

    const parts = [
      "app/features/quality/checks.js",
      "app/features/quality/enhanced-checks.js",
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

  let translationsExportPromise = null;
  App.services.ensureTranslationsExportModule = function () {
    if (App.services.__translationsExportLoaded) return Promise.resolve();
    if (translationsExportPromise) return translationsExportPromise;

    const parts = [
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

  let terminologyIoPromise = null;
  App.services.ensureTerminologyImportExportModule = function () {
    if (App.services.__terminologyImportExportLoaded) return Promise.resolve();
    if (terminologyIoPromise) return terminologyIoPromise;

    const parts = [
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

  let projectManagerPromise = null;
  App.services.ensureProjectManagerModule = function () {
    if (App.services.__projectManagerLoaded) return Promise.resolve();
    if (projectManagerPromise) return projectManagerPromise;

    projectManagerPromise = App.services
      .loadScriptOnce("app/features/projects/manager.js")
      .then(function () {
        App.services.__projectManagerLoaded = true;
      })
      .catch(function (e) {
        projectManagerPromise = null;
        throw e;
      });

    return projectManagerPromise;
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

