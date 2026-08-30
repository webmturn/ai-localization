// ==================== Google Translate 翻译引擎 ====================
// 传统翻译引擎，使用 Google Translation API v2

EngineRegistry.register({
  id: "google",
  name: "Google Translate",
  category: "traditional",
  // 传统引擎唯一 URL 源：_buildRequest 复用此值（原先两处字面量重复，改一处不生效）
  apiUrl: "https://translation.googleapis.com/language/translate/v2",
  apiKeyField: "googleApiKey",
  apiKeyValidationType: "google",
  defaultModel: "",
  supportsJsonMode: false,
  supportsBatch: false,
  extraBodyParams: {},
  rateLimitPerSecond: 10,

  // 传统引擎专用：构建请求（authHeaderBuilder 对传统引擎无效，headers 在此构建）
  _buildRequest: function (cleanText, sourceLang, targetLang, apiKey, settings) {
    return {
      url: this.apiUrl,
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
