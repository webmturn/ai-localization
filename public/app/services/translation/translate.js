// 统一翻译接口（带重试机制和上下文支持）
TranslationService.prototype.translate = async function (
  text,
  sourceLang,
  targetLang,
  engine = "deepseek",
  context = null,
  maxRetries = null
) {
  if (!text || !text.trim()) {
    return text;
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
      await this.checkRateLimit(engine);

      // 调用对应的翻译服务（传递上下文）
      let result;
      switch (engine.toLowerCase()) {
        case "deepseek":
          result = await this.translateWithDeepSeek(
            text,
            sourceLang,
            targetLang,
            context
          );
          break;
        case "openai":
          result = await this.translateWithOpenAI(
            text,
            sourceLang,
            targetLang,
            context
          );
          break;
        case "google":
          result = await this.translateWithGoogle(text, sourceLang, targetLang);
          break;
        default:
          throw new Error(`不支持的翻译引擎: ${engine}`);
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
        console.warn("鉴权失败，停止重试:", message);
        break;
      }

      console.warn(`翻译尝试 ${attempt + 1}/${maxRetries} 失败:`, message);

      // 等待后重试（指数退避）
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError || new Error("翻译失败");
};
