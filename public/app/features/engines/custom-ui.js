// ==================== 自定义引擎配置 UI ====================

var CustomEngineUI = (function () {
  var _editingId = null; // null = 新增, string = 编辑
  var _modalObserver = null;

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

    var requiresKey = document.getElementById("ceFieldRequiresKey");
    if (requiresKey) {
      EventManager.add(requiresKey, "change", _syncApiKeyField);
    }

    var modal = document.getElementById("customEngineModal");
    if (modal) {
      modal.querySelectorAll(".close-modal").forEach(function (btn) {
        EventManager.add(btn, "click", _hideForm, {
          tag: "custom-engine",
          scope: "customEngineModal",
          label: "customEngineModalClose:click",
        });
      });
      if (typeof MutationObserver !== "undefined" && !_modalObserver) {
        _modalObserver = new MutationObserver(function () {
          if (modal.classList.contains("hidden")) {
            _hideForm();
          }
        });
        _modalObserver.observe(modal, { attributes: true, attributeFilter: ["class"] });
      }
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
      var engineId = _normalizeCustomEngineId(engine.id);
      var urlShort = (engine.apiUrl || "").replace(/^https?:\/\//, "").substring(0, 50);
      return '<div class="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900/50">' +
        '<div class="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">' +
          '<i class="fa-solid fa-plug text-xs text-green-600 dark:text-green-400"></i>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title="' + _escapeHtml(engine.name || engineId) + '">' + _escapeHtml(engine.name || engineId) + '</div>' +
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
          return _normalizeCustomEngineId(e.id) === id;
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
    _editingId = engine ? _normalizeCustomEngineId(engine.id) : null;
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
    var fieldSupportsJsonMode = document.getElementById("ceFieldSupportsJsonMode");
    var fieldApiKey = document.getElementById("ceFieldApiKey");

    if (engine) {
      if (titleEl) titleEl.textContent = "编辑引擎";
      var rawId = _normalizeCustomEngineId(engine.id).replace(/^custom-/, "");
      if (fieldId) { fieldId.value = rawId; fieldId.disabled = true; }
      if (fieldName) fieldName.value = engine.name || "";
      if (fieldUrl) fieldUrl.value = engine.apiUrl || "";
      if (fieldModel) fieldModel.value = engine.model || "";
      if (fieldMaxTokens) fieldMaxTokens.value = engine.maxTokens || 4096;
      if (fieldRequiresKey) fieldRequiresKey.checked = !!engine.requiresApiKey;
      if (fieldApiKey) fieldApiKey.value = "";
      // supportsJsonMode 未显式设置时默认 true，保持与旧配置起有一致
      if (fieldSupportsJsonMode) fieldSupportsJsonMode.checked = engine.supportsJsonMode !== false;
    } else {
      if (titleEl) titleEl.textContent = "添加引擎";
      if (fieldId) { fieldId.value = ""; fieldId.disabled = false; }
      if (fieldName) fieldName.value = "";
      if (fieldUrl) fieldUrl.value = "";
      if (fieldModel) fieldModel.value = "";
      if (fieldMaxTokens) fieldMaxTokens.value = 4096;
      if (fieldRequiresKey) fieldRequiresKey.checked = false;
      if (fieldApiKey) fieldApiKey.value = "";
      if (fieldSupportsJsonMode) fieldSupportsJsonMode.checked = true;
    }

    _syncApiKeyField();
    formEl.classList.remove("hidden");
    if (fieldId && !fieldId.disabled) fieldId.focus();
  }

  function _hideForm() {
    var formEl = document.getElementById("ceFormSection");
    if (formEl) formEl.classList.add("hidden");
    _editingId = null;

    var fieldId = document.getElementById("ceFieldId");
    if (fieldId) fieldId.disabled = false;
    if (fieldId) fieldId.value = "";
    var fieldName = document.getElementById("ceFieldName");
    if (fieldName) fieldName.value = "";
    var fieldUrl = document.getElementById("ceFieldUrl");
    if (fieldUrl) fieldUrl.value = "";
    var fieldModel = document.getElementById("ceFieldModel");
    if (fieldModel) fieldModel.value = "";
    var fieldMaxTokens = document.getElementById("ceFieldMaxTokens");
    if (fieldMaxTokens) fieldMaxTokens.value = 4096;
    var fieldRequiresKey = document.getElementById("ceFieldRequiresKey");
    if (fieldRequiresKey) fieldRequiresKey.checked = false;
    var fieldApiKey = document.getElementById("ceFieldApiKey");
    if (fieldApiKey) fieldApiKey.value = "";
    var fieldSupportsJsonMode = document.getElementById("ceFieldSupportsJsonMode");
    if (fieldSupportsJsonMode) fieldSupportsJsonMode.checked = true;
    _syncApiKeyField();
  }

  async function _saveForm() {
    var fieldId = document.getElementById("ceFieldId");
    var fieldName = document.getElementById("ceFieldName");
    var fieldUrl = document.getElementById("ceFieldUrl");
    var fieldModel = document.getElementById("ceFieldModel");
    var fieldMaxTokens = document.getElementById("ceFieldMaxTokens");
    var fieldRequiresKey = document.getElementById("ceFieldRequiresKey");
    var fieldSupportsJsonMode = document.getElementById("ceFieldSupportsJsonMode");
    var fieldApiKey = document.getElementById("ceFieldApiKey");

    var rawId = ((fieldId && fieldId.value.trim()) || (_editingId ? _editingId.replace(/^custom-/, "") : "")).replace(/^custom-/i, "").toLowerCase();
    var apiUrl = fieldUrl && fieldUrl.value.trim();
    var modelName = (fieldModel && fieldModel.value.trim()) || "";
    var requiresApiKey = !!(fieldRequiresKey && fieldRequiresKey.checked);
    var engineId = "custom-" + rawId;
    var apiKeyField = "customApiKey_" + engineId;
    var apiKey = (fieldApiKey && fieldApiKey.value.trim()) || "";
    var existingSettings = typeof SettingsCache !== "undefined" ? SettingsCache.get() : {};

    if (!rawId) {
      _fieldError(fieldId, "引擎 ID 不能为空");
      return;
    }
    if (!apiUrl) {
      _fieldError(fieldUrl, "API 端点 URL 不能为空");
      return;
    }
    // 模型必填：大多数 OpenAI 兼容端点在 model 为空时返回 400 “model is required”
    if (!modelName) {
      _fieldError(fieldModel, "模型名称不能为空（例如 llama3、qwen2.5）");
      return;
    }
    if (requiresApiKey && !apiKey && !(existingSettings && existingSettings[apiKeyField])) {
      _fieldError(fieldApiKey, "请填写自定义引擎 API Key，或取消勾选需要 API Key");
      return;
    }

    var config = {
      id: rawId,
      name: (fieldName && fieldName.value.trim()) || rawId,
      apiUrl: apiUrl,
      model: modelName,
      maxTokens: parseInt((fieldMaxTokens && fieldMaxTokens.value) || "4096", 10),
      requiresApiKey: requiresApiKey,
      // 记录用户选择；默认 true 保持向后兼容
      supportsJsonMode: fieldSupportsJsonMode ? !!fieldSupportsJsonMode.checked : true,
    };

    var pendingSettings = null;
    var originalSettings = null;
    try {
      originalSettings = typeof SettingsCache !== "undefined" ? Object.assign({}, SettingsCache.get() || {}) : null;
      pendingSettings = await _prepareCustomApiKeySettings(engineId, apiKey, requiresApiKey);
      if (pendingSettings) {
        SettingsCache.save(pendingSettings);
      }
    } catch (e) {
      if (typeof showNotification === "function") {
        showNotification("error", "保存失败", "API Key 加密保存失败");
      }
      return;
    }

    var ok = typeof CustomEngineManager !== "undefined"
      ? CustomEngineManager.add(config)
      : false;

    if (ok) {
      _hideForm();
      _loadList();
      _syncEngineSelectDropdown(engineId);
      if (typeof showNotification === "function") {
        showNotification("success", "已保存", "自定义引擎 " + engineId + " 已注册");
      }
    } else {
      if (pendingSettings && originalSettings) {
        try { SettingsCache.save(originalSettings); } catch (e) {}
      }
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
    _removeCustomApiKey(engineId);
    _loadList();
    _syncEngineSelectDropdown();
    if (typeof showNotification === "function") {
      showNotification("success", "已删除", "引擎 " + engineId + " 已移除");
    }
  }

  // 同步侧边栏引擎下拉选项
  function _syncEngineSelectDropdown(preferredEngine) {
    if (typeof window.refreshEngineModelSelectors === "function") {
      window.refreshEngineModelSelectors(preferredEngine);
      return;
    }
    if (typeof EngineRegistry === "undefined") return;
    var target = preferredEngine && EngineRegistry.has(preferredEngine)
      ? preferredEngine
      : EngineRegistry.getDefaultEngineId();
    ["translationEngine", "sidebarTranslationEngine", "defaultEngine"].forEach(function (id) {
      var select = document.getElementById(id);
      if (!select) return;
      select.replaceChildren();
      var engines = EngineRegistry.getByCategory("ai");
      engines.forEach(function (engine) {
        var opt = document.createElement("option");
        opt.value = engine.id;
        opt.textContent = engine.name;
        select.appendChild(opt);
      });
      if (Array.from(select.options).some(function (opt) { return opt.value === target; })) {
        select.value = target;
      }
      select.dispatchEvent(new Event("change"));
    });
  }

  function _normalizeCustomEngineId(id) {
    var s = String(id || "").trim().toLowerCase();
    return s.indexOf("custom-") === 0 ? s : "custom-" + s;
  }

  function _syncApiKeyField() {
    var requiresKey = document.getElementById("ceFieldRequiresKey");
    var row = document.getElementById("ceApiKeyFieldRow");
    var field = document.getElementById("ceFieldApiKey");
    var enabled = !!(requiresKey && requiresKey.checked);
    if (row) row.classList.toggle("hidden", !enabled);
    if (field) {
      field.disabled = !enabled;
      if (!enabled) field.value = "";
    }
  }

  async function _prepareCustomApiKeySettings(engineId, apiKey, requiresApiKey) {
    if (typeof SettingsCache === "undefined") {
      if (requiresApiKey && apiKey) throw new Error("SettingsCache unavailable");
      return null;
    }
    var settings = Object.assign({}, SettingsCache.get() || {});
    var apiKeyField = "customApiKey_" + _normalizeCustomEngineId(engineId);
    if (!requiresApiKey) {
      delete settings[apiKeyField];
      return settings;
    }
    if (apiKey) {
      settings[apiKeyField] = typeof securityUtils !== "undefined" && typeof securityUtils.encrypt === "function"
        ? await securityUtils.encrypt(apiKey)
        : apiKey;
      return settings;
    }
    return null;
  }

  function _removeCustomApiKey(engineId) {
    if (typeof SettingsCache === "undefined") return;
    var settings = Object.assign({}, SettingsCache.get() || {});
    var apiKeyField = "customApiKey_" + _normalizeCustomEngineId(engineId);
    if (settings[apiKeyField]) {
      delete settings[apiKeyField];
      SettingsCache.save(settings);
    }
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
