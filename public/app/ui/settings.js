async function loadSettings() {
  const settings = SettingsCache.get();
  if (settings && Object.keys(settings).length > 0) {
    try {

      // 加载外观设置
      {
        const themeModeValue = settings.themeMode || "auto";
        const themeMode = DOMCache.get("themeMode");
        if (themeMode) themeMode.value = themeModeValue;
        applySettings({ themeMode: themeModeValue });
      }
      if (settings.fontSize) {
        const fontSize = DOMCache.get("fontSize");
        if (fontSize) fontSize.value = settings.fontSize;
      }
      if (settings.itemsPerPage) {
        const itemsPerPage = DOMCache.get("itemsPerPage");
        if (itemsPerPage) itemsPerPage.value = settings.itemsPerPage;
        // 同步到 AppState
        AppState.translations.itemsPerPage = parseInt(settings.itemsPerPage);
      }

      if (settings.sourceSelectionIndicatorEnabled !== undefined) {
        const sourceSelectionIndicatorEnabled = DOMCache.get(
          "sourceSelectionIndicatorEnabled"
        );
        if (sourceSelectionIndicatorEnabled) {
          sourceSelectionIndicatorEnabled.checked =
            !!settings.sourceSelectionIndicatorEnabled;
        }
      }

      if (settings.sourceSelectionIndicatorUnselectedStyle) {
        const sourceSelectionIndicatorUnselectedStyle = DOMCache.get(
          "sourceSelectionIndicatorUnselectedStyle"
        );
        if (sourceSelectionIndicatorUnselectedStyle) {
          sourceSelectionIndicatorUnselectedStyle.value =
            settings.sourceSelectionIndicatorUnselectedStyle;
        }
      }

      if (settings.autoScrollEnabled !== undefined) {
        const autoScrollEnabled = DOMCache.get("autoScrollEnabled");
        if (autoScrollEnabled) {
          autoScrollEnabled.checked = !!settings.autoScrollEnabled;
        }
      }

      if (settings.autosaveIntervalSeconds !== undefined) {
        const autosaveIntervalSeconds = DOMCache.get(
          "autosaveIntervalSeconds"
        );
        if (autosaveIntervalSeconds)
          autosaveIntervalSeconds.value = settings.autosaveIntervalSeconds;
      }

      // 加载翻译引擎设置
      const rawSavedEngine =
        settings.defaultEngine || settings.translationEngine;
      const savedEngine = (typeof EngineRegistry !== "undefined" && EngineRegistry.has(String(rawSavedEngine)))
        ? String(rawSavedEngine)
        : (typeof EngineRegistry !== "undefined" ? EngineRegistry.getDefaultEngineId() : "deepseek");
      if (savedEngine !== rawSavedEngine) {
        settings.defaultEngine = savedEngine;
        settings.translationEngine = savedEngine;
        SettingsCache.save(settings);
      }
      if (savedEngine) {
        const engine = DOMCache.get("defaultEngine");
        if (engine) {
          engine.value = savedEngine;
          // 触发模型下拉框联动：重建模型列表后恢复保存的模型
          engine.dispatchEvent(new Event("change"));
        }
      }
      const savedModel = settings.translationModel || settings.model;
      if (savedModel) {
        const model = DOMCache.get("translationModel");
        if (model) model.value = savedModel;
      }
      if (settings.apiTimeout) {
        const timeout = DOMCache.get("apiTimeout");
        if (timeout) timeout.value = settings.apiTimeout;
      }
      if (settings.concurrentLimit) {
        const concurrent = DOMCache.get("concurrentLimit");
        if (concurrent) concurrent.value = settings.concurrentLimit;
      }
      if (settings.retryCount !== undefined) {
        const retry = DOMCache.get("retryCount");
        if (retry) retry.value = settings.retryCount;
      }

      if (settings.translationRequestCacheEnabled !== undefined) {
        const el = DOMCache.get("translationRequestCacheEnabled");
        if (el) el.checked = !!settings.translationRequestCacheEnabled;
      }
      if (settings.translationRequestCacheTTLSeconds !== undefined) {
        const el = DOMCache.get("translationRequestCacheTTLSeconds");
        const raw = parseInt(settings.translationRequestCacheTTLSeconds);
        const ttl = Number.isFinite(raw) ? Math.max(1, Math.min(600, raw)) : 5;
        if (el) el.value = ttl;
      }

      // AI 翻译增强设置（向后兼容 deepseek* → ai*）
      {
        const _v = (aiKey, dsKey) => settings[aiKey] ?? settings[dsKey];
        const _useKey = _v("aiUseKeyContext", "deepseekUseKeyContext");
        if (_useKey !== undefined) {
          const el = DOMCache.get("aiUseKeyContext");
          if (el) el.checked = !!_useKey;
        }

        const _ctxAware = _v("aiContextAwareEnabled", "deepseekContextAwareEnabled");
        if (_ctxAware !== undefined) {
          const el = DOMCache.get("aiContextAwareEnabled");
          if (el) el.checked = !!_ctxAware;
        }
        const _ctxWin = _v("aiContextWindowSize", "deepseekContextWindowSize");
        if (_ctxWin !== undefined) {
          const el = DOMCache.get("aiContextWindowSize");
          const val = Math.max(1, Math.min(10, Number(_ctxWin) || 3));
          if (el) el.value = val;
          const label = DOMCache.get("aiContextWindowSizeValue");
          if (label) label.textContent = `前后 ${val} 条`;
        }

        const _priming = _v("aiPrimingEnabled", "deepseekPrimingEnabled");
        if (_priming !== undefined) {
          const el = DOMCache.get("aiPrimingEnabled");
          if (el) el.checked = !!_priming;
        }

        const _primCount = _v("aiPrimingSampleCount", "deepseekPrimingSampleCount");
        if (_primCount !== undefined) {
          const el = DOMCache.get("aiPrimingSampleCount");
          if (el) el.value = _primCount;
        }

        const _primIds = _v("aiPrimingSampleIds", "deepseekPrimingSampleIds");
        if (_primIds !== undefined) {
          const el = DOMCache.get("aiPrimingSampleIds");
          if (el) {
            try {
              el.value = JSON.stringify(_primIds || []);
            } catch (_) {
              el.value = "[]";
            }
          }
        }

        const _convEnabled = _v("aiConversationEnabled", "deepseekConversationEnabled");
        if (_convEnabled !== undefined) {
          const el = DOMCache.get("aiConversationEnabled");
          if (el) el.checked = !!_convEnabled;
        }

        const _convScope = _v("aiConversationScope", "deepseekConversationScope") || "";
        if (_convScope) {
          const el = DOMCache.get("aiConversationScope");
          if (el) el.value = _convScope;
        }

        const _batchItems = _v("aiBatchMaxItems", "deepseekBatchMaxItems");
        if (_batchItems !== undefined) {
          const el = DOMCache.get("aiBatchMaxItems");
          if (el) el.value = Math.min(100, Math.max(5, Number(_batchItems) || 40));
        }
        const _batchChars = _v("aiBatchMaxChars", "deepseekBatchMaxChars");
        if (_batchChars !== undefined) {
          const el = DOMCache.get("aiBatchMaxChars");
          if (el) el.value = Math.min(20000, Math.max(1000, Number(_batchChars) || 6000));
        }

        try {
          const idsEl = DOMCache.get("aiPrimingSampleIds");
          const countEl = DOMCache.get("aiPrimingSelectedCount");
          if (idsEl && countEl) {
            const ids = safeJsonParse(idsEl.value, []);
            countEl.textContent = String(Array.isArray(ids) ? ids.length : 0);
          }
        } catch (_) {
          (loggers.app || console).debug("settings loadPrimingCount:", _);
        }
      }

      // 加载质量检查设置
      if (settings.checkTerminology !== undefined) {
        const check = DOMCache.get("checkTerminology");
        if (check) check.checked = settings.checkTerminology;
      }
      if (settings.checkPlaceholders !== undefined) {
        const check = DOMCache.get("checkPlaceholders");
        if (check) check.checked = settings.checkPlaceholders;
      }
      if (settings.checkPunctuation !== undefined) {
        const check = DOMCache.get("checkPunctuation");
        if (check) check.checked = settings.checkPunctuation;
      }
      if (settings.checkLength !== undefined) {
        const check = DOMCache.get("checkLength");
        if (check) check.checked = settings.checkLength;
      }
      if (settings.checkNumbers !== undefined) {
        const check = DOMCache.get("checkNumbers");
        if (check) check.checked = settings.checkNumbers;
      }
      if (settings.qualityThreshold) {
        const threshold = DOMCache.get("qualityThreshold");
        if (threshold) threshold.value = settings.qualityThreshold;
      }

      if (settings.qualityCheckScope) {
        const scope = DOMCache.get("qualityCheckScope");
        if (scope) scope.value = settings.qualityCheckScope;
      }

      // 加载术语库设置
      if (settings.autoApplyTerms !== undefined) {
        const auto = DOMCache.get("autoApplyTerms");
        if (auto) auto.checked = settings.autoApplyTerms;
      }
      if (settings.termMatchMode) {
        const mode = DOMCache.get("termMatchMode");
        if (mode) mode.value = settings.termMatchMode;
      }
      if (settings.highlightTerms !== undefined) {
        const highlight = DOMCache.get("highlightTerms");
        if (highlight) highlight.checked = settings.highlightTerms;
      }
      if (settings.duplicateHandling) {
        const handling = DOMCache.get("duplicateHandling");
        if (handling) handling.value = settings.duplicateHandling;
      }

      // 加载文件处理设置
      if (settings.maxFileSize) {
        const maxSize = DOMCache.get("maxFileSize");
        if (maxSize) maxSize.value = settings.maxFileSize;
      }
      if (settings.formatXML !== undefined) {
        const format = DOMCache.get("formatXML");
        if (format) format.checked = settings.formatXML;
      }
      if (settings.formatXLIFF !== undefined) {
        const format = DOMCache.get("formatXLIFF");
        if (format) format.checked = settings.formatXLIFF;
      }
      if (settings.formatJSON !== undefined) {
        const format = DOMCache.get("formatJSON");
        if (format) format.checked = settings.formatJSON;
      }
      if (settings.formatPO !== undefined) {
        const format = DOMCache.get("formatPO");
        if (format) format.checked = settings.formatPO;
      }
      if (settings.formatRESX !== undefined) {
        const format = DOMCache.get("formatRESX");
        if (format) format.checked = settings.formatRESX;
      }
      if (settings.formatIOSStrings !== undefined) {
        const format = DOMCache.get("formatIOSStrings");
        if (format) format.checked = settings.formatIOSStrings;
      }
      if (settings.formatQtTS !== undefined) {
        const format = DOMCache.get("formatQtTS");
        if (format) format.checked = settings.formatQtTS;
      }
      if (settings.formatTextFallback !== undefined) {
        const format = DOMCache.get("formatTextFallback");
        if (format) format.checked = settings.formatTextFallback;
      }
      if (settings.autoDetectEncoding !== undefined) {
        const auto = DOMCache.get("autoDetectEncoding");
        if (auto) auto.checked = settings.autoDetectEncoding;
      }
      if (settings.autoTranslateOnImport !== undefined) {
        const auto = DOMCache.get("autoTranslateOnImport");
        if (auto) auto.checked = settings.autoTranslateOnImport;
      }

      // 加载并解密 API 密钥
      if (settings.deepseekApiKey) {
        const deepseekKey = DOMCache.get("deepseekApiKey");
        if (deepseekKey) {
          const decrypted = await securityUtils.decrypt(
            settings.deepseekApiKey
          );
          deepseekKey.value = decrypted;
        }
      }
      if (settings.openaiApiKey) {
        const openaiKey = DOMCache.get("openaiApiKey");
        if (openaiKey) {
          const decrypted = await securityUtils.decrypt(settings.openaiApiKey);
          openaiKey.value = decrypted;
        }
      }
      if (settings.googleApiKey) {
        const googleKey = DOMCache.get("googleApiKey");
        if (googleKey) {
          const decrypted = await securityUtils.decrypt(settings.googleApiKey);
          googleKey.value = decrypted;
        }
      }
      if (settings.geminiApiKey) {
        const geminiKey = DOMCache.get("geminiApiKey");
        if (geminiKey) {
          const decrypted = await securityUtils.decrypt(settings.geminiApiKey);
          geminiKey.value = decrypted;
        }
      }
      if (settings.claudeApiKey) {
        const claudeKey = DOMCache.get("claudeApiKey");
        if (claudeKey) {
          const decrypted = await securityUtils.decrypt(settings.claudeApiKey);
          claudeKey.value = decrypted;
        }
      }

      // 应用设置
      applySettings(settings);
    } catch (e) {
      (loggers.app || console).error("加载设置失败:", e);
    }
  }

  if (!settings || Object.keys(settings).length === 0) {
    const themeMode = DOMCache.get("themeMode");
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
    const wasDark = body.classList.contains("dark-mode");
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
    const isDark = body.classList.contains("dark-mode");
    if (wasDark !== isDark) {
      body.classList.add("theme-transitioning");
      setTimeout(function () { body.classList.remove("theme-transitioning"); }, 400);
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
