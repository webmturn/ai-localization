// 获取保存的API设置（带解密）
TranslationService.prototype.getSettings = async function () {
  const settings = SettingsCache.get();
  if (!settings || Object.keys(settings).length === 0) return {};

  try {

    // 尝试解密API密钥（如果是加密的）
    // 加密后的 Base64 字符串通常远长于原始 API Key，50 为安全阈值
    const _encryptedMinLen = 50;
    const _apiKeyFields = ['openaiApiKey', 'googleApiKey', 'deepseekApiKey', 'geminiApiKey', 'claudeApiKey'];
    for (const field of _apiKeyFields) {
      if (settings[field] && settings[field].length > _encryptedMinLen) {
        settings[field] = await securityUtils.decrypt(settings[field]);
      }
    }

    return settings;
  } catch (error) {
    (loggers.translation || console).error("读取设置失败:", error);
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
} catch (_) {
  (loggers.translation || console).debug("translation settings global register:", _);
}

__DEFAULT_PROJECT_PROMPT_TEMPLATES.general =
  __DEFAULT_PROJECT_PROMPT_TEMPLATES.openai || "";

const __AI_BATCH_PROMPT_SUFFIX =
  "\n\n批量翻译额外要求：" +
  "\n- 严格保留原文中的占位符、标记与格式（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增" +
  "\n- key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写" +
  "\n- 你必须使用 JSON 格式输出。只输出 JSON，不要输出任何解释。";

function __ensureAiBatchSuffix(base) {
  const s = base == null ? "" : String(base);
  const hasPlaceholders = /严格保留原文中的占位符/.test(s);
  const hasKeyRule = /key\/字段名仅作为上下文参考/.test(s);
  const hasJsonRule = /JSON\s*格式输出/.test(s) || /只输出\s*JSON/.test(s);
  if (hasPlaceholders && hasKeyRule && hasJsonRule) return s;
  return s + __AI_BATCH_PROMPT_SUFFIX;
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
    if (key.endsWith("Batch")) return "";
    return pt;
  }

  if (key === "general") {
    const v = pt.general;
    return typeof v === "string" ? v : "";
  }

  // 批量翻译 key（如 deepseekBatch, openaiBatch, geminiBatch 等）
  // 先查精确 key，再查通用 aiBatch，再查旧 deepseekBatch 兼容
  if (key.endsWith("Batch")) {
    const v = pt[key] ?? pt.aiBatch ?? pt.deepseekBatch ?? pt.deepseek_batch ?? pt.batch;
    return typeof v === "string" ? v : "";
  }

  const v = pt[key];
  return typeof v === "string" ? v : "";
};

TranslationService.prototype.getEffectiveProjectPromptTemplate = function (
  engineKey
) {
  const key = (engineKey || "").toString();
  const isBatch = key.endsWith("Batch");

  const raw = this.getProjectPromptTemplate(key);
  if (raw && raw.trim()) {
    return isBatch ? __ensureAiBatchSuffix(raw) : raw;
  }

  const general = this.getProjectPromptTemplate("general");
  if (isBatch) {
    // 尝试找引擎单条覆盖 -> 通用 -> 默认
    const engineBase = key.replace(/Batch$/, "");
    const engineOverride = this.getProjectPromptTemplate(engineBase);
    const base =
      engineOverride && engineOverride.trim()
        ? engineOverride
        : general && general.trim()
          ? general
          : "";
    if (base && base.trim()) {
      return __ensureAiBatchSuffix(base);
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

  // aiBatch 通用批量模板（向后兼容 deepseekBatch）
  if (typeof pt.aiBatch === "string") out.aiBatch = pt.aiBatch;
  else if (typeof pt.deepseekBatch === "string") out.aiBatch = pt.deepseekBatch;
  else if (typeof pt.deepseek_batch === "string") out.aiBatch = pt.deepseek_batch;
  else if (typeof pt.batch === "string") out.aiBatch = pt.batch;

  return out;
};
