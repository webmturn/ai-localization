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

  const settingsEngineSelect = DOMCache.get("defaultEngine");
  const settingsModelSelect = DOMCache.get("translationModel");
  const settingsModelContainer = settingsModelSelect
    ? settingsModelSelect.closest("div")
    : null;

  if (!engineSelect || !sidebarEngineSelect) return;

  // 引擎模型定义（工具栏和设置页共享，避免重复）
  var __engineModelDefs = {
    deepseek: [
      { value: "deepseek-chat", label: "DeepSeek Chat (推荐)" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner (推理)" },
    ],
    openai: [
      { value: "gpt-4o-mini", label: "GPT-4o mini (快速/经济)" },
      { value: "gpt-4o", label: "GPT-4o (推荐)" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
      { value: "gpt-4", label: "GPT-4 (经典)" },
      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
    gemini: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (推荐)" },
      { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    claude: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (推荐)" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
      { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    ],
  };

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

        var optionDefs = __engineModelDefs[selectedEngine];
        // 自定义引擎：显示一个可编辑的默认模型
        if (!optionDefs && engineConfig) {
          optionDefs = engineConfig.defaultModel
            ? [{ value: engineConfig.defaultModel, label: engineConfig.defaultModel }]
            : [];
        }
        if (!optionDefs) optionDefs = [];

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

    if (!settingsIsAI) {
      if (settingsModelContainer)
        settingsModelContainer.classList.add("hidden");
      return;
    }

    if (settingsModelContainer)
      settingsModelContainer.classList.remove("hidden");

    // 动态重建模型下拉框：只显示当前引擎的模型（无 optgroup 标题）
    var models = __engineModelDefs[engine];
    if (!models && settingsConfig && settingsConfig.defaultModel) {
      models = [{ value: settingsConfig.defaultModel, label: settingsConfig.defaultModel }];
    }
    if (!models) models = [];

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
      },
      { tag: "engine", scope: "engineModel", label: "modelSelect:change" },
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
        } catch (_) {
          (loggers.app || console).debug("engineModelSync saveTemperature:", _);
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
  } catch (_) {
    (loggers.app || console).debug("engineModelSync init:", _);
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
