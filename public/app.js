// __APP_SPLIT_LOADER__
// This file loads split parts in order. It is intentionally NOT an ES module
// so that opening index.html via file:// keeps working.
(function () {
  // ==================== 架构系统初始化 ====================
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.services = App.services || {};
  App.parsers = App.parsers || {};
  App.features = App.features || {};
  App.ui = App.ui || {};

  // 架构系统脚本 - 必须首先加载
  var architectureScripts = [
    "app/core/logger-config.js",         // 日志配置（最先加载）
    "app/types/core-types.js",           // 核心类型定义（P2新增）
    "app/core/namespace-manager.js",      // 命名空间管理
    "app/core/architecture-debug.js",     // 架构调试标记管理
    "app/core/dependency-injection.js",  // 依赖注入
    "app/core/module-manager.js",         // 模块管理
    "app/core/architecture-initializer.js" // 架构初始化器
  ];

  // 错误管理器预加载脚本 - 确保错误处理在架构初始化前可用
  var errorPreloadScripts = [
    "app/core/error-manager-preload.js"
  ];

  // 核心系统脚本 - 按依赖顺序加载
  var coreScripts = [
    "app/core/state.js",
    "app/core/utils.js",
    "app/utils/validators-v2.js",                     // 新增：通用验证器
    "app/utils/runtime-type-checker.js",              // P2新增：运行时类型检查器
    "app/utils/dom-performance-optimizer.js",         // 性能优化：DOM操作优化工具
    "app/core/dom-cache.js",
    "app/core/dev-tools.js",
    "app/core/performance-monitor.js",                // 性能监控系统
    "app/core/enhanced-performance-monitor.js",      // P2新增：增强性能监控系统
    // 错误处理系统
    "app/core/error-manager.js",
    "app/core/error-utils.js",
    "app/core/error-integration.js",
    "app/core/unified-error-handler.js",              // P1新增：统一错误处理器
    // 核心服务
    "app/services/security-utils.js",
    "app/core/event-manager.js",
    "app/core/event-binding-manager.js",              // 新增：事件绑定管理器
    "app/core/dom-optimization-manager.js",           // P1新增：DOM优化管理器
    "app/core/service-startup-manager.js"             // 服务启动管理器
  ];

  // 服务层脚本
  var serviceScripts = [
    "app/services/storage/idb-operations.js",      // IndexedDB底层操作（从 storage-manager.js 拆分）
    "app/services/storage/file-content-keys.js",  // 文件内容键管理（从 storage-manager.js 拆分）
    "app/services/storage/storage-manager.js",
    "app/services/storage/error-handler.js",
    "app/services/storage/storage-error-handler.js",    // 新增：统一存储错误处理器
    "app/services/storage/smart-storage-strategy.js",   // P2新增：智能存储降级策略
    "app/services/storage/backup-sync-manager.js",      // P2新增：备份同步管理器
    "app/services/auto-save-manager.js",
    "app/network/network-utils.js",
    "app/network/error-handler.js",
    "app/network/request-deduplication.js",            // P1新增：请求去重机制
    "app/services/translation/service-class.js",
    "app/services/translation/compat.js",
    "app/services/translation/settings.js",
    "app/services/translation/terminology.js",
    "app/services/translation/engines/deepseek.js",
    "app/services/translation/engines/openai.js",
    "app/services/translation/engines/google.js",
    "app/services/translation/rate-limit.js",
    "app/services/translation/translate.js",
    "app/services/translation/batch.js",
    "app/services/translation-service.js"
  ];

  // 解析器脚本
  var parserScripts = [
    "app/parsers/parser-utils.js",                    // 解析器工具类
    "app/parsers/xml-generic.js",
    "app/parsers/xml-android.js",
    "app/parsers/xliff.js",
    "app/parsers/qt-ts.js",
    "app/parsers/ios-strings.js",
    "app/parsers/resx.js",
    "app/parsers/po.js",
    "app/parsers/json.js",
    "app/parsers/yaml.js",
    "app/parsers/csv.js",
    "app/parsers/text.js"
  ];

  // 功能模块脚本
  var featureScripts = [
    "app/features/files/read.js",
    "app/features/files/parse.js",
    "app/features/files/process.js",
    "app/features/files/error-handler.js",
    "app/features/translations/status.js",
    "app/features/translations/render.js",
    "app/features/translations/search.js",
    "app/features/translations/selection.js",
    "app/features/translations/result-handler-v2.js", // 新增：翻译结果处理器
    "app/features/translations/ui-updates.js",        // 新增：UI更新器
    "app/services/translation/business-logic.js",    // 新增：翻译业务逻辑服务
    "app/features/translations/ui-controller.js",    // 新增：翻译UI控制器
    "app/features/translations/find-replace.js", // 查找替换（从 actions.js 拆分）
    "app/features/translations/progress.js",     // 进度UI（从 actions.js 拆分）
    "app/features/translations/actions.js",
    "app/features/translations/error-handler.js",
    "app/features/translations/export/shared.js",
    "app/features/translations/export/ui.js",
    "app/features/translations/export/project.js",
    "app/features/translations/export/terminology-list.js",
    "app/features/quality/checks.js",
    "app/features/quality/enhanced-checks.js",
    "app/features/quality/scoring.js",
    "app/features/quality/run.js",
    "app/features/quality/charts.js",
    "app/features/quality/export.js",
    "app/features/quality/ui.js",
    "app/features/terminology/init.js",
    "app/features/projects/manager.js",
    "app/features/sample/sample-project.js"
  ];

  // UI组件脚本
  var uiScripts = [
    "app/ui/file-tree.js",
    "app/ui/notification.js",
    "app/ui/charts.js",
    "app/ui/settings.js",
    "app/ui/file-drop.js",
    "app/ui/engine-model-sync.js",
    "app/ui/perf/sync-heights.js",
    "app/ui/event-listeners/keyboard.js",
    "app/ui/event-listeners/translations-lists.js",
    "app/ui/event-listeners/file-panels.js",
    "app/ui/event-listeners/terminology.js",
    "app/ui/event-listeners/settings.js",
    "app/ui/event-listeners/translations-search.js",
    "app/ui/event-listeners/data-and-ui.js",
    "app/ui/event-listeners/quality.js",
    "app/ui/event-listeners.js"
  ];

  // 兼容性脚本
  var compatScripts = [
    "app/compat/files.js",
    "app/compat/perf.js",
    "app/compat/quality.js"
  ];

  // 引导脚本
  var bootstrapScripts = [
    "app/core/bootstrap.js"
  ];

  // 合并所有脚本，按加载顺序
  var scripts = [].concat(
    architectureScripts,
    errorPreloadScripts,  // 错误管理器预加载
    coreScripts,
    serviceScripts,
    parserScripts,
    featureScripts,
    uiScripts,
    compatScripts,
    bootstrapScripts
  );

  // 开发模式下加载测试和演示代码
  if (typeof isDevelopment !== 'undefined' && isDevelopment) {
    scripts.push(
      "app/core/error-demo.js",
      "app/core/error-test.js", 
      "app/core/error-system-test.js",
      "app/examples/error-handling-examples.js",
      "app/dev-tools/p0-integration-test.js",      // P0集成测试
      "app/dev-tools/p1-decoupling-test.js",      // P1解耦测试
      "app/dev-tools/legacy-cleanup-test.js",     // 遗留代码清理测试
      "app/dev-tools/p2-improvements-test.js"     // P2改进验证测试
    );
  } else {
    // 生产模式下加载精简版监控工具
    scripts.push("app/core/error-production.js");
  }

  // ==================== 脚本加载逻辑 ====================
  var suffix = "";
  try {
    var cs = document.currentScript && document.currentScript.src;
    if (cs) {
      var u = new URL(cs, window.location.href);
      var v = u.searchParams.get("v");
      if (v) suffix = "?v=" + encodeURIComponent(v);
    }
  } catch (e) {}

  try {
    if (window.ArchDebug) {
      window.ArchDebug.setFlag('appScriptSuffix', suffix, {
        mirrorWindow: false,
      });
    } else {
      App.__appScriptSuffix = suffix;
    }
  } catch (e) {}

  // ==================== 统一日志辅助函数 ====================
  // 在日志系统加载前提供基本日志功能
  function safeLog(level, message, data) {
    var logger = window.loggers && window.loggers.scripts;
    if (logger && logger[level]) {
      if (data !== undefined) {
        logger[level](message, data);
      } else {
        logger[level](message);
      }
    } else {
      // 备用：使用 console（仅在日志系统未加载时）
      var prefix = level === 'info' ? '📦' : level === 'warn' ? '⚠️' : level === 'error' ? '❌' : '🔍';
      if (data !== undefined) {
        console[level](prefix + ' ' + message, data);
      } else {
        console[level](prefix + ' ' + message);
      }
    }
  }

  /**
   * 高性能脚本加载器
   * 支持分组并行加载、进度监控、错误重试和性能优化
   */
  function createScriptLoader() {
    var loadedCount = 0;
    var totalCount = scripts.length;
    var loadErrors = [];
    var startTime = performance.now();
    var batchSize = 3; // 并行加载批次大小
    var currentBatch = 0;

    function updateProgress() {
      var progress = (loadedCount / totalCount) * 100;
      
      // 优化日志输出频率
      if (loadedCount === 1 || loadedCount === totalCount || loadedCount % Math.max(1, Math.floor(totalCount / 5)) === 0) {
        safeLog('info', `脚本加载进度: ${loadedCount}/${totalCount} (${progress.toFixed(1)}%)`);
      }
      
      // 性能优化：减少事件触发频率
      if (loadedCount === totalCount || loadedCount % 10 === 0) {
        if (typeof window.CustomEvent === 'function') {
          var event = new CustomEvent('scriptLoadProgress', {
            detail: { loaded: loadedCount, total: totalCount, progress: progress }
          });
          window.dispatchEvent(event);
        }
      }
    }

    function loadScript(index, retryCount) {
      retryCount = retryCount || 0;
      
      if (index >= scripts.length) {
        onAllScriptsLoaded();
        return;
      }

      var scriptPath = scripts[index];
      var script = document.createElement("script");
      // 确保脚本路径正确（当从根目录运行时需要public/前缀）
      var basePath;
      try {
        if (window.ArchDebug) {
          basePath = window.ArchDebug.getFlag('appBasePath');
          if (typeof basePath !== 'string') {
            basePath = App.__appBasePath;
          }
        } else {
          basePath = App.__appBasePath;
        }
      } catch (_) {
        basePath = App.__appBasePath;
      }
      if (typeof basePath !== 'string') basePath = '';
      script.src = basePath + scriptPath + suffix;
      script.async = false;

      script.onload = function() {
        loadedCount++;
        updateProgress();
        
        // 检查是否为架构脚本，如果是则进行特殊处理
        if (architectureScripts.includes(scriptPath)) {
          // 只记录架构脚本加载，不输出到控制台
        }
        
        loadScript(index + 1);
      };

      script.onerror = function() {
        var error = {
          script: scriptPath,
          index: index,
          retryCount: retryCount,
          timestamp: new Date().toISOString()
        };
        
        safeLog('error', `脚本加载失败: ${scriptPath} (重试次数: ${retryCount})`);

        // 重试逻辑
        if (retryCount < 2) {
          safeLog('info', `重试加载脚本: ${scriptPath}`);
          setTimeout(function() {
            loadScript(index, retryCount + 1);
          }, 1000 * (retryCount + 1));
        } else {
          loadErrors.push(error);
          safeLog('error', `脚本加载最终失败: ${scriptPath}`);

          // 继续加载下一个脚本
          loadScript(index + 1);
        }
      };

      document.head.appendChild(script);
    }

    function onAllScriptsLoaded() {
      var endTime = performance.now();
      var totalTime = endTime - startTime;

      // 使用统一的日志系统
      safeLog('info', `所有脚本加载完成 (耗时: ${totalTime.toFixed(2)}ms)`);
      if (loadErrors.length > 0) {
        safeLog('warn', `${loadErrors.length} 个脚本加载失败`, loadErrors);
      }

      // 触发加载完成事件
      if (typeof window.CustomEvent === 'function') {
        var event = new CustomEvent('allScriptsLoaded', {
          detail: {
            totalTime: totalTime,
            errors: loadErrors,
            loadedCount: loadedCount,
            totalCount: totalCount
          }
        });
        window.dispatchEvent(event);
      }

      try {
        if (window.ArchDebug) {
          try {
            delete App.__appScriptSuffix;
          } catch (_) {
            App.__appScriptSuffix = undefined;
          }
        }
      } catch (_) {}

      // 开始架构初始化
      initializeArchitectureSystem();
    }

    return {
      start: function() {
        safeLog('info', `开始加载 ${totalCount} 个脚本...`);
        loadScript(0);
      }
    };
  }

  /**
   * 初始化架构系统
   */
  function initializeArchitectureSystem() {
    // 等待架构组件加载完成
    function waitForArchitectureComponents() {
      var requiredComponents = [
        'NamespaceManager',
        'DIContainer',
        'ModuleManager',
        'ArchitectureInitializer'
      ];
      
      var missing = requiredComponents.filter(function(component) {
        return !window[component];
      });
      
      if (missing.length > 0) {
        safeLog('info', `等待架构组件: ${missing.join(', ')}`);
        setTimeout(waitForArchitectureComponents, 100);
        return;
      }

      // ...existing code...

      // 开始架构初始化
      safeLog('info', '开始架构系统初始化...');

      if (window.architectureInitializer) {
        window.architectureInitializer.initialize({
          enableLogging: true,
          enablePerformanceMonitoring: true,
          enableErrorReporting: true
        }).then(function(report) {
          safeLog('info', '架构初始化完成', report);
          bootstrapApplication({
            architectureReady: true,
            architectureReport: report,
            architectureError: null,
          });
        }).catch(function(error) {
          safeLog('error', '架构初始化失败', error);
          // 即使架构初始化失败，也尝试启动应用
          bootstrapApplication({
            architectureReady: false,
            architectureReport: null,
            architectureError: error,
          });
        });
      } else {
        safeLog('warn', '架构初始化器未找到，直接启动应用');
        bootstrapApplication({
          architectureReady: false,
          architectureReport: null,
          architectureError: new Error('architectureInitializer not found'),
        });
      }
    }
    
    waitForArchitectureComponents();
  }

  /**
   * 启动应用
   */
  function bootstrapApplication(bootstrapContext) {
    function run() {
      try {
        try {
          var appBootstrapInvoked = window.ArchDebug
            ? window.ArchDebug.getFlag('appBootstrapInvoked')
            : false;

          if (appBootstrapInvoked) {
            return;
          }

          if (window.ArchDebug) {
            window.ArchDebug.setFlag('appBootstrapInvoked', true, {
              mirrorWindow: false,
            });
          }
        } catch (_) {}

        if (typeof window.__appBootstrap === "function") {
          Promise.resolve(window.__appBootstrap(bootstrapContext)).catch(function (e) {
            safeLog('error', 'App bootstrap failed', e);
          });
        } else {
          safeLog('error', 'App bootstrap entry not found: window.__appBootstrap');
        }
      } catch (e) {
        safeLog('error', 'App bootstrap threw', e);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  // ==================== 启动脚本加载 ====================
  var scriptLoader = createScriptLoader();
  scriptLoader.start();
})();