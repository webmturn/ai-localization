// ==================== UI 初始化 ====================

/**
 * 初始化翻译引擎和模型选择器的联动逻辑
 * 功能：
 * 1. 同步工具栏和侧边栏的引擎选择
 * 2. 根据引擎类型动态显示/隐藏模型选项
 * 3. 保存用户选择到 localStorage
 */
let engineModelSyncInitialized = false;
function initEngineModelSync() {
  if (engineModelSyncInitialized) return;
  engineModelSyncInitialized = true;
  const engineSelect = DOMCache.get("translationEngine");
  const sidebarEngineSelect = DOMCache.get(
    "sidebarTranslationEngine",
  );
  const modelDiv = DOMCache.get("aiModelDiv");
  const temperatureDiv = DOMCache.get("temperatureDiv");
  const temperatureInput = DOMCache.get("temperature");
  const temperatureValue = DOMCache.get("temperatureValue");
  const modelCapabilityHint = DOMCache.get("modelCapabilityHint");

  const settingsEngineSelect = DOMCache.get("defaultEngine");
  const settingsModelSelect = DOMCache.get("translationModel");
  const settingsModelContainer = settingsModelSelect
    ? settingsModelSelect.closest("div")
    : null;
  const concurrentLimitSelect = DOMCache.get("concurrentLimit");
  const concurrentLimitHint = DOMCache.get("concurrentLimitHint");
  const translationModelHint = DOMCache.get("translationModelHint");

  if (!engineSelect || !sidebarEngineSelect) return;

  /**
   * 从 EngineRegistry 运行时解析引擎的可用模型列表
   * - 动态模型列表（ModelFetcher 从 API 拉取并缓存的）为唯一数据源
   * - 未拉取过（未配置 Key / 离线）时回退到引擎 defaultModel 单选项
   * - 自定义引擎保留用户配置的模型（config.availableModels）
   * - 无任何信息时返回空数组（UI 隐藏模型下拉并提示获取）
   */
  function _resolveEngineModels(engineId) {
    var cfg = (typeof EngineRegistry !== "undefined") ? EngineRegistry.get(engineId) : null;
    if (!cfg) return [];

    var out = [];

    // 1. 动态模型列表（ModelFetcher 从 API 获取的缓存）
    var dynamic = (typeof ModelFetcher !== "undefined")
      ? ModelFetcher.getCachedModels(engineId)
      : null;
    if (dynamic && dynamic.length > 0) {
      dynamic.forEach(function (m) {
        if (m && m.id) out.push({ value: m.id, label: m.label || m.id, source: "dynamic" });
      });
      return out;
    }

    // 2. 自定义引擎：用户显式配置的模型
    if (cfg.isCustom && Array.isArray(cfg.availableModels) && cfg.availableModels.length > 0) {
      cfg.availableModels.forEach(function (id) {
        out.push({ value: id, label: id, source: "static" });
      });
      return out;
    }

    // 3. 兜底：默认模型单选项（未获取过远程列表时保证可用）
    if (cfg.defaultModel) {
      out.push({ value: cfg.defaultModel, label: cfg.defaultModel, source: "fallback" });
    }

    return out;
  }

  function _buildModelCapabilityHint(engineId, model) {
    var cfg = EngineRegistry.get(engineId);
    if (!cfg || !model) return "选择使用的AI模型（根据当前引擎自动切换）";
    var capability = typeof EngineRegistry.getModelCapability === "function"
      ? EngineRegistry.getModelCapability(engineId, model)
      : {
        supportsJsonMode: cfg.supportsJsonMode !== false,
        supportsBatch: cfg.supportsBatch !== false,
        hints: [],
      };
    var parts = Array.isArray(capability.hints) ? capability.hints.slice() : [];
    if (capability.supportsJsonMode === false && parts.join("；").indexOf("JSON") === -1) {
      parts.push("该模型不支持强制 JSON mode，系统会自动关闭 response_format");
    }
    if (capability.supportsBatch === false) {
      parts.push("该引擎不支持批量 JSON 路径，将使用逐条翻译");
    }
    return parts.length > 0
      ? parts.join("；")
      : "选择使用的AI模型（根据当前引擎自动切换）";
  }

  function _setCapabilityHint(el, engineId, model) {
    if (!el) return;
    var text = _buildModelCapabilityHint(engineId, model);
    el.textContent = text;
    var isWarn = text.indexOf("不支持") !== -1 || text.indexOf("推理模型") !== -1;
    el.classList.toggle("text-amber-600", isWarn);
    el.classList.toggle("dark:text-amber-400", isWarn);
    el.classList.toggle("text-gray-500", !isWarn);
    el.classList.toggle("dark:text-gray-400", !isWarn);
  }

  /**
   * 温度范围跟随引擎/模型动态适配：
   * - 引擎声明的 temperatureRange（如 Claude 0-1）→ 滑杆 min/max 同步
   * - 模型能力 disablesTemperature（如 OpenAI o1/o3）→ 滑杆禁用并提示
   * - 当前值超出新范围时自动钳制并保存
   */
  function _applyTemperatureRange(engineId, modelId) {
    var cfg = (typeof EngineRegistry !== "undefined") ? EngineRegistry.get(engineId) : null;
    var range = (cfg && cfg.temperatureRange) || { min: 0, max: 2 };
    var min = Number.isFinite(range.min) ? range.min : 0;
    var max = Number.isFinite(range.max) ? range.max : 2;

    var capability = (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.getModelCapability === "function")
      ? EngineRegistry.getModelCapability(engineId, modelId)
      : null;
    var noTemperature = !!(capability && capability.disablesTemperature);

    var sliders = [
      DOMCache.get("temperature"),
      DOMCache.get("temperatureSettings"),
    ];
    var values = [
      DOMCache.get("temperatureValue"),
      DOMCache.get("temperatureSettingsValue"),
    ];
    var hints = [
      DOMCache.get("temperatureHint"),
      DOMCache.get("temperatureSettingsHint"),
    ];

    sliders.forEach(function (slider) {
      if (!slider) return;
      slider.disabled = noTemperature;
      slider.min = String(min);
      slider.max = String(max);
      slider.step = "0.1";
      // 钳制当前值
      var v = parseFloat(slider.value);
      if (!Number.isFinite(v)) v = 0.3;
      if (v < min || v > max) {
        v = Math.min(max, Math.max(min, v));
        slider.value = String(v);
      }
    });

    // 同步显示值与保存
    var cur = parseFloat(sliders[0] ? sliders[0].value : 0.3);
    if (!Number.isFinite(cur)) cur = 0.3;
    values.forEach(function (el) { if (el) el.textContent = String(cur); });
    try {
      SettingsCache.update(function (s) {
        s.temperature = cur;
      });
    } catch (e) {}

    // 两端标签
    var minLabel = DOMCache.get("temperatureMinLabel");
    if (minLabel) minLabel.textContent = noTemperature ? "精确 (" + min + ")" : "精确 (" + min + ")";
    var maxLabel = DOMCache.get("temperatureMaxLabel");
    if (maxLabel) maxLabel.textContent = noTemperature ? "创意 (" + max + ")" : "创意 (" + max + ")";

    // 提示
    var hintText = "";
    if (noTemperature) {
      hintText = "该模型不支持温度参数，请求时将自动移除";
      hints.forEach(function (el) {
        if (el) {
          el.textContent = hintText;
          el.classList.add("text-amber-600", "dark:text-amber-400");
          el.classList.remove("text-gray-500", "dark:text-gray-400");
        }
      });
    } else {
      var engineName = cfg ? cfg.name : "";
      hintText = min === 0 && max === 2
        ? ""
        : engineName + " 支持温度范围 " + min + "–" + max;
      hints.forEach(function (el) {
        if (el) {
          el.textContent = hintText;
          el.classList.remove("text-amber-600", "dark:text-amber-400");
          el.classList.add("text-gray-500", "dark:text-gray-400");
        }
      });
    }
  }

  const toolbarCategoryFilter = DOMCache.get("toolbarEngineCategoryFilter");
  const sidebarCategoryFilter = DOMCache.get("sidebarEngineCategoryFilter");

  // 按类别重建引擎下拉框为扁平选项
  function rebuildEngineSelectByCategory(selectEl, category, selectedValue) {
    if (!selectEl) return;
    var engines = EngineRegistry.getByCategory(category);
    var prevValue = selectedValue || selectEl.value;
    selectEl.replaceChildren();
    for (var ei = 0; ei < engines.length; ei++) {
      var opt = document.createElement("option");
      opt.value = engines[ei].id;
      opt.textContent = engines[ei].name;
      selectEl.appendChild(opt);
    }
    var hasOld = Array.from(selectEl.options).some(function (o) { return o.value === prevValue; });
    if (hasOld) {
      selectEl.value = prevValue;
    } else if (selectEl.options.length > 0) {
      selectEl.value = selectEl.options[0].value;
    }
  }

  // 同步所有类别下拉和引擎下拉
  function syncToolbarCategory(category, selectedEngine) {
    rebuildEngineSelectByCategory(engineSelect, category, selectedEngine);
    rebuildEngineSelectByCategory(sidebarEngineSelect, category, selectedEngine);
    if (toolbarCategoryFilter) toolbarCategoryFilter.value = category;
    if (sidebarCategoryFilter) sidebarCategoryFilter.value = category;
    updateEngineUI(engineSelect.value);
  }

  // 更新UI显示的函数
  function updateEngineUI(selectedEngine) {
    const modelSelect = DOMCache.get("modelSelect");

    // 根据引擎分类显示/隐藏模型和温度选项
    var engineConfig = EngineRegistry.get(selectedEngine);
    var isAI = engineConfig && engineConfig.category === "ai";

    if (isAI) {
      modelDiv?.classList.remove("hidden");
      temperatureDiv?.classList.remove("hidden");

      // 动态填充模型选项
      if (modelSelect) {
        modelSelect.replaceChildren();

        // 运行时解析模型列表（动态 API 列表优先，defaultModel 兜底）
        var optionDefs = _resolveEngineModels(selectedEngine);

        optionDefs.forEach(({ value, label }) => {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = label;
          modelSelect.appendChild(opt);
        });

        // 尝试恢复保存的模型选择
        const savedSettings = SettingsCache.get();
        const savedModel =
          savedSettings.model || savedSettings.translationModel;
        if (
          savedModel &&
          Array.from(modelSelect.options).some(
            (opt) => opt.value === savedModel,
          )
        ) {
          modelSelect.value = savedModel;
        }

        SettingsCache.update(function (s) {
          s.model = modelSelect.value;
          s.translationModel = modelSelect.value;
        });
        _setCapabilityHint(modelCapabilityHint, selectedEngine, modelSelect.value);
        _applyTemperatureRange(selectedEngine, modelSelect.value);
      }
    } else {
      modelDiv?.classList.add("hidden");
      temperatureDiv?.classList.add("hidden");
      // 传统引擎：恢复温度滑杆可用状态（下次切回 AI 时由 _applyTemperatureRange 重新配置）
      var _t1 = DOMCache.get("temperature");
      if (_t1) _t1.disabled = false;
      var _t2 = DOMCache.get("temperatureSettings");
      if (_t2) _t2.disabled = false;
    }

    // 保存选择
    SettingsCache.update(function (s) {
      s.translationEngine = selectedEngine;
      s.defaultEngine = selectedEngine;
    });
  }

  /**
   * API 密钥配置区跟随当前引擎联动：
   * 只显示当前所选引擎对应的密钥输入框，其余隐藏
   * 自定义引擎（密钥在自定义引擎表单中管理）显示提示行
   */
  function _syncApiKeyFields(engineId) {
    var section = DOMCache.get("apiKeysSection");
    if (!section) return;

    var cfg = (typeof EngineRegistry !== "undefined") ? EngineRegistry.get(engineId) : null;
    var isCustom = !!(cfg && cfg.isCustom);
    var rows = section.querySelectorAll("[data-engine-key]");
    var matched = false;

    rows.forEach(function (row) {
      var match = row.getAttribute("data-engine-key") === engineId;
      row.classList.toggle("hidden", !match);
      if (match) matched = true;
    });

    // 自定义引擎或无匹配密钥的引擎：显示提示行
    var noRow = DOMCache.get("apiKeyNoEngineRow");
    if (noRow) noRow.classList.toggle("hidden", !(isCustom || !matched));
  }

  function updateSettingsEngineUI(selectedEngine) {
    if (!settingsEngineSelect || !settingsModelSelect) return;

    const engine = String(selectedEngine || "").toLowerCase();

    var settingsConfig = EngineRegistry.get(engine);
    var settingsIsAI = settingsConfig && settingsConfig.category === "ai";
    updateConcurrentLimitHint(engine);
    // API 密钥区跟随当前引擎切换
    _syncApiKeyFields(engine);

    if (!settingsIsAI) {
      if (settingsModelContainer)
        settingsModelContainer.classList.add("hidden");
      return;
    }

    if (settingsModelContainer)
      settingsModelContainer.classList.remove("hidden");

    // 动态重建模型下拉框：只显示当前引擎的模型（无 optgroup 标题）
    var models = _resolveEngineModels(engine);

    var prevModel = settingsModelSelect.value;
    settingsModelSelect.replaceChildren();
    for (var mi = 0; mi < models.length; mi++) {
      var opt = document.createElement("option");
      opt.value = models[mi].value;
      opt.textContent = models[mi].label;
      settingsModelSelect.appendChild(opt);
    }

    // 恢复之前的选中值，或使用引擎默认模型
    var hasPrev = Array.from(settingsModelSelect.options).some(function (o) { return o.value === prevModel; });
    if (hasPrev) {
      settingsModelSelect.value = prevModel;
    } else if (settingsConfig && settingsConfig.defaultModel) {
      settingsModelSelect.value = settingsConfig.defaultModel;
    } else if (settingsModelSelect.options.length > 0) {
      settingsModelSelect.value = settingsModelSelect.options[0].value;
    }
    _setCapabilityHint(translationModelHint, engine, settingsModelSelect.value);
    _applyTemperatureRange(engine, settingsModelSelect.value);
  }

  function updateConcurrentLimitHint(selectedEngine) {
    if (!concurrentLimitHint) return;
    var engine = String(selectedEngine || settingsEngineSelect?.value || "").toLowerCase();
    var cfg = EngineRegistry.get(engine);
    var userLimit = parseInt(concurrentLimitSelect?.value, 10);
    if (!Number.isFinite(userLimit)) userLimit = 5;
    var rps = Number(cfg?.rateLimitPerSecond);
    if (!cfg || !Number.isFinite(rps)) {
      concurrentLimitHint.textContent = "同时进行的翻译请求数，过高可能触发限流";
      concurrentLimitHint.classList.remove("text-amber-600", "dark:text-amber-400");
      concurrentLimitHint.classList.add("text-gray-500", "dark:text-gray-400");
      return;
    }

    var maxByEngine = rps < 1 ? 1 : Math.ceil(rps);
    if (userLimit > maxByEngine) {
      concurrentLimitHint.textContent =
        cfg.name + " 速率较低，实际并发将自动限制为 " + maxByEngine + "，避免触发限流";
      concurrentLimitHint.classList.remove("text-gray-500", "dark:text-gray-400");
      concurrentLimitHint.classList.add("text-amber-600", "dark:text-amber-400");
    } else {
      concurrentLimitHint.textContent = "同时进行的翻译请求数，过高可能触发限流";
      concurrentLimitHint.classList.remove("text-amber-600", "dark:text-amber-400");
      concurrentLimitHint.classList.add("text-gray-500", "dark:text-gray-400");
    }
  }

  window.refreshEngineModelSelectors = function (preferredEngine) {
    var targetEngine = preferredEngine && EngineRegistry.has(preferredEngine)
      ? preferredEngine
      : (EngineRegistry.has(engineSelect.value) ? engineSelect.value : EngineRegistry.getDefaultEngineId());
    var targetConfig = EngineRegistry.get(targetEngine);
    var category = (targetConfig && targetConfig.category) || "ai";
    syncToolbarCategory(category, targetEngine);
    var settingsCategoryFilter = DOMCache.get("engineCategoryFilter");
    if (settingsCategoryFilter) settingsCategoryFilter.value = category;
    var aiSection = DOMCache.get("aiEngineSettingsSection");
    var traditionalSection = DOMCache.get("traditionalEngineSettingsSection");
    if (aiSection) aiSection.style.display = category === "ai" ? "" : "none";
    if (traditionalSection) traditionalSection.style.display = category === "traditional" ? "" : "none";
    if (settingsEngineSelect) {
      // 默认引擎下拉跟随类别筛选器：只显示当前类别的引擎
      settingsEngineSelect.replaceChildren();
      var engines = EngineRegistry.getByCategory(category);
      for (var i = 0; i < engines.length; i++) {
        var opt = document.createElement("option");
        opt.value = engines[i].id;
        opt.textContent = engines[i].name;
        settingsEngineSelect.appendChild(opt);
      }
      if (Array.from(settingsEngineSelect.options).some(function (o) { return o.value === targetEngine; })) {
        settingsEngineSelect.value = targetEngine;
      } else if (settingsEngineSelect.options.length > 0) {
        settingsEngineSelect.value = settingsEngineSelect.options[0].value;
      }
      updateSettingsEngineUI(settingsEngineSelect.value);
    }
  };

  /**
   * 从 API 刷新当前引擎的模型列表
   * - 拉取成功后更新 localStorage 缓存并重建所有模型下拉
   * - 失败时保留静态/缓存列表，仅提示错误
   */
  async function refreshEngineModels(engineId) {
    var statusEl = DOMCache.get("fetchModelsStatus");
    var btn = DOMCache.get("fetchModelsBtn");
    var cfg = EngineRegistry.get(engineId);

    function setStatus(text, isError) {
      if (statusEl) {
        statusEl.textContent = text || "";
        statusEl.classList.toggle("text-red-500", !!isError);
        statusEl.classList.toggle("text-green-600", !isError && !!text && text.indexOf("成功") !== -1);
        statusEl.classList.toggle("text-gray-500", !isError && (!text || text.indexOf("成功") === -1));
      }
    }

    if (typeof ModelFetcher === "undefined") {
      setStatus("模型列表服务未加载", true);
      return;
    }
    if (!cfg) {
      setStatus("未知引擎", true);
      return;
    }

    // 按钮 loading 状态
    if (btn) {
      btn.disabled = true;
      var icon = btn.querySelector("i");
      if (icon) icon.className = "fa-solid fa-spinner fa-spin";
    }
    setStatus("正在获取 " + cfg.name + " 模型列表...");

    try {
      var apiKey = null;
      if (typeof ModelFetcher.readDecryptedApiKey === "function") {
        apiKey = await ModelFetcher.readDecryptedApiKey(cfg);
      }
      var result = await ModelFetcher.fetchModels(engineId, apiKey);

      if (result && result.ok) {
        var count = Array.isArray(result.models) ? result.models.length : 0;
        setStatus("成功获取 " + count + " 个模型（已缓存，可在下拉框中查看）");
        // 重建工具栏 + 侧边栏 + 设置面板的模型下拉
        updateEngineUI(engineSelect.value);
        updateSettingsEngineUI(settingsEngineSelect ? settingsEngineSelect.value : engineId);
        if (typeof showNotification === "function") {
          showNotification("success", "模型列表已更新", cfg.name + "：获取到 " + count + " 个模型", { duration: 3000 });
        }
      } else {
        var errMsg = (result && result.error) || "获取失败";
        setStatus(errMsg, true);
        if (typeof showNotification === "function") {
          showNotification("error", "模型列表获取失败", errMsg, { duration: 5000 });
        }
      }
    } catch (e) {
      setStatus("获取失败: " + ((e && e.message) || e), true);
    } finally {
      if (btn) {
        btn.disabled = false;
        var icon2 = btn.querySelector("i");
        if (icon2) icon2.className = "fa-solid fa-rotate";
      }
    }
  }
  window.refreshEngineModels = refreshEngineModels;

  // 设置面板"从 API 获取模型"按钮
  var fetchModelsBtn = DOMCache.get("fetchModelsBtn");
  if (fetchModelsBtn) {
    EventManager.add(
      fetchModelsBtn,
      "click",
      function () {
        var engine = settingsEngineSelect ? settingsEngineSelect.value : (engineSelect ? engineSelect.value : null);
        if (engine) refreshEngineModels(engine);
      },
      {
        tag: "engine",
        scope: "engineModel",
        label: "fetchModelsBtn:click",
      },
    );
  }

  // 同步两个选择器
  function syncEngineSelects(source, target, value) {
    if (target.value !== value) {
      target.value = value;
    }
    updateEngineUI(value);
    // 引擎切换 toast 反馈
    var cfg = EngineRegistry.get(value);
    if (cfg && typeof showNotification === "function") {
      showNotification("info", "翻译引擎已切换", cfg.name + (cfg.defaultModel ? " · " + cfg.defaultModel : ""), { duration: 2000 });
    }
  }

  // 工具栏类别选择器变更事件
  if (toolbarCategoryFilter) {
    EventManager.add(
      toolbarCategoryFilter,
      "change",
      function () {
        syncToolbarCategory(this.value);
      },
      {
        tag: "engine",
        scope: "engineModel",
        label: "toolbarEngineCategoryFilter:change",
      },
    );
  }

  // 侧边栏类别选择器变更事件
  if (sidebarCategoryFilter) {
    EventManager.add(
      sidebarCategoryFilter,
      "change",
      function () {
        syncToolbarCategory(this.value);
      },
      {
        tag: "engine",
        scope: "engineModel",
        label: "sidebarEngineCategoryFilter:change",
      },
    );
  }

  // 工具栏选择器变更事件
  EventManager.add(
    engineSelect,
    "change",
    function () {
      syncEngineSelects(engineSelect, sidebarEngineSelect, this.value);
    },
    {
      tag: "engine",
      scope: "engineModel",
      label: "toolbarEngineSelect:change",
    },
  );

  // 侧边栏选择器变更事件
  EventManager.add(
    sidebarEngineSelect,
    "change",
    function () {
      syncEngineSelects(sidebarEngineSelect, engineSelect, this.value);
    },
    {
      tag: "engine",
      scope: "engineModel",
      label: "sidebarEngineSelect:change",
    },
  );

  if (settingsEngineSelect) {
    EventManager.add(
      settingsEngineSelect,
      "change",
      function () {
        updateSettingsEngineUI(this.value);
        var cfg = EngineRegistry.get(this.value);
        if (cfg && typeof showNotification === "function") {
          showNotification("info", "默认引擎已更改", cfg.name, { duration: 2000 });
        }
      },
      {
        tag: "engine",
        scope: "engineModel",
        label: "settingsDefaultEngineSelect:change",
      },
    );
  }

  if (concurrentLimitSelect) {
    EventManager.add(
      concurrentLimitSelect,
      "change",
      function () {
        updateConcurrentLimitHint(settingsEngineSelect?.value);
      },
      {
        tag: "engine",
        scope: "engineModel",
        label: "concurrentLimit:change",
      },
    );
  }

  // 模型选择器变更事件
  const modelSelect = DOMCache.get("modelSelect");
  if (modelSelect) {
    EventManager.add(
      modelSelect,
      "change",
      function () {
        SettingsCache.update(function (s) {
          s.model = modelSelect.value;
          s.translationModel = modelSelect.value;
        });
        _setCapabilityHint(modelCapabilityHint, engineSelect.value, modelSelect.value);
        _applyTemperatureRange(engineSelect.value, modelSelect.value);
      },
      { tag: "engine", scope: "engineModel", label: "modelSelect:change" },
    );
  }

  if (settingsModelSelect) {
    EventManager.add(
      settingsModelSelect,
      "change",
      function () {
        SettingsCache.update(function (s) {
          s.model = settingsModelSelect.value;
          s.translationModel = settingsModelSelect.value;
        });
        _setCapabilityHint(
          translationModelHint,
          settingsEngineSelect?.value,
          settingsModelSelect.value,
        );
        _applyTemperatureRange(
          settingsEngineSelect?.value,
          settingsModelSelect.value,
        );
      },
      { tag: "engine", scope: "engineModel", label: "translationModel:change" },
    );
  }

  // 温度滑块：更新显示并持久化到 localStorage（AI 引擎翻译时使用）
  if (temperatureInput && temperatureValue) {
    EventManager.add(
      temperatureInput,
      "input",
      function () {
        const v = this.value;
        temperatureValue.textContent = v;
        // 同步设置面板的温度滑杆
        const settingsTemp = DOMCache.get("temperatureSettings");
        if (settingsTemp) settingsTemp.value = v;
        const settingsTempVal = DOMCache.get("temperatureSettingsValue");
        if (settingsTempVal) settingsTempVal.textContent = v;
        try {
          const num = parseFloat(v);
          SettingsCache.update(function (s) {
            s.temperature = Number.isFinite(num) ? num : 0.3;
          });
        } catch (e) {
          (loggers.app || console).debug("engineModelSync saveTemperature:", e);
        }
      },
      { tag: "engine", scope: "engineModel", label: "temperature:input" },
    );
  }

  // 设置面板的温度滑杆（与侧边栏双向同步）
  const temperatureSettingsInput = DOMCache.get("temperatureSettings");
  if (temperatureSettingsInput) {
    EventManager.add(
      temperatureSettingsInput,
      "input",
      function () {
        const v = this.value;
        const valEl = DOMCache.get("temperatureSettingsValue");
        if (valEl) valEl.textContent = v;
        // 同步侧边栏温度滑杆
        if (temperatureInput) temperatureInput.value = v;
        if (temperatureValue) temperatureValue.textContent = v;
        try {
          const num = parseFloat(v);
          SettingsCache.update(function (s) {
            s.temperature = Number.isFinite(num) ? num : 0.3;
          });
        } catch (e) {
          (loggers.app || console).debug("engineModelSync saveTemperatureSettings:", e);
        }
      },
      { tag: "engine", scope: "engineModel", label: "temperatureSettings:input" },
    );
  }

  // 加载保存的设置
  const savedSettings = SettingsCache.get();
  const rawInitialEngine =
    savedSettings.translationEngine ||
    savedSettings.defaultEngine ||
    EngineRegistry.getDefaultEngineId();
  const initialEngine = EngineRegistry.has(String(rawInitialEngine))
    ? String(rawInitialEngine)
    : EngineRegistry.getDefaultEngineId();
  if (initialEngine !== rawInitialEngine) {
    savedSettings.translationEngine = initialEngine;
    savedSettings.defaultEngine = initialEngine;
    SettingsCache.save(savedSettings);
  }
  // 根据初始引擎类别重建工具栏和侧边栏引擎下拉
  var initialConfig = EngineRegistry.get(initialEngine);
  var initialCategory = (initialConfig && initialConfig.category) || "ai";
  syncToolbarCategory(initialCategory, initialEngine);

  // 加载保存的温度并同步到侧栏滑块与设置面板滑块（AI 引擎支持 0–2）
  if (temperatureInput && temperatureValue) {
    const savedTemp = savedSettings.temperature;
    const num = parseFloat(savedTemp);
    const temp = Number.isFinite(num) && num >= 0 && num <= 2 ? num : 0.3;
    temperatureInput.value = String(temp);
    temperatureValue.textContent = String(temp);
    const settingsTemp = DOMCache.get("temperatureSettings");
    if (settingsTemp) settingsTemp.value = String(temp);
    const settingsTempVal = DOMCache.get("temperatureSettingsValue");
    if (settingsTempVal) settingsTempVal.textContent = String(temp);
  }

  try {
    if (settingsEngineSelect) {
      const settingsEngine = String(
        settingsEngineSelect.value || initialEngine,
      );
      updateSettingsEngineUI(settingsEngine);
    }
  } catch (e) {
    (loggers.app || console).debug("engineModelSync init:", e);
  }
}

// 暴露到全局并在 DOM 加载后自动初始化
window.initEngineModelSync = initEngineModelSync;

// DOM 加载完成后自动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngineModelSync);
} else {
  // DOM 已经加载完成，延迟执行确保其他脚本已加载
  setTimeout(initEngineModelSync, 0);
}
