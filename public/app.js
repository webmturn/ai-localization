// __APP_SPLIT_LOADER__
// This file loads split parts in order. It is intentionally NOT an ES module
// so that opening index.html via file:// keeps working.
(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.services = App.services || {};
  App.parsers = App.parsers || {};
  App.features = App.features || {};
  App.ui = App.ui || {};

  var scripts = [
    "app/core/state.js",
    "app/core/utils.js",
    "app/core/dom-cache.js",
    "app/core/dev-tools.js",
    // 错误处理系统 - 按依赖顺序加载
    "app/core/error-manager.js",
    "app/core/error-utils.js",
    "app/core/error-integration.js", // 新增：错误系统集成器
    "app/services/security-utils.js",
    "app/services/storage/storage-manager.js",
    "app/services/storage/error-handler.js",
    "app/core/event-manager.js",
    "app/services/auto-save-manager.js",
    "app/network/network-utils.js",
    "app/network/error-handler.js",
    "app/features/files/error-handler.js", // 新增：文件错误处理器
    "app/features/translations/error-handler.js", // 新增：翻译错误处理器
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
    "app/services/translation-service.js",
    "app/parsers/xml-generic.js",
    "app/parsers/xml-android.js",
    "app/parsers/xliff.js",
    "app/parsers/qt-ts.js",
    "app/parsers/ios-strings.js",
    "app/parsers/resx.js",
    "app/parsers/po.js",
    "app/parsers/json.js",
    "app/parsers/text.js",
    "app/ui/file-tree.js",
    "app/ui/notification.js",
    "app/features/files/read.js",
    "app/features/files/parse.js",
    "app/features/files/process.js",
    "app/features/files/error-handler.js",
    "app/compat/files.js",
    "app/ui/perf/sync-heights.js",
    "app/compat/perf.js",
    "app/features/translations/status.js",
    "app/features/translations/render.js",
    "app/features/translations/search.js",
    "app/features/translations/selection.js",
    "app/features/translations/actions.js",
    "app/features/translations/error-handler.js",
    "app/features/translations/export/shared.js",
    "app/features/translations/export/ui.js",
    "app/features/translations/export/project.js",
    "app/features/translations/export/terminology-list.js",
    "app/ui/charts.js",
    "app/compat/quality.js",
    "app/features/terminology/init.js",
    "app/features/projects/manager.js",
    "app/features/sample/sample-project.js",
    "app/ui/engine-model-sync.js",
    "app/ui/event-listeners/keyboard.js",
    "app/ui/event-listeners/translations-lists.js",
    "app/ui/event-listeners/file-panels.js",
    "app/ui/event-listeners/terminology.js",
    "app/ui/event-listeners/settings.js",
    "app/ui/event-listeners/translations-search.js",
    "app/ui/event-listeners/data-and-ui.js",
    "app/ui/event-listeners/quality.js",
    "app/ui/event-listeners.js",
    "app/ui/settings.js",
    "app/ui/file-drop.js",
    "app/core/bootstrap.js",
  ];

  // 开发模式下加载测试和演示代码
  if (typeof isDevelopment !== 'undefined' && isDevelopment) {
    // 开发模式下加载错误处理相关的开发工具与示例
    scripts.push(
      "app/dev-tools/error-demo.js",
      "app/dev-tools/error-test.js",
      "app/dev-tools/error-system-test.js",
      "app/dev-tools/error-handling-examples.js"
    );
  } else {
    // 生产模式下加载精简版监控工具
    scripts.push("app/core/error-production.js");
  }

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
    window.__appScriptSuffix = suffix;
  } catch (e) {}

  function bootstrapWhenReady() {
    function run() {
      try {
        if (typeof window.__appBootstrap === "function") {
          Promise.resolve(window.__appBootstrap()).catch(function (e) {
            console.error("App bootstrap failed:", e);
          });
        } else {
          console.error("App bootstrap entry not found: window.__appBootstrap");
        }
      } catch (e) {
        console.error("App bootstrap threw:", e);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }
  }

  function loadAt(i) {
    if (i >= scripts.length) {
      bootstrapWhenReady();
      return;
    }
    var s = document.createElement("script");
    s.src = scripts[i] + suffix;
    s.async = false;
    s.onload = function () {
      loadAt(i + 1);
    };
    s.onerror = function () {
      console.error("Failed to load script:", s.src);
    };
    document.head.appendChild(s);
  }

  loadAt(0);
})();
