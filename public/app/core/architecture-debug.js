(function () {
  'use strict';

  function ensurePath(root, path) {
    var cur = root;
    for (var i = 0; i < path.length; i++) {
      var key = path[i];
      if (!cur[key]) cur[key] = {};
      cur = cur[key];
    }
    return cur;
  }

  var App = (window.App = window.App || {});
  var debug = ensurePath(App, ['architecture', 'debug']);

  if (!debug.flags) debug.flags = {};

  function defaultWindowKey(name) {
    return '__' + name;
  }

  function setWindowFlag(windowKey, value) {
    try {
      window[windowKey] = value;
    } catch (_) {}
  }

  function getWindowFlag(windowKey) {
    try {
      return window[windowKey];
    } catch (_) {
      return undefined;
    }
  }

  debug.setFlag = function (name, value, options) {
    options = options || {};
    var mirrorWindow = options.mirrorWindow !== false;
    var windowKey = options.windowKey || defaultWindowKey(name);

    debug.flags[name] = value;

    if (mirrorWindow) {
      setWindowFlag(windowKey, value);
    }

    return value;
  };

  debug.getFlag = function (name, options) {
    options = options || {};
    var windowKey = options.windowKey || defaultWindowKey(name);

    if (Object.prototype.hasOwnProperty.call(debug.flags, name)) {
      return debug.flags[name];
    }

    if (options.fallbackWindow !== false) {
      return getWindowFlag(windowKey);
    }

    return undefined;
  };

  debug.once = function (name, fn, options) {
    var already = !!debug.getFlag(name, options);
    if (already) return;

    debug.setFlag(name, true, options);

    if (typeof fn === 'function') {
      return fn();
    }
  };

  try {
    if (!Object.prototype.hasOwnProperty.call(debug.flags, 'appScriptSuffix')) {
      var legacySuffix = getWindowFlag('__appScriptSuffix');
      var appSuffix =
        legacySuffix !== undefined
          ? legacySuffix
          : (function () {
              try {
                var App = window.App;
                return App ? App.__appScriptSuffix : undefined;
              } catch (_) {
                return undefined;
              }
            })();

      if (appSuffix !== undefined) {
        debug.setFlag('appScriptSuffix', appSuffix, {
          mirrorWindow: false,
        });
      }
    }

    if (!Object.prototype.hasOwnProperty.call(debug.flags, 'appBasePath')) {
      try {
        var App0 = window.App;
        var bp = App0 ? App0.__appBasePath : undefined;
        if (typeof bp === 'string') {
          debug.setFlag('appBasePath', bp, {
            mirrorWindow: false,
          });
        }
      } catch (_) {}
    }

    try {
      delete window.__appScriptSuffix;
    } catch (_) {
      window.__appScriptSuffix = undefined;
    }

    if (getWindowFlag('__appScriptSuffix') !== undefined) {
      setWindowFlag('__appScriptSuffix', undefined);
    }

    try {
      if (window.App && window.App.__appScriptSuffix !== undefined) {
        try {
          delete window.App.__appScriptSuffix;
        } catch (_) {
          window.App.__appScriptSuffix = undefined;
        }
      }
    } catch (_) {}

    try {
      if (window.App && window.App.__appBasePath !== undefined) {
        try {
          delete window.App.__appBasePath;
        } catch (_) {
          window.App.__appBasePath = undefined;
        }
      }
    } catch (_) {}
  } catch (_) {}

  debug.snapshot = function () {
    return {
      timestamp: new Date().toISOString(),
      flags: Object.assign({}, debug.flags),
    };
  };

  window.ArchDebug = debug;

  if (window.namespaceManager && typeof window.namespaceManager.addToNamespace === 'function') {
    try {
      var ns =
        typeof window.namespaceManager.getNamespace === 'function'
          ? window.namespaceManager.getNamespace('App.architecture')
          : null;

      if (ns && !('debug' in ns)) {
        window.namespaceManager.addToNamespace('App.architecture', 'debug', debug);
      }
    } catch (_) {}
  }
})();
