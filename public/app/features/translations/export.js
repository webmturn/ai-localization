// Compatibility shim: load split export modules in order
(function () {
  if (window.__translationsExportShimLoaded) return;
  window.__translationsExportShimLoaded = true;

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
    } catch (e) {}
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
        console.error("Failed to load export module:", s.src, e);
      } catch (_) {}
    };
    document.head.appendChild(s);
  }

  loadAt(0);
})();
