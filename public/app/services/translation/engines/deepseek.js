// DeepSeek翻译（增强版 - 支持上下文和术语库）
TranslationService.prototype.translateWithDeepSeek = async function (
  text,
  sourceLang,
  targetLang,
  context = null
) {
  const settings = await this.getSettings();
  const apiKey = settings.deepseekApiKey;
  const model = settings.model || "deepseek-chat";

  const cacheEnabled = !!settings.translationRequestCacheEnabled;
  const rawCacheTtlSeconds = parseInt(settings.translationRequestCacheTTLSeconds);
  const cacheTtlSeconds = Number.isFinite(rawCacheTtlSeconds)
    ? Math.max(1, Math.min(600, rawCacheTtlSeconds))
    : 5;

  if (!apiKey) {
    const err = new Error("DeepSeek API密钥未配置");
    err.code = "API_KEY_MISSING";
    err.provider = "deepseek";
    throw err;
  }

  // 验证API密钥
  if (!securityUtils.validateApiKey(apiKey, "deepseek")) {
    const err = new Error("DeepSeek API密钥格式不正确");
    err.code = "API_KEY_INVALID";
    err.provider = "deepseek";
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

  // 清理输入（不转义HTML实体，保留原始字符供翻译引擎处理）
  const cleanText = securityUtils.sanitizeForApi(text);

  // 构建增强型提示词
  let systemPrompt = "";
  try {
    if (typeof this.buildProjectSystemPrompt === "function") {
      systemPrompt = this.buildProjectSystemPrompt("deepseek", {
        sourceLanguage,
        targetLanguage,
        sourceLang,
        targetLang,
      });
    }
  } catch (_) {
    (loggers.translation || console).debug("deepseek getPromptTemplate:", _);
  }
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

    if (settings.deepseekUseKeyContext && context.key) {
      systemPrompt += `\n- Key/字段名（仅供参考，严禁翻译或改写）: ${context.key}`;
    }
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
    // checkRateLimit 已由上层 translate() 统一调用，此处不再重复检查

    const response = await networkUtils.fetchWithDedupe(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
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
      let message = `DeepSeek API错误: ${response.status}`;
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
      err.provider = "deepseek";
      err.url = "https://api.deepseek.com/v1/chat/completions";
      throw err;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text && text !== '') {
      throw new Error('DeepSeek API 返回数据结构异常：缺少 choices[0].message.content');
    }
    return text.trim();
  } catch (error) {
    (loggers.translation || console).error("DeepSeek翻译失败:", error);
    throw error;
  }
};

// 使用 helpers.js 中的共享函数
const __deepseekGetItemKey = translationGetItemKey;
const __deepseekGetFileType = translationGetFileType;

function __deepseekResolvePrimingSamples(sampleIds) {
  const ids = Array.isArray(sampleIds) ? sampleIds : [];
  if (ids.length === 0) return [];
  const all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  const byId = new Map();
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    if (it?.id) byId.set(String(it.id), it);
  }
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    const it = byId.get(String(ids[i]));
    if (!it) continue;
    const source = (it?.sourceText || "").toString().trim();
    if (!source) continue;
    out.push({
      key: __deepseekGetItemKey(it),
      source: source,
      file: it?.metadata?.file || "",
    });
  }
  return out;
}

function __deepseekBuildConversationKey(scope, items) {
  const projectId = AppState?.project?.id || "";
  if (!projectId) return "";
  const normalizedScope = scope || "project";
  if (normalizedScope === "project") return `deepseek:${projectId}`;

  const first = Array.isArray(items) && items.length > 0 ? items[0] : null;
  if (normalizedScope === "file") {
    const file = first?.metadata?.file || "";
    return `deepseek:${projectId}:file:${file}`;
  }

  const fileType = __deepseekGetFileType(first);
  return `deepseek:${projectId}:type:${fileType}`;
}

function __deepseekChunkItems(items, maxChars = 6000, maxItems = 40) {
  const chunks = [];
  let current = [];
  let currentChars = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const text = (it?.sourceText || "").toString();
    const key = __deepseekGetItemKey(it);
    const cost = text.length + key.length + 50;
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

/**
 * 收集批次上下文：为当前chunk收集前后相邻条目作为翻译参考
 * @param {Array} allItems - 完整的翻译项目列表
 * @param {Array} chunkItems - 当前批次的条目
 * @param {number} windowSize - 前后各取多少条
 * @returns {Object} { before: [...], after: [...] }
 */
function __deepseekCollectChunkContext(allItems, chunkItems, windowSize) {
  if (!allItems || !chunkItems || windowSize <= 0) return { before: [], after: [] };

  // 找到当前chunk在allItems中的起止位置
  const firstId = chunkItems[0]?.id;
  const lastId = chunkItems[chunkItems.length - 1]?.id;
  let startIdx = -1, endIdx = -1;

  for (let i = 0; i < allItems.length; i++) {
    if (startIdx === -1 && allItems[i]?.id === firstId) startIdx = i;
    if (allItems[i]?.id === lastId) { endIdx = i; break; }
  }

  if (startIdx === -1) return { before: [], after: [] };

  const before = [];
  const after = [];
  const chunkIdSet = new Set(chunkItems.map(it => it?.id));

  // 收集前文
  for (let i = Math.max(0, startIdx - windowSize); i < startIdx; i++) {
    const it = allItems[i];
    if (!it || chunkIdSet.has(it.id)) continue;
    const source = (it.sourceText || "").toString().trim();
    if (!source) continue;
    before.push({
      source: source.length > 120 ? source.substring(0, 120) + "..." : source,
      target: (it.targetText || "").toString().trim().substring(0, 120) || null,
      key: __deepseekGetItemKey(it) || null
    });
  }

  // 收集后文
  for (let i = endIdx + 1; i < Math.min(allItems.length, endIdx + 1 + windowSize); i++) {
    const it = allItems[i];
    if (!it || chunkIdSet.has(it.id)) continue;
    const source = (it.sourceText || "").toString().trim();
    if (!source) continue;
    after.push({
      source: source.length > 120 ? source.substring(0, 120) + "..." : source,
      target: (it.targetText || "").toString().trim().substring(0, 120) || null,
      key: __deepseekGetItemKey(it) || null
    });
  }

  return { before, after };
}

/**
 * 将上下文信息格式化为prompt文本
 */
function __deepseekFormatContextPrompt(ctx) {
  if (!ctx) return "";
  const { before, after } = ctx;
  if ((!before || before.length === 0) && (!after || after.length === 0)) return "";

  let text = "\n\n📎 相邻条目上下文（仅供参考，帮助你理解语境和保持翻译一致性）：";

  if (before && before.length > 0) {
    text += "\n【前文】";
    before.forEach((item, i) => {
      text += `\n  ${i + 1}. 原文: "${item.source}"`;
      if (item.target) text += ` → 译文: "${item.target}"`;
    });
  }

  if (after && after.length > 0) {
    text += "\n【后文】";
    after.forEach((item, i) => {
      text += `\n  ${i + 1}. 原文: "${item.source}"`;
      if (item.target) text += ` → 译文: "${item.target}"`;
    });
  }

  return text;
}

function __deepseekIsCancelled() {
  try {
    return !!(
      typeof AppState !== "undefined" &&
      AppState?.translations &&
      !AppState.translations.isInProgress
    );
  } catch (_) {
    return false;
  }
}

function __deepseekMakeCancelError(partialOutputs) {
  const err = new Error("用户取消");
  err.code = "USER_CANCELLED";
  err.partialOutputs = Array.isArray(partialOutputs) ? partialOutputs : [];
  return err;
}

function __deepseekCreateCancelWatcher(partialOutputs) {
  let intervalId = null;
  let cancelled = false;

  const cancelPromise = new Promise((_, reject) => {
    if (__deepseekIsCancelled()) {
      cancelled = true;
      reject(__deepseekMakeCancelError(partialOutputs));
      return;
    }

    intervalId = setInterval(() => {
      if (__deepseekIsCancelled()) {
        cancelled = true;
        clearInterval(intervalId);
        intervalId = null;
        reject(__deepseekMakeCancelError(partialOutputs));
      }
    }, 300);
  });

  return {
    cancelPromise,
    isCancelled: () => cancelled,
    cleanup: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

TranslationService.prototype.translateBatchWithDeepSeek = async function (
  items,
  sourceLang,
  targetLang,
  options = {}
) {
  const settings = await this.getSettings();
  const apiKey = settings.deepseekApiKey;
  const model = settings.model || "deepseek-chat";

  const onProgress =
    options && typeof options.onProgress === "function"
      ? options.onProgress
      : null;
  const onLog =
    options && typeof options.onLog === "function" ? options.onLog : null;

  if (!apiKey) {
    throw new Error("DeepSeek API密钥未配置");
  }
  if (!securityUtils.validateApiKey(apiKey, "deepseek")) {
    throw new Error("DeepSeek API密钥格式不正确");
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

  const useKeyContext = !!settings.deepseekUseKeyContext;
  const contextAwareEnabled = !!settings.deepseekContextAwareEnabled;
  const contextWindowSize = Math.max(1, Math.min(10, Number(settings.deepseekContextWindowSize) || 3));
  const primingEnabled = !!settings.deepseekPrimingEnabled;
  const conversationEnabled = !!settings.deepseekConversationEnabled;
  const conversationScope = settings.deepseekConversationScope || "project";

  // 获取完整条目列表用于上下文收集
  const allItems = contextAwareEnabled
    ? (Array.isArray(AppState?.translations?.items) ? AppState.translations.items
       : Array.isArray(AppState?.project?.translationItems) ? AppState.project.translationItems
       : [])
    : [];

  const primingSamples = primingEnabled
    ? __deepseekResolvePrimingSamples(settings.deepseekPrimingSampleIds)
    : [];

  let baseSystemPrompt = "";
  try {
    if (typeof this.buildProjectSystemPrompt === "function") {
      baseSystemPrompt = this.buildProjectSystemPrompt("deepseekBatch", {
        sourceLanguage,
        targetLanguage,
        sourceLang,
        targetLang,
      });
    }
  } catch (_) {
    (loggers.translation || console).debug("deepseek batch getPromptTemplate:", _);
  }
  if (!baseSystemPrompt || !baseSystemPrompt.trim()) {
    baseSystemPrompt = `你是一位专业的软件本地化翻译专家，精通${sourceLanguage}到${targetLanguage}的翻译。

翻译要求：
1. 准确传达原文含义，保持专业术语的一致性
2. 符合目标语言的表达习惯，自然流畅
3. 对于UI文本，要简洁明了
4. 严格保留原文中的占位符、标记与格式（例如 %s, %d, {0}, {{var}}, <b>...</b> 等），不得丢失、不得新增
5. key/字段名仅作为上下文参考：严禁翻译、严禁改写、严禁改变大小写
6. 你必须使用 JSON 格式输出。只输出 JSON，不要输出任何解释。`;
  }

  const conversationKey = conversationEnabled
    ? __deepseekBuildConversationKey(conversationScope, items)
    : "";
  let history =
    conversationEnabled && conversationKey
      ? this.deepseekConversations.get(conversationKey) || []
      : [];

  const maxItems = Math.min(100, Math.max(5, Number(settings.deepseekBatchMaxItems) || 40));
  const maxChars = Math.min(20000, Math.max(1000, Number(settings.deepseekBatchMaxChars) || 6000));
  const chunks = __deepseekChunkItems(items, maxChars, maxItems);
  const outputs = [];
  let pauseNotified = false;

  const waitWhilePaused = async () => {
    while (AppState?.translations?.isPaused) {
      if (__deepseekIsCancelled()) {
        throw __deepseekMakeCancelError(outputs);
      }
      if (onLog && !pauseNotified) {
        onLog("翻译已暂停，等待继续...");
      }
      pauseNotified = true;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (pauseNotified) {
      pauseNotified = false;
    }
  };

  for (let c = 0; c < chunks.length; c++) {
    await waitWhilePaused();
    if (__deepseekIsCancelled()) {
      throw __deepseekMakeCancelError(outputs);
    }

    const chunk = chunks[c];

    if (onLog) {
      onLog(
        `DeepSeek 批量请求 ${c + 1}/${chunks.length}（${chunk.length} 项）...`
      );
    }
    if (onProgress) {
      onProgress(
        outputs.length,
        items.length,
        `请求中...（${c + 1}/${chunks.length}）`
      );
    }

    try {
      await this.checkRateLimit("deepseek");
    } catch (_) {
      (loggers.translation || console).debug("deepseek batch rateLimit:", _);
    }

    const reqItems = chunk.map((it) => {
      const cleanText = securityUtils.sanitizeForApi(it.sourceText || "");
      return {
        key: useKeyContext ? __deepseekGetItemKey(it) : "",
        source: cleanText,
        file: it?.metadata?.file || "",
        fileType: __deepseekGetFileType(it),
      };
    });

    const primingMessage =
      primingSamples.length > 0
        ? {
            role: "user",
            content:
              "下面是用户手动选择的文件样本（source-only）。仅用于让你理解 key 命名与语境。请注意这是 JSON：\n" +
              JSON.stringify({
                samples: primingSamples.map((s) => ({
                  key: useKeyContext ? s.key : "",
                  source: s.source,
                  file: s.file,
                })),
              }),
          }
        : null;

    const userMessage = {
      role: "user",
      content:
        "请将以下 items 翻译为目标语言，并返回严格 JSON。\n" +
        "输出格式示例（必须包含 json 字样且结构一致）：\n" +
        '{"translations":["...","..."]}\n' +
        "规则：translations 数组长度必须与 items 长度一致，且按顺序一一对应。\n" +
        JSON.stringify({ items: reqItems }),
    };

    // 上下文感知：为当前chunk收集前后相邻条目
    let chunkSystemPrompt = baseSystemPrompt;
    if (contextAwareEnabled && allItems.length > 0) {
      const ctx = __deepseekCollectChunkContext(allItems, chunk, contextWindowSize);
      const ctxText = __deepseekFormatContextPrompt(ctx);
      if (ctxText) {
        chunkSystemPrompt += ctxText;
      }
    }

    const messages = [];
    messages.push({ role: "system", content: chunkSystemPrompt });
    if (history.length > 0) {
      for (const item of history) {
        if (item && item.role) {
          messages.push(item);
        } else if (item && item.user && item.assistant) {
          if (item.priming) messages.push(item.priming);
          messages.push(item.user);
          messages.push(item.assistant);
        }
      }
    }
    if (primingMessage) messages.push(primingMessage);
    messages.push(userMessage);

    const watcher = __deepseekCreateCancelWatcher(outputs);
    const fetchPromise = networkUtils
      .fetchWithTimeout(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: settings.temperature != null ? Number(settings.temperature) : 0.1,
            response_format: { type: "json_object" },
          }),
        },
        (settings.apiTimeout ? parseInt(settings.apiTimeout) : 30) * 1000
      )
      .catch((e) => {
        if (watcher.isCancelled()) {
          return new Promise(() => {});
        }
        throw e;
      });

    let response;
    try {
      response = await Promise.race([fetchPromise, watcher.cancelPromise]);
    } finally {
      watcher.cleanup();
    }

    if (__deepseekIsCancelled()) {
      throw __deepseekMakeCancelError(outputs);
    }

    if (!response.ok) {
      const raw = await response.text();
      let message = `DeepSeek API错误: ${response.status}`;
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
      err.provider = "deepseek";
      err.url = "https://api.deepseek.com/v1/chat/completions";
      throw err;
    }

    const data = await response.json();
    const content = (data?.choices?.[0]?.message?.content || "").trim();
    if (!content) {
      throw new Error("DeepSeek 返回空内容（可能为 JSON 输出不稳定），请重试");
    }

    if (__deepseekIsCancelled()) {
      throw __deepseekMakeCancelError(outputs);
    }

    if (onLog) {
      onLog(`DeepSeek 已返回响应，正在解析 JSON...`);
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error("DeepSeek JSON 解析失败：" + e.message);
    }

    const translations = parsed?.translations;
    if (!Array.isArray(translations) || translations.length !== chunk.length) {
      throw new Error(
        `DeepSeek 返回 translations 数量不匹配：期望 ${chunk.length}，实际 ${
          Array.isArray(translations) ? translations.length : 0
        }`
      );
    }

    for (let i = 0; i < translations.length; i++) {
      outputs.push(String(translations[i] ?? ""));
      if (onProgress) {
        onProgress(
          outputs.length,
          items.length,
          `[${outputs.length}/${items.length}] 正在处理批量结果...`
        );
      }
    }

    if (__deepseekIsCancelled()) {
      throw __deepseekMakeCancelError(outputs);
    }

    if (onLog) {
      onLog(
        `DeepSeek 批量请求 ${c + 1}/${chunks.length} 完成（累计 ${
          outputs.length
        }/${items.length}）`
      );
    }

    if (conversationEnabled && conversationKey) {
      const assistantMsg = { role: "assistant", content };
      const round = {
        system: baseSystemPrompt,
        priming: primingMessage || null,
        user: userMessage,
        assistant: assistantMsg,
      };
      const nextHistory = Array.isArray(history) ? history.slice() : [];
      nextHistory.push(round);

      const maxRounds = 8;
      const trimmedHistory = nextHistory.slice(-maxRounds);
      this.deepseekConversations.set(conversationKey, trimmedHistory);
      history = trimmedHistory;
    }
  }

  return outputs;
};
