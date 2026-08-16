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
    // 显式取消标记优先（由 cancelTranslation 设置）
    if (AppState.translations._batchCancelled === true) return true;
    // 兼容旧逻辑：仅当批量翻译曾经启动过（_batchStarted）后 isInProgress 变为 false 才视为取消
    // 避免在翻译尚未开始时误判
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
 * 解析使用的模型，避免 settings.model 跨引擎污染
 * - 内置引擎不再声明静态模型列表（模型由 ModelFetcher 动态获取），直接采用 settings.model，
 *   为空时回退 defaultModel；用户选择的动态模型始终被接受
 * - 自定义引擎若声明 availableModels（用户显式配置的模型），仍校验并回退 defaultModel
 */
function _aiResolveModel(settings, config) {
  var requested = settings && settings.model ? String(settings.model) : "";
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

function _aiCreateCancelWatcher(partialOutputs) {
  var intervalId = null;
  var cancelled = false;

  var cancelPromise = new Promise(function (_, reject) {
    if (_aiIsCancelled()) {
      cancelled = true;
      reject(_aiMakeCancelError(partialOutputs));
      return;
    }

    intervalId = setInterval(function () {
      if (_aiIsCancelled()) {
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
  translateSingle: async function (engineId, text, sourceLang, targetLang, context, service) {
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
      systemPrompt = "你是一位专业的软件本地化翻译专家，精通" + sourceLanguage + "到" + targetLanguage + "的翻译。\n\n" +
        "翻译要求：\n" +
        "1. 准确传达原文含义，保持专业术语的一致性\n" +
        "2. 符合目标语言的表达习惯，自然流畅\n" +
        "3. 保持原文的语气和风格（正式/非正式）\n" +
        "4. 对于UI文本，要简洁明了\n" +
        "5. 专有名词、品牌名、技术术语保持原样或使用通用译名\n" +
        "6. 只返回翻译结果，不要添加任何解释或说明";
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
      return resultText.trim();
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

    var allItems = contextAwareEnabled
      ? (Array.isArray(AppState?.translations?.items) ? AppState.translations.items
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
      baseSystemPrompt = "你是一位专业的软件本地化翻译专家，精通" + sourceLanguage + "到" + targetLanguage + "的翻译。\n\n" +
        "翻译要求：\n" +
        "1. 准确传达原文含义，保持专业术语的一致性\n" +
        "2. 符合目标语言的表达习惯，自然流畅\n" +
        "3. 对于UI文本，要简洁明了\n" +
        "4. 严格保留原文中的占位符、标记与格式（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增\n" +
        "5. key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写\n" +
        "6. 你必须使用 JSON 格式输出。只输出 JSON，不要输出任何解释。";
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
      while (AppState?.translations?.isPaused) {
        if (_aiIsCancelled()) {
          throw _aiMakeCancelError(outputs);
        }
        if (onLog && !pauseNotified) {
          onLog("翻译已暂停，等待继续...");
        }
        pauseNotified = true;
        await new Promise(function (resolve) { setTimeout(resolve, 200); });
      }
      if (pauseNotified) pauseNotified = false;
    };

    for (var c = 0; c < chunks.length; c++) {
      await waitWhilePaused();
      if (_aiIsCancelled()) throw _aiMakeCancelError(outputs);

      var chunk = chunks[c];

      try {
      if (onLog) {
        onLog(config.name + " 批量请求 " + (c + 1) + "/" + chunks.length + "（" + chunk.length + " 项）...");
      }
      if (onProgress) {
        onProgress(outputs.length, items.length, "请求中...（" + (c + 1) + "/" + chunks.length + "）");
      }

      await service.checkRateLimit(engineId);

      var reqItems = chunk.map(function (it) {
        var cleanText = securityUtils.sanitizeForApi(it.sourceText || "");
        return {
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
          '{"translations":["...","..."]}\n' +
          "规则：translations 数组长度必须与 items 长度一致，且按顺序一一对应。\n" +
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

      var watcher = _aiCreateCancelWatcher(outputs);
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

      if (_aiIsCancelled()) throw _aiMakeCancelError(outputs);

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

      if (_aiIsCancelled()) throw _aiMakeCancelError(outputs);

      if (onLog) {
        onLog(config.name + " 已返回响应，正在解析 JSON...");
      }

      var parsedResp;
      try {
        parsedResp = JSON.parse(content);
      } catch (parseErr) {
        var errBatchParse = new Error(config.name + " JSON 解析失败：" + parseErr.message);
        errBatchParse.code = "BATCH_JSON_PARSE_FAILED";
        errBatchParse.provider = engineId;
        throw errBatchParse;
      }

      var translations = parsedResp?.translations;
      if (!Array.isArray(translations) || translations.length !== chunk.length) {
        var errBatchMismatch = new Error(
          config.name + " 返回 translations 数量不匹配：期望 " + chunk.length +
          "，实际 " + (Array.isArray(translations) ? translations.length : 0)
        );
        errBatchMismatch.code = "BATCH_OUTPUT_MISMATCH";
        errBatchMismatch.provider = engineId;
        throw errBatchMismatch;
      }

      for (var ti = 0; ti < translations.length; ti++) {
        outputs.push(String(translations[ti] ?? ""));
        if (onProgress) {
          onProgress(
            outputs.length,
            items.length,
            "[" + outputs.length + "/" + items.length + "] 正在处理批量结果..."
          );
        }
      }

      if (_aiIsCancelled()) throw _aiMakeCancelError(outputs);

      if (onLog) {
        onLog(
          config.name + " 批量请求 " + (c + 1) + "/" + chunks.length +
          " 完成（累计 " + outputs.length + "/" + items.length + "）"
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
        if (_aiIsCancelled()) throw _aiMakeCancelError(outputs);

        if (_aiIsAdaptiveBatchError(chunkError) && chunk.length > 1) {
          var splitAt = Math.ceil(chunk.length / 2);
          var firstHalf = chunk.slice(0, splitAt);
          var secondHalf = chunk.slice(splitAt);
          chunks.splice(c, 1, firstHalf, secondHalf);
          if (onLog) {
            onLog(
              config.name + " 当前批次过大或输出不完整，已将 " + chunk.length +
              " 项拆分为 " + firstHalf.length + " + " + secondHalf.length + " 后重试"
            );
          }
          c--;
          continue;
        }

        if (_aiIsAdaptiveBatchError(chunkError) && chunk.length <= 1 && !chunkError.code) {
          chunkError.code = "BATCH_ITEM_TOO_LARGE";
          chunkError.provider = engineId;
        }
        throw chunkError;
      }
    }

    return outputs;
  },
};
