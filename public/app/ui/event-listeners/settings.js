// 跟踪快捷键编辑状态，确保 keydown 监听器可被清理
let __shortcutEditPendingKeyHandler = null;

function __cleanupShortcutEditKeyHandler() {
  if (__shortcutEditPendingKeyHandler) {
    document.removeEventListener("keydown", __shortcutEditPendingKeyHandler, true);
    __shortcutEditPendingKeyHandler = null;
  }
}

function refreshShortcutsList() {
  const list = DOMCache.get("shortcutsList");
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

  // 清理上一次可能残留的 keydown 监听器
  __cleanupShortcutEditKeyHandler();

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
    editBtn.dataset.shortcutAction = "edit";
    editBtn.dataset.shortcutId = id;
    resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className =
      "shortcut-reset-btn px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600";
    resetBtn.textContent = "恢复默认";
    resetBtn.dataset.shortcutAction = "reset";
    resetBtn.dataset.shortcutId = id;
    container.appendChild(editBtn);
    container.appendChild(resetBtn);
  });

  // 事件委托：一次性绑定在列表容器上
  if (!list.__shortcutDelegateAttached) {
    list.__shortcutDelegateAttached = true;
    EventManager.add(list, "click", (e) => {
      const btn = e.target.closest("[data-shortcut-action]");
      if (!btn) return;
      const action = btn.dataset.shortcutAction;
      const shortcutId = btn.dataset.shortcutId;
      if (!shortcutId) return;

      if (action === "reset") {
        window.resetShortcutToDefault(shortcutId);
        refreshShortcutsList();
        return;
      }

      if (action === "edit") {
        __cleanupShortcutEditKeyHandler();
        const hint = "请按下新快捷键";
        btn.textContent = hint;
        const onKey = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          __cleanupShortcutEditKeyHandler();
          const keyString = window.eventToKeyString(ev);
          if (keyString) {
            window.saveShortcutOverride(shortcutId, keyString);
            refreshShortcutsList();
          } else {
            btn.textContent = "修改";
          }
        };
        __shortcutEditPendingKeyHandler = onKey;
        document.addEventListener("keydown", onKey, true);
        setTimeout(() => {
          if (__shortcutEditPendingKeyHandler === onKey) {
            __cleanupShortcutEditKeyHandler();
            if (btn.textContent === hint) btn.textContent = "修改";
          }
        }, 5000);
      }
    }, { tag: "settings", scope: "settingsModal", label: "shortcutsList:clickDelegate" });
  }
}

function registerEventListenersSettings(ctx) {
  // 设置标签页切换（事件委托 + 缓存引用）
  const settingsNav = DOMCache.query("#settingsModal nav, #settingsModal .settings-nav");
  const tabBtns = Array.from(DOMCache.queryAll(".settings-tab-btn"));
  const tabContents = Array.from(DOMCache.queryAll(".settings-tab-content"));

  if (settingsNav && tabBtns.length > 0) {
    EventManager.add(
      settingsNav,
      "click",
      function (e) {
        const btn = e.target.closest(".settings-tab-btn");
        if (!btn) return;
        const targetTab = btn.dataset.tab;

        // 移除所有按钮的激活状态
        for (let i = 0; i < tabBtns.length; i++) {
          tabBtns[i].classList.remove("active");
        }

        // 激活当前按钮
        btn.classList.add("active");

        // 隐藏所有内容
        for (let i = 0; i < tabContents.length; i++) {
          tabContents[i].classList.add("hidden");
        }

        // 显示对应内容
        for (let i = 0; i < tabContents.length; i++) {
          if (tabContents[i].dataset.tab === targetTab) {
            tabContents[i].classList.remove("hidden");
            break;
          }
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
          } catch (_) {
            (loggers.app || console).debug("settings loadPromptTemplates:", _);
          }
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
        label: "settingsNav:clickDelegate",
      },
    );
  }

  // Prompt 模板管理已拆分到 settings-prompt-templates.js
  if (typeof registerEventListenersSettingsPromptTemplates === "function") {
    registerEventListenersSettingsPromptTemplates(ctx);
  }

  // 保存设置按钮
  const saveSettingsBtn = DOMCache.get("saveSettings");
  if (saveSettingsBtn) {
    EventManager.add(
      saveSettingsBtn,
      "click",
      async () => {
        const rawAutosaveSeconds = parseInt(
          DOMCache.get("autosaveIntervalSeconds")?.value,
        );
        const autosaveIntervalSeconds = Number.isFinite(rawAutosaveSeconds)
          ? Math.max(5, Math.min(600, rawAutosaveSeconds))
          : 10;

        const autosaveInput = DOMCache.get(
          "autosaveIntervalSeconds",
        );
        if (autosaveInput) autosaveInput.value = autosaveIntervalSeconds;

        const deepseekPrimingSampleCountInput = DOMCache.get(
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

        const apiTimeoutInput = DOMCache.get("apiTimeout");
        const rawApiTimeout = parseInt(apiTimeoutInput?.value);
        const apiTimeout = Number.isFinite(rawApiTimeout)
          ? Math.max(5, Math.min(120, rawApiTimeout))
          : 30;
        if (apiTimeoutInput) apiTimeoutInput.value = apiTimeout;

        const translationRequestCacheEnabled =
          DOMCache.get("translationRequestCacheEnabled")?.checked ??
          false;
        const rawCacheTtl = parseInt(
          DOMCache.get("translationRequestCacheTTLSeconds")?.value,
        );
        const translationRequestCacheTTLSeconds = Number.isFinite(rawCacheTtl)
          ? Math.max(1, Math.min(600, rawCacheTtl))
          : 5;
        try {
          const el = DOMCache.get("translationRequestCacheTTLSeconds");
          if (el) el.value = translationRequestCacheTTLSeconds;
        } catch (_) {
          (loggers.app || console).debug("settings cacheTTL sync:", _);
        }

        // 保存设置到 localStorage
        const rawDefaultEngine =
          DOMCache.get("defaultEngine")?.value || "deepseek";
        const defaultEngine = ["deepseek", "openai", "google"].includes(
          String(rawDefaultEngine),
        )
          ? String(rawDefaultEngine)
          : "deepseek";

        const rawModel =
          DOMCache.get("translationModel")?.value || "deepseek-chat";
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
          themeMode: DOMCache.get("themeMode")?.value || "auto",
          fontSize: DOMCache.get("fontSize")?.value || "medium",
          itemsPerPage:
            parseInt(DOMCache.get("itemsPerPage")?.value) || 20,
          autoScrollEnabled:
            DOMCache.get("autoScrollEnabled")?.checked ?? true,
          sourceSelectionIndicatorEnabled:
            DOMCache.get("sourceSelectionIndicatorEnabled")
              ?.checked ?? true,
          sourceSelectionIndicatorUnselectedStyle:
            DOMCache.get("sourceSelectionIndicatorUnselectedStyle")
              ?.value || "gray",
          autosaveIntervalSeconds,

          // 翻译引擎设置
          defaultEngine,
          translationEngine: defaultEngine,
          translationModel: normalizedModel,
          model: normalizedModel,
          apiTimeout,
          concurrentLimit:
            parseInt(DOMCache.get("concurrentLimit")?.value) || 5,
          retryCount:
            parseInt(DOMCache.get("retryCount")?.value) || 2,

          translationRequestCacheEnabled,
          translationRequestCacheTTLSeconds,

          deepseekUseKeyContext:
            DOMCache.get("deepseekUseKeyContext")?.checked || false,
          deepseekContextAwareEnabled:
            DOMCache.get("deepseekContextAwareEnabled")?.checked || false,
          deepseekContextWindowSize:
            parseInt(DOMCache.get("deepseekContextWindowSize")?.value) || 3,
          deepseekPrimingEnabled:
            DOMCache.get("deepseekPrimingEnabled")?.checked || false,
          deepseekPrimingSampleCount,
          deepseekPrimingSampleIds: safeJsonParse(
            DOMCache.get("deepseekPrimingSampleIds")?.value,
            [],
          ),
          deepseekConversationEnabled:
            DOMCache.get("deepseekConversationEnabled")?.checked ||
            false,
          deepseekConversationScope:
            DOMCache.get("deepseekConversationScope")?.value ||
            "project",
          deepseekBatchMaxItems:
            parseInt(DOMCache.get("deepseekBatchMaxItems")?.value) || 40,
          deepseekBatchMaxChars:
            parseInt(DOMCache.get("deepseekBatchMaxChars")?.value) || 6000,

          // 质量检查设置（开关：未勾选为 false，须原样保存）
          checkTerminology:
            DOMCache.get("checkTerminology")?.checked ?? true,
          checkPlaceholders:
            DOMCache.get("checkPlaceholders")?.checked ?? true,
          checkPunctuation:
            DOMCache.get("checkPunctuation")?.checked ?? true,
          checkLength:
            DOMCache.get("checkLength")?.checked ?? false,
          checkNumbers:
            DOMCache.get("checkNumbers")?.checked ?? true,
          qualityThreshold:
            parseInt(DOMCache.get("qualityThreshold")?.value) || 70,
          qualityCheckScope:
            DOMCache.get("qualityCheckScope")?.value || "project",

          // 术语库设置
          autoApplyTerms:
            DOMCache.get("autoApplyTerms")?.checked || true,
          termMatchMode:
            DOMCache.get("termMatchMode")?.value || "exact",
          highlightTerms:
            DOMCache.get("highlightTerms")?.checked || true,
          duplicateHandling:
            DOMCache.get("duplicateHandling")?.value || "overwrite",

          // 文件处理设置
          maxFileSize:
            parseInt(DOMCache.get("maxFileSize")?.value) || 10,
          formatXML: DOMCache.get("formatXML")?.checked || true,
          formatXLIFF: DOMCache.get("formatXLIFF")?.checked || true,
          formatJSON: DOMCache.get("formatJSON")?.checked || true,
          formatPO: DOMCache.get("formatPO")?.checked || true,
          formatRESX: DOMCache.get("formatRESX")?.checked || true,
          formatIOSStrings:
            DOMCache.get("formatIOSStrings")?.checked || true,
          formatQtTS: DOMCache.get("formatQtTS")?.checked || true,
          formatTextFallback:
            DOMCache.get("formatTextFallback")?.checked || true,
          autoDetectEncoding:
            DOMCache.get("autoDetectEncoding")?.checked || true,
          autoTranslateOnImport:
            DOMCache.get("autoTranslateOnImport")?.checked || false,

          // 加密保存 API 密钥
          deepseekApiKey: "",
          openaiApiKey: "",
          googleApiKey: "",
        };

        // 加密API密钥
        const deepseekKey = DOMCache.get("deepseekApiKey")?.value;
        const openaiKey = DOMCache.get("openaiApiKey")?.value;
        const googleKey = DOMCache.get("googleApiKey")?.value;

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
          const existing = SettingsCache.get();
          if (existing) {
            if (existing?.preferredStorageBackend) {
              settings.preferredStorageBackend =
                existing.preferredStorageBackend;
            }
            if (existing && typeof existing.keyboardShortcuts === "object" && Object.keys(existing.keyboardShortcuts).length > 0) {
              settings.keyboardShortcuts = existing.keyboardShortcuts;
            }
          }
        } catch (_) {
          (loggers.app || console).debug("settings merge shortcuts:", _);
        }

        SettingsCache.save(settings);

        // 应用设置
        applySettings(settings);

        try {
          const toolbarEngine = DOMCache.get("translationEngine");
          const sidebarEngine = DOMCache.get(
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
          const modelInput = DOMCache.get("translationModel");
          if (modelInput && modelInput.value !== normalizedModel) {
            modelInput.value = normalizedModel;
          }
        } catch (_) {
          (loggers.app || console).debug("settings model sync:", _);
        }

        try {
          await __saveProjectPromptTemplatesFromUI();
        } catch (e) {
          (loggers.app || console).error("保存项目 Prompt 模板失败:", e);
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
