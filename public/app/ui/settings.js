async function loadSettings({ applyRuntime = true } = {}) {
  const settings = SettingsCache.get();
  const layoutSettings = {
    desktopLayout: settings?.desktopLayout === "classic" ? "classic" : "proofreading",
    desktopSettingsPanel: settings?.desktopSettingsPanel === "expanded" ? "expanded" : "collapsed",
    compactFileImport: settings?.compactFileImport !== false,
    translationDensity: settings?.translationDensity === "comfortable" ? "comfortable" : "compact",
  };
  for (const [key, value] of Object.entries(layoutSettings)) {
    const input = DOMCache.get(key);
    if (input) {
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
  }
  if (applyRuntime) applySettings(layoutSettings);
  const setDecryptedApiKey = async function (field, elementId) {
    const input = DOMCache.get(elementId);
    if (!input) return;
    if (!settings[field]) { input.value = ""; return; }
    try {
      input.value = await securityUtils.decrypt(settings[field]);
    } catch (e) {
      input.value = "";
      (loggers.app || console).warn("API 密钥解密失败:", field, e);
    }
  };
  if (settings && Object.keys(settings).length > 0) {
    try {

      // 加载外观设置
      {
        const themeModeValue = settings.themeMode || "auto";
        const themeMode = DOMCache.get("themeMode");
        if (themeMode) themeMode.value = themeModeValue;
        if (applyRuntime) applySettings({ themeMode: themeModeValue });
      }
      if (settings.fontSize) {
        const fontSize = DOMCache.get("fontSize");
        if (fontSize) fontSize.value = settings.fontSize;
      }
      if (settings.itemsPerPage) {
        const itemsPerPage = DOMCache.get("itemsPerPage");
        if (itemsPerPage) itemsPerPage.value = settings.itemsPerPage;
        // 同步到 AppState（经 TranslationViewStore）
        if (applyRuntime) TranslationViewStore.setItemsPerPage(parseInt(settings.itemsPerPage));
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

      App.ui.engineSettings?.loadDraft(settings);
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
            } catch (e) {
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
        } catch (e) {
          (loggers.app || console).debug("settings loadPrimingCount:", e);
        }
      }

      // TM 自动应用设置 + 温度滑杆（设置页）同步
      {
        const _tmEnabled = settings.tmAutoApplyEnabled;
        const tmEl = DOMCache.get("tmAutoApplyEnabled");
        if (tmEl) tmEl.checked = _tmEnabled !== undefined ? !!_tmEnabled : true;

        const _tmThreshold = settings.tmFuzzyThreshold;
        const tmThEl = DOMCache.get("tmFuzzyThreshold");
        if (tmThEl) tmThEl.value = String(Math.max(60, Math.min(95, Number(_tmThreshold) || 75)));
        const tmThVal = DOMCache.get("tmFuzzyThresholdValue");
        if (tmThVal) tmThVal.textContent = tmThEl ? tmThEl.value : "75";

        // 应用 TM 设置到运行时（TMAutoApply）
        try {
          if (typeof TMAutoApply !== "undefined") {
            TMAutoApply.setEnabled(tmEl ? tmEl.checked : true);
            TMAutoApply.setFuzzyThreshold(tmThEl ? parseFloat(tmThEl.value) : 75);
          }
        } catch (e) {
          (loggers.app || console).debug("settings applyTmSettings:", e);
        }

        // 引擎草稿中的温度已由 engineSettings.loadDraft 按模型能力适配。
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
      for (const key of ['formatYAML', 'formatCSV']) {
        const input = DOMCache.get(key);
        if (input) input.checked = settings[key] !== false;
      }
      const encodingInput = DOMCache.get('fileEncoding');
      if (encodingInput) encodingInput.value = settings.fileEncoding || 'auto';
      const textModeInput = DOMCache.get('textParseMode');
      if (textModeInput) textModeInput.value = ['auto', 'plain', 'keyValue'].includes(settings.textParseMode) ? settings.textParseMode : 'auto';
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

      await setDecryptedApiKey("deepseekApiKey", "deepseekApiKey");
      await setDecryptedApiKey("openaiApiKey", "openaiApiKey");
      await setDecryptedApiKey("googleApiKey", "googleApiKey");
      await setDecryptedApiKey("geminiApiKey", "geminiApiKey");
      await setDecryptedApiKey("claudeApiKey", "claudeApiKey");

      // 应用设置
      if (applyRuntime) applySettings(settings);
    } catch (e) {
      (loggers.app || console).error("加载设置失败:", e);
    }
  }

  if (!settings || Object.keys(settings).length === 0) {
    const themeMode = DOMCache.get("themeMode");
    if (themeMode) themeMode.value = "auto";
    if (applyRuntime) applySettings({ themeMode: "auto" });
  }
}

// 应用设置
function applySettings(settings) {
  if (settings.translationDensity !== undefined) {
    AppState.ui.translationDensity = settings.translationDensity === "comfortable" ? "comfortable" : "compact";
    document.body.classList.toggle("compact-translation-list", AppState.ui.translationDensity === "compact");
    if (typeof syncTranslationHeights === "function") syncTranslationHeights();
  }
  if (settings.desktopLayout !== undefined || settings.desktopSettingsPanel !== undefined || settings.compactFileImport !== undefined) {
    if (settings.desktopLayout !== undefined) {
      AppState.ui.desktopLayout = settings.desktopLayout === "classic" ? "classic" : "proofreading";
    }
    if (settings.desktopSettingsPanel !== undefined) {
      AppState.ui.desktopSettingsPanel = settings.desktopSettingsPanel === "expanded" ? "expanded" : "collapsed";
    }
    if (settings.compactFileImport !== undefined) AppState.ui.compactFileImport = !!settings.compactFileImport;
    App.ui.workspaceLayout.apply();
  }
  // ui 切片默认值（sourceSelectionIndicatorEnabled / sourceSelectionIndicatorUnselectedStyle /
  // autoScrollEnabled）已在 state.js 显式声明（阶段 0），此处不再重复兜底赋值。

  // 应用主题设置
  //
  // 载体类必须加在 <html> 上：Tailwind 的 class 策略编译成后代选择器
  // （.dark\:bg-gray-900:is(.dark-mode *)），若加在 <body> 上，
  // <body> 自身写的 dark:bg-*/dark:text-* 永远不会匹配
  // （页面底色与继承文字色会留在浅色，深色模式下出现浅色带/深字）。
  if (settings.themeMode) {
    const root = document.documentElement;
    const applyDark = (on) => {
      root.classList.toggle("dark-mode", on);
      // 兼容旧读取方（charts.js 曾读 body）；两处都同步，避免图表配色判断失效
      document.body.classList.toggle("dark-mode", on);
    };
    if (settings.themeMode === "dark") {
      applyDark(true);
    } else if (settings.themeMode === "light") {
      applyDark(false);
    } else if (settings.themeMode === "auto") {
      // 根据系统主题设置
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      applyDark(prefersDark);
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
    TranslationViewStore.setItemsPerPage(parseInt(settings.itemsPerPage));
    TranslationViewStore.setPage(1); // 重置到第一页
    // 刷新翻译列表
    if (TranslationViewStore.getViewItems().length > 0) {
      updateTranslationLists();
    }
  }

  if (settings.sourceSelectionIndicatorEnabled !== undefined) {
    AppState.ui.sourceSelectionIndicatorEnabled =
      !!settings.sourceSelectionIndicatorEnabled;
    if (TranslationViewStore.getViewItems().length > 0) {
      updateTranslationLists();
    }
  }

  if (settings.sourceSelectionIndicatorUnselectedStyle) {
    AppState.ui.sourceSelectionIndicatorUnselectedStyle =
      settings.sourceSelectionIndicatorUnselectedStyle;
    if (TranslationViewStore.getViewItems().length > 0) {
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
    // quality 切片已在 state.js 显式声明（阶段 0），无需动态建切片
    AppState.quality.checkScope = settings.qualityCheckScope;
  }
}
