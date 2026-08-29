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

  const parts = [];
  let idx = 0;
  let searchIdx = 0;
  while (true) {
    const found = lowerText.indexOf(lowerSource, searchIdx);
    if (found === -1) {
      parts.push(text.slice(idx));
      break;
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
