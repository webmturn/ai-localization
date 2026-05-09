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
   * 从 EngineRegistry 运行时解析引擎的可用模型列表（含友好 label）
   * - 优先使用 config.availableModels + config.modelLabels（内置引擎）
   * - 自定义引擎只有 defaultModel：返回 [{value: defaultModel, label: defaultModel}]
   * - 无任何信息时返回空数组（UI 隐藏模型下拉）
   */
  function _resolveEngineModels(engineId) {
    var cfg = (typeof EngineRegistry !== "undefined") ? EngineRegistry.get(engineId) : null;
    if (!cfg) return [];

    var available = Array.isArray(cfg.availableModels) ? cfg.availableModels : null;
    var labels = (cfg.modelLabels && typeof cfg.modelLabels === "object") ? cfg.modelLabels : {};

    if (available && available.length > 0) {
      return available.map(function (id) {
        return { value: id, label: labels[id] || id };
      });
    }
    if (cfg.defaultModel) {
      return [{ value: cfg.defaultModel, label: labels[cfg.defaultModel] || cfg.defaultModel }];
    }
    return [];
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

        // 运行时从 EngineRegistry 读取 availableModels + modelLabels（内置引擎、自定义引擎走同一路径）
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
      }
    } else {
      modelDiv?.classList.add("hidden");
      temperatureDiv?.classList.add("hidden");
    }

    // 保存选择
    SettingsCache.update(function (s) {
      s.translationEngine = selectedEngine;
      s.defaultEngine = selectedEngine;
    });
  }

  function updateSettingsEngineUI(selectedEngine) {
    if (!settingsEngineSelect || !settingsModelSelect) return;

    const engine = String(selectedEngine || "").toLowerCase();

    var settingsConfig = EngineRegistry.get(engine);
    var settingsIsAI = settingsConfig && settingsConfig.category === "ai";
    updateConcurrentLimitHint(engine);

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

  // 加载保存的温度并同步到侧栏滑块（AI 引擎支持 0–2）
  if (temperatureInput && temperatureValue) {
    const savedTemp = savedSettings.temperature;
    const num = parseFloat(savedTemp);
    const temp = Number.isFinite(num) && num >= 0 && num <= 2 ? num : 0.3;
    temperatureInput.value = String(temp);
    temperatureValue.textContent = String(temp);
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
