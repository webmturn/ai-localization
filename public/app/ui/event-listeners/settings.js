function refreshShortcutsList() {
  const list = document.getElementById("shortcutsList");
  if (
    !list ||
    typeof window.KEYBOARD_SHORTCUT_DEFINITIONS === "undefined" ||
    typeof window.getEffectiveShortcutKeys !== "function" ||
    typeof window.formatKeyDisplay !== "function" ||
    typeof window.eventToKeyString !== "function" ||
    typeof window.saveShortcutOverride !== "function" ||
    typeof window.resetShortcutToDefault !== "function"
  ) {
    return;
  }
  const definitions = window.KEYBOARD_SHORTCUT_DEFINITIONS;
  const effectiveKeys = window.getEffectiveShortcutKeys();
  const rows = list.querySelectorAll("[data-shortcut-id]");
  rows.forEach((row) => {
    const id = row.getAttribute("data-shortcut-id");
    if (!id) return;
    const kbd = row.querySelector(".shortcut-kbd");
    if (!kbd) return;
    kbd.textContent = window.formatKeyDisplay(effectiveKeys[id] || "");
    const def = definitions.find((d) => d.id === id);
    if (!def || def.editable !== true) return;
    let container = kbd.parentElement;
    if (!container) return;
    let editBtn = container.querySelector(".shortcut-edit-btn");
    let resetBtn = container.querySelector(".shortcut-reset-btn");
    if (editBtn) editBtn.remove();
    if (resetBtn) resetBtn.remove();
    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "shortcut-edit-btn px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600";
    editBtn.textContent = "修改";
    resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className =
      "shortcut-reset-btn px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600";
    resetBtn.textContent = "恢复默认";
    editBtn.addEventListener("click", () => {
      const hint = "请按下新快捷键";
      editBtn.textContent = hint;
      const onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.removeEventListener("keydown", onKey, true);
        const keyString = window.eventToKeyString(e);
        if (keyString) {
          window.saveShortcutOverride(id, keyString);
          refreshShortcutsList();
        } else {
          editBtn.textContent = "修改";
        }
      };
      document.addEventListener("keydown", onKey, true);
      setTimeout(() => {
        document.removeEventListener("keydown", onKey, true);
        if (editBtn.textContent === hint) editBtn.textContent = "修改";
      }, 5000);
    });
    resetBtn.addEventListener("click", () => {
      window.resetShortcutToDefault(id);
      refreshShortcutsList();
    });
    container.appendChild(editBtn);
    container.appendChild(resetBtn);
  });
}

function registerEventListenersSettings(ctx) {
  // 设置标签页切换
  document.querySelectorAll(".settings-tab-btn").forEach((btn) => {
    EventManager.add(
      btn,
      "click",
      function () {
        const targetTab = this.dataset.tab;

        // 移除所有按钮的激活状态
        document.querySelectorAll(".settings-tab-btn").forEach((b) => {
          b.classList.remove("active");
        });

        // 激活当前按钮
        this.classList.add("active");

        // 隐藏所有内容
        document
          .querySelectorAll(".settings-tab-content")
          .forEach((content) => {
            content.classList.add("hidden");
          });

        // 显示对应内容
        const targetContent = document.querySelector(
          `.settings-tab-content[data-tab="${targetTab}"]`,
        );
        if (targetContent) {
          targetContent.classList.remove("hidden");
        }
        if (targetTab === "shortcuts" && typeof refreshShortcutsList === "function") {
          refreshShortcutsList();
        }
        if (
          targetTab === "promptTemplates" &&
          typeof window.loadProjectPromptTemplatesToUI === "function"
        ) {
          try {
            window.loadProjectPromptTemplatesToUI();
          } catch (_) {}
        }
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "settingsTabBtn:click",
      },
    );
  });

  function __getDefaultProjectPromptTemplate(engineKey) {
    try {
      if (
        typeof translationService !== "undefined" &&
        translationService &&
        typeof translationService.getDefaultProjectPromptTemplate === "function"
      ) {
        return translationService.getDefaultProjectPromptTemplate(engineKey);
      }
    } catch (_) {}

    try {
      const dict = window.__DEFAULT_PROJECT_PROMPT_TEMPLATES;
      if (dict && dict[engineKey]) return String(dict[engineKey]);
    } catch (_) {}

    return "";
  }

  function __loadProjectPromptTemplatesToUI() {
    const generalEl = document.getElementById("projectPromptTemplateGeneral");
    const openaiEl = document.getElementById("projectPromptTemplateOpenAI");
    const deepseekEl = document.getElementById("projectPromptTemplateDeepSeek");
    const deepseekBatchEl = document.getElementById(
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

    const generalEl = document.getElementById("projectPromptTemplateGeneral");
    const openaiEl = document.getElementById("projectPromptTemplateOpenAI");
    const deepseekEl = document.getElementById("projectPromptTemplateDeepSeek");
    const deepseekBatchEl = document.getElementById(
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

  try {
    if (typeof window !== "undefined") {
      window.loadProjectPromptTemplatesToUI = __loadProjectPromptTemplatesToUI;
    }
  } catch (_) {}

  const resetProjectPromptTemplateGeneral = document.getElementById(
    "resetProjectPromptTemplateGeneral",
  );
  if (resetProjectPromptTemplateGeneral) {
    EventManager.add(
      resetProjectPromptTemplateGeneral,
      "click",
      () => {
        const el = document.getElementById("projectPromptTemplateGeneral");
        if (el) el.value = __getDefaultProjectPromptTemplate("general");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateGeneral:click",
      },
    );
  }

  const resetProjectPromptTemplateOpenAI = document.getElementById(
    "resetProjectPromptTemplateOpenAI",
  );
  if (resetProjectPromptTemplateOpenAI) {
    EventManager.add(
      resetProjectPromptTemplateOpenAI,
      "click",
      () => {
        const el = document.getElementById("projectPromptTemplateOpenAI");
        if (el) el.value = "";
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateOpenAI:click",
      },
    );
  }

  const resetProjectPromptTemplateDeepSeek = document.getElementById(
    "resetProjectPromptTemplateDeepSeek",
  );
  if (resetProjectPromptTemplateDeepSeek) {
    EventManager.add(
      resetProjectPromptTemplateDeepSeek,
      "click",
      () => {
        const el = document.getElementById("projectPromptTemplateDeepSeek");
        if (el) el.value = "";
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "resetProjectPromptTemplateDeepSeek:click",
      },
    );
  }

  const resetProjectPromptTemplateDeepSeekBatch = document.getElementById(
    "resetProjectPromptTemplateDeepSeekBatch",
  );
  if (resetProjectPromptTemplateDeepSeekBatch) {
    EventManager.add(
      resetProjectPromptTemplateDeepSeekBatch,
      "click",
      () => {
        const el = document.getElementById(
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

  // 保存设置按钮
  const saveSettingsBtn = document.getElementById("saveSettings");
  if (saveSettingsBtn) {
    EventManager.add(
      saveSettingsBtn,
      "click",
      async () => {
        const rawAutosaveSeconds = parseInt(
          document.getElementById("autosaveIntervalSeconds")?.value,
        );
        const autosaveIntervalSeconds = Number.isFinite(rawAutosaveSeconds)
          ? Math.max(5, Math.min(600, rawAutosaveSeconds))
          : 10;

        const autosaveInput = document.getElementById(
          "autosaveIntervalSeconds",
        );
        if (autosaveInput) autosaveInput.value = autosaveIntervalSeconds;

        const deepseekPrimingSampleCountInput = document.getElementById(
          "deepseekPrimingSampleCount",
        );
        const rawDeepseekPrimingSampleCount = parseInt(
          deepseekPrimingSampleCountInput?.value,
        );
        const deepseekPrimingSampleCount = Number.isFinite(
          rawDeepseekPrimingSampleCount,
        )
          ? Math.max(1, Math.min(20, rawDeepseekPrimingSampleCount))
          : 3;
        if (deepseekPrimingSampleCountInput)
          deepseekPrimingSampleCountInput.value = deepseekPrimingSampleCount;

        const apiTimeoutInput = document.getElementById("apiTimeout");
        const rawApiTimeout = parseInt(apiTimeoutInput?.value);
        const apiTimeout = Number.isFinite(rawApiTimeout)
          ? Math.max(5, Math.min(120, rawApiTimeout))
          : 30;
        if (apiTimeoutInput) apiTimeoutInput.value = apiTimeout;

        // 保存设置到 localStorage
        const rawDefaultEngine =
          document.getElementById("defaultEngine")?.value || "deepseek";
        const defaultEngine = ["deepseek", "openai", "google"].includes(
          String(rawDefaultEngine),
        )
          ? String(rawDefaultEngine)
          : "deepseek";

        const rawModel =
          document.getElementById("translationModel")?.value || "deepseek-chat";
        let normalizedModel = String(rawModel);
        if (defaultEngine === "deepseek") {
          if (!/^deepseek-/.test(normalizedModel)) {
            normalizedModel = "deepseek-chat";
          }
        } else if (defaultEngine === "openai") {
          if (/^deepseek-/.test(normalizedModel)) {
            normalizedModel = "gpt-4o-mini";
          }
        }

        const settings = {
          // 外观设置
          themeMode: document.getElementById("themeMode")?.value || "auto",
          fontSize: document.getElementById("fontSize")?.value || "medium",
          itemsPerPage:
            parseInt(document.getElementById("itemsPerPage")?.value) || 20,
          autoScrollEnabled:
            document.getElementById("autoScrollEnabled")?.checked ?? true,
          sourceSelectionIndicatorEnabled:
            document.getElementById("sourceSelectionIndicatorEnabled")
              ?.checked ?? true,
          sourceSelectionIndicatorUnselectedStyle:
            document.getElementById("sourceSelectionIndicatorUnselectedStyle")
              ?.value || "gray",
          autosaveIntervalSeconds,

          // 翻译引擎设置
          defaultEngine,
          translationEngine: defaultEngine,
          translationModel: normalizedModel,
          model: normalizedModel,
          apiTimeout,
          concurrentLimit:
            parseInt(document.getElementById("concurrentLimit")?.value) || 5,
          retryCount:
            parseInt(document.getElementById("retryCount")?.value) || 2,

          deepseekUseKeyContext:
            document.getElementById("deepseekUseKeyContext")?.checked || false,
          deepseekPrimingEnabled:
            document.getElementById("deepseekPrimingEnabled")?.checked || false,
          deepseekPrimingSampleCount,
          deepseekPrimingSampleIds: safeJsonParse(
            document.getElementById("deepseekPrimingSampleIds")?.value,
            [],
          ),
          deepseekConversationEnabled:
            document.getElementById("deepseekConversationEnabled")?.checked ||
            false,
          deepseekConversationScope:
            document.getElementById("deepseekConversationScope")?.value ||
            "project",
          deepseekBatchMaxItems:
            parseInt(document.getElementById("deepseekBatchMaxItems")?.value) || 40,
          deepseekBatchMaxChars:
            parseInt(document.getElementById("deepseekBatchMaxChars")?.value) || 6000,

          // 质量检查设置（开关：未勾选为 false，须原样保存）
          checkTerminology:
            document.getElementById("checkTerminology")?.checked ?? true,
          checkPlaceholders:
            document.getElementById("checkPlaceholders")?.checked ?? true,
          checkPunctuation:
            document.getElementById("checkPunctuation")?.checked ?? true,
          checkLength:
            document.getElementById("checkLength")?.checked ?? false,
          checkNumbers:
            document.getElementById("checkNumbers")?.checked ?? true,
          qualityThreshold:
            parseInt(document.getElementById("qualityThreshold")?.value) || 70,
          qualityCheckScope:
            document.getElementById("qualityCheckScope")?.value || "project",

          // 术语库设置
          autoApplyTerms:
            document.getElementById("autoApplyTerms")?.checked || true,
          termMatchMode:
            document.getElementById("termMatchMode")?.value || "exact",
          highlightTerms:
            document.getElementById("highlightTerms")?.checked || true,
          duplicateHandling:
            document.getElementById("duplicateHandling")?.value || "overwrite",

          // 文件处理设置
          maxFileSize:
            parseInt(document.getElementById("maxFileSize")?.value) || 10,
          formatXML: document.getElementById("formatXML")?.checked || true,
          formatXLIFF: document.getElementById("formatXLIFF")?.checked || true,
          formatJSON: document.getElementById("formatJSON")?.checked || true,
          formatPO: document.getElementById("formatPO")?.checked || true,
          formatRESX: document.getElementById("formatRESX")?.checked || true,
          formatIOSStrings:
            document.getElementById("formatIOSStrings")?.checked || true,
          formatQtTS: document.getElementById("formatQtTS")?.checked || true,
          formatTextFallback:
            document.getElementById("formatTextFallback")?.checked || true,
          autoDetectEncoding:
            document.getElementById("autoDetectEncoding")?.checked || true,
          autoTranslateOnImport:
            document.getElementById("autoTranslateOnImport")?.checked || false,

          // 加密保存 API 密钥
          deepseekApiKey: "",
          openaiApiKey: "",
          googleApiKey: "",
        };

        // 加密API密钥
        const deepseekKey = document.getElementById("deepseekApiKey")?.value;
        const openaiKey = document.getElementById("openaiApiKey")?.value;
        const googleKey = document.getElementById("googleApiKey")?.value;

        if (deepseekKey) {
          settings.deepseekApiKey = await securityUtils.encrypt(deepseekKey);
        }
        if (openaiKey) {
          settings.openaiApiKey = await securityUtils.encrypt(openaiKey);
        }
        if (googleKey) {
          settings.googleApiKey = await securityUtils.encrypt(googleKey);
        }

        try {
          const existingRaw = localStorage.getItem("translatorSettings");
          if (existingRaw) {
            const existing = JSON.parse(existingRaw);
            if (existing && typeof existing.keyboardShortcuts === "object" && Object.keys(existing.keyboardShortcuts).length > 0) {
              settings.keyboardShortcuts = existing.keyboardShortcuts;
            }
          }
        } catch (_) {}

        localStorage.setItem("translatorSettings", JSON.stringify(settings));

        // 应用设置
        applySettings(settings);

        try {
          const toolbarEngine = document.getElementById("translationEngine");
          const sidebarEngine = document.getElementById(
            "sidebarTranslationEngine",
          );
          if (toolbarEngine && toolbarEngine.value !== defaultEngine) {
            toolbarEngine.value = defaultEngine;
            toolbarEngine.dispatchEvent(new Event("change"));
          }
          if (sidebarEngine && sidebarEngine.value !== defaultEngine) {
            sidebarEngine.value = defaultEngine;
            sidebarEngine.dispatchEvent(new Event("change"));
          }
          const modelInput = document.getElementById("translationModel");
          if (modelInput && modelInput.value !== normalizedModel) {
            modelInput.value = normalizedModel;
          }
        } catch (_) {}

        try {
          await __saveProjectPromptTemplatesFromUI();
        } catch (e) {
          console.error("保存项目 Prompt 模板失败:", e);
        }

        showNotification(
          "success",
          "设置已保存",
          "您的设置已成功保存（API密钥已加密）",
        );
        closeModal("settingsModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "saveSettingsBtn:click",
      },
    );
  }

  function __getItemKeyForContext(item) {
    if (!item) return "";
    return (
      item?.metadata?.resourceId ||
      item?.metadata?.key ||
      item?.metadata?.path ||
      item?.metadata?.unitId ||
      item?.metadata?.contextName ||
      item?.id ||
      ""
    );
  }

  function __getPrimingBaseItems() {
    const all = Array.isArray(AppState?.project?.translationItems)
      ? AppState.project.translationItems
      : [];
    const selectedFile = AppState?.translations?.selectedFile;
    if (selectedFile) {
      const filtered = all.filter((it) => it?.metadata?.file === selectedFile);
      if (filtered.length > 0) return filtered;
    }
    const visible = Array.isArray(AppState?.translations?.filtered)
      ? AppState.translations.filtered
      : [];
    return visible.length > 0 ? visible : all;
  }

  function __getDefaultPrimingSampleIds(items, count) {
    const out = [];
    const seen = new Set();
    for (let i = 0; i < items.length && out.length < count; i++) {
      const it = items[i];
      const id = it?.id;
      if (!id || seen.has(id)) continue;
      const source = (it?.sourceText || "").trim();
      if (!source) continue;
      out.push(id);
      seen.add(id);
    }
    return out;
  }

  function __updatePrimingSelectedCountLabel() {
    try {
      const idsEl = document.getElementById("deepseekPrimingSampleIds");
      const countEl = document.getElementById("deepseekPrimingSelectedCount");
      if (!idsEl || !countEl) return;
      const ids = safeJsonParse(idsEl.value, []);
      countEl.textContent = String(Array.isArray(ids) ? ids.length : 0);
    } catch (_) {}
  }

  function __renderPrimingSamplesModal() {
    const listEl = document.getElementById("deepseekPrimingSamplesList");
    const idsEl = document.getElementById("deepseekPrimingSampleIds");
    const countInput = document.getElementById("deepseekPrimingSampleCount");
    if (!listEl || !idsEl) return;

    const items = __getPrimingBaseItems();
    const rawCount = parseInt(countInput?.value);
    const desiredCount = Number.isFinite(rawCount)
      ? Math.max(1, Math.min(20, rawCount))
      : 3;

    let selectedIds = safeJsonParse(idsEl.value, []);
    if (!Array.isArray(selectedIds)) selectedIds = [];
    if (selectedIds.length === 0) {
      selectedIds = __getDefaultPrimingSampleIds(items, desiredCount);
      try {
        idsEl.value = JSON.stringify(selectedIds);
      } catch (_) {
        idsEl.value = "[]";
        selectedIds = [];
      }
      __updatePrimingSelectedCountLabel();
    }

    const selectedSet = new Set(selectedIds);
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const id = item.id;
      if (!id) continue;

      const wrap = document.createElement("label");
      wrap.className =
        "flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "mt-1";
      checkbox.dataset.id = String(id);
      checkbox.checked = selectedSet.has(id);

      const body = document.createElement("div");
      body.className = "min-w-0";

      const key = __getItemKeyForContext(item);
      const file = item?.metadata?.file || "";
      const sourceText = (item?.sourceText || "").toString();
      const sourcePreview =
        sourceText.length > 200
          ? sourceText.substring(0, 200) + "..."
          : sourceText;

      const title = document.createElement("div");
      title.className = "text-xs text-gray-500 dark:text-gray-400 break-words";
      title.textContent = `${file ? file + " · " : ""}${key}`;

      const content = document.createElement("div");
      content.className =
        "text-sm text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap mt-1";
      content.textContent = sourcePreview;

      body.appendChild(title);
      body.appendChild(content);

      wrap.appendChild(checkbox);
      wrap.appendChild(body);

      fragment.appendChild(wrap);
    }

    listEl.replaceChildren(fragment);
  }

  const selectPrimingBtn = document.getElementById(
    "selectDeepseekPrimingSamples",
  );
  if (selectPrimingBtn) {
    EventManager.add(
      selectPrimingBtn,
      "click",
      () => {
        __renderPrimingSamplesModal();
        openModal("deepseekPrimingSamplesModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "selectDeepseekPrimingSamples:click",
      },
    );
  }

  const savePrimingBtn = document.getElementById("saveDeepseekPrimingSamples");
  if (savePrimingBtn) {
    EventManager.add(
      savePrimingBtn,
      "click",
      () => {
        const listEl = document.getElementById("deepseekPrimingSamplesList");
        const idsEl = document.getElementById("deepseekPrimingSampleIds");
        const countInput = document.getElementById(
          "deepseekPrimingSampleCount",
        );
        if (!listEl || !idsEl) return;

        const rawCount = parseInt(countInput?.value);
        const desiredCount = Number.isFinite(rawCount)
          ? Math.max(1, Math.min(20, rawCount))
          : 3;

        const items = __getPrimingBaseItems();
        const order = new Map();
        for (let i = 0; i < items.length; i++) {
          const id = items[i]?.id;
          if (id && !order.has(id)) order.set(id, i);
        }

        const checked = Array.from(
          listEl.querySelectorAll('input[type="checkbox"][data-id]'),
        )
          .filter((el) => el.checked)
          .map((el) => String(el.dataset.id));

        checked.sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0));

        const trimmed = checked.slice(0, desiredCount);
        try {
          idsEl.value = JSON.stringify(trimmed);
        } catch (_) {
          idsEl.value = "[]";
        }
        __updatePrimingSelectedCountLabel();
        closeModal("deepseekPrimingSamplesModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "saveDeepseekPrimingSamples:click",
      },
    );
  }

  const clearConversationBtn = document.getElementById(
    "clearDeepseekConversation",
  );
  if (clearConversationBtn) {
    EventManager.add(
      clearConversationBtn,
      "click",
      () => {
        try {
          if (
            translationService &&
            translationService.deepseekConversations &&
            typeof translationService.deepseekConversations.clear === "function"
          ) {
            translationService.deepseekConversations.clear();
          }
        } catch (_) {}
        showNotification("success", "已清空会话", "DeepSeek 会话上下文已清空");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "clearDeepseekConversation:click",
      },
    );
  }

  function __buildDeepseekConversationKey(scope) {
    const projectId = AppState?.project?.id || "";
    if (!projectId) return "";
    const normalizedScope = scope || "project";
    if (normalizedScope === "project") return `deepseek:${projectId}`;

    const selectedFile = AppState?.translations?.selectedFile || "";
    const all = Array.isArray(AppState?.project?.translationItems)
      ? AppState.project.translationItems
      : [];
    const first = all.length > 0 ? all[0] : null;
    const file = selectedFile || first?.metadata?.file || "";

    if (normalizedScope === "file") {
      return `deepseek:${projectId}:file:${file}`;
    }

    const ext = (file.split(".").pop() || "").toLowerCase();
    return `deepseek:${projectId}:type:${ext}`;
  }

  function __normalizeConversationToFlatMessages(messages) {
    const safe = Array.isArray(messages) ? messages : [];
    const out = [];
    for (let i = 0; i < safe.length; i++) {
      const item = safe[i];
      if (!item) continue;
      if (item.role && item.content !== undefined) {
        out.push({ role: item.role, content: item.content });
      } else if (item.user && item.assistant) {
        out.push({ role: "system", content: item.system || "" });
        if (item.priming && item.priming.content !== undefined) {
          out.push({ role: "user", content: "(Priming) " + (item.priming.content || "") });
        }
        out.push({ role: "user", content: (item.user && item.user.content) || "" });
        out.push({ role: "assistant", content: (item.assistant && item.assistant.content) || "" });
      }
    }
    return out;
  }

  function __renderDeepseekConversationMessages(messages) {
    const listEl = document.getElementById("deepseekConversationMessages");
    if (!listEl) return;
    listEl.replaceChildren();

    const flat = __normalizeConversationToFlatMessages(messages);
    if (flat.length === 0) {
      const empty = document.createElement("div");
      empty.className =
        "text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3";
      empty.textContent = "当前会话为空";
      listEl.appendChild(empty);
      return;
    }

    for (let i = 0; i < flat.length; i++) {
      const msg = flat[i] || {};
      const row = document.createElement("div");
      row.className =
        "border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900";

      const header = document.createElement("div");
      header.className =
        "flex items-center justify-between gap-3 mb-2 text-xs text-gray-500 dark:text-gray-400";

      const role = document.createElement("div");
      role.className = "font-medium";
      role.textContent = String(msg.role || "");

      const index = document.createElement("div");
      index.textContent = `#${i + 1}`;

      header.appendChild(role);
      header.appendChild(index);

      const body = document.createElement("div");
      body.className =
        "text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words";
      body.textContent = String(msg.content || "");

      row.appendChild(header);
      row.appendChild(body);
      listEl.appendChild(row);
    }
  }

  function __getDeepseekConversationSnapshot() {
    const out = {};
    try {
      const map = translationService?.deepseekConversations;
      if (!map || typeof map.entries !== "function") return out;
      for (const [key, value] of map.entries()) {
        out[String(key)] = Array.isArray(value) ? value : [];
      }
      return out;
    } catch (_) {
      return out;
    }
  }

  const viewConversationBtn = document.getElementById(
    "viewDeepseekConversation",
  );
  if (viewConversationBtn) {
    EventManager.add(
      viewConversationBtn,
      "click",
      () => {
        const keySelect = document.getElementById(
          "deepseekConversationKeySelect",
        );
        const metaEl = document.getElementById("deepseekConversationMeta");
        const copyBtn = document.getElementById("copyDeepseekConversation");

        const scope =
          document.getElementById("deepseekConversationScope")?.value ||
          "project";
        const defaultKey = __buildDeepseekConversationKey(scope);

        const snapshot = __getDeepseekConversationSnapshot();
        const keys = Object.keys(snapshot);
        const selectedKey =
          defaultKey && snapshot[defaultKey]
            ? defaultKey
            : keys.length > 0
              ? keys[0]
              : defaultKey;

        if (keySelect) {
          keySelect.replaceChildren();
          const allKeys =
            keys.length > 0 ? keys : selectedKey ? [selectedKey] : [];
          for (let i = 0; i < allKeys.length; i++) {
            const k = allKeys[i];
            const opt = document.createElement("option");
            opt.value = k;
            const arr = Array.isArray(snapshot[k]) ? snapshot[k] : [];
            const first = arr[0];
            const isRounds = first && first.user && first.assistant;
            const countLabel = isRounds ? `${arr.length} 轮` : `${arr.length} 条`;
            opt.textContent = `${k} (${countLabel})`;
            keySelect.appendChild(opt);
          }
          if (selectedKey) keySelect.value = selectedKey;
        }

        const renderSelected = () => {
          const k = keySelect ? keySelect.value : selectedKey;
          const messages = snapshot[k] || [];
          if (metaEl) {
            const enabled = !!document.getElementById(
              "deepseekConversationEnabled",
            )?.checked;
            const rawKey = String(k || "");
            const prefix = rawKey.startsWith("deepseek:") ? "deepseek:" : "";
            const rest = prefix ? rawKey.slice(prefix.length) : rawKey;
            const parts = rest
              ? rest
                  .split(":")
                  .map((p) => String(p || "").trim())
                  .filter(Boolean)
              : [];
            const lines = [
              `范围: ${scope}`,
              `启用记忆: ${enabled ? "是" : "否"}`,
              `Key: ${prefix ? "deepseek" : rawKey ? rawKey.split(":")[0] : ""}`,
            ];

            for (let i = 0; i < parts.length; i += 2) {
              const label = parts[i];
              const value = parts[i + 1];
              if (!label) continue;
              if (value) {
                lines.push(`${label}:${value}`);
              } else {
                lines.push(label);
              }
            }

            metaEl.textContent = lines.filter(Boolean).join("\n");
          }
          __renderDeepseekConversationMessages(messages);
          if (copyBtn) {
            copyBtn.onclick = async () => {
              try {
                const raw = snapshot[k] || [];
                const payload = JSON.stringify(
                  { key: k, scope, messages: raw },
                  null,
                  2,
                );
                if (navigator?.clipboard?.writeText) {
                  await navigator.clipboard.writeText(payload);
                  showNotification(
                    "success",
                    "已复制",
                    "会话内容已复制到剪贴板",
                  );
                } else {
                  throw new Error("clipboard not available");
                }
              } catch (_) {
                showNotification(
                  "warning",
                  "复制失败",
                  "当前环境不支持自动复制",
                );
              }
            };
          }
        };

        if (keySelect) {
          keySelect.onchange = renderSelected;
        }
        renderSelected();
        openModal("deepseekConversationViewerModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "viewDeepseekConversation:click",
      },
    );
  }

  __updatePrimingSelectedCountLabel();
}
