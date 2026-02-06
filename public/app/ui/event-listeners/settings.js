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
        if (
          targetTab === "data" &&
          typeof window.updateStorageBackendStatus === "function"
        ) {
          window.updateStorageBackendStatus();
        }
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "settingsTabBtn:click",
      },
    );
  });

  // Prompt 模板管理已拆分到 settings-prompt-templates.js
  if (typeof registerEventListenersSettingsPromptTemplates === "function") {
    registerEventListenersSettingsPromptTemplates(ctx);
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

        const translationRequestCacheEnabled =
          document.getElementById("translationRequestCacheEnabled")?.checked ??
          false;
        const rawCacheTtl = parseInt(
          document.getElementById("translationRequestCacheTTLSeconds")?.value,
        );
        const translationRequestCacheTTLSeconds = Number.isFinite(rawCacheTtl)
          ? Math.max(1, Math.min(600, rawCacheTtl))
          : 5;
        try {
          const el = document.getElementById("translationRequestCacheTTLSeconds");
          if (el) el.value = translationRequestCacheTTLSeconds;
        } catch (_) {}

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

          translationRequestCacheEnabled,
          translationRequestCacheTTLSeconds,

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
            if (existing?.preferredStorageBackend) {
              settings.preferredStorageBackend =
                existing.preferredStorageBackend;
            }
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

  // DeepSeek 高级设置已拆分到 settings-deepseek.js
  if (typeof registerEventListenersSettingsDeepseek === "function") {
    registerEventListenersSettingsDeepseek(ctx);
  }
}
