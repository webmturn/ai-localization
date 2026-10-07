// ==================== AI 翻译引擎基类 ====================
// 从各 AI 引擎提取的通用 Chat Completions 翻译逻辑
// 所有兼容 OpenAI Chat Completions 格式的 AI 引擎共享此实现

var _AI_LANG_NAMES = {
  zh: "中文",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  "zh-HK": "繁體中文（香港）",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  pt: "Português",
  "pt-BR": "Português (Brasil)",
  it: "Italiano",
  ru: "Русский",
  ar: "العربية",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ms: "Bahasa Melayu",
  nl: "Nederlands",
  pl: "Polski",
  tr: "Türkçe",
  uk: "Українська",
  cs: "Čeština",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  el: "Ελληνικά",
  he: "עברית",
  hi: "हिन्दी",
  bn: "বাংলা",
  ro: "Română",
  hu: "Magyar",
  sk: "Slovenčina",
  bg: "Български",
  hr: "Hrvatski",
  ca: "Català",
};

// ======================== 辅助函数 ========================

function _aiResolvePrimingSamples(sampleIds, settings) {
  var ids = Array.isArray(sampleIds) ? sampleIds : [];
  if (ids.length === 0) return [];
  var all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  var byId = new Map();
  for (var i = 0; i < all.length; i++) {
    var it = all[i];
    if (it?.id) byId.set(String(it.id), it);
  }
  var out = [];
  for (var j = 0; j < ids.length; j++) {
    var item = byId.get(String(ids[j]));
    if (!item) continue;
    var source = (item?.sourceText || "").toString().trim();
    if (!source) continue;
    out.push({
      key: translationGetItemKey(item),
      source: source,
      file: item?.metadata?.file || "",
    });
  }
  return out;
}

function _aiBuildConversationKey(engineId, scope, items) {
  var projectId = AppState?.project?.id || "";
  if (!projectId) return "";
  var normalizedScope = scope || "project";
  if (normalizedScope === "project") return engineId + ":" + projectId;

  var first = Array.isArray(items) && items.length > 0 ? items[0] : null;
  if (normalizedScope === "file") {
    var file = first?.metadata?.file || "";
    return engineId + ":" + projectId + ":file:" + file;
  }

  var fileType = translationGetFileType(first);
  return engineId + ":" + projectId + ":type:" + fileType;
}

function _aiChunkItems(items, maxChars, maxItems) {
  if (!maxChars) maxChars = 6000;
  if (!maxItems) maxItems = 40;
  var chunks = [];
  var current = [];
  var currentChars = 0;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var text = (it?.sourceText || "").toString();
    var key = translationGetItemKey(it);
    var cost = text.length + key.length + 50;
    if (
      current.length > 0 &&
      (current.length >= maxItems || currentChars + cost > maxChars)
    ) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(it);
    currentChars += cost;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ======================== 自适应拆批与完整性检查 ========================
function _aiIsAdaptiveBatchError(error) {
  var code = error && error.code ? String(error.code) : "";
  var status = error && error.status;
  var msg = error && error.message ? String(error.message) : String(error || "");
  if (code === "CONTEXT_LENGTH_EXCEEDED" || code === "EMPTY_RESPONSE") return true;
  if (code === "BATCH_JSON_PARSE_FAILED" || code === "BATCH_OUTPUT_MISMATCH") return true;
  if (code === "BATCH_OUTPUT_TRUNCATED" || status === 413) return true;
  return /上下文长度超限/i.test(msg) ||
    /context[_\s-]*length[_\s-]*exceeded/i.test(msg) ||
    /maximum\s+context\s+length/i.test(msg) ||
    /prompt\s+is\s+too\s+long/i.test(msg) ||
    /exceeds?\s+the\s+max(?:imum)?\s+(?:input\s+)?tokens?/i.test(msg) ||
    /input\s+(?:is\s+)?too\s+long/i.test(msg) ||
    /token\s+limit/i.test(msg) ||
    /json\s*解析失败/i.test(msg) ||
    /unexpected\s+end/i.test(msg) ||
    /unterminated\s+string/i.test(msg) ||
    /translations\s+数量不匹配/i.test(msg) ||
    /truncat/i.test(msg) ||
    /output\s+too\s+long/i.test(msg);
}

function _aiIsTruncatedBatchResponse(respData) {
  var choice = respData?.choices?.[0];
  var finishReason = choice?.finish_reason || choice?.finishReason;
  if (finishReason && /^(length|max_tokens|MAX_TOKENS)$/i.test(String(finishReason))) return true;
  // Claude 原生 Messages API：截断信号为顶层 stop_reason（与 content 数组同级）
  if (respData?.stop_reason && /^(max_tokens|length)$/i.test(String(respData.stop_reason))) return true;
  var candidates = respData?.candidates;
  if (Array.isArray(candidates)) {
    for (var i = 0; i < candidates.length; i++) {
      var reason = candidates[i]?.finishReason;
      if (reason && /^(MAX_TOKENS|length|max_tokens)$/i.test(String(reason))) return true;
    }
  }
  return false;
}

function _aiCollectChunkContext(allItems, chunkItems, windowSize) {
  if (!allItems || !chunkItems || windowSize <= 0) return { before: [], after: [] };

  var firstId = chunkItems[0]?.id;
  var lastId = chunkItems[chunkItems.length - 1]?.id;
  var startIdx = -1, endIdx = -1;

  for (var i = 0; i < allItems.length; i++) {
    if (startIdx === -1 && allItems[i]?.id === firstId) startIdx = i;
    if (allItems[i]?.id === lastId) { endIdx = i; break; }
  }

  if (startIdx === -1) return { before: [], after: [] };

  var before = [];
  var after = [];
  var chunkIdSet = new Set(chunkItems.map(function (it) { return it?.id; }));

  for (var b = Math.max(0, startIdx - windowSize); b < startIdx; b++) {
    var bi = allItems[b];
    if (!bi || chunkIdSet.has(bi.id)) continue;
    var bs = (bi.sourceText || "").toString().trim();
    if (!bs) continue;
    before.push({
      source: bs.length > 120 ? bs.substring(0, 120) + "..." : bs,
      target: (bi.targetText || "").toString().trim().substring(0, 120) || null,
      key: translationGetItemKey(bi) || null,
    });
  }

  for (var a = endIdx + 1; a < Math.min(allItems.length, endIdx + 1 + windowSize); a++) {
    var ai = allItems[a];
    if (!ai || chunkIdSet.has(ai.id)) continue;
    var as = (ai.sourceText || "").toString().trim();
    if (!as) continue;
    after.push({
      source: as.length > 120 ? as.substring(0, 120) + "..." : as,
      target: (ai.targetText || "").toString().trim().substring(0, 120) || null,
      key: translationGetItemKey(ai) || null,
    });
  }

  return { before: before, after: after };
}

function _aiFormatContextPrompt(ctx) {
  if (!ctx) return "";
  var before = ctx.before;
  var after = ctx.after;
  if ((!before || before.length === 0) && (!after || after.length === 0)) return "";

  var text = "\n\n📎 相邻条目上下文（仅供参考，帮助你理解语境和保持翻译一致性）：";

  if (before && before.length > 0) {
    text += "\n【前文】";
    before.forEach(function (item, i) {
      text += "\n  " + (i + 1) + '. 原文: "' + item.source + '"';
      if (item.target) text += ' → 译文: "' + item.target + '"';
    });
  }

  if (after && after.length > 0) {
    text += "\n【后文】";
    after.forEach(function (item, i) {
      text += "\n  " + (i + 1) + '. 原文: "' + item.source + '"';
      if (item.target) text += ' → 译文: "' + item.target + '"';
    });
  }

  return text;
}

function _aiIsCancelled() {
  try {
    if (typeof AppState === "undefined" || !AppState?.translations) return false;
    // 取消协议经 BatchProgressStore.isUserCancelled()（语义 getter，单点文档化）
    if (typeof BatchProgressStore !== "undefined" && BatchProgressStore?.isUserCancelled) {
      return BatchProgressStore.isUserCancelled();
    }
    // 兜底（Store 未加载的降级路径，语义与 isUserCancelled 一致）：
    // 显式取消标记优先；否则仅当批量曾启动后 isInProgress 变 false 才视为取消
    if (AppState.translations._batchCancelled === true) return true;
    return !!(AppState.translations._batchStarted && AppState.translations.isInProgress === false);
  } catch (e) {
    return false;
  }
}

function _aiMakeCancelError(partialOutputs) {
  var err = new Error("用户取消");
  err.code = "USER_CANCELLED";
  err.partialOutputs = Array.isArray(partialOutputs) ? partialOutputs : [];
  return err;
}

/**
 * 去掉包裹整个文本的 markdown 代码围栏（```lang … ```）。
 * 仅当围栏包住全部内容时才剥离，避免破坏译文里本来就含反引号的情况。
 * @param {string} text
 * @returns {string}
 */
function _aiStripCodeFence(text) {
  var s = String(text == null ? "" : text).trim();
  var m = s.match(/^```[ \t]*[A-Za-z]*[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
  return m && m[1] != null ? m[1].trim() : s;
}

/**
 * 从模型返回文本中提取 JSON。
 *
 * 真实模型经常不遵守"只返回 JSON"的约定，常见形态：
 *   - ```json … ``` 代码围栏（最高频）
 *   - 前后夹带解释性文字（"好的，以下是翻译结果：" …）
 *   - 直接返回裸数组 ["a","b"] 而不是 {"translations":[...]}
 *
 * 此前只做 JSON.parse(content)，上述任一形态都会抛 BATCH_JSON_PARSE_FAILED，
 * 触发自适应拆半重试（请求数放大 4–5 倍），最终整批中止并回退逐项翻译。
 *
 * @param {string} raw - 模型返回的原始文本
 * @returns {{ok: true, value: *} | {ok: false, error: string}}
 */
function _aiExtractJson(raw) {
  var text = String(raw == null ? "" : raw).trim();
  if (!text) return { ok: false, error: "empty" };

  // 1) 直接解析
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {}

  // 2) 剥离 markdown 代码围栏（```json / ```JSON / ``` 均可，允许前后有文字）
  var fence = text.match(/```[ \t]*[A-Za-z]*[ \t]*\r?\n([\s\S]*?)```/);
  if (fence && fence[1]) {
    var inner = fence[1].trim();
    try {
      return { ok: true, value: JSON.parse(inner) };
    } catch (e) {}
    // 围栏内容仍不可解析时，继续按括号配对尝试
    text = inner;
  }

  // 3) 括号配对：取第一个 { 或 [ 到与之匹配的收尾符号
  var startObj = text.indexOf("{");
  var startArr = text.indexOf("[");
  var start = -1;
  if (startObj === -1) start = startArr;
  else if (startArr === -1) start = startObj;
  else start = Math.min(startObj, startArr);
  if (start === -1) return { ok: false, error: "no-json-delimiter" };

  var open = text[start];
  var close = open === "{" ? "}" : "]";
  var depth = 0;
  var inStr = false;
  var escaped = false;
  for (var i = start; i < text.length; i++) {
    var ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        var candidate = text.slice(start, i + 1);
        try {
          return { ok: true, value: JSON.parse(candidate) };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
    }
  }
  return { ok: false, error: "unbalanced-json" };
}

/**
 * 从解析出的响应对象中取出 translations 数组。
 * 兼容 {"translations":[…]}、裸数组 […]、以及 {"items":[…]} / {"result":[…]} 等别名。
 * @returns {Array|null}
 */
function _aiCoerceTranslations(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  var keys = ["translations", "translation", "items", "result", "results", "data"];
  for (var i = 0; i < keys.length; i++) {
    if (Array.isArray(parsed[keys[i]])) return parsed[keys[i]];
  }
  return null;
}

/**
 * 解析使用的模型，避免 settings.model 跨引擎污染
 * - 内置引擎不再声明静态模型列表（模型由 ModelFetcher 动态获取），直接采用 settings.model，
 *   为空时回退 defaultModel；用户选择的动态模型始终被接受
 * - 自定义引擎同理：动态拉取列表为唯一数据源，直接采用 settings.model
 *   （isCustom 跳过白名单——availableModels 仅含表单配置的单个模型，
 *   校验会拦截用户动态选择的模型，导致换模型静默失效）
 * - 其余程序化注册且声明 availableModels 的引擎仍校验并回退 defaultModel
 */
function _aiResolveModel(settings, config) {
  var selected = String(settings.model || settings.translationModel || "");
  if (Array.isArray(config?.retiredModels) && config.retiredModels.includes(selected)) return config.defaultModel;
  var requested = settings && settings.model ? String(settings.model) : "";
  // 自定义引擎：动态模型列表（ModelFetcher 缓存）为唯一数据源，不做白名单校验
  if (config && config.isCustom) {
    return requested || (config && config.defaultModel) || "";
  }
  var available = Array.isArray(config && config.availableModels)
    ? config.availableModels
    : null;

  if (!available || available.length === 0) {
    return requested || (config && config.defaultModel) || "";
  }

  if (requested && available.indexOf(requested) !== -1) {
    return requested;
  }

  if (requested && (loggers.translation || console).debug) {
    (loggers.translation || console).debug(
      "_aiResolveModel: settings.model=" + requested +
      " 不在 " + (config && config.id) + " 的 availableModels 中，回退到 defaultModel=" +
      ((config && config.defaultModel) || "")
    );
  }
  return (config && config.defaultModel) || available[0] || "";
}

/**
 * 温度钳制：按引擎声明的 temperatureRange 限制（默认 0-2），
 * 未设置时使用默认值 0.3，避免超出 API 限制（如 Claude 仅 0-1）
 */
function _aiClampTemperature(config, rawTemperature) {
  var range = (config && config.temperatureRange) || { min: 0, max: 2 };
  var min = Number.isFinite(range.min) ? range.min : 0;
  var max = Number.isFinite(range.max) ? range.max : 2;
  var num = rawTemperature != null ? Number(rawTemperature) : 0.3;
  if (!Number.isFinite(num)) num = 0.3;
  return Math.min(max, Math.max(min, num));
}

function _aiSupportsJsonMode(config, model) {
  if (typeof EngineRegistry !== "undefined" && typeof EngineRegistry.getModelCapability === "function") {
    return !!EngineRegistry.getModelCapability(config && config.id, model).supportsJsonMode;
  }
  if (!config || config.supportsJsonMode === false) return false;
  var unsupported = Array.isArray(config.jsonModeUnsupportedModels)
    ? config.jsonModeUnsupportedModels
    : [];
  if (!model || unsupported.length === 0) return true;
  for (var i = 0; i < unsupported.length; i++) {
    var rule = unsupported[i];
    if (rule instanceof RegExp && rule.test(model)) return false;
    if (typeof rule === "string" && rule === model) return false;
  }
  return true;
}

function _aiCreateCancelWatcher(partialOutputs, shouldCancel) {
  shouldCancel = shouldCancel || _aiIsCancelled;
  var intervalId = null;
  var cancelled = false;

  var cancelPromise = new Promise(function (_, reject) {
    if (shouldCancel()) {
      cancelled = true;
      reject(_aiMakeCancelError(partialOutputs));
      return;
    }

    intervalId = setInterval(function () {
      if (shouldCancel()) {
        cancelled = true;
        clearInterval(intervalId);
        intervalId = null;
        reject(_aiMakeCancelError(partialOutputs));
      }
    }, 300);
  });

  return {
    cancelPromise: cancelPromise,
    isCancelled: function () { return cancelled; },
    cleanup: function () {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

// ======================== 核心翻译逻辑 ========================

var AIEngineBase = {
  // 将响应按请求标识还原；拒绝缺失、重复、未知标识，避免译文落到错误原文。
  mapBatchTranslations(parsed, reqItems) {
    var rows = _aiCoerceTranslations(parsed);
    var mismatch = () => Object.assign(new Error("批量译文标识或数量不匹配"), { code: "BATCH_OUTPUT_MISMATCH" });
    if (!Array.isArray(rows) || rows.length !== reqItems.length) throw mismatch();
    // 单条响应没有顺序歧义，兼容只返回一个字符串的旧模板。
    if (reqItems.length === 1 && typeof rows[0] === "string") return rows;
    var expected = new Set(reqItems.map((it) => it.id));
    var values = new Map();
    for (var row of rows) {
      if (!row || typeof row !== "object" || !expected.has(row.id) || values.has(row.id) || !Object.prototype.hasOwnProperty.call(row, "text")) throw mismatch();
      values.set(row.id, row.text);
    }
    return reqItems.map((it) => values.get(it.id));
  },

  /**
   * 单条翻译（Chat Completions API）
   * @param {string} engineId - 引擎 ID
   * @param {string} text - 待翻译文本
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {Object|null} context - 上下文信息
   * @param {TranslationService} service - 翻译服务实例
   * @returns {Promise<string>} 翻译结果
   */
  translateSingle: async function (engineId, text, sourceLang, targetLang, context, service, shouldCancel) {
    var config = EngineRegistry.get(engineId);
    if (!config) throw new Error("未知的翻译引擎: " + engineId);

    var settings = await service.getSettings();
    var apiKey = settings[config.apiKeyField];
    var model = _aiResolveModel(settings, config);
    var noKeyNeeded = config.apiKeyValidationType === "none";

    var cacheEnabled = !!settings.translationRequestCacheEnabled;
    var rawCacheTtl = parseInt(settings.translationRequestCacheTTLSeconds);
    var cacheTtlSeconds = Number.isFinite(rawCacheTtl)
      ? Math.max(1, Math.min(600, rawCacheTtl))
      : 5;

    // 校验 API Key（自定义引擎可能配置为无需 API Key，例如本地 Ollama）
    if (!noKeyNeeded) {
      if (!apiKey) {
        var err1 = new Error(config.name + " API密钥未配置");
        err1.code = "API_KEY_MISSING";
        err1.provider = engineId;
        throw err1;
      }
      if (!securityUtils.validateApiKey(apiKey, config.apiKeyValidationType || engineId)) {
        var err2 = new Error(config.name + " API密钥格式不正确");
        err2.code = "API_KEY_INVALID";
        err2.provider = engineId;
        throw err2;
      }
    }

    var sourceLanguage = _AI_LANG_NAMES[sourceLang] || sourceLang;
    var targetLanguage = _AI_LANG_NAMES[targetLang] || targetLang;
    var cleanText = securityUtils.sanitizeForApi(text);

    // 构建系统提示词
    var systemPrompt = "";
    try {
      if (typeof service.buildProjectSystemPrompt === "function") {
        systemPrompt = service.buildProjectSystemPrompt(engineId, {
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          sourceLang: sourceLang,
          targetLang: targetLang,
        });
      }
    } catch (e) {
      (loggers.translation || console).debug(engineId + " getPromptTemplate:", e);
    }
    if (!systemPrompt || !systemPrompt.trim()) {
      systemPrompt = "你是一位资深的软件本地化翻译专家，精通" + sourceLanguage + "到" + targetLanguage + "的翻译，擅长 UI 文案与软件资源文件的本地化。\n\n" +
        "核心翻译原则：\n" +
        "1. 忠实传达原文语义，避免逐字直译；译文自然流畅，符合" + targetLanguage + "的表达习惯，杜绝翻译腔\n" +
        "2. 保持原文的语气、风格与正式程度（正式/非正式、友好/严肃）\n" +
        "3. 专业术语全文保持一致；若提供术语库，必须优先采用术语库指定译名\n" +
        "4. UI 文本优先简洁直白：按钮、菜单、提示等界面文案简短清晰\n" +
        "5. 专有名词、品牌名、产品名与代码标识符保持原样，不翻译、不音译（除非已有通用译名）\n" +
        "6. 控制译文长度与原文相当，不随意增删信息\n" +
        "占位符与格式约束：\n" +
        "7. 严格保留原文中的占位符、变量与标记：%s、%d、%1$s、{0}、{{var}}、<b>...</b>、&amp; 等，不得丢失、不得新增、不得改变位置\n" +
        "8. 保留原文的换行与空格结构\n" +
        "输出要求：\n" +
        "9. 只输出译文本身，不要添加任何解释、注释或原文复述";
    }

    // 添加上下文
    if (context) {
      systemPrompt += "\n\n上下文信息：";
      if (context.elementType) systemPrompt += "\n- 元素类型: " + context.elementType;
      if (context.xmlPath) systemPrompt += "\n- XML路径: " + context.xmlPath;
      if (context.parentText) systemPrompt += "\n- 父级文本: " + context.parentText;
      if (settings.aiUseKeyContext && context.key) {
        systemPrompt += "\n- Key/字段名（仅供参考，严禁翻译或改写）: " + context.key;
      }
    }

    // 术语库
    var terminologyMatches = service.findTerminologyMatches(cleanText);
    if (terminologyMatches.length > 0) {
      systemPrompt += "\n\n术语库参考（请优先使用这些翻译）：";
      terminologyMatches.forEach(function (term) {
        systemPrompt += '\n- "' + term.source + '" → "' + term.target + '"';
      });
    }

    // 构建请求体（温度按引擎范围钳制，避免超出 API 限制）
    var body = {
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: cleanText },
      ],
      temperature: _aiClampTemperature(config, settings.temperature),
    };
    if (config.extraBodyParams) {
      var extraKeys = Object.keys(config.extraBodyParams);
      for (var ek = 0; ek < extraKeys.length; ek++) {
        body[extraKeys[ek]] = config.extraBodyParams[extraKeys[ek]];
      }
    }
    // 引擎专用请求体变换（如 Claude 的 system 字段提取）
    if (typeof config._transformRequestBody === "function") {
      body = config._transformRequestBody(body);
    }

    try {
      var headers = { "Content-Type": "application/json" };
      if (apiKey && typeof config.authHeaderBuilder === "function") {
        var authHeaders = config.authHeaderBuilder(apiKey) || {};
        var authKeys = Object.keys(authHeaders);
        for (var ak = 0; ak < authKeys.length; ak++) {
          headers[authKeys[ak]] = authHeaders[authKeys[ak]];
        }
      }
      // 自定义引擎可注入额外请求头（例如本地代理需要的私有 token）
      if (config.customHeaders && typeof config.customHeaders === "object") {
        var chKeys = Object.keys(config.customHeaders);
        for (var ch = 0; ch < chKeys.length; ch++) {
          headers[chKeys[ch]] = config.customHeaders[chKeys[ch]];
        }
      }

      if (shouldCancel && shouldCancel()) throw _aiMakeCancelError();
      var response = await networkUtils.fetchWithDedupe(
        config.apiUrl,
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body),
        },
        {
          timeout: (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000,
          dedupe: true,
          cache: cacheEnabled,
          cacheTTL: cacheTtlSeconds * 1000,
        }
      );

      if (!response.ok) {
        var raw = await response.text();
        var message = config.name + " API错误: " + response.status;
        try {
          var parsed = JSON.parse(raw);
          message = parsed.error?.message || parsed.message || message;
        } catch (e) {
          if (raw && raw.trim()) message = raw;
        }
        var errResp = new Error(message);
        errResp.status = response.status;
        errResp.provider = engineId;
        errResp.url = config.apiUrl;
        // 解析 Retry-After 头，供速率限制冷却使用
        if (response.status === 429) {
          var retryAfterHeader = response.headers?.get?.("Retry-After");
          if (retryAfterHeader) {
            var retryAfterNum = parseInt(retryAfterHeader, 10);
            errResp.retryAfter = Number.isFinite(retryAfterNum) ? retryAfterNum : 30;
          }
        }
        throw errResp;
      }

      var data = await response.json();
      if (shouldCancel && shouldCancel()) throw _aiMakeCancelError();
      if (_aiIsTruncatedBatchResponse(data)) {
        throw Object.assign(new Error(config.name + " 译文未完整返回，请增加输出上限或拆分原文"), { code: "OUTPUT_TRUNCATED", provider: engineId });
      }
      var resultText;
      if (typeof config._parseResponseText === "function") {
        resultText = config._parseResponseText(data);
      } else {
        resultText = data?.choices?.[0]?.message?.content;
      }
      if (!resultText && resultText !== "") {
        var errEmpty = new Error(config.name + " API 返回数据结构异常或响应为空");
        errEmpty.code = "EMPTY_RESPONSE";
        errEmpty.provider = engineId;
        throw errEmpty;
      }
      // 单条路径同样要防代码围栏：模型常把纯文本译文包在 ``` 中返回，
      // 直接用会把围栏当成译文内容写进 targetText。
      return _aiStripCodeFence(String(resultText).trim());
    } catch (error) {
      (loggers.translation || console).error(config.name + "翻译失败:", error);
      throw error;
    }
  },

  /**
   * 批量翻译（Chat Completions + JSON 输出模式）
   * @param {string} engineId - 引擎 ID
   * @param {Array} items - 翻译项数组
   * @param {string} sourceLang - 源语言代码
   * @param {string} targetLang - 目标语言代码
   * @param {Object} options - { onProgress, onLog }
   * @param {TranslationService} service - 翻译服务实例
   * @returns {Promise<string[]>} 翻译结果数组
   */
  translateBatch: async function (engineId, items, sourceLang, targetLang, options, service) {
    var generation = typeof BatchProgressStore.getGeneration === "function" ? BatchProgressStore.getGeneration() : undefined;
    var shouldCancel = () => _aiIsCancelled() || (generation !== undefined && generation !== BatchProgressStore.getGeneration());
    var config = EngineRegistry.get(engineId);
    if (!config) throw new Error("未知的翻译引擎: " + engineId);

    var settings = await service.getSettings();
    var apiKey = settings[config.apiKeyField];
    var model = _aiResolveModel(settings, config);
    var noKeyNeeded = config.apiKeyValidationType === "none";

    var onProgress = options && typeof options.onProgress === "function" ? options.onProgress : null;
    var onLog = options && typeof options.onLog === "function" ? options.onLog : null;

    if (!noKeyNeeded) {
      if (!apiKey) {
        var err1 = new Error(config.name + " API密钥未配置");
        err1.code = "API_KEY_MISSING";
        err1.provider = engineId;
        throw err1;
      }
      if (!securityUtils.validateApiKey(apiKey, config.apiKeyValidationType || engineId)) {
        var err2 = new Error(config.name + " API密钥格式不正确");
        err2.code = "API_KEY_INVALID";
        err2.provider = engineId;
        throw err2;
      }
    }

    var sourceLanguage = _AI_LANG_NAMES[sourceLang] || sourceLang;
    var targetLanguage = _AI_LANG_NAMES[targetLang] || targetLang;

    // 通用 AI 设置（ai* 为主键，deepseek* 向后兼容）
    var useKeyContext = !!(settings.aiUseKeyContext ?? settings.deepseekUseKeyContext);
    var contextAwareEnabled = !!(settings.aiContextAwareEnabled ?? settings.deepseekContextAwareEnabled);
    var contextWindowSize = Math.max(1, Math.min(10, Number(settings.aiContextWindowSize ?? settings.deepseekContextWindowSize) || 3));
    var primingEnabled = !!(settings.aiPrimingEnabled ?? settings.deepseekPrimingEnabled);
    var conversationEnabled = !!(settings.aiConversationEnabled ?? settings.deepseekConversationEnabled);
    var conversationScope = settings.aiConversationScope || settings.deepseekConversationScope || "project";

    // 上下文条目：视图稳定引用优先，canonical 兜底（与旧 translations.items 读取序一致）
    var allItems = contextAwareEnabled
      ? (typeof TranslationViewStore !== "undefined" &&
        Array.isArray(TranslationViewStore.getViewItems()) &&
        TranslationViewStore.getViewItems().length > 0
        ? TranslationViewStore.getViewItems()
        : Array.isArray(AppState?.project?.translationItems) ? AppState.project.translationItems
          : [])
      : [];

    var primingSamples = primingEnabled
      ? _aiResolvePrimingSamples(settings.aiPrimingSampleIds ?? settings.deepseekPrimingSampleIds)
      : [];

    // 系统提示词
    var baseSystemPrompt = "";
    try {
      if (typeof service.buildProjectSystemPrompt === "function") {
        baseSystemPrompt = service.buildProjectSystemPrompt(engineId + "Batch", {
          sourceLanguage: sourceLanguage,
          targetLanguage: targetLanguage,
          sourceLang: sourceLang,
          targetLang: targetLang,
        });
      }
    } catch (e) {
      (loggers.translation || console).debug(engineId + " batch getPromptTemplate:", e);
    }
    if (!baseSystemPrompt || !baseSystemPrompt.trim()) {
      baseSystemPrompt = "你是一位资深的软件本地化翻译专家，精通" + sourceLanguage + "到" + targetLanguage + "的翻译，擅长 UI 文案与软件资源文件的本地化。\n\n" +
        "核心翻译原则：\n" +
        "1. 忠实传达原文语义，避免逐字直译；译文自然流畅，符合" + targetLanguage + "的表达习惯，杜绝翻译腔\n" +
        "2. 保持原文的语气、风格与正式程度（正式/非正式、友好/严肃）\n" +
        "3. 专业术语全文保持一致；若提供术语库，必须优先采用术语库指定译名\n" +
        "4. UI 文本优先简洁直白：按钮、菜单、提示等界面文案简短清晰\n" +
        "5. 专有名词、品牌名、产品名与代码标识符保持原样，不翻译、不音译（除非已有通用译名）\n" +
        "6. 控制译文长度与原文相当，不随意增删信息\n" +
        "占位符与格式约束：\n" +
        "7. 严格保留原文中的占位符、变量与标记（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增\n" +
        "8. 保留原文的换行与空格结构\n" +
        "批量输出要求：\n" +
        "9. 逐条翻译，条目之间互不干扰\n" +
        "10. key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写\n" +
        "11. 你必须使用 JSON 格式输出，结构为 {\"translations\":[{\"id\":\"输入 id\",\"text\":\"译文\"}]}：每个输入 id 恰好返回一次，id 保持原样，只输出 JSON，不要输出任何解释";
    }

    // 会话历史
    var conversationKey = conversationEnabled
      ? _aiBuildConversationKey(engineId, conversationScope, items)
      : "";
    var conversations = service.aiConversations || (service.aiConversations = new Map());
    var history = conversationEnabled && conversationKey
      ? conversations.get(conversationKey) || []
      : [];

    // 分块
    var batchMaxItems = Math.min(100, Math.max(5, Number(settings.aiBatchMaxItems ?? settings.deepseekBatchMaxItems) || 40));
    var batchMaxChars = Math.min(20000, Math.max(1000, Number(settings.aiBatchMaxChars ?? settings.deepseekBatchMaxChars) || 6000));
    var chunks = _aiChunkItems(items, batchMaxChars, batchMaxItems);
    var outputs = [];
    var pauseNotified = false;

    var waitWhilePaused = async function () {
      while (BatchProgressStore.isBatchPaused()) {
        if (shouldCancel()) {
          throw _aiMakeCancelError(buildOrderedOutputs());
        }
        if (onLog && !pauseNotified) {
          onLog("翻译已暂停，等待继续...");
        }
        pauseNotified = true;
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
      }
      if (pauseNotified) pauseNotified = false;
    };

    // ========== 并发控制（性能优化） ==========
    // 会话记忆开启时保持串行（跨 chunk 的历史链有严格顺序依赖，无法并发）；
    // 关闭时按引擎限速适度并发，绕过"批量请求串行"瓶颈。
    // 并发上限 3，且受 checkRateLimit 令牌桶统一节流，不会突破引擎 RPS。
    var chunkConcurrency = 1;
    if (!conversationEnabled) {
      var _rpsNum = Number(config.rateLimitPerSecond);
      var userLimit = parseInt(settings.concurrentLimit, 10);
      if (!Number.isFinite(userLimit)) userLimit = 5;
      chunkConcurrency = Math.max(1, Math.min(3, userLimit, Math.ceil(_rpsNum) || 1));
    }

    // chunk 任务队列 + 有序结果槽：并发完成顺序可能与 chunk 顺序不一致，
    // 最终按 orderIds 顺序组装，保证返回数组与 items 一一对应（取消时 partialOutputs 保持前缀语义）
    var chunkQueue = [];
    var slotResults = {};
    var orderIds = [];
    var completedItems = 0;
    var batchFailed = false;

    for (var ci = 0; ci < chunks.length; ci++) {
      chunkQueue.push({ id: "chunk-" + ci, chunk: chunks[ci] });
      orderIds.push("chunk-" + ci);
    }

    // 按 chunk 顺序组装结果（未完成的 chunk 之后不再取值）
    function buildOrderedOutputs() {
      var out = [];
      for (var oi = 0; oi < orderIds.length; oi++) {
        var slot = slotResults[orderIds[oi]];
        if (!slot) break;
        for (var si = 0; si < slot.length; si++) out.push(slot[si]);
      }
      return out;
    }

    // 处理单个 chunk 任务（拆半重试时同任务内串行处理两半，保持该 chunk 内顺序）
    async function processChunkTask(task) {
      var chunk = task.chunk;

      try {
      // 暂停闸门：必须在「构造并发出请求之前」等待。
      // 此前 waitWhilePaused 只被定义、从未调用，导致点暂停后剩余 chunk 仍会被全部发出，
      // 用户无法通过暂停止损。用户取消时 waitWhilePaused 内部会抛出取消错误。
      await waitWhilePaused();

      if (onLog) {
        onLog(config.name + " 批量请求（" + chunk.length + " 项，并发 " + chunkConcurrency + "）...");
      }
      if (onProgress) {
        onProgress(completedItems, items.length, "请求中...（已完成 " + completedItems + "/" + items.length + " 项）");
      }

      await service.checkRateLimit(engineId, shouldCancel);
      if (shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());
      await waitWhilePaused();

      var reqItems = chunk.map(function (it, index) {
        // 占位符保护：把 %s/{0}/${x} 等替换为安全标记后再发给模型，
        // 使其不会被翻译/改写；译文回来后由 batch.js 还原。
        // 此前批量路径发送的是原始占位符，导致 batch.js 中的 restore 实际是空操作。
        var rawText = it.sourceText || "";
        if (typeof PlaceholderGuard !== "undefined" && PlaceholderGuard && typeof PlaceholderGuard.protect === "function") {
          try {
            var ph = PlaceholderGuard.protect(rawText);
            if (ph && ph.hasPlaceholders) it.__phGuardMap = ph.map;
            else delete it.__phGuardMap;
            rawText = ph && ph.hasPlaceholders ? ph.text : rawText;
          } catch (e) {
            delete it.__phGuardMap;
          }
        }
        var cleanText = securityUtils.sanitizeForApi(rawText);
        return {
          id: task.id + "-item-" + index,
          key: useKeyContext ? translationGetItemKey(it) : "",
          source: cleanText,
          file: it?.metadata?.file || "",
          fileType: translationGetFileType(it),
        };
      });

      var primingMessage = primingSamples.length > 0
        ? {
          role: "user",
          content:
            "下面是用户手动选择的文件样本（source-only）。仅用于让你理解 key 命名与语境。请注意这是 JSON：\n" +
            JSON.stringify({
              samples: primingSamples.map(function (s) {
                return {
                  key: useKeyContext ? s.key : "",
                  source: s.source,
                  file: s.file,
                };
              }),
            }),
        }
        : null;

      var userMessage = {
        role: "user",
        content:
          "请将以下 items 翻译为目标语言，并返回严格 JSON。\n" +
          "输出格式示例（必须包含 json 字样且结构一致）：\n" +
          '{"translations":[{"id":"输入条目的 id","text":"译文"}]}\n' +
          "规则：每个输入 id 必须恰好返回一次，保留 id 原样，译文写入 text；不得省略或新增条目。此格式优先于旧模板中的数组格式。\n" +
          JSON.stringify({ items: reqItems }),
      };

      // 上下文感知
      var chunkSystemPrompt = baseSystemPrompt;
      if (contextAwareEnabled && allItems.length > 0) {
        var ctx = _aiCollectChunkContext(allItems, chunk, contextWindowSize);
        var ctxText = _aiFormatContextPrompt(ctx);
        if (ctxText) chunkSystemPrompt += ctxText;
      }

      var messages = [];
      messages.push({ role: "system", content: chunkSystemPrompt });
      if (history.length > 0) {
        for (var hi = 0; hi < history.length; hi++) {
          var hItem = history[hi];
          if (hItem && hItem.role) {
            messages.push(hItem);
          } else if (hItem && hItem.user && hItem.assistant) {
            if (hItem.priming) messages.push(hItem.priming);
            messages.push(hItem.user);
            messages.push(hItem.assistant);
          }
        }
      }
      if (primingMessage) messages.push(primingMessage);
      messages.push(userMessage);

      // 构建请求体
      var batchBody = {
        model: model,
        messages: messages,
        temperature: _aiClampTemperature(config, settings.temperature),
      };
      if (_aiSupportsJsonMode(config, model)) {
        batchBody.response_format = { type: "json_object" };
      }
      // 批量路径优先使用 extraBatchBodyParams（例如更大的 max_tokens 防止 JSON 截断）
      var batchExtraParams = config.extraBatchBodyParams || config.extraBodyParams;
      if (batchExtraParams) {
        var bExtraKeys = Object.keys(batchExtraParams);
        for (var bek = 0; bek < bExtraKeys.length; bek++) {
          batchBody[bExtraKeys[bek]] = batchExtraParams[bExtraKeys[bek]];
        }
      }
      // 引擎专用请求体变换
      if (typeof config._transformRequestBody === "function") {
        batchBody = config._transformRequestBody(batchBody);
      }

      // 请求
      var batchHeaders = { "Content-Type": "application/json" };
      if (apiKey && typeof config.authHeaderBuilder === "function") {
        var batchAuth = config.authHeaderBuilder(apiKey) || {};
        var batchAuthKeys = Object.keys(batchAuth);
        for (var bak = 0; bak < batchAuthKeys.length; bak++) {
          batchHeaders[batchAuthKeys[bak]] = batchAuth[batchAuthKeys[bak]];
        }
      }
      // 自定义引擎额外请求头
      if (config.customHeaders && typeof config.customHeaders === "object") {
        var bchKeys = Object.keys(config.customHeaders);
        for (var bch = 0; bch < bchKeys.length; bch++) {
          batchHeaders[bchKeys[bch]] = config.customHeaders[bchKeys[bch]];
        }
      }

      if (shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());
      var watcher = _aiCreateCancelWatcher(buildOrderedOutputs(), shouldCancel);
      var fetchPromise = networkUtils
        .fetchWithTimeout(
          config.apiUrl,
          {
            method: "POST",
            headers: batchHeaders,
            body: JSON.stringify(batchBody),
          },
          (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000
        )
        .catch(function (e) {
          if (watcher.isCancelled()) return new Promise(function () {});
          throw e;
        });

      var response;
      try {
        response = await Promise.race([fetchPromise, watcher.cancelPromise]);
      } finally {
        watcher.cleanup();
      }

      if (shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());

      if (!response.ok) {
        var rawErr = await response.text();
        var errMessage = config.name + " API错误: " + response.status;
        try {
          var parsedErr = JSON.parse(rawErr);
          errMessage = parsedErr.error?.message || parsedErr.message || errMessage;
        } catch (e) {
          if (rawErr && rawErr.trim()) errMessage = rawErr;
        }
        var batchErr = new Error(errMessage);
        batchErr.status = response.status;
        batchErr.provider = engineId;
        batchErr.url = config.apiUrl;
        if (response.status === 429) {
          var batchRetryAfter = response.headers?.get?.("Retry-After");
          if (batchRetryAfter) {
            var batchRetryNum = parseInt(batchRetryAfter, 10);
            batchErr.retryAfter = Number.isFinite(batchRetryNum) ? batchRetryNum : 30;
          }
        }
        throw batchErr;
      }

      var respData = await response.json();
      if (_aiIsTruncatedBatchResponse(respData)) {
        var errBatchTruncated = new Error(config.name + " 批量响应被截断，请减小批量大小");
        errBatchTruncated.code = "BATCH_OUTPUT_TRUNCATED";
        errBatchTruncated.provider = engineId;
        throw errBatchTruncated;
      }
      var content;
      if (typeof config._parseResponseText === "function") {
        content = (config._parseResponseText(respData) || "").trim();
      } else {
        content = (respData?.choices?.[0]?.message?.content || "").trim();
      }
      if (!content) {
        var errBatchEmpty = new Error(config.name + " 返回空内容（可能为 JSON 输出不稳定或被截断），请重试或减小批量大小");
        errBatchEmpty.code = "EMPTY_RESPONSE";
        errBatchEmpty.provider = engineId;
        throw errBatchEmpty;
      }

      if (shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());

      if (onLog) {
        onLog(config.name + " 已返回响应，正在解析 JSON...");
      }

      // 宽容提取 JSON：支持代码围栏、前后夹带说明文字、裸数组形态
      var extracted = _aiExtractJson(content);
      if (!extracted.ok) {
        var errBatchParse = new Error(config.name + " JSON 解析失败：" + extracted.error);
        errBatchParse.code = "BATCH_JSON_PARSE_FAILED";
        errBatchParse.provider = engineId;
        throw errBatchParse;
      }
      var parsedResp = extracted.value;

      var translations = AIEngineBase.mapBatchTranslations(parsedResp, reqItems);

      for (var ti = 0; ti < translations.length; ti++) {
        completedItems++;
        if (onProgress) {
          onProgress(
            completedItems,
            items.length,
            "[" + completedItems + "/" + items.length + "] 正在处理批量结果..."
          );
        }
      }
      slotResults[task.id] = translations;

      if (shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());

      if (onLog) {
        onLog(
          config.name + " 批量请求完成（累计 " + completedItems + "/" + items.length + " 项）"
        );
      }

      // 会话历史
      if (conversationEnabled && conversationKey) {
        var assistantMsg = { role: "assistant", content: content };
        var round = {
          system: baseSystemPrompt,
          priming: primingMessage || null,
          user: userMessage,
          assistant: assistantMsg,
        };
        var nextHistory = Array.isArray(history) ? history.slice() : [];
        nextHistory.push(round);

        var maxRounds = 8;
        var trimmedHistory = nextHistory.slice(-maxRounds);
        conversations.set(conversationKey, trimmedHistory);

        // 防止会话键无限增长导致内存泄漏（最多保留 50 个会话）
        if (conversations.size > 50) {
          var oldest = conversations.keys().next().value;
          conversations.delete(oldest);
        }

        // 内存安全：估算总大小，超过阈值时淘汰最旧会话
        // 字符数 ×3 近似 UTF-8 字节数（中日韩等多字节字符占 3 字节）
        var _estimatedBytes = 0;
        conversations.forEach(function (rounds) {
          for (var ri = 0; ri < rounds.length; ri++) {
            var r = rounds[ri];
            _estimatedBytes += (r.system || "").length + (r.user?.content || "").length + (r.assistant?.content || "").length + (r.priming?.content || "").length;
          }
        });
        _estimatedBytes = _estimatedBytes * 3;
        var _maxBytes = 2 * 1024 * 1024; // 2MB 上限
        while (_estimatedBytes > _maxBytes && conversations.size > 1) {
          var _oldKey = conversations.keys().next().value;
          var _oldRounds = conversations.get(_oldKey) || [];
          for (var _ri = 0; _ri < _oldRounds.length; _ri++) {
            var _r = _oldRounds[_ri];
            _estimatedBytes -= (((_r.system || "").length + (_r.user?.content || "").length + (_r.assistant?.content || "").length + (_r.priming?.content || "").length) * 3);
          }
          conversations.delete(_oldKey);
        }

        history = trimmedHistory;
      }
      } catch (chunkError) {
        if (batchFailed || shouldCancel()) throw _aiMakeCancelError(buildOrderedOutputs());

        if (_aiIsAdaptiveBatchError(chunkError) && chunk.length > 1) {
          var splitAt = Math.ceil(chunk.length / 2);
          var firstHalf = chunk.slice(0, splitAt);
          var secondHalf = chunk.slice(splitAt);
          // 保持输出顺序：任务 id 原地替换为两个半块 id，随后串行处理两半
          var _pos = orderIds.indexOf(task.id);
          if (_pos !== -1) {
            orderIds.splice(_pos, 1, task.id + "-a", task.id + "-b");
          }
          if (onLog) {
            onLog(
              config.name + " 当前批次过大或输出不完整，已将 " + chunk.length +
              " 项拆分为 " + firstHalf.length + " + " + secondHalf.length + " 后重试"
            );
          }
          await processChunkTask({ id: task.id + "-a", chunk: firstHalf });
          await processChunkTask({ id: task.id + "-b", chunk: secondHalf });
          return;
        }

        if (_aiIsAdaptiveBatchError(chunkError) && chunk.length <= 1 && !chunkError.code) {
          chunkError.code = "BATCH_ITEM_TOO_LARGE";
          chunkError.provider = engineId;
        }
        throw chunkError;
      }
    }

    // ========== 并发 worker 池 ==========
    // 每个 worker 从队列取任务；任一任务失败（batchFailed）后其余 worker 停止取新任务
    async function runChunkWorkers() {
      var pool = Math.min(chunkConcurrency, chunkQueue.length || 1);
      var workers = [];
      for (var wi = 0; wi < pool; wi++) {
        workers.push(
          (async function () {
            while (!batchFailed && chunkQueue.length > 0) {
              var task = chunkQueue.shift();
              try {
                await processChunkTask(task);
              } catch (e) {
                batchFailed = true;
                throw e;
              }
            }
          })()
        );
      }
      await Promise.all(workers);
    }

    await runChunkWorkers();

    // 按 chunk 顺序组装最终结果（并发完成顺序与 chunk 顺序解耦）
    outputs = buildOrderedOutputs();
    return outputs;
  },
};
