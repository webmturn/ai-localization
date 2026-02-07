// Compatibility shim: load split export modules in order
(function () {
  try {
    var shimLoaded = window.ArchDebug
      ? window.ArchDebug.getFlag('translationsExportShimLoaded')
      : window.__translationsExportShimLoaded;
    if (shimLoaded) return;

    if (window.ArchDebug) {
      window.ArchDebug.setFlag('translationsExportShimLoaded', true, {
        mirrorWindow: false,
      });
    } else {
      window.__translationsExportShimLoaded = true;
    }
  } catch (_) {
    try {
      if (window.ArchDebug) {
        var shimLoaded2 = window.ArchDebug.getFlag('translationsExportShimLoaded');
        if (shimLoaded2) return;
        window.ArchDebug.setFlag('translationsExportShimLoaded', true, {
          mirrorWindow: false,
        });
        return;
      }
    } catch (_) {
      (loggers.app || console).debug("translations export ArchDebug check:", _);
    }
    try {
      if (!window.ArchDebug) {
        if (window.__translationsExportShimLoaded) return;
        window.__translationsExportShimLoaded = true;
      }
    } catch (_) {
      (loggers.app || console).debug("translations export shim check:", _);
    }
  }

  var base = "app/features/translations/export/";
  var parts = [
    "shared.js",
    "ui.js",
    "translation-formats.js",
    "translation-original.js",
    "translation-entry.js",
    "project.js",
    "terminology-list.js",
    "terminology-import.js",
    "terminology-export.js",
  ];

  function getSuffix() {
    var suffix = "";
    try {
      var cs = document.currentScript && document.currentScript.src;
      if (cs) {
        var u = new URL(cs, window.location.href);
        var v = u.searchParams.get("v");
        if (v) suffix = "?v=" + encodeURIComponent(v);
      }
    } catch (e) {
      // URL parse guard - safe to ignore
    }
    return suffix;
  }

  var suffix = getSuffix();

  function loadAt(i) {
    if (i >= parts.length) return;

    var s = document.createElement("script");
    s.src = base + parts[i] + suffix;
    s.async = false;
    s.onload = function () {
      loadAt(i + 1);
    };
    s.onerror = function (e) {
      try {
        (loggers.app || console).error("Failed to load export module:", s.src, e);
      } catch (_) { /* console.error itself failed - nothing we can do */ }
    };
    document.head.appendChild(s);
  }

  loadAt(0);
})();
