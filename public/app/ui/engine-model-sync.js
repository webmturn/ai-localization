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
  const modelDiv = DOMCache.get("openaiModelDiv");
  const temperatureDiv = DOMCache.get("temperatureDiv");
  const temperatureInput = DOMCache.get("temperature");
  const temperatureValue = DOMCache.get("temperatureValue");

  const settingsEngineSelect = DOMCache.get("defaultEngine");
  const settingsModelSelect = DOMCache.get("translationModel");
  const settingsModelContainer = settingsModelSelect
    ? settingsModelSelect.closest("div")
    : null;

  if (!engineSelect || !sidebarEngineSelect) return;

  // 更新UI显示的函数
  function updateEngineUI(selectedEngine) {
    const modelSelect = DOMCache.get("modelSelect");

    // 根据引擎显示/隐藏对应选项
    if (selectedEngine === "openai" || selectedEngine === "deepseek") {
      modelDiv?.classList.remove("hidden");
      temperatureDiv?.classList.remove("hidden");

      // 动态填充模型选项
      if (modelSelect) {
        modelSelect.replaceChildren();

        const optionDefs =
          selectedEngine === "openai"
            ? [
                { value: "gpt-4o-mini", label: "GPT-4o mini (快速/经济)" },
                { value: "gpt-4o", label: "GPT-4o (推荐)" },
                { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
                { value: "gpt-4.1", label: "GPT-4.1" },
                { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
                { value: "gpt-4", label: "GPT-4 (经典)" },
                { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
              ]
            : [
                { value: "deepseek-chat", label: "DeepSeek Chat (推荐)" },
                { value: "deepseek-reasoner", label: "DeepSeek Reasoner (推理)" },
              ];

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

    if (engine === "google") {
      if (settingsModelContainer)
        settingsModelContainer.classList.add("hidden");
      return;
    }

    if (settingsModelContainer)
      settingsModelContainer.classList.remove("hidden");

    settingsModelSelect.replaceChildren();

    const optionDefs =
      engine === "openai"
        ? [
            { value: "gpt-4o-mini", label: "GPT-4o mini" },
            { value: "gpt-4o", label: "GPT-4o" },
            { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
            { value: "gpt-4.1", label: "GPT-4.1" },
            { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
            { value: "gpt-4", label: "GPT-4" },
            { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
          ]
        : [
            { value: "deepseek-chat", label: "DeepSeek Chat" },
            { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
          ];

    optionDefs.forEach(({ value, label }) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      settingsModelSelect.appendChild(opt);
    });

    const current = String(settingsModelSelect.value || "");
    const hasCurrent = Array.from(settingsModelSelect.options).some(
      (opt) => opt.value === current,
    );

    if (!hasCurrent) {
      const fallback = engine === "openai" ? "gpt-4o-mini" : "deepseek-chat";
      if (
        Array.from(settingsModelSelect.options).some(
          (opt) => opt.value === fallback,
        )
      ) {
        settingsModelSelect.value = fallback;
      }
    }
  }

  // 同步两个选择器
  function syncEngineSelects(source, target, value) {
    if (target.value !== value) {
      target.value = value;
    }
    updateEngineUI(value);
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

  // 温度滑块：更新显示并持久化到 localStorage（DeepSeek/OpenAI 翻译时使用）
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
    "deepseek";
  const allowedEngines = ["deepseek", "openai", "google"];
  const initialEngine = allowedEngines.includes(String(rawInitialEngine))
    ? String(rawInitialEngine)
    : "deepseek";
  if (initialEngine !== rawInitialEngine) {
    savedSettings.translationEngine = initialEngine;
    savedSettings.defaultEngine = initialEngine;
    SettingsCache.save(savedSettings);
  }
  engineSelect.value = initialEngine;
  sidebarEngineSelect.value = initialEngine;
  updateEngineUI(initialEngine);

  // 加载保存的温度并同步到侧栏滑块（DeepSeek/OpenAI 支持 0–2）
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
