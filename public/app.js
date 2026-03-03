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

  // 安全回退：确保 loggers 在 logger-config.js 加载失败时不会导致全局 ReferenceError
  // logger-config.js 加载成功后会用完整实现覆盖此占位
  if (typeof window.loggers === 'undefined') {
    var _noop = function () {};
    var _stubLogger = { error: console.error.bind(console), warn: console.warn.bind(console), info: _noop, debug: _noop, verbose: _noop };
    window.loggers = {
      architecture: _stubLogger, modules: _stubLogger, services: _stubLogger,
      scripts: _stubLogger, errors: _stubLogger, app: _stubLogger,
      storage: _stubLogger, startup: _stubLogger, translation: _stubLogger, di: _stubLogger
    };
  }
  // 确保 loggers 在闭包作用域内也可用（与 logger-config.js 中的 const loggers 保持一致）
  var loggers = window.loggers;

  // 架构系统脚本 - 必须首先加载
  var architectureScripts = [
    "app/core/logger-config.js",         // 日志配置（最先加载）
    "app/types/core-types.js",           // 核心类型定义（P2新增）
    "app/core/architecture/namespace-manager.js",      // 命名空间管理
    "app/core/architecture/architecture-debug.js",     // 架构调试标记管理
    "app/core/architecture/dependency-injection.js",  // 依赖注入
    "app/core/architecture/module-manager.js",         // 模块管理
    "app/core/architecture/architecture-initializer.js" // 架构初始化器
  ];

  // 错误管理器预加载脚本 - 确保错误处理在架构初始化前可用
  var errorPreloadScripts = [
    "app/core/errors/error-manager-preload.js"
  ];

  // 核心系统脚本 - 按依赖顺序加载
  var coreScripts = [
    "app/core/state.js",
    "app/core/utils.js",
    "app/utils/validators-v2.js",                     // 新增：通用验证器
    // runtime-type-checker.js、dom-performance-optimizer.js 已移至开发模式按需加载（未被业务代码引用）
    "app/core/dom-cache.js",
    "app/core/dev-tools.js",
    "app/core/performance-monitor.js",                // 性能监控系统
    // enhanced-performance-monitor.js 已移至开发模式按需加载（未被业务代码引用）
    // 错误处理系统
    "app/core/errors/error-manager.js",
    "app/core/errors/error-utils.js",
    "app/core/errors/error-integration.js",
    // unified-error-handler.js 已移除（未被业务代码使用，且侵入式patch addEventListener/Promise.catch）
    // 核心服务
    "app/services/security-utils.js",
    "app/core/event-manager.js",
    // event-binding-manager.js 已移至开发模式按需加载（未被业务代码引用，仅在DI注册中备用）
    "app/core/dom-optimization-manager.js",           // P1新增：DOM优化管理器
    "app/utils/dom-cache-integration.js",             // DOM缓存集成（被 service-startup-manager 引用）
    "app/core/architecture/architecture-integration-helpers.js",   // 架构集成助手（被 bootstrap 引用）
    "app/core/service-startup-manager.js"             // 服务启动管理器
  ];

  // 服务层脚本
  var serviceScripts = [
    "app/services/storage/idb-operations.js",      // IndexedDB底层操作（从 storage-manager.js 拆分）
    "app/services/storage/file-content-keys.js",  // 文件内容键管理（从 storage-manager.js 拆分）
    "app/services/storage/storage-manager.js",
    "app/services/storage/error-handler.js",
    "app/services/storage/storage-error-handler.js",    // 新增：统一存储错误处理器
    // smart-storage-strategy.js、backup-sync-manager.js 已移至开发模式按需加载（未被业务代码引用）
    "app/services/auto-save-manager.js",
    "app/network/network-utils.js",
    "app/network/error-handler.js",
    // request-deduplication.js 已移至开发模式按需加载（未被业务代码引用）
    // 翻译引擎注册表和基类（必须在 providers 和 service-class 之前加载）
    "app/services/translation/engines/engine-registry.js",
    "app/services/translation/engines/base/ai-engine-base.js",
    "app/services/translation/engines/base/traditional-engine-base.js",
    // 翻译引擎 providers（注册到 EngineRegistry）
    "app/services/translation/engines/providers/deepseek.js",
    "app/services/translation/engines/providers/openai.js",
    "app/services/translation/engines/providers/gemini.js",
    "app/services/translation/engines/providers/claude.js",
    "app/services/translation/engines/providers/google-translate.js",
    "app/services/translation/engines/providers/custom-engine.js",  // 自定义引擎接入
    // 翻译服务核心
    "app/services/translation/service-class.js",
    "app/services/translation/compat.js",
    "app/services/translation/settings.js",
    "app/services/translation/terminology.js",
    "app/services/translation/helpers.js",
    "app/services/translation/translation-memory.js",   // 翻译记忆库
    "app/services/translation/translation-diff.js",     // 增量翻译 Diff
    "app/services/translation/batch-resume.js",         // 批量翻译断点续传
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
    "app/features/terminology/init.js",
    "app/features/tm/ui.js",                           // 翻译记忆库管理 UI
    "app/features/engines/custom-ui.js",               // 自定义引擎配置 UI
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
    "app/ui/perf/virtual-scroll.js",
    "app/ui/event-listeners/keyboard.js",
    "app/ui/event-listeners/translations-lists.js",
    "app/ui/event-listeners/file-panels.js",
    "app/ui/event-listeners/terminology.js",
    "app/ui/event-listeners/settings-prompt-templates.js", // Prompt模板管理（从 settings.js 拆分）
    "app/ui/event-listeners/settings-ai-engine.js",      // AI引擎高级设置（从 settings.js 拆分）
    "app/ui/event-listeners/settings.js",
    "app/ui/event-listeners/translations-search.js",
    "app/ui/event-listeners/data-management.js", // 数据管理监听器（从 data-and-ui.js 拆分）
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
      "app/dev-tools/error-demo.js",
      "app/dev-tools/error-test.js",
      "app/dev-tools/error-system-test.js",
      "app/dev-tools/error-handling-examples.js"
    );
  } else {
    // 生产模式下加载精简版监控工具
    scripts.push("app/core/errors/error-production.js");
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

    // 预加载：让浏览器并行下载所有脚本（不执行），加速后续顺序加载
    function preloadAllScripts() {
      var basePath;
      try {
        basePath = (window.ArchDebug
          ? window.ArchDebug.getFlag('appBasePath')
          : App.__appBasePath) || '';
      } catch (_) { basePath = App.__appBasePath || ''; }
      if (typeof basePath !== 'string') basePath = '';
      for (var i = 0; i < scripts.length; i++) {
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = basePath + scripts[i] + suffix;
        document.head.appendChild(link);
      }
    }

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
        preloadAllScripts();
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