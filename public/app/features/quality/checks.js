const __qualityCheckCache = new Map();

function __getQualityCheckOptions() {
  try {
    const s = SettingsCache.get();
    return {
      checkTerminology: s.checkTerminology !== false,
      checkPlaceholders: s.checkPlaceholders !== false,
      checkPunctuation: s.checkPunctuation !== false,
      checkLength: s.checkLength === true,
      checkNumbers: s.checkNumbers !== false,
    };
  } catch (_) {
    return {
      checkTerminology: true,
      checkPlaceholders: true,
      checkPunctuation: true,
      checkLength: false,
      checkNumbers: true,
    };
  }
}

async function __checkTranslationItemCachedImpl(item) {
  const cacheKey = `${item.id}-${item.sourceText}-${item.targetText}`;

  if (__qualityCheckCache.has(cacheKey)) {
    return __qualityCheckCache.get(cacheKey);
  }

  const result = await __checkTranslationItemOptimizedImpl(item);

  if (__qualityCheckCache.size < 1000) {
    __qualityCheckCache.set(cacheKey, result);
  }

  return result;
}

async function __checkTranslationItemOptimizedImpl(item) {
  const result = {
    isTranslated: false,
    issues: [],
    termMatches: 0,
  };
  const opts = __getQualityCheckOptions();

  if (!item.targetText || item.targetText.trim() === "") {
    if (item.sourceText && item.sourceText.trim() !== "") {
      result.issues.push({
        itemId: item.id,
        sourceText: item.sourceText,
        targetText: "",
        type: "empty",
        typeName: "空译文",
        severity: "high",
        description: "该项尚未翻译",
      });
    }
    return result;
  }

  result.isTranslated = true;

  if (opts.checkLength) {
    const sourceLength = item.sourceText.length;
    const targetLength = item.targetText.length;
    const lengthRatio = sourceLength > 0 ? targetLength / sourceLength : 0;
    if (lengthRatio < 0.3 || lengthRatio > 3) {
      result.issues.push({
        itemId: item.id,
        sourceText: item.sourceText,
        targetText: item.targetText,
        type: "length",
        typeName: "长度异常",
        severity: lengthRatio < 0.2 || lengthRatio > 4 ? "high" : "medium",
        description: `译文长度比例异常（${lengthRatio.toFixed(2)}x）`,
      });
    }
  }

  if (opts.checkTerminology && AppState.terminology.list && AppState.terminology.list.length > 0) {
    const termsToCheck = AppState.terminology.list.slice(0, 100);
    const sourceLower = item.sourceText.toLowerCase();
    const targetLower = item.targetText.toLowerCase();
    for (const term of termsToCheck) {
      const termSourceLower = term.source.toLowerCase();
      const termTargetLower = term.target.toLowerCase();
      if (sourceLower.includes(termSourceLower)) {
        result.termMatches++;
        if (!targetLower.includes(termTargetLower)) {
          result.issues.push({
            itemId: item.id,
            sourceText: item.sourceText,
            targetText: item.targetText,
            type: "terminology",
            typeName: "术语不一致",
            severity: "medium",
            description: `应使用术语“${term.target}”替代“${term.source}”`,
          });
        }
      }
    }
  }

  if (opts.checkPlaceholders) {
    const variableChecks = [
      { pattern: /\{\{[^}]+\}\}/g, name: "{{}}" },
      { pattern: /\{[^}]+\}/g, name: "{}" },
      { pattern: /%[sd]/g, name: "%s/%d" },
      { pattern: /%\d+\$[sdf]/g, name: "%n$s 等" },
    ];
    for (const check of variableChecks) {
      const sourceVars = item.sourceText.match(check.pattern);
      const targetVars = item.targetText.match(check.pattern);
      const sourceCount = sourceVars ? sourceVars.length : 0;
      const targetCount = targetVars ? targetVars.length : 0;
      if (sourceCount !== targetCount) {
        result.issues.push({
          itemId: item.id,
          sourceText: item.sourceText,
          targetText: item.targetText,
          type: "variable",
          typeName: "变量/占位符丢失",
          severity: "high",
          description: `${check.name}数量不匹配：原文${sourceCount}个，译文${targetCount}个`,
        });
        break;
      }
    }

    const sourceTagCount = (item.sourceText.match(/<[^>]+>/g) || []).length;
    const targetTagCount = (item.targetText.match(/<[^>]+>/g) || []).length;
    if (sourceTagCount > 0 && sourceTagCount !== targetTagCount) {
      result.issues.push({
        itemId: item.id,
        sourceText: item.sourceText,
        targetText: item.targetText,
        type: "format",
        typeName: "标签数量不匹配",
        severity: "medium",
        description: `HTML标签数量不匹配：原文${sourceTagCount}个，译文${targetTagCount}个`,
      });
    }
  }

  if (opts.checkPunctuation) {
    const src = (item.sourceText || "").trim();
    const tgt = (item.targetText || "").trim();
    const endPunct = /[.!?。！？；;:：]$/;
    const srcEnd = src.match(endPunct);
    const tgtEnd = tgt.match(endPunct);
    if (src.length > 0 && tgt.length > 0) {
      const srcHas = !!srcEnd;
      const tgtHas = !!tgtEnd;
      if (srcHas && !tgtHas) {
        result.issues.push({
          itemId: item.id,
          sourceText: item.sourceText,
          targetText: item.targetText,
          type: "punctuation",
          typeName: "标点缺失",
          severity: "low",
          description: "原文句尾有标点，译文句尾缺少标点",
        });
      } else if (!srcHas && tgtHas) {
        result.issues.push({
          itemId: item.id,
          sourceText: item.sourceText,
          targetText: item.targetText,
          type: "punctuation",
          typeName: "标点多余",
          severity: "low",
          description: "原文句尾无标点，译文句尾多了标点",
        });
      }
    }
  }

  if (opts.checkNumbers) {
    const sourceDigits = (item.sourceText || "").match(/\d+(?:\.\d+)?/g) || [];
    const targetStr = item.targetText || "";
    for (const num of sourceDigits) {
      if (targetStr.indexOf(num) === -1) {
        result.issues.push({
          itemId: item.id,
          sourceText: item.sourceText,
          targetText: item.targetText,
          type: "numbers",
          typeName: "数字不一致",
          severity: "medium",
          description: `原文中的数字“${num}”在译文中未保留`,
        });
        break;
      }
    }
  }

  return result;
}

function __escapeRegexImpl(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.checkTranslationItemCached = __checkTranslationItemCachedImpl;
  App.impl.checkTranslationItemOptimized = __checkTranslationItemOptimizedImpl;
  App.impl.escapeRegex = __escapeRegexImpl;
})();
