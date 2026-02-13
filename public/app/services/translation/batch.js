// 批量翻译接口
// 通过 EngineRegistry 自动分发：AI 引擎走批量 JSON 路径，传统/不支持批量的引擎走逐项路径
TranslationService.prototype.translateBatch = async function (
  items,
  sourceLang,
  targetLang,
  engine = null,
  onProgress = null
) {
  const results = [];
  const errors = [];
  let completed = 0;
  const total = items.length;
  let pauseNotified = false;

  const waitWhilePaused = async () => {
    while (AppState.translations.isPaused) {
      if (!AppState.translations.isInProgress) return false;
      if (!pauseNotified) {
        pauseNotified = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    pauseNotified = false;
    return true;
  };

  (loggers.translation || console).info(`开始批量翻译: ${total} 项`);

  const normalizedEngine = (engine || EngineRegistry.getDefaultEngineId()).toString().toLowerCase();
  const engineConfig = EngineRegistry.get(normalizedEngine);

  const getItemKey = translationGetItemKey;
  const getFileBase = translationGetFileBase;
  const toSnippet = translationToSnippet;

  // ========== AI 引擎批量路径 ==========
  if (engineConfig && engineConfig.category === "ai" && engineConfig.supportsBatch) {
    try {
      if (!AppState.translations.isInProgress) {
        (loggers.translation || console).debug("翻译已被取消 (尚未开始)");
        return { results, errors };
      }

      if (!(await waitWhilePaused())) {
        (loggers.translation || console).debug("翻译已被取消 (暂停等待)");
        return { results, errors };
      }

      if (onProgress) {
        onProgress(0, total, "正在请求 " + engineConfig.name + " 批量翻译...");
      }
      if (typeof addProgressLog === "function") {
        addProgressLog({
          level: "info",
          message: `开始批量翻译（${engineConfig.name}）：${total} 项（${sourceLang} → ${targetLang}）`,
        });
      }

      const logBuffer = [];
      const flushLogs = () => {
        if (typeof addProgressLog !== "function") return;
        if (logBuffer.length === 0) return;
        addProgressLog(logBuffer.splice(0));
      };

      const translatedList = await AIEngineBase.translateBatch(
        normalizedEngine,
        items,
        sourceLang,
        targetLang,
        {
          onProgress,
          onLog: (msg) => {
            if (typeof addProgressLog === "function") {
              addProgressLog({ level: "info", message: msg });
            }
          },
        },
        this
      );

      for (let i = 0; i < items.length; i++) {
        if (!(await waitWhilePaused())) {
          errors.push({
            success: false,
            index: i,
            error: "用户取消",
            item: items[i],
          });
          (loggers.translation || console).debug("翻译已被取消");
          break;
        }
        if (!AppState.translations.isInProgress) {
          flushLogs();
          errors.push({
            success: false,
            index: i,
            error: "用户取消",
            item: items[i],
          });
          (loggers.translation || console).debug(`翻译已被取消`);
          break;
        }

        const item = items[i];
        const translated = translatedList[i];
        item.targetText = translated;
        item.status = "translated";

        results.push({
          success: true,
          index: i,
          result: translated,
          item: item,
        });

        if (typeof addProgressLog === "function") {
          const fileBase = getFileBase(item);
          const key = getItemKey(item);
          const snippet = toSnippet(item.sourceText, 40);
          const keyPart = key ? ` | key=${key}` : "";
          const filePart = fileBase ? ` | file=${fileBase}` : "";
          logBuffer.push({
            level: "success",
            message: `[${
              i + 1
            }/${total}] 已翻译${filePart}${keyPart} | src="${snippet}"`,
          });
          if (logBuffer.length >= 10) flushLogs();
        }

        completed++;
        if (onProgress) {
          const currentText =
            item.sourceText.length > 50
              ? item.sourceText.substring(0, 50) + "..."
              : item.sourceText;
          onProgress(
            completed,
            total,
            `[${completed}/${total}] ${currentText}`
          );
        }
      }

      flushLogs();

      (loggers.translation || console).info(
        `批量翻译结束: 成功 ${results.length}, 失败 ${errors.length}`
      );
      return { results, errors };
    } catch (error) {
      const msg = (error && error.message ? String(error.message) : String(error || ""))
        .trim();

      if (translationIsUserCancelled(error, AppState.translations.isInProgress)) {
        const partial = Array.isArray(error?.partialOutputs)
          ? error.partialOutputs
          : [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (i < partial.length) {
            const translated = partial[i];
            item.targetText = translated;
            item.status = "translated";

            results.push({
              success: true,
              index: i,
              result: translated,
              item,
            });
          } else {
            item.status = "pending";
            errors.push({
              success: false,
              index: i,
              error: "用户取消",
              item,
            });
          }
        }

        if (typeof addProgressLog === "function") {
          addProgressLog({
            level: "warn",
            message: `已取消：保留已完成 ${results.length} 项，剩余 ${errors.length} 项未翻译`,
          });
        }

        if (onProgress) {
          onProgress(results.length, total, "已取消");
        }

        return { results, errors };
      }

      if (translationIsApiKeyError(error)) {
        if (typeof addProgressLog === "function") {
          addProgressLog({
            level: "error",
            message: `${engineConfig.name} 批量翻译失败: ${msg || engineConfig.name + " API密钥未配置"}`,
          });
        }

        translationMarkAllAsErrors(items, errors, msg || engineConfig.name + " API密钥未配置", {
          status: error?.status,
          code: error?.code,
          provider: error?.provider,
          url: error?.url,
        });

        if (onProgress) {
          onProgress(0, total, engineConfig.name + " API Key 未配置，已中止批量翻译");
        }

        return { results, errors };
      }

      // 批量路径 429 时触发共享冷却，让后续逐项路径等待
      const batchStatus = error?.status;
      const batchIs429 = batchStatus === 429 || (msg && (msg.includes("429") || /rate\s*limit/i.test(msg)));
      if (batchIs429 && typeof this.reportRateLimit === "function") {
        this.reportRateLimit(normalizedEngine, error?.retryAfter || 30);
      }

      if (typeof addProgressLog === "function") {
        addProgressLog({
          level: "error",
          message: `${engineConfig.name} 批量翻译失败: ${msg || error}`,
        });
      }
      (loggers.translation || console).warn(
        engineConfig.name + " 批量翻译失败，将回退为逐项翻译:",
        msg || error
      );
    }
  }

  // ========== 预检 API Key（通用，基于 EngineRegistry） ==========
  const __batchSettings = await this.getSettings().catch(() => ({}));
  if (engineConfig) {
    const key = __batchSettings[engineConfig.apiKeyField];
    const missing = !key;
    const invalid = !missing && !securityUtils.validateApiKey(key, engineConfig.apiKeyValidationType || normalizedEngine);

    if (missing || invalid) {
      const keyMsg = missing
        ? engineConfig.name + " API密钥未配置"
        : engineConfig.name + " API密钥格式不正确";

      if (typeof addProgressLog === "function") {
        addProgressLog({ level: "error", message: keyMsg });
      }

      translationMarkAllAsErrors(items, errors, keyMsg, {
        code: missing ? "API_KEY_MISSING" : "API_KEY_INVALID",
        provider: normalizedEngine,
      });

      if (onProgress) {
        onProgress(0, total, engineConfig.name + " API Key 未配置/无效，已中止批量翻译");
      }

      return { results, errors };
    }
  }

  // ========== 逐项处理（支持并发） ==========
  const rawLimit = parseInt(__batchSettings?.concurrentLimit);
  // 并发数不超过引擎速率限制（rateLimitPerSecond < 1 时强制串行）
  const engineRps = engineConfig?.rateLimitPerSecond || 3;
  const maxByEngine = engineRps < 1 ? 1 : Math.ceil(engineRps);
  const userLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(10, rawLimit)) : 1;
  const concurrentLimit = Math.min(userLimit, maxByEngine);

  // ETA 预估
  const etaStartTime = Date.now();

  const processOne = async (i) => {
    const item = items[i];
    if (!item) return;

    if (!(await waitWhilePaused())) {
      errors.push({
        success: false,
        index: i,
        error: "用户取消",
        item,
      });
      return;
    }

    if (!AppState.translations.isInProgress) {
      errors.push({
        success: false,
        index: i,
        error: "用户取消",
        item,
      });
      return;
    }

    try {
      const context = {
        elementType: item.metadata?.elementType,
        xmlPath: item.context,
        parentText: item.metadata?.parentText,
        key:
          item.metadata?.resourceId ||
          item.metadata?.key ||
          item.metadata?.path ||
          item.metadata?.unitId ||
          item.metadata?.contextName ||
          item.id,
      };

      const translated = await this.translate(
        item.sourceText,
        sourceLang,
        targetLang,
        normalizedEngine,
        context
      );

      if (!AppState.translations.isInProgress) {
        errors.push({
          success: false,
          index: i,
          error: "用户取消",
          item,
        });
        return;
      }

      item.targetText = translated;
      item.status = "translated";

      results.push({
        success: true,
        index: i,
        result: translated,
        item: item,
      });

      if (typeof addProgressLog === "function") {
        const logText =
          item.sourceText.length > 30
            ? item.sourceText.substring(0, 30) + "..."
            : item.sourceText;
        addProgressLog(`已翻译: ${logText}`);
      }
    } catch (error) {
      item.status = "pending";
      errors.push({
        success: false,
        index: i,
        error: error?.message || String(error),
        status: error?.status,
        code: error?.code,
        provider: error?.provider,
        url: error?.url,
        item: item,
      });

      if (typeof addProgressLog === "function") {
        const logText =
          item.sourceText.length > 30
            ? item.sourceText.substring(0, 30) + "..."
            : item.sourceText;
        addProgressLog(`失败: ${logText} - ${(error && error.message) || error}`);
      }
    } finally {
      completed++;
      if (onProgress) {
        const item2 = items[i] || {};
        const currentText =
          (item2.sourceText || "").length > 50
            ? item2.sourceText.substring(0, 50) + "..."
            : item2.sourceText || "";
        // ETA 预估
        let etaText = "";
        if (completed > 0 && completed < total) {
          const elapsed = Date.now() - etaStartTime;
          const avgMs = elapsed / completed;
          const remaining = Math.ceil((total - completed) * avgMs / 1000);
          if (remaining >= 60) {
            etaText = ` · 预计剩余 ${Math.floor(remaining / 60)}分${remaining % 60}秒`;
          } else {
            etaText = ` · 预计剩余 ${remaining}秒`;
          }
        }
        onProgress(completed, total, `[${completed}/${total}] ${currentText}${etaText}`);
      }
    }
  };

  if (concurrentLimit <= 1) {
    for (let i = 0; i < items.length; i++) {
      if (!(await waitWhilePaused())) {
        (loggers.translation || console).debug(`翻译已被取消 (已完成 ${completed}/${total})`);
        break;
      }
      if (!AppState.translations.isInProgress) {
        (loggers.translation || console).debug(`翻译已被取消 (已完成 ${completed}/${total})`);
        break;
      }
      await processOne(i);
      if (!AppState.translations.isInProgress) {
        (loggers.translation || console).debug("翻译已被取消");
        break;
      }
    }
  } else {
    let nextIndex = 0;
    const workers = new Array(Math.min(concurrentLimit, items.length))
      .fill(0)
      .map(async () => {
        while (true) {
          if (!(await waitWhilePaused())) return;
          if (!AppState.translations.isInProgress) return;
          const i = nextIndex;
          nextIndex++;
          if (i >= items.length) return;
          await processOne(i);
        }
      });
    await Promise.all(workers);
  }

  (loggers.translation || console).info(`批量翻译结束: 成功 ${results.length}, 失败 ${errors.length}`);
  return { results, errors };
};
