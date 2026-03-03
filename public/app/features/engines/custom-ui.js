// ==================== 自定义引擎配置 UI ====================

var CustomEngineUI = (function () {
  var _editingId = null; // null = 新增, string = 编辑

  // ==================== 初始化 ====================

  function init() {
    var openBtn = document.getElementById("openCustomEngineBtn");
    var addNewBtn = document.getElementById("ceAddNewBtn");
    var cancelFormBtn = document.getElementById("ceCancelFormBtn");
    var saveFormBtn = document.getElementById("ceSaveFormBtn");

    if (openBtn) {
      EventManager.add(openBtn, "click", function () {
        openModal("customEngineModal");
        _loadList();
      });
    }

    if (addNewBtn) {
      EventManager.add(addNewBtn, "click", function () {
        _showForm(null);
      });
    }

    if (cancelFormBtn) {
      EventManager.add(cancelFormBtn, "click", _hideForm);
    }

    if (saveFormBtn) {
      EventManager.add(saveFormBtn, "click", _saveForm);
    }
  }

  // ==================== 列表渲染 ====================

  function _loadList() {
    var listEl = document.getElementById("ceEngineList");
    var badge = document.getElementById("customEngineCountBadge");
    if (!listEl) return;

    var engines = typeof CustomEngineManager !== "undefined"
      ? CustomEngineManager.getAll()
      : [];

    if (badge) badge.textContent = engines.length > 0 ? engines.length + " 个" : "";

    if (engines.length === 0) {
      listEl.innerHTML = '<div class="text-center py-4 text-gray-400 dark:text-gray-500 text-sm">' +
        '<i class="fa-solid fa-plug text-xl mb-1 block opacity-30"></i>暂无自定义引擎</div>';
      return;
    }

    var html = engines.map(function (engine) {
      var engineId = engine.id.startsWith("custom-") ? engine.id : "custom-" + engine.id;
      var urlShort = (engine.apiUrl || "").replace(/^https?:\/\//, "").substring(0, 50);
      return '<div class="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900/50">' +
        '<div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">' +
          '<i class="fa-solid fa-plug text-xs text-green-600 dark:text-green-400"></i>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-sm font-medium text-gray-800 dark:text-gray-100">' + _escapeHtml(engine.name || engineId) + '</div>' +
          '<div class="text-xs text-gray-400 dark:text-gray-500 truncate">' + _escapeHtml(urlShort) + (engine.model ? ' · ' + _escapeHtml(engine.model) : '') + '</div>' +
        '</div>' +
        '<button class="p-1.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors" data-ce-edit="' + _escapeHtml(engineId) + '" title="编辑">' +
          '<i class="fa-solid fa-pen text-xs"></i>' +
        '</button>' +
        '<button class="p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors" data-ce-delete="' + _escapeHtml(engineId) + '" title="删除">' +
          '<i class="fa-solid fa-trash text-xs"></i>' +
        '</button>' +
      '</div>';
    }).join("");

    listEl.innerHTML = html;

    // 绑定编辑/删除按钮
    listEl.querySelectorAll("[data-ce-edit]").forEach(function (btn) {
      EventManager.add(btn, "click", function () {
        var id = btn.getAttribute("data-ce-edit");
        var engine = engines.find(function (e) {
          return (e.id.startsWith("custom-") ? e.id : "custom-" + e.id) === id;
        });
        if (engine) _showForm(engine);
      });
    });

    listEl.querySelectorAll("[data-ce-delete]").forEach(function (btn) {
      EventManager.add(btn, "click", function () {
        var id = btn.getAttribute("data-ce-delete");
        _deleteEngine(id);
      });
    });
  }

  // ==================== 表单 ====================

  function _showForm(engine) {
    _editingId = engine ? (engine.id.startsWith("custom-") ? engine.id : "custom-" + engine.id) : null;
    var formEl = document.getElementById("ceFormSection");
    var titleEl = document.getElementById("ceFormTitle");
    if (!formEl) return;

    // 填充表单字段
    var fieldId = document.getElementById("ceFieldId");
    var fieldName = document.getElementById("ceFieldName");
    var fieldUrl = document.getElementById("ceFieldUrl");
    var fieldModel = document.getElementById("ceFieldModel");
    var fieldMaxTokens = document.getElementById("ceFieldMaxTokens");
    var fieldRequiresKey = document.getElementById("ceFieldRequiresKey");

    if (engine) {
      if (titleEl) titleEl.textContent = "编辑引擎";
      var rawId = engine.id.replace(/^custom-/, "");
      if (fieldId) { fieldId.value = rawId; fieldId.disabled = true; }
      if (fieldName) fieldName.value = engine.name || "";
      if (fieldUrl) fieldUrl.value = engine.apiUrl || "";
      if (fieldModel) fieldModel.value = engine.model || "";
      if (fieldMaxTokens) fieldMaxTokens.value = engine.maxTokens || 4096;
      if (fieldRequiresKey) fieldRequiresKey.checked = !!engine.requiresApiKey;
    } else {
      if (titleEl) titleEl.textContent = "添加引擎";
      if (fieldId) { fieldId.value = ""; fieldId.disabled = false; }
      if (fieldName) fieldName.value = "";
      if (fieldUrl) fieldUrl.value = "";
      if (fieldModel) fieldModel.value = "";
      if (fieldMaxTokens) fieldMaxTokens.value = 4096;
      if (fieldRequiresKey) fieldRequiresKey.checked = false;
    }

    formEl.classList.remove("hidden");
    if (fieldId && !fieldId.disabled) fieldId.focus();
  }

  function _hideForm() {
    var formEl = document.getElementById("ceFormSection");
    if (formEl) formEl.classList.add("hidden");
    _editingId = null;

    var fieldId = document.getElementById("ceFieldId");
    if (fieldId) fieldId.disabled = false;
  }

  function _saveForm() {
    var fieldId = document.getElementById("ceFieldId");
    var fieldName = document.getElementById("ceFieldName");
    var fieldUrl = document.getElementById("ceFieldUrl");
    var fieldModel = document.getElementById("ceFieldModel");
    var fieldMaxTokens = document.getElementById("ceFieldMaxTokens");
    var fieldRequiresKey = document.getElementById("ceFieldRequiresKey");

    var rawId = (fieldId && fieldId.value.trim()) || (_editingId ? _editingId.replace(/^custom-/, "") : "");
    var apiUrl = fieldUrl && fieldUrl.value.trim();

    if (!rawId) {
      _fieldError(fieldId, "引擎 ID 不能为空");
      return;
    }
    if (!apiUrl) {
      _fieldError(fieldUrl, "API 端点 URL 不能为空");
      return;
    }

    var config = {
      id: rawId,
      name: (fieldName && fieldName.value.trim()) || rawId,
      apiUrl: apiUrl,
      model: (fieldModel && fieldModel.value.trim()) || "",
      maxTokens: parseInt((fieldMaxTokens && fieldMaxTokens.value) || "4096", 10),
      requiresApiKey: !!(fieldRequiresKey && fieldRequiresKey.checked),
    };

    var ok = typeof CustomEngineManager !== "undefined"
      ? CustomEngineManager.add(config)
      : false;

    if (ok) {
      _hideForm();
      _loadList();
      _syncEngineSelectDropdown();
      if (typeof showNotification === "function") {
        showNotification("success", "已保存", "自定义引擎 custom-" + rawId + " 已注册");
      }
    } else {
      if (typeof showNotification === "function") {
        showNotification("error", "保存失败", "请检查 ID 和 URL 是否填写正确");
      }
    }
  }

  function _deleteEngine(engineId) {
    if (!confirm("\u786e\u5b9a\u8981\u5220\u9664\u5f15\u64ce [" + engineId + "] \u5417\uff1f")) return;
    if (typeof CustomEngineManager !== "undefined") {
      CustomEngineManager.remove(engineId);
    }
    _loadList();
    _syncEngineSelectDropdown();
    if (typeof showNotification === "function") {
      showNotification("success", "已删除", "引擎 " + engineId + " 已移除");
    }
  }

  // 同步侧边栏引擎下拉选项
  function _syncEngineSelectDropdown() {
    var select = document.getElementById("sidebarTranslationEngine");
    if (!select || typeof CustomEngineManager === "undefined") return;
    var engines = CustomEngineManager.getAll();

    // 移除旧的自定义选项
    var toRemove = [];
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value.startsWith("custom-")) {
        toRemove.push(select.options[i]);
      }
    }
    toRemove.forEach(function (opt) { select.removeChild(opt); });

    // 添加新的自定义选项
    engines.forEach(function (engine) {
      var opt = document.createElement("option");
      opt.value = engine.id.startsWith("custom-") ? engine.id : "custom-" + engine.id;
      opt.textContent = engine.name || opt.value;
      select.appendChild(opt);
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

  function _fieldError(el, msg) {
    if (!el) return;
    el.classList.add("border-red-500");
    el.focus();
    setTimeout(function () { el.classList.remove("border-red-500"); }, 2000);
    if (typeof showNotification === "function") {
      showNotification("warning", "输入错误", msg);
    }
  }

  // ==================== 公共 ====================

  return {
    init: init,
    syncDropdown: _syncEngineSelectDropdown,
  };
})();

window.CustomEngineUI = CustomEngineUI;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { CustomEngineUI.init(); });
} else {
  setTimeout(function () { CustomEngineUI.init(); }, 0);
}
