async function loadSettings() {
  const savedSettings = localStorage.getItem("translatorSettings");
  if (savedSettings) {
    try {
      const settings = safeJsonParse(savedSettings, {});

      // 加载外观设置
      {
        const themeModeValue = settings.themeMode || "auto";
        const themeMode = document.getElementById("themeMode");
        if (themeMode) themeMode.value = themeModeValue;
        applySettings({ themeMode: themeModeValue });
      }
      if (settings.fontSize) {
        const fontSize = document.getElementById("fontSize");
        if (fontSize) fontSize.value = settings.fontSize;
      }
      if (settings.itemsPerPage) {
        const itemsPerPage = document.getElementById("itemsPerPage");
        if (itemsPerPage) itemsPerPage.value = settings.itemsPerPage;
        // 同步到 AppState
        AppState.translations.itemsPerPage = parseInt(settings.itemsPerPage);
      }

      if (settings.sourceSelectionIndicatorEnabled !== undefined) {
        const sourceSelectionIndicatorEnabled = document.getElementById(
          "sourceSelectionIndicatorEnabled"
        );
        if (sourceSelectionIndicatorEnabled) {
          sourceSelectionIndicatorEnabled.checked =
            !!settings.sourceSelectionIndicatorEnabled;
        }
      }

      if (settings.sourceSelectionIndicatorUnselectedStyle) {
        const sourceSelectionIndicatorUnselectedStyle = document.getElementById(
          "sourceSelectionIndicatorUnselectedStyle"
        );
        if (sourceSelectionIndicatorUnselectedStyle) {
          sourceSelectionIndicatorUnselectedStyle.value =
            settings.sourceSelectionIndicatorUnselectedStyle;
        }
      }

      if (settings.autoScrollEnabled !== undefined) {
        const autoScrollEnabled = document.getElementById("autoScrollEnabled");
        if (autoScrollEnabled) {
          autoScrollEnabled.checked = !!settings.autoScrollEnabled;
        }
      }

      if (settings.autosaveIntervalSeconds !== undefined) {
        const autosaveIntervalSeconds = document.getElementById(
          "autosaveIntervalSeconds"
        );
        if (autosaveIntervalSeconds)
          autosaveIntervalSeconds.value = settings.autosaveIntervalSeconds;
      }

      // 加载翻译引擎设置
      const rawSavedEngine =
        settings.defaultEngine || settings.translationEngine;
      const allowedEngines = ["deepseek", "openai", "google"];
      const savedEngine = allowedEngines.includes(String(rawSavedEngine))
        ? String(rawSavedEngine)
        : "deepseek";
      if (savedEngine !== rawSavedEngine) {
        settings.defaultEngine = savedEngine;
        settings.translationEngine = savedEngine;
        localStorage.setItem("translatorSettings", JSON.stringify(settings));
      }
      if (savedEngine) {
        const engine = document.getElementById("defaultEngine");
        if (engine) engine.value = savedEngine;
      }
      const savedModel = settings.translationModel || settings.model;
      if (savedModel) {
        const model = document.getElementById("translationModel");
        if (model) model.value = savedModel;
      }
      if (settings.apiTimeout) {
        const timeout = document.getElementById("apiTimeout");
        if (timeout) timeout.value = settings.apiTimeout;
      }
      if (settings.concurrentLimit) {
        const concurrent = document.getElementById("concurrentLimit");
        if (concurrent) concurrent.value = settings.concurrentLimit;
      }
      if (settings.retryCount !== undefined) {
        const retry = document.getElementById("retryCount");
        if (retry) retry.value = settings.retryCount;
      }

      if (settings.translationRequestCacheEnabled !== undefined) {
        const el = document.getElementById("translationRequestCacheEnabled");
        if (el) el.checked = !!settings.translationRequestCacheEnabled;
      }
      if (settings.translationRequestCacheTTLSeconds !== undefined) {
        const el = document.getElementById("translationRequestCacheTTLSeconds");
        const raw = parseInt(settings.translationRequestCacheTTLSeconds);
        const ttl = Number.isFinite(raw) ? Math.max(1, Math.min(600, raw)) : 5;
        if (el) el.value = ttl;
      }

      if (settings.deepseekUseKeyContext !== undefined) {
        const el = document.getElementById("deepseekUseKeyContext");
        if (el) el.checked = !!settings.deepseekUseKeyContext;
      }

      if (settings.deepseekPrimingEnabled !== undefined) {
        const el = document.getElementById("deepseekPrimingEnabled");
        if (el) el.checked = !!settings.deepseekPrimingEnabled;
      }

      if (settings.deepseekPrimingSampleCount !== undefined) {
        const el = document.getElementById("deepseekPrimingSampleCount");
        if (el) el.value = settings.deepseekPrimingSampleCount;
      }

      if (settings.deepseekPrimingSampleIds !== undefined) {
        const el = document.getElementById("deepseekPrimingSampleIds");
        if (el) {
          try {
            el.value = JSON.stringify(settings.deepseekPrimingSampleIds || []);
          } catch (_) {
            el.value = "[]";
          }
        }
      }

      if (settings.deepseekConversationEnabled !== undefined) {
        const el = document.getElementById("deepseekConversationEnabled");
        if (el) el.checked = !!settings.deepseekConversationEnabled;
      }

      if (settings.deepseekConversationScope) {
        const el = document.getElementById("deepseekConversationScope");
        if (el) el.value = settings.deepseekConversationScope;
      }

      if (settings.deepseekBatchMaxItems !== undefined) {
        const el = document.getElementById("deepseekBatchMaxItems");
        if (el) el.value = Math.min(100, Math.max(5, Number(settings.deepseekBatchMaxItems) || 40));
      }
      if (settings.deepseekBatchMaxChars !== undefined) {
        const el = document.getElementById("deepseekBatchMaxChars");
        if (el) el.value = Math.min(20000, Math.max(1000, Number(settings.deepseekBatchMaxChars) || 6000));
      }

      try {
        const idsEl = document.getElementById("deepseekPrimingSampleIds");
        const countEl = document.getElementById("deepseekPrimingSelectedCount");
        if (idsEl && countEl) {
          const ids = safeJsonParse(idsEl.value, []);
          countEl.textContent = String(Array.isArray(ids) ? ids.length : 0);
        }
      } catch (_) {}

      // 加载质量检查设置
      if (settings.checkTerminology !== undefined) {
        const check = document.getElementById("checkTerminology");
        if (check) check.checked = settings.checkTerminology;
      }
      if (settings.checkPlaceholders !== undefined) {
        const check = document.getElementById("checkPlaceholders");
        if (check) check.checked = settings.checkPlaceholders;
      }
      if (settings.checkPunctuation !== undefined) {
        const check = document.getElementById("checkPunctuation");
        if (check) check.checked = settings.checkPunctuation;
      }
      if (settings.checkLength !== undefined) {
        const check = document.getElementById("checkLength");
        if (check) check.checked = settings.checkLength;
      }
      if (settings.checkNumbers !== undefined) {
        const check = document.getElementById("checkNumbers");
        if (check) check.checked = settings.checkNumbers;
      }
      if (settings.qualityThreshold) {
        const threshold = document.getElementById("qualityThreshold");
        if (threshold) threshold.value = settings.qualityThreshold;
      }

      if (settings.qualityCheckScope) {
        const scope = document.getElementById("qualityCheckScope");
        if (scope) scope.value = settings.qualityCheckScope;
      }

      // 加载术语库设置
      if (settings.autoApplyTerms !== undefined) {
        const auto = document.getElementById("autoApplyTerms");
        if (auto) auto.checked = settings.autoApplyTerms;
      }
      if (settings.termMatchMode) {
        const mode = document.getElementById("termMatchMode");
        if (mode) mode.value = settings.termMatchMode;
      }
      if (settings.highlightTerms !== undefined) {
        const highlight = document.getElementById("highlightTerms");
        if (highlight) highlight.checked = settings.highlightTerms;
      }
      if (settings.duplicateHandling) {
        const handling = document.getElementById("duplicateHandling");
        if (handling) handling.value = settings.duplicateHandling;
      }

      // 加载文件处理设置
      if (settings.maxFileSize) {
        const maxSize = document.getElementById("maxFileSize");
        if (maxSize) maxSize.value = settings.maxFileSize;
      }
      if (settings.formatXML !== undefined) {
        const format = document.getElementById("formatXML");
        if (format) format.checked = settings.formatXML;
      }
      if (settings.formatXLIFF !== undefined) {
        const format = document.getElementById("formatXLIFF");
        if (format) format.checked = settings.formatXLIFF;
      }
      if (settings.formatJSON !== undefined) {
        const format = document.getElementById("formatJSON");
        if (format) format.checked = settings.formatJSON;
      }
      if (settings.formatPO !== undefined) {
        const format = document.getElementById("formatPO");
        if (format) format.checked = settings.formatPO;
      }
      if (settings.formatRESX !== undefined) {
        const format = document.getElementById("formatRESX");
        if (format) format.checked = settings.formatRESX;
      }
      if (settings.formatIOSStrings !== undefined) {
        const format = document.getElementById("formatIOSStrings");
        if (format) format.checked = settings.formatIOSStrings;
      }
      if (settings.formatQtTS !== undefined) {
        const format = document.getElementById("formatQtTS");
        if (format) format.checked = settings.formatQtTS;
      }
      if (settings.formatTextFallback !== undefined) {
        const format = document.getElementById("formatTextFallback");
        if (format) format.checked = settings.formatTextFallback;
      }
      if (settings.autoDetectEncoding !== undefined) {
        const auto = document.getElementById("autoDetectEncoding");
        if (auto) auto.checked = settings.autoDetectEncoding;
      }
      if (settings.autoTranslateOnImport !== undefined) {
        const auto = document.getElementById("autoTranslateOnImport");
        if (auto) auto.checked = settings.autoTranslateOnImport;
      }

      // 加载并解密 API 密钥
      if (settings.deepseekApiKey) {
        const deepseekKey = document.getElementById("deepseekApiKey");
        if (deepseekKey) {
          const decrypted = await securityUtils.decrypt(
            settings.deepseekApiKey
          );
          deepseekKey.value = decrypted;
        }
      }
      if (settings.openaiApiKey) {
        const openaiKey = document.getElementById("openaiApiKey");
        if (openaiKey) {
          const decrypted = await securityUtils.decrypt(settings.openaiApiKey);
          openaiKey.value = decrypted;
        }
      }
      if (settings.googleApiKey) {
        const googleKey = document.getElementById("googleApiKey");
        if (googleKey) {
          const decrypted = await securityUtils.decrypt(settings.googleApiKey);
          googleKey.value = decrypted;
        }
      }

      // 应用设置
      applySettings(settings);
    } catch (e) {
      console.error("加载设置失败:", e);
    }
  }

  if (!savedSettings) {
    const themeMode = document.getElementById("themeMode");
    if (themeMode) themeMode.value = "auto";
    applySettings({ themeMode: "auto" });
  }
}

// 应用设置
function applySettings(settings) {
  if (
    settings.sourceSelectionIndicatorEnabled === undefined &&
    AppState.ui?.sourceSelectionIndicatorEnabled === undefined
  ) {
    AppState.ui.sourceSelectionIndicatorEnabled = true;
  }
  if (!AppState.ui?.sourceSelectionIndicatorUnselectedStyle) {
    AppState.ui.sourceSelectionIndicatorUnselectedStyle = "gray";
  }
  if (
    settings.autoScrollEnabled === undefined &&
    AppState.ui?.autoScrollEnabled === undefined
  ) {
    AppState.ui.autoScrollEnabled = true;
  }

  // 应用主题设置
  if (settings.themeMode) {
    const body = document.body;
    if (settings.themeMode === "dark") {
      body.classList.add("dark-mode");
    } else if (settings.themeMode === "light") {
      body.classList.remove("dark-mode");
    } else if (settings.themeMode === "auto") {
      // 根据系统主题设置
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      if (prefersDark) {
        body.classList.add("dark-mode");
      } else {
        body.classList.remove("dark-mode");
      }
    }
  }

  // 应用字体大小设置
  if (settings.fontSize) {
    const html = document.documentElement;
    html.classList.remove("text-sm", "text-base", "text-lg");
    if (settings.fontSize === "small") {
      html.classList.add("text-sm");
    } else if (settings.fontSize === "large") {
      html.classList.add("text-lg");
    } else {
      html.classList.add("text-base");
    }
  }

  // 应用每页显示数量设置
  if (settings.itemsPerPage) {
    AppState.translations.itemsPerPage = parseInt(settings.itemsPerPage);
    AppState.translations.currentPage = 1; // 重置到第一页
    // 刷新翻译列表
    if (AppState.translations.items.length > 0) {
      updateTranslationLists();
    }
  }

  if (settings.sourceSelectionIndicatorEnabled !== undefined) {
    AppState.ui.sourceSelectionIndicatorEnabled =
      !!settings.sourceSelectionIndicatorEnabled;
    if (AppState.translations.items.length > 0) {
      updateTranslationLists();
    }
  }

  if (settings.sourceSelectionIndicatorUnselectedStyle) {
    AppState.ui.sourceSelectionIndicatorUnselectedStyle =
      settings.sourceSelectionIndicatorUnselectedStyle;
    if (AppState.translations.items.length > 0) {
      updateTranslationLists();
    }
  }

  if (settings.autoScrollEnabled !== undefined) {
    AppState.ui.autoScrollEnabled = !!settings.autoScrollEnabled;
  }

  if (settings.autosaveIntervalSeconds !== undefined) {
    const seconds = parseInt(settings.autosaveIntervalSeconds);
    if (
      Number.isFinite(seconds) &&
      typeof autoSaveManager?.setSaveInterval === "function"
    ) {
      autoSaveManager.setSaveInterval(seconds * 1000);
    }
  }

  if (settings.qualityCheckScope) {
    if (!AppState.quality) AppState.quality = {};
    AppState.quality.checkScope = settings.qualityCheckScope;
  }
}
