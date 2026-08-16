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

    // 从 API 获取模型列表（OpenAI 兼容 /models）
    var fetchModelsBtn = document.getElementById("ceFetchModelsBtn");
    if (fetchModelsBtn) {
      EventManager.add(fetchModelsBtn, "click", _fetchModelsFromApi, {
        tag: "custom-engine",
        scope: "customEngineModal",
        label: "ceFetchModelsBtn:click",
      });
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
    // 重置模型获取状态
    var dl = document.getElementById("ceModelDatalist");
    if (dl) dl.replaceChildren();
    var st = document.getElementById("ceFetchModelsStatus");
    if (st) {
      st.textContent = "可从 API 自动获取模型列表";
      st.classList.remove("text-red-500", "text-green-600");
      st.classList.add("text-gray-500");
    }
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

  /**
   * 从自定义引擎 API 端点获取模型列表
   * 根据填写的 API URL 推导 /models 端点（OpenAI 兼容格式），
   * 成功后填充 datalist 供模型输入框选择
   */
  async function _fetchModelsFromApi() {
    var urlInput = document.getElementById("ceFieldUrl");
    var modelInput = document.getElementById("ceFieldModel");
    var statusEl = document.getElementById("ceFetchModelsStatus");
    var btn = document.getElementById("ceFetchModelsBtn");
    var datalist = document.getElementById("ceModelDatalist");

    if (!urlInput || !urlInput.value.trim()) {
      if (statusEl) statusEl.textContent = "请先填写 API 端点 URL";
      statusEl && statusEl.classList.add("text-red-500");
      return;
    }

    if (typeof ModelFetcher === "undefined") {
      if (statusEl) statusEl.textContent = "模型列表服务未加载";
      return;
    }

    var modelsUrl = ModelFetcher.deriveModelsUrl(urlInput.value.trim());
    if (!modelsUrl) {
      if (statusEl) statusEl.textContent = "无法从该 URL 推导模型列表端点";
      return;
    }

    // 按钮 loading
    if (btn) {
      btn.disabled = true;
      var icon = btn.querySelector("i");
      if (icon) icon.className = "fa-solid fa-spinner fa-spin";
    }
    if (statusEl) {
      statusEl.textContent = "正在获取模型列表...";
      statusEl.classList.remove("text-red-500");
      statusEl.classList.add("text-gray-500");
    }

    try {
      // 用表单中的 API Key（若填写）或已保存的 Key
      var apiKeyInput = document.getElementById("ceFieldApiKey");
      var apiKey = (apiKeyInput && apiKeyInput.value.trim()) || "";
      if (!apiKey) {
        try {
          var existingSettings = (typeof SettingsCache !== "undefined" && SettingsCache.get) ? SettingsCache.get() : {};
          var savedKey = existingSettings && existingSettings["customApiKey_custom-" + _normalizeCustomEngineId(_editingId || "x").replace(/^custom-/, "")];
          if (savedKey) apiKey = savedKey;
        } catch (e) {}
      }

      // 临时构造配置请求模型列表
      var tempConfig = {
        apiUrl: urlInput.value.trim(),
        isCustom: true,
        apiKeyField: "customApiKey_tmp",
        apiKeyValidationType: apiKey ? "generic" : "none",
        customHeaders: {},
      };
      var endpoint = { url: modelsUrl };
      var result = await _fetchWithEndpoint(endpoint, tempConfig, apiKey);

      if (result && result.ok && result.models && result.models.length > 0) {
        // 填充 datalist
        if (datalist) {
          datalist.replaceChildren();
          result.models.forEach(function (m) {
            var opt = document.createElement("option");
            opt.value = m.id;
            if (m.label && m.label !== m.id) opt.textContent = m.label;
            datalist.appendChild(opt);
          });
        }
        // 未填模型时自动填入第一个
        if (modelInput && !modelInput.value.trim() && result.models[0]) {
          modelInput.value = result.models[0].id;
        }
        if (statusEl) {
          statusEl.textContent = "获取到 " + result.models.length + " 个模型，点击输入框可选择";
          statusEl.classList.remove("text-red-500");
          statusEl.classList.add("text-green-600");
        }
      } else {
        var errMsg = (result && result.error) || "获取失败";
        if (statusEl) {
          statusEl.textContent = errMsg;
          statusEl.classList.add("text-red-500");
        }
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = "获取失败: " + ((e && e.message) || e);
        statusEl.classList.add("text-red-500");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        var icon2 = btn.querySelector("i");
        if (icon2) icon2.className = "fa-solid fa-rotate";
      }
    }
  }

  /**
   * 使用给定端点发起模型列表请求（独立于 ModelFetcher.fetchModels 的轻量实现，
   * 便于在引擎尚未注册时（表单编辑阶段）直接调用）
   */
  async function _fetchWithEndpoint(endpoint, config, apiKey) {
    try {
      var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;
      var headers = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = "Bearer " + apiKey;

      var fetchFn = (typeof window !== "undefined" && window.fetch)
        ? window.fetch.bind(window)
        : (typeof globalThis !== "undefined" && globalThis.fetch ? globalThis.fetch.bind(globalThis) : null);
      if (!fetchFn) return { ok: false, error: "当前环境不支持网络请求" };

      var resp = await fetchFn(endpoint.url, {
        method: "GET",
        headers: headers,
        signal: controller ? controller.signal : undefined,
      });
      if (timer) clearTimeout(timer);

      if (!resp.ok) {
        var text = "";
        try { text = await resp.text(); } catch (e) {}
        return { ok: false, error: "HTTP " + resp.status + (text ? " " + text.slice(0, 100) : "") };
      }
      var data = await resp.json();
      var models = ModelFetcher.parseModelsResponse(data);
      if (models.length === 0) return { ok: false, error: "响应中没有模型数据" };
      models = models.filter(function (m) { return ModelFetcher.defaultModelFilter(m); });
      return { ok: true, models: models };
    } catch (e) {
      var msg = e && e.name === "AbortError" ? "请求超时（15 秒）" : ((e && e.message) || String(e));
      return { ok: false, error: msg };
    }
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
