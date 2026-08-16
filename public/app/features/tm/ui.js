// ==================== 翻译记忆库管理 UI ====================

var TMManagerUI = (function () {
  var _currentEntries = [];
  var _searchQuery = "";

  // ==================== 初始化 ====================

  function init() {
    var openBtn = document.getElementById("openTMManagerBtn");
    var refreshBtn = document.getElementById("tmRefreshBtn");
    var searchBtn = document.getElementById("tmSearchBtn");
    var searchInput = document.getElementById("tmSearchInput");
    var exportBtn = document.getElementById("tmExportBtn");
    var clearBtn = document.getElementById("tmClearBtn");

    if (openBtn) {
      EventManager.add(openBtn, "click", function () {
        openModal("tmManagerModal");
        _loadStats();
        _loadEntries();
      });
    }

    if (refreshBtn) {
      EventManager.add(refreshBtn, "click", function () {
        _loadStats();
        _loadEntries();
      });
    }

    if (searchBtn) {
      EventManager.add(searchBtn, "click", function () {
        _searchQuery = (searchInput && searchInput.value.trim()) || "";
        _loadEntries();
      });
    }

    if (searchInput) {
      EventManager.add(searchInput, "keydown", function (e) {
        if (e.key === "Enter") {
          _searchQuery = searchInput.value.trim();
          _loadEntries();
        }
      });
    }

    if (exportBtn) {
      EventManager.add(exportBtn, "click", _exportTMX);
    }

    if (clearBtn) {
      EventManager.add(clearBtn, "click", _clearAll);
    }
  }

  // ==================== 数据加载 ====================

  function _loadStats() {
    if (typeof TranslationMemory === "undefined") return;
    TranslationMemory.getStats().then(function (stats) {
      var totalEl = document.getElementById("tmTotalCount");
      var langEl = document.getElementById("tmLangStats");
      var badgeEl = document.getElementById("tmCountBadge");

      if (totalEl) totalEl.textContent = stats.total;
      if (badgeEl) badgeEl.textContent = stats.total > 0 ? stats.total + " 条" : "";
      if (langEl) {
        if (stats.languages.length > 0) {
          var pairs = [];
          for (var i = 0; i < stats.languages.length - 1; i += 2) {
            pairs.push(stats.languages[i] + " → " + stats.languages[i + 1]);
          }
          langEl.textContent = "语言: " + (pairs.join(", ") || stats.languages.join(", "));
        } else {
          langEl.textContent = "语言对: —";
        }
      }
    }).catch(function (e) {
      (loggers.storage || console).debug("TMManagerUI loadStats:", e);
    });
  }

  function _loadEntries() {
    var listEl = document.getElementById("tmEntryList");
    if (!listEl) return;

    if (typeof TranslationMemory === "undefined") {
      listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">翻译记忆库不可用</div>';
      return;
    }

    listEl.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>加载中…</div>';

    var query = _searchQuery.toLowerCase();

    TranslationMemory.getStats().then(function () {
      // 通过 fuzzyMatch 或全量扫描获取条目
      // 因为 TM 没有直接"列出所有"API，用内部 IndexedDB 方式
      return _getAllEntries();
    }).then(function (entries) {
      _currentEntries = entries;
      if (query) {
        entries = entries.filter(function (e) {
          return e.sourceText.toLowerCase().includes(query) || e.targetText.toLowerCase().includes(query);
        });
      }
      _renderEntries(entries, listEl);
    }).catch(function (e) {
      listEl.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">加载失败: ' + (e && e.message || e) + '</div>';
    });
  }

  function _getAllEntries() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("translation-memory-db", 1);
      req.onsuccess = function (event) {
        var db = event.target.result;
        try {
          var tx = db.transaction("entries", "readonly");
          var store = tx.objectStore("entries");
          var getAllReq = store.getAll();
          getAllReq.onsuccess = function () {
            resolve(getAllReq.result || []);
          };
          getAllReq.onerror = function () { reject(getAllReq.error); };
        } catch (e) {
          reject(e);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function _renderEntries(entries, listEl) {
    if (!entries || entries.length === 0) {
      listEl.innerHTML = '<div class="text-center py-8 text-gray-400 dark:text-gray-500 text-sm"><i class="fa-solid fa-brain text-2xl mb-2 block opacity-30"></i>' +
        (_searchQuery ? "未找到匹配的记忆条目" : "记忆库为空，翻译后自动保存") + '</div>';
      return;
    }

    var html = entries.slice(0, 200).map(function (entry, idx) {
      var srcEscaped = _escapeHtml(entry.sourceText || "");
      var tgtEscaped = _escapeHtml(entry.targetText || "");
      var langBadge = '<span class="text-xs text-gray-400">' + _escapeHtml(entry.sourceLang || "?") + " → " + _escapeHtml(entry.targetLang || "?") + '</span>';
      var engineBadge = entry.engine ? '<span class="ml-2 text-xs text-gray-400 dark:text-gray-500">' + _escapeHtml(entry.engine) + '</span>' : "";
      var dateStr = entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : "";

      return '<div class="border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900/50 group">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2 mb-1">' + langBadge + engineBadge +
              '<span class="ml-auto text-xs text-gray-300 dark:text-gray-600">' + dateStr + '</span>' +
            '</div>' +
            '<div class="text-sm text-gray-800 dark:text-gray-100 mb-1 line-clamp-2">' + srcEscaped + '</div>' +
            '<div class="text-sm text-blue-700 dark:text-blue-300 line-clamp-2">' + tgtEscaped + '</div>' +
          '</div>' +
          '<button class="flex-shrink-0 p-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" data-tm-delete="' + (entry.id || idx) + '" title="删除此条目">' +
            '<i class="fa-solid fa-trash text-xs"></i>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join("");

    if (entries.length > 200) {
      html += '<div class="text-center py-2 text-xs text-gray-400">仅显示前 200 条，使用搜索缩小范围</div>';
    }

    listEl.innerHTML = html;

    // 绑定删除按钮
    var deleteBtns = listEl.querySelectorAll("[data-tm-delete]");
    deleteBtns.forEach(function (btn) {
      EventManager.add(btn, "click", function () {
        var id = parseInt(btn.getAttribute("data-tm-delete"), 10);
        _deleteEntry(id);
      });
    });
  }

  function _deleteEntry(id) {
    var req = indexedDB.open("translation-memory-db", 1);
    req.onsuccess = function (event) {
      var db = event.target.result;
      var tx = db.transaction("entries", "readwrite");
      var store = tx.objectStore("entries");
      store.delete(id);
      tx.oncomplete = function () {
        _loadStats();
        _loadEntries();
      };
    };
  }

  // ==================== 导出 / 清空 ====================

  function _exportTMX() {
    if (typeof TranslationMemory === "undefined") return;
    TranslationMemory.exportTMX().then(function (xml) {
      var blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "translation-memory-" + new Date().toISOString().slice(0, 10) + ".tmx";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      if (typeof showNotification === "function") {
        showNotification("success", "导出成功", "翻译记忆库已导出为 TMX 格式");
      }
    }).catch(function (e) {
      if (typeof showNotification === "function") {
        showNotification("error", "导出失败", e && e.message || String(e));
      }
    });
  }

  async function _clearAll() {
    const ok = await showConfirmDialog({
      title: "清空翻译记忆",
      message: "确定要清空所有翻译记忆吗？此操作无法撤销。",
      confirmText: "清空",
      danger: true,
    });
    if (!ok) return;
    if (typeof TranslationMemory === "undefined") return;
    TranslationMemory.clear().then(function () {
      _loadStats();
      _loadEntries();
      if (typeof showNotification === "function") {
        showNotification("success", "已清空", "翻译记忆库已清空");
      }
    });
  }

  // ==================== 工具 ====================

  function _escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ==================== 公共 ====================

  return {
    init: init,
    refresh: function () {
      _loadStats();
      _loadEntries();
    },
  };
})();

window.TMManagerUI = TMManagerUI;

// DOM 加载后自动初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { TMManagerUI.init(); });
} else {
  setTimeout(function () { TMManagerUI.init(); }, 0);
}
