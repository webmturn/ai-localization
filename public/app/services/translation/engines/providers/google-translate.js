// ==================== Google Translate 翻译引擎 ====================
// 传统翻译引擎，使用 Google Translation API v2

EngineRegistry.register({
  id: "google",
  name: "Google Translate",
  category: "traditional",
  apiUrl: "https://translation.googleapis.com/language/translate/v2",
  apiKeyField: "googleApiKey",
  apiKeyValidationType: "google",
  defaultModel: "",
  authHeaderBuilder: function (key) {
    return { "X-Goog-Api-Key": key };
  },
  supportsJsonMode: false,
  supportsBatch: false,
  extraBodyParams: {},
  rateLimitPerSecond: 10,

  // 传统引擎专用：构建请求
  _buildRequest: function (cleanText, sourceLang, targetLang, apiKey, settings) {
    return {
      url: "https://translation.googleapis.com/language/translate/v2",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: {
        q: cleanText,
        source: sourceLang,
        target: targetLang,
        format: "text",
      },
    };
  },

  // 传统引擎专用：解析响应
  _parseResponse: function (data) {
    var translated = data?.data?.translations?.[0]?.translatedText;
    if (translated === undefined || translated === null) {
      throw new Error("Google Translate API 返回数据结构异常：缺少 data.translations[0].translatedText");
    }
    return translated;
  },
});
