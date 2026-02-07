// 批量翻译接口
TranslationService.prototype.translateBatch = async function (
  items,
  sourceLang,
  targetLang,
  engine = "deepseek",
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

  const normalizedEngine = (engine || "").toString().toLowerCase();

  const getItemKey = (item) => {
    try {
      return String(
        item?.metadata?.resourceId ||
          item?.metadata?.key ||
          item?.metadata?.path ||
          item?.metadata?.unitId ||
          item?.metadata?.contextName ||
          item?.id ||
          ""
      );
    } catch (_) {
      return "";
    }
  };

  const getFileBase = (item) => {
    try {
      const f = String(item?.metadata?.file || "");
      if (!f) return "";
      const parts = f.split(/\\|\//g);
      return parts[parts.length - 1] || f;
    } catch (_) {
      return "";
    }
  };

  const toSnippet = (text, maxLen) => {
    const s = (text || "").toString().replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
  };

  if (normalizedEngine === "deepseek") {
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
        onProgress(0, total, "正在请求 DeepSeek 批量翻译...");
      }
      if (typeof addProgressLog === "function") {
        addProgressLog({
          level: "info",
          message: `开始批量翻译（DeepSeek）：${total} 项（${sourceLang} → ${targetLang}）`,
        });
      }

      const logBuffer = [];
      const flushLogs = () => {
        if (typeof addProgressLog !== "function") return;
        if (logBuffer.length === 0) return;
        addProgressLog(logBuffer.splice(0));
      };

      const translatedList = await this.translateBatchWithDeepSeek(
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
        }
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
        item.qualityScore = Math.floor(Math.random() * 20) + 80;

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
      const msgLower = msg.toLowerCase();
      const code = error?.code;
      const isKeyError =
        code === "API_KEY_MISSING" ||
        code === "API_KEY_INVALID" ||
        /api\s*key/.test(msgLower) &&
          (/missing/.test(msgLower) || /not\s*configured/.test(msgLower) || /invalid/.test(msgLower)) ||
        /密钥未配置/.test(msg) ||
        /api密钥未配置/.test(msgLower) ||
        /未配置.*密钥/.test(msg);

      const isUserCancelled =
        error?.code === "USER_CANCELLED" ||
        error?.message === "用户取消" ||
        error?.message === "请求已取消或超时" ||
        error?.message === "请求已取消" ||
        (!AppState.translations.isInProgress &&
          (error?.name === "AbortError" ||
            /aborted|abort|cancell/i.test(error?.message || "")));

      if (isUserCancelled) {
        const partial = Array.isArray(error?.partialOutputs)
          ? error.partialOutputs
          : [];

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (i < partial.length) {
            const translated = partial[i];
            item.targetText = translated;
            item.status = "translated";
            item.qualityScore = Math.floor(Math.random() * 20) + 80;

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

      if (isKeyError) {
        if (typeof addProgressLog === "function") {
          addProgressLog({
            level: "error",
            message: `DeepSeek 批量翻译失败: ${msg || "DeepSeek API密钥未配置"}`,
          });
        }

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item) item.status = "pending";
          errors.push({
            success: false,
            index: i,
            error: msg || "DeepSeek API密钥未配置",
            status: error?.status,
            code: error?.code,
            provider: error?.provider,
            url: error?.url,
            item,
          });
        }

        if (onProgress) {
          onProgress(0, total, "DeepSeek API Key 未配置，已中止批量翻译");
        }

        return { results, errors };
      }

      if (typeof addProgressLog === "function") {
        addProgressLog({
          level: "error",
          message: `DeepSeek 批量翻译失败: ${msg || error}`,
        });
      }
      (loggers.translation || console).warn(
        "DeepSeek 批量翻译失败，将回退为逐项翻译:",
        msg || error
      );
    }
  }

  // 其他引擎：预检 API Key，避免逐项失败刷屏
  if (normalizedEngine === "openai" || normalizedEngine === "google") {
    const settings = await this.getSettings().catch(() => ({}));
    let key = "";
    let providerLabel = normalizedEngine === "openai" ? "OpenAI" : "Google Translate";
    let validateType = normalizedEngine === "openai" ? "openai" : "google";

    if (normalizedEngine === "openai") {
      key = settings.openaiApiKey;
    } else {
      key = settings.googleApiKey;
    }

    const missing = !key;
    const invalid = !missing && !securityUtils.validateApiKey(key, validateType);

    if (missing || invalid) {
      const msg = missing
        ? `${providerLabel} API密钥未配置`
        : `${providerLabel} API密钥格式不正确`;

      if (typeof addProgressLog === "function") {
        addProgressLog({ level: "error", message: msg });
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item) item.status = "pending";
        errors.push({
          success: false,
          index: i,
          error: msg,
          code: missing ? "API_KEY_MISSING" : "API_KEY_INVALID",
          provider: normalizedEngine,
          item,
        });
      }

      if (onProgress) {
        onProgress(0, total, `${providerLabel} API Key 未配置/无效，已中止批量翻译`);
      }

      return { results, errors };
    }
  }

  // 逐项处理（支持并发）
  const nonDeepseekSettings = await this.getSettings().catch(() => ({}));
  const rawLimit = parseInt(nonDeepseekSettings?.concurrentLimit);
  const concurrentLimit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(10, rawLimit))
    : 1;

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
        engine,
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
      item.qualityScore = Math.floor(Math.random() * 20) + 80;

      results.push({
        success: true,
        index: i,
        result: translated,
        item: item,
      });

      const logText =
        item.sourceText.length > 30
          ? item.sourceText.substring(0, 30) + "..."
          : item.sourceText;
      addProgressLog(`已翻译: ${logText}`);
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

      const logText =
        item.sourceText.length > 30
          ? item.sourceText.substring(0, 30) + "..."
          : item.sourceText;
      addProgressLog(`失败: ${logText} - ${(error && error.message) || error}`);
    } finally {
      completed++;
      if (onProgress) {
        const item2 = items[i] || {};
        const currentText =
          (item2.sourceText || "").length > 50
            ? item2.sourceText.substring(0, 50) + "..."
            : item2.sourceText || "";
        onProgress(completed, total, `[${completed}/${total}] ${currentText}`);
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
