// ==================== Prompt 模板管理 ====================
// 从 settings.js 拆分出来的独立模块
// 提供项目级 Prompt 模板的加载、保存、重置功能

function __getDefaultProjectPromptTemplate(engineKey) {
  try {
    if (
      typeof translationService !== "undefined" &&
      translationService &&
      typeof translationService.getDefaultProjectPromptTemplate === "function"
    ) {
      return translationService.getDefaultProjectPromptTemplate(engineKey);
    }
  } catch (_) {
    (loggers.app || console).debug("getDefaultPromptTemplate service:", _);
  }

  try {
    const dict = window.ArchDebug
      ? window.ArchDebug.getFlag('DEFAULT_PROJECT_PROMPT_TEMPLATES', {
          windowKey: '__DEFAULT_PROJECT_PROMPT_TEMPLATES',
        })
      : window.__DEFAULT_PROJECT_PROMPT_TEMPLATES;
    if (dict && dict[engineKey]) return String(dict[engineKey]);
  } catch (_) {
    (loggers.app || console).debug("getDefaultPromptTemplate fallback:", _);
  }

  return "";
}

function __loadProjectPromptTemplatesToUI() {
  const generalEl = DOMCache.get("projectPromptTemplateGeneral");
  const openaiEl = DOMCache.get("projectPromptTemplateOpenAI");
  const deepseekEl = DOMCache.get("projectPromptTemplateDeepSeek");
  const deepseekBatchEl = DOMCache.get(
    "projectPromptTemplateDeepSeekBatch",
  );

  if (!generalEl && !openaiEl && !deepseekEl && !deepseekBatchEl) return;

  let normalized = {};
  try {
    if (
      typeof translationService !== "undefined" &&
      translationService &&
      typeof translationService.getNormalizedProjectPromptTemplate ===
        "function"
    ) {
      normalized = translationService.getNormalizedProjectPromptTemplate() || {};
    } else {
      const pt = AppState?.project?.promptTemplate;
      if (pt && typeof pt === "object") normalized = pt;
      else if (typeof pt === "string") normalized = { general: pt };
    }
  } catch (_) {
    normalized = {};
  }

  const defGeneral = __getDefaultProjectPromptTemplate("general");
  const defOpenai = __getDefaultProjectPromptTemplate("openai");
  const defDeepseek = __getDefaultProjectPromptTemplate("deepseek");
  const defDeepseekBatch = __getDefaultProjectPromptTemplate("deepseekBatch");

  const generalValue =
    typeof normalized.general === "string" ? normalized.general : "";
  const openaiValue =
    typeof normalized.openai === "string" ? normalized.openai : "";
  const deepseekValue =
    typeof normalized.deepseek === "string" ? normalized.deepseek : "";
  const deepseekBatchValue =
    typeof normalized.deepseekBatch === "string"
      ? normalized.deepseekBatch
      : typeof normalized.deepseek_batch === "string"
        ? normalized.deepseek_batch
        : typeof normalized.batch === "string"
          ? normalized.batch
          : "";

  if (generalEl) {
    generalEl.value = generalValue;
    if (defGeneral && defGeneral.trim()) {
      generalEl.placeholder = "留空表示使用默认通用模板";
    }
  }
  if (openaiEl) {
    openaiEl.value = openaiValue;
    if (defOpenai && defOpenai.trim()) {
      openaiEl.placeholder = "留空表示继承通用模板";
    }
  }
  if (deepseekEl) {
    deepseekEl.value = deepseekValue;
    if (defDeepseek && defDeepseek.trim()) {
      deepseekEl.placeholder = "留空表示继承通用模板";
    }
  }
  if (deepseekBatchEl) {
    deepseekBatchEl.value = deepseekBatchValue;
    if (defDeepseekBatch && defDeepseekBatch.trim()) {
      deepseekBatchEl.placeholder =
        "留空表示继承通用模板（会自动补充 JSON 输出要求）";
    }
  }
}

async function __saveProjectPromptTemplatesFromUI() {
  const project = AppState?.project;
  if (!project) return;

  const generalEl = DOMCache.get("projectPromptTemplateGeneral");
  const openaiEl = DOMCache.get("projectPromptTemplateOpenAI");
  const deepseekEl = DOMCache.get("projectPromptTemplateDeepSeek");
  const deepseekBatchEl = DOMCache.get(
    "projectPromptTemplateDeepSeekBatch",
  );

  if (!generalEl && !openaiEl && !deepseekEl && !deepseekBatchEl) return;

  const generalRaw = generalEl ? String(generalEl.value || "") : "";
  const openaiRaw = openaiEl ? String(openaiEl.value || "") : "";
  const deepseekRaw = deepseekEl ? String(deepseekEl.value || "") : "";
  const deepseekBatchRaw = deepseekBatchEl
    ? String(deepseekBatchEl.value || "")
    : "";

  const defGeneral = __getDefaultProjectPromptTemplate("general");
  const defOpenai = __getDefaultProjectPromptTemplate("openai");
  const defDeepseek = __getDefaultProjectPromptTemplate("deepseek");
  const defDeepseekBatch = __getDefaultProjectPromptTemplate("deepseekBatch");

  const next = {};
  if (
    generalRaw.trim() &&
    generalRaw.trim() !== String(defGeneral || "").trim()
  ) {
    next.general = generalRaw;
  }
  if (
    openaiRaw.trim() &&
    openaiRaw.trim() !== String(defOpenai || "").trim()
  ) {
    next.openai = openaiRaw;
  }
  if (
    deepseekRaw.trim() &&
    deepseekRaw.trim() !== String(defDeepseek || "").trim()
  ) {
    next.deepseek = deepseekRaw;
  }
  if (
    deepseekBatchRaw.trim() &&
    deepseekBatchRaw.trim() !== String(defDeepseekBatch || "").trim()
  ) {
    next.deepseekBatch = deepseekBatchRaw;
  }

  let existing = {};
  try {
    if (
      typeof translationService !== "undefined" &&
      translationService &&
      typeof translationService.getNormalizedProjectPromptTemplate ===
        "function"
    ) {
      existing = translationService.getNormalizedProjectPromptTemplate() || {};
    } else {
      const pt = project.promptTemplate;
      if (pt && typeof pt === "object") existing = pt;
      else if (typeof pt === "string") existing = { general: pt };
    }
  } catch (_) {
    existing = {};
  }

  const existingGeneral =
    typeof existing.general === "string" ? existing.general : "";
  const existingOpenai =
    typeof existing.openai === "string" ? existing.openai : "";
  const existingDeepseek =
    typeof existing.deepseek === "string" ? existing.deepseek : "";
  const existingBatch =
    typeof existing.deepseekBatch === "string"
      ? existing.deepseekBatch
      : typeof existing.deepseek_batch === "string"
        ? existing.deepseek_batch
        : typeof existing.batch === "string"
          ? existing.batch
          : "";

  const changed =
    existingGeneral !== (next.general || "") ||
    existingOpenai !== (next.openai || "") ||
    existingDeepseek !== (next.deepseek || "") ||
    existingBatch !== (next.deepseekBatch || "");

  if (!changed) return;

  if (Object.keys(next).length === 0) {
    if (project.promptTemplate !== undefined) {
      try {
        delete project.promptTemplate;
      } catch (_) {
        project.promptTemplate = undefined;
      }
    }
  } else {
    project.promptTemplate = next;
  }

  if (typeof autoSaveManager?.markDirty === "function") {
    autoSaveManager.markDirty();
  }
  if (typeof autoSaveManager?.saveProject === "function") {
    await autoSaveManager.saveProject();
  }
}

function registerEventListenersSettingsPromptTemplates(ctx) {
  try {
    if (typeof window !== "undefined") {
      window.loadProjectPromptTemplatesToUI = __loadProjectPromptTemplatesToUI;
    }
  } catch (_) {
    (loggers.app || console).debug("promptTemplates module init:", _);
  }

  const resetProjectPromptTemplateGeneral = DOMCache.get(
    "resetProjectPromptTemplateGeneral",
  );
  if (resetProjectPromptTemplateGeneral) {
    EventManager.add(
      resetProjectPromptTemplateGeneral,
      "click",
      () => {
        const el = DOMCache.get("projectPromptTemplateGeneral");
        if (el) el.value = __getDefaultProjectPromptTemplate("general");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateGeneral:click",
      },
    );
  }

  const resetProjectPromptTemplateOpenAI = DOMCache.get(
    "resetProjectPromptTemplateOpenAI",
  );
  if (resetProjectPromptTemplateOpenAI) {
    EventManager.add(
      resetProjectPromptTemplateOpenAI,
      "click",
      () => {
        const el = DOMCache.get("projectPromptTemplateOpenAI");
        if (el) el.value = "";
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateOpenAI:click",
      },
    );
  }

  const resetProjectPromptTemplateDeepSeek = DOMCache.get(
    "resetProjectPromptTemplateDeepSeek",
  );
  if (resetProjectPromptTemplateDeepSeek) {
    EventManager.add(
      resetProjectPromptTemplateDeepSeek,
      "click",
      () => {
        const el = DOMCache.get("projectPromptTemplateDeepSeek");
        if (el) el.value = "";
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateDeepSeek:click",
      },
    );
  }

  const resetProjectPromptTemplateDeepSeekBatch = DOMCache.get(
    "resetProjectPromptTemplateDeepSeekBatch",
  );
  if (resetProjectPromptTemplateDeepSeekBatch) {
    EventManager.add(
      resetProjectPromptTemplateDeepSeekBatch,
      "click",
      () => {
        const el = DOMCache.get(
          "projectPromptTemplateDeepSeekBatch",
        );
        if (el) el.value = "";
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateDeepSeekBatch:click",
      },
    );
  }
}
