// 统一翻译接口（带重试机制和上下文支持）
// 通过 EngineRegistry 自动分发到对应引擎，无需硬编码 switch
TranslationService.prototype.translate = async function (
  text,
  sourceLang,
  targetLang,
  engine = null,
  context = null,
  maxRetries = null
) {
  if (!text || !text.trim()) {
    return text;
  }

  var engineId = (engine || EngineRegistry.getDefaultEngineId()).toString().toLowerCase();

  // 验证引擎是否已注册
  var config = EngineRegistry.get(engineId);
  if (!config) {
    throw new Error("不支持的翻译引擎: " + engineId);
  }

  if (!Number.isFinite(maxRetries)) {
    try {
      const settings = await this.getSettings();
      const raw = parseInt(settings?.retryCount);
      maxRetries = Number.isFinite(raw) ? raw : 3;
    } catch (_) {
      maxRetries = 3;
    }
  }
  maxRetries = Math.max(0, Math.min(10, parseInt(maxRetries)));

  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 速率限制
      await this.checkRateLimit(engineId);

      // 通过引擎分类分发到对应的基类
      let result;
      if (config.category === "ai") {
        result = await AIEngineBase.translateSingle(
          engineId, text, sourceLang, targetLang, context, this
        );
      } else {
        result = await TraditionalEngineBase.translateSingle(
          engineId, text, sourceLang, targetLang, this
        );
      }

      return result;
    } catch (error) {
      lastError = error;
      const message = error && error.message ? error.message : String(error);
      const status = error?.status;
      const isAuthError =
        message.includes("API密钥未配置") ||
        message.includes("API密钥格式不正确") ||
        message.includes("401") ||
        message.includes("403") ||
        status === 401 ||
        status === 403 ||
        /authentication\s*fails/i.test(message) ||
        /unauthorized/i.test(message) ||
        /invalid\s+api\s*key/i.test(message) ||
        /api\s*key[^\n]*invalid/i.test(message);

      if (isAuthError) {
        (loggers.translation || console).warn("鉴权失败，停止重试:", message);
        lastError = new Error(config.name + " API 密钥无效或未配置，请在设置中检查");
        lastError.status = status;
        break;
      }

      // 配额耗尽（如 OpenAI 余额不足）：不可重试
      const isQuotaError =
        /exceeded.*quota/i.test(message) ||
        /insufficient.*quota/i.test(message) ||
        /billing/i.test(message) ||
        status === 402;

      if (isQuotaError) {
        (loggers.translation || console).warn("配额耗尽，停止重试:", message);
        lastError = new Error(config.name + " 账户配额已用完，请充值或更换引擎");
        lastError.status = status;
        break;
      }

      const isRateLimited =
        !isQuotaError && (
          status === 429 ||
          message.includes("429") ||
          /rate\s*limit/i.test(message) ||
          /too\s*many\s*requests/i.test(message)
        );

      // 429 时触发共享冷却，让所有并发 worker 暂停
      if (isRateLimited && typeof this.reportRateLimit === "function") {
        const retryAfter = error?.retryAfter;
        this.reportRateLimit(engineId, retryAfter || 30);
      }

      (loggers.translation || console).warn(
        `翻译尝试 ${attempt + 1}/${maxRetries} 失败${isRateLimited ? " (速率限制)" : ""}:`,
        message
      );

      // 429 时不再自行等待，由 checkRateLimit 的冷却队列统一控制
      if (attempt < maxRetries - 1) {
        if (isRateLimited) {
          // 直接进入下一次循环，checkRateLimit 会阻塞到冷却结束
          continue;
        }
        const baseDelay = 1000;
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError || new Error("翻译失败");
};
