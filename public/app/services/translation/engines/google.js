// Google Translate翻译
TranslationService.prototype.translateWithGoogle = async function (
  text,
  sourceLang,
  targetLang
) {
  const settings = await this.getSettings();
  const apiKey = settings.googleApiKey;

  const cacheEnabled = !!settings.translationRequestCacheEnabled;
  const rawCacheTtlSeconds = parseInt(settings.translationRequestCacheTTLSeconds);
  const cacheTtlSeconds = Number.isFinite(rawCacheTtlSeconds)
    ? Math.max(1, Math.min(600, rawCacheTtlSeconds))
    : 5;

  if (!apiKey) {
    const err = new Error("Google Translate API密钥未配置");
    err.code = "API_KEY_MISSING";
    err.provider = "google";
    throw err;
  }

  // 验证API密钥
  if (!securityUtils.validateApiKey(apiKey, "google")) {
    const err = new Error("Google Translate API密钥格式不正确");
    err.code = "API_KEY_INVALID";
    err.provider = "google";
    throw err;
  }

  // 清理输入（不转义HTML实体，保留原始字符供翻译引擎处理）
  const cleanText = securityUtils.sanitizeForApi(text);

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await networkUtils.fetchWithDedupe(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: cleanText,
          source: sourceLang,
          target: targetLang,
          format: "text",
        }),
      },
      {
        timeout: (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000,
        dedupe: true,
        cache: cacheEnabled,
        cacheTTL: cacheTtlSeconds * 1000,
      }
    );

    if (!response.ok) {
      const raw = await response.text();
      let message = `Google Translate API错误: ${response.status}`;
      try {
        const parsed = JSON.parse(raw);
        message = parsed.error?.message || parsed.message || message;
      } catch (e) {
        if (raw && raw.trim()) {
          message = raw;
        }
      }
      const err = new Error(message);
      err.status = response.status;
      err.provider = "google";
      err.url = url;
      throw err;
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error) {
    (loggers.translation || console).error("Google翻译失败:", error);
    throw error;
  }
};
