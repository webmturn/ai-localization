// 获取保存的API设置（带解密）
TranslationService.prototype.getSettings = async function () {
  const savedSettings = localStorage.getItem("translatorSettings");
  if (!savedSettings) return {};

  try {
    const settings = safeJsonParse(savedSettings, {});

    // 尝试解密API密钥（如果是加密的）
    if (settings.openaiApiKey && settings.openaiApiKey.length > 50) {
      settings.openaiApiKey = await securityUtils.decrypt(
        settings.openaiApiKey
      );
    }
    if (settings.googleApiKey && settings.googleApiKey.length > 50) {
      settings.googleApiKey = await securityUtils.decrypt(
        settings.googleApiKey
      );
    }
    if (settings.deepseekApiKey && settings.deepseekApiKey.length > 50) {
      settings.deepseekApiKey = await securityUtils.decrypt(
        settings.deepseekApiKey
      );
    }

    return settings;
  } catch (error) {
    console.error("读取设置失败:", error);
    return {};
  }
};

const __DEFAULT_PROJECT_PROMPT_TEMPLATES = {
  openai: `你是一位专业的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 保持原文的语气和风格（正式/非正式）
4. 对于UI文本，要简洁明了
5. 专有名词、品牌名、技术术语保持原样或使用通用译名
6. 只返回翻译结果，不要添加任何解释或说明`,
  deepseek: `你是一位专业的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 保持原文的语气和风格（正式/非正式）
4. 对于UI文本，要简洁明了
5. 专有名词、品牌名、技术术语保持原样或使用通用译名
6. 只返回翻译结果，不要添加任何解释或说明`,
  deepseekBatch: `你是一位专业的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 对于UI文本，要简洁明了
4. 严格保留原文中的占位符、标记与格式（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增
5. key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写
6. 你必须使用 JSON 格式输出。只输出 JSON，不要输出任何解释。`,
};

try {
  if (typeof window !== "undefined") {
    if (window.ArchDebug) {
      window.ArchDebug.setFlag(
        'DEFAULT_PROJECT_PROMPT_TEMPLATES',
        __DEFAULT_PROJECT_PROMPT_TEMPLATES,
        {
          windowKey: '__DEFAULT_PROJECT_PROMPT_TEMPLATES',
          mirrorWindow: false,
        }
      );
    } else {
      window.__DEFAULT_PROJECT_PROMPT_TEMPLATES = __DEFAULT_PROJECT_PROMPT_TEMPLATES;
    }
  }
} catch (_) {}

__DEFAULT_PROJECT_PROMPT_TEMPLATES.general =
  __DEFAULT_PROJECT_PROMPT_TEMPLATES.openai || "";

const __PROJECT_PROMPT_TEMPLATE_DEEPSEEK_BATCH_SUFFIX =
  "\n\n批量翻译额外要求：" +
  "\n- 严格保留原文中的占位符、标记与格式（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增" +
  "\n- key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写" +
  "\n- 你必须使用 JSON 格式输出。只输出 JSON，不要输出任何解释。";

function __projectPromptTemplateEnsureDeepseekBatchSuffix(base) {
  const s = base == null ? "" : String(base);
  const hasPlaceholders = /严格保留原文中的占位符/.test(s);
  const hasKeyRule = /key\/字段名仅作为上下文参考/.test(s);
  const hasJsonRule = /JSON\s*格式输出/.test(s) || /只输出\s*JSON/.test(s);
  if (hasPlaceholders && hasKeyRule && hasJsonRule) return s;
  return s + __PROJECT_PROMPT_TEMPLATE_DEEPSEEK_BATCH_SUFFIX;
}

TranslationService.prototype.getDefaultProjectPromptTemplate = function (
  engineKey
) {
  const key = (engineKey || "").toString();
  return __DEFAULT_PROJECT_PROMPT_TEMPLATES[key] || "";
};

TranslationService.prototype.getProjectPromptTemplate = function (engineKey) {
  const key = (engineKey || "").toString();
  const project = typeof AppState !== "undefined" ? AppState?.project : null;
  const pt = project ? project.promptTemplate : null;

  if (!pt) return "";

  if (typeof pt === "string") {
    if (key === "deepseekBatch") return "";
    return pt;
  }

  if (key === "general") {
    const v = pt.general;
    return typeof v === "string" ? v : "";
  }

  if (key === "deepseekBatch") {
    const v = pt.deepseekBatch ?? pt.deepseek_batch ?? pt.batch;
    return typeof v === "string" ? v : "";
  }

  const v = pt[key];
  return typeof v === "string" ? v : "";
};

TranslationService.prototype.getEffectiveProjectPromptTemplate = function (
  engineKey
) {
  const key = (engineKey || "").toString();

  const raw = this.getProjectPromptTemplate(key);
  if (raw && raw.trim()) {
    if (key === "deepseekBatch") {
      return __projectPromptTemplateEnsureDeepseekBatchSuffix(raw);
    }
    return raw;
  }

  const general = this.getProjectPromptTemplate("general");
  if (key === "deepseekBatch") {
    const deepseekBase = this.getProjectPromptTemplate("deepseek");
    const base =
      deepseekBase && deepseekBase.trim()
        ? deepseekBase
        : general && general.trim()
          ? general
          : "";
    if (base && base.trim()) {
      return __projectPromptTemplateEnsureDeepseekBatchSuffix(base);
    }
  }

  if (general && general.trim()) {
    return general;
  }

  return this.getDefaultProjectPromptTemplate(key);
};

TranslationService.prototype.renderProjectPromptTemplate = function (
  template,
  vars
) {
  let out = template == null ? "" : String(template);
  const v = vars && typeof vars === "object" ? vars : {};
  const keys = ["sourceLanguage", "targetLanguage", "sourceLang", "targetLang"];

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (v[k] === undefined || v[k] === null) continue;
    const value = String(v[k]);
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), value);
  }

  return out;
};

TranslationService.prototype.buildProjectSystemPrompt = function (
  engineKey,
  vars
) {
  const template = this.getEffectiveProjectPromptTemplate(engineKey);
  return this.renderProjectPromptTemplate(template, vars);
};

TranslationService.prototype.getNormalizedProjectPromptTemplate = function () {
  const project = typeof AppState !== "undefined" ? AppState?.project : null;
  const pt = project ? project.promptTemplate : null;
  const out = {};

  if (!pt) return out;
  if (typeof pt === "string") {
    out.general = pt;
    return out;
  }

  if (typeof pt.general === "string") out.general = pt.general;

  if (typeof pt.openai === "string") out.openai = pt.openai;
  if (typeof pt.deepseek === "string") out.deepseek = pt.deepseek;
  if (typeof pt.deepseekBatch === "string") out.deepseekBatch = pt.deepseekBatch;
  else if (typeof pt.deepseek_batch === "string") out.deepseekBatch = pt.deepseek_batch;
  else if (typeof pt.batch === "string") out.deepseekBatch = pt.batch;

  return out;
};
