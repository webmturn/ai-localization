// 术语库匹配函数
// 匹配模式由设置 termMatchMode 控制：exact（完全匹配）/ prefix（前缀）/ contains（包含，默认）
TranslationService.prototype.findTerminologyMatches = function (text) {
  const matches = [];

  try {
    // 运行时唯一数据源：TerminologyStore getter（消灭双源兜底读）
    const terminologyList =
      typeof TerminologyStore !== "undefined" && TerminologyStore
        ? TerminologyStore.getList()
        : [];
    if (!terminologyList || terminologyList.length === 0) return matches;

    // 匹配模式（设置项，default contains）
    let mode = "contains";
    try {
      const settings = (typeof SettingsCache !== "undefined" && SettingsCache.get) ? SettingsCache.get() : {};
      if (settings && settings.termMatchMode) mode = String(settings.termMatchMode);
    } catch (e) {}

    const textLower = text.toLowerCase();
    for (const term of terminologyList) {
      try {
        const sourceLower = String(term.source || "").toLowerCase();
        if (!sourceLower) continue;

        let hit = false;
        if (mode === "exact") {
          hit = textLower === sourceLower;
        } else if (mode === "prefix") {
          hit = textLower.startsWith(sourceLower);
        } else {
          hit = textLower.includes(sourceLower);
        }

        if (hit) {
          matches.push({
            source: term.source,
            target: term.target,
            context: term.context || "",
          });
        }
      } catch (e) {
        // 忽略单个术语的错误
        (loggers.translation || console).warn("匹配术语失败:", term.source, e);
      }
    }
  } catch (error) {
    (loggers.translation || console).error("术语库匹配失败:", error);
  }

  return matches;
};

// 大小写不敏感的全局替换（无需正则转义，术语可含特殊字符）
function __terminologyReplaceIgnoreCase(text, source, target) {
  if (!text || !source) return text;
  const lowerText = text.toLowerCase();
  const lowerSource = source.toLowerCase();
  const lowerTarget = target.toLowerCase();
  if (!lowerText.includes(lowerSource)) return text;

  // 词边界判定：避免把术语当成更长单词的一部分替换掉
  // （例如术语 "cat" 不应命中 "category"、"no" 不应命中 "node"、"id" 不应命中 "width"）。
  //
  // 但边界规则**不能**用于 CJK 术语：中文/日文不写空格，词与词之间没有可判定边界。
  // 若对 CJK 术语也要求边界，"打开文件" 里的 "文件"、"点击取消按钮" 里的 "取消"
  // 都将无法命中 —— 那等于让中文术语库整体失效（这是必须避免的回归）。
  // 因此：术语含 CJK 时按子串匹配（CJK 术语也不会嵌在拉丁单词内部，无副作用）；
  //       纯拉丁/数字术语才施加词边界。
  // 词字符 = Unicode 字母/数字/下划线（用于拉丁文术语的边界判定）
  var WORD_CHAR;
  try {
    WORD_CHAR = new RegExp("[\\p{L}\\p{N}_]", "u");
  } catch (e) {
    WORD_CHAR = /[0-9A-Za-z_\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
  }

  var CJK_RE = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]/;
  var termHasCjk = CJK_RE.test(source);
  var headIsWord = WORD_CHAR.test(source.charAt(0));
  var tailIsWord = WORD_CHAR.test(source.charAt(source.length - 1));

  function isReplacementSite(at) {
    if (termHasCjk) return true;
    if (headIsWord && at > 0 && WORD_CHAR.test(text.charAt(at - 1))) return false;
    var end = at + source.length;
    if (tailIsWord && end < text.length && WORD_CHAR.test(text.charAt(end))) return false;
    return true;
  }

  const parts = [];
  let idx = 0;
  let searchIdx = 0;
  while (true) {
    const found = lowerText.indexOf(lowerSource, searchIdx);
    if (found === -1) {
      parts.push(text.slice(idx));
      break;
    }
    if (!isReplacementSite(found)) {
      // 不是独立词：原样保留，继续向后搜索
      searchIdx = found + 1;
      continue;
    }
    parts.push(text.slice(idx, found));
    const original = text.slice(found, found + source.length);
    // 幂等：该位置已是术语 target（大小写不敏感）则保留
    parts.push(original.toLowerCase() === lowerTarget ? original : target);
    idx = found + source.length;
    searchIdx = idx;
  }
  return parts.join("");
}

/**
 * 翻译后自动应用术语库（autoApplyTerms 设置项，默认开启）
 * 在译文中将命中的术语 source 替换为术语 target（忽略大小写、幂等保护）
 * 关闭 autoApplyTerms 或未命中任何术语时原样返回
 */
TranslationService.prototype.applyTerminologyToTranslation = function (text) {
  if (!text || typeof text !== "string") return text;

  try {
    const settings = (typeof SettingsCache !== "undefined" && SettingsCache.get) ? SettingsCache.get() : {};
    // 显式关闭才跳过（默认开启）
    if (settings && settings.autoApplyTerms === false) return text;

    const terminologyList =
      typeof TerminologyStore !== "undefined" && TerminologyStore
        ? TerminologyStore.getList()
        : [];
    if (!terminologyList || terminologyList.length === 0) return text;

    let result = text;
    for (const term of terminologyList) {
      try {
        const source = String((term && term.source) || "");
        const target = String((term && term.target) || "");
        if (!source || !target || source.toLowerCase() === target.toLowerCase()) continue;
        result = __terminologyReplaceIgnoreCase(result, source, target);
      } catch (e) {
        // 忽略单个术语的错误
      }
    }
    return result;
  } catch (error) {
    return text;
  }
};
