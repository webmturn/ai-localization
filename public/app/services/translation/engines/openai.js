// OpenAI翻译（增强版 - 支持上下文和术语库）
TranslationService.prototype.translateWithOpenAI = async function (
  text,
  sourceLang,
  targetLang,
  context = null
) {
  const settings = await this.getSettings();
  const apiKey = settings.openaiApiKey;
  const model =
    settings.model ||
    settings.translationModel ||
    settings.openaiModel ||
    "gpt-4o-mini";

  if (!apiKey) {
    const err = new Error("OpenAI API密钥未配置");
    err.code = "API_KEY_MISSING";
    err.provider = "openai";
    throw err;
  }

  // 验证API密钥
  if (!securityUtils.validateApiKey(apiKey, "openai")) {
    const err = new Error("OpenAI API密钥格式不正确");
    err.code = "API_KEY_INVALID";
    err.provider = "openai";
    throw err;
  }

  const langNames = {
    zh: "中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
  };

  const sourceLanguage = langNames[sourceLang] || sourceLang;
  const targetLanguage = langNames[targetLang] || targetLang;

  // 清理输入
  const cleanText = securityUtils.sanitizeInput(text);

  // 构建增强型提示词
  let systemPrompt = "";
  try {
    if (typeof this.buildProjectSystemPrompt === "function") {
      systemPrompt = this.buildProjectSystemPrompt("openai", {
        sourceLanguage,
        targetLanguage,
        sourceLang,
        targetLang,
      });
    }
  } catch (_) {}
  if (!systemPrompt || !systemPrompt.trim()) {
    systemPrompt = `你是一位专业的软件本地化翻译专家，精通${sourceLanguage}到${targetLanguage}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 保持原文的语气和风格（正式/非正式）
4. 对于UI文本，要简洁明了
5. 专有名词、品牌名、技术术语保持原样或使用通用译名
6. 只返回翻译结果，不要添加任何解释或说明`;
  }

  // 添加上下文信息
  if (context) {
    systemPrompt += `\n\n上下文信息：`;
    if (context.elementType)
      systemPrompt += `\n- 元素类型: ${context.elementType}`;
    if (context.xmlPath) systemPrompt += `\n- XML路径: ${context.xmlPath}`;
    if (context.parentText)
      systemPrompt += `\n- 父级文本: ${context.parentText}`;
  }

  // 检查术语库匹配
  const terminologyMatches = this.findTerminologyMatches(cleanText);
  if (terminologyMatches.length > 0) {
    systemPrompt += `\n\n术语库参考（请优先使用这些翻译）：`;
    terminologyMatches.forEach((term) => {
      systemPrompt += `\n- "${term.source}" → "${term.target}"`;
    });
  }

  try {
    const response = await networkUtils.fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: cleanText,
            },
          ],
          temperature: settings.temperature != null ? Number(settings.temperature) : 0.1,
          max_tokens: 2000,
        }),
      },
      (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000
    );

    if (!response.ok) {
      const raw = await response.text();
      let message = `OpenAI API错误: ${response.status}`;
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
      err.provider = "openai";
      err.url = "https://api.openai.com/v1/chat/completions";
      throw err;
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI翻译失败:", error);
    throw error;
  }
};
