// 获取保存的API设置（带解密）
// 解密缓存：避免每次调用都执行 PBKDF2 解密（批量翻译时可达数百次）
var _decryptedSettingsCache = {
  _result: null,
  _sourceRef: null, // 引用比较，SettingsCache.get() 返回同一对象时跳过解密
};

TranslationService.prototype.getSettings = async function () {
  const settings = SettingsCache.get();
  if (!settings || Object.keys(settings).length === 0) return {};

  // 引用未变说明底层设置未更新，复用已解密的结果
  if (_decryptedSettingsCache._sourceRef === settings && _decryptedSettingsCache._result) {
    return _decryptedSettingsCache._result;
  }

  try {
    // 使用副本解密，避免污染 SettingsCache 的内部缓存对象
    const copy = JSON.parse(JSON.stringify(settings));

    // 尝试解密API密钥（如果是加密的）
    // 加密后的 Base64 字符串通常远长于原始 API Key，50 为安全阈值
    const _encryptedMinLen = 50;
    const _apiKeyFields = ['openaiApiKey', 'googleApiKey', 'deepseekApiKey', 'geminiApiKey', 'claudeApiKey'];
    Object.keys(copy).forEach(function (field) {
      if (field.indexOf('customApiKey_') === 0 && _apiKeyFields.indexOf(field) === -1) {
        _apiKeyFields.push(field);
      }
    });
    for (const field of _apiKeyFields) {
      if (copy[field] && copy[field].length > _encryptedMinLen) {
        try {
          copy[field] = await securityUtils.decrypt(copy[field]);
        } catch (e) {
          (loggers.translation || console).debug("解密 API Key 失败:", field, e);
        }
      }
    }

    _decryptedSettingsCache._sourceRef = settings;
    _decryptedSettingsCache._result = copy;

    return copy;
  } catch (error) {
    (loggers.translation || console).error("读取设置失败:", error);
    return {};
  }
};

// ==================== 默认 Prompt 模板（v2：本地化质量优化） ====================
// 注意：__ensureAiBatchSuffix 依赖以下关键词做去重检测，修改时需保留：
//   "严格保留原文中的占位符" / "key/字段名仅作为上下文参考" / "JSON 格式输出"
const __DEFAULT_PROJECT_PROMPT_TEMPLATES = {
  openai: `你是一位资深的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译，擅长 UI 文案与软件资源文件的本地化。

核心翻译原则：
1. 忠实传达原文语义，避免逐字直译；译文自然流畅，符合{{targetLanguage}}的表达习惯，杜绝翻译腔
2. 保持原文的语气、风格与正式程度（正式/非正式、友好/严肃）
3. 专业术语全文保持一致：同一术语始终使用同一译法；若提供术语库，必须优先采用术语库指定译名
4. UI 文本优先简洁直白：按钮、菜单、提示等界面文案简短清晰，符合交互场景
5. 专有名词、品牌名、产品名与代码标识符保持原样，不翻译、不音译（除非已有通用译名）
6. 控制译文长度与原文相当，不随意增删信息，不补充原文没有的内容

占位符与格式约束：
7. 严格保留原文中的占位符、变量与标记：%s、%d、%1$s、{0}、{{var}}、<b>...</b>、&amp; 等，不得丢失、不得新增、不得改变位置
8. 保留原文的换行与空格结构：多行文本行数保持一致

输出要求：
9. 只输出译文本身，不要添加任何解释、注释或原文复述`,
  deepseek: `你是一位资深的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译，擅长 UI 文案与软件资源文件的本地化。

核心翻译原则：
1. 忠实传达原文语义，避免逐字直译；译文自然流畅，符合{{targetLanguage}}的表达习惯，杜绝翻译腔
2. 保持原文的语气、风格与正式程度（正式/非正式、友好/严肃）
3. 专业术语全文保持一致：同一术语始终使用同一译法；若提供术语库，必须优先采用术语库指定译名
4. UI 文本优先简洁直白：按钮、菜单、提示等界面文案简短清晰，符合交互场景
5. 专有名词、品牌名、产品名与代码标识符保持原样，不翻译、不音译（除非已有通用译名）
6. 控制译文长度与原文相当，不随意增删信息，不补充原文没有的内容

占位符与格式约束：
7. 严格保留原文中的占位符、变量与标记：%s、%d、%1$s、{0}、{{var}}、<b>...</b>、&amp; 等，不得丢失、不得新增、不得改变位置
8. 保留原文的换行与空格结构：多行文本行数保持一致

输出要求：
9. 只输出译文本身，不要添加任何解释、注释或原文复述`,
  deepseekBatch: `你是一位资深的软件本地化翻译专家，精通{{sourceLanguage}}到{{targetLanguage}}的翻译，擅长 UI 文案与软件资源文件的本地化。

核心翻译原则：
1. 忠实传达原文语义，避免逐字直译；译文自然流畅，符合{{targetLanguage}}的表达习惯，杜绝翻译腔
2. 保持原文的语气、风格与正式程度（正式/非正式、友好/严肃）
3. 专业术语全文保持一致：同一术语始终使用同一译法；若提供术语库，必须优先采用术语库指定译名
4. UI 文本优先简洁直白：按钮、菜单、提示等界面文案简短清晰，符合交互场景
5. 专有名词、品牌名、产品名与代码标识符保持原样，不翻译、不音译（除非已有通用译名）
6. 控制译文长度与原文相当，不随意增删信息，不补充原文没有的内容

占位符与格式约束：
7. 严格保留原文中的占位符、变量与标记：%s、%d、%1$s、{0}、{{var}}、<b>...</b>、&amp; 等，不得丢失、不得新增、不得改变位置
8. 保留原文的换行与空格结构：多行文本行数保持一致

批量输出要求：
9. 输入为多条文本（JSON 数组形式），逐条翻译，条目之间互不干扰
10. key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写
11. 你必须使用 JSON 格式输出，结构为 {"translations":["...","..."]}：数组长度与输入完全一致，顺序一一对应，只输出 JSON，不要输出任何解释`,
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
} catch (e) {
  (loggers.translation || console).debug("translation settings global register:", e);
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
