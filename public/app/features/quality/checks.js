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
  } catch (e) {
    return {
      checkTerminology: true,
      checkPlaceholders: true,
      checkPunctuation: true,
      checkLength: false,
      checkNumbers: true,
    };
  }
}

async function __checkTranslationItemCachedImpl(item, terms) {
  const cacheKey = `${item.id}-${item.sourceText}-${item.targetText}`;

  if (__qualityCheckCache.has(cacheKey)) {
    return __qualityCheckCache.get(cacheKey);
  }

  const result = await __checkTranslationItemOptimizedImpl(item, terms);

  if (__qualityCheckCache.size < 1000) {
    __qualityCheckCache.set(cacheKey, result);
  }

  return result;
}

function __extractPlaceholderTokensImpl(text) {
  // 提取占位符 token 列表（多重集比较的基础）。
  // 提取顺序：{{}} 先于 {}、%n$s 先于 %s，避免外层/通用模式误吞内层 token
  // （旧实现的 /\{[^}]+\}/ 会把 {{name}} 误匹配为 "{{name}"，导致风格互换漏报）。
  const tokens = [];
  if (!text) return tokens;
  let rest = String(text);
  const families = [
    /\{\{[^{}]+\}\}/g, // {{name}}
    /%\d+\$[sdf]/g, // %1$s 等
    /\{[^{}]+\}/g, // {name}
    /%[sd]/g, // %s / %d
  ];
  for (const pattern of families) {
    rest = rest.replace(pattern, (match) => {
      tokens.push(match);
      return "\u0000";
    });
  }
  return tokens;
}

async function __checkTranslationItemOptimizedImpl(item, terms) {
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

  // 术语上下文由 run() 入参注入（检查开始时的快照）；
  // 本模块不直读 TerminologyStore / AppState.terminology（依赖注入，可测）
  const __termList = Array.isArray(terms) ? terms : [];
  if (opts.checkTerminology && __termList.length > 0) {
    const termsToCheck = __termList.slice(0, 100);
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
    // 占位符按 token 多重集比较（而非按家族计数）：
    // 可检出风格互换（{{a}} {b} ↔ {a} {{b}}）与重命名（{name} → {nom}）等
    // 旧计数实现漏报的场景；顺序不同但集合相同不算问题。
    const sourceTokens = __extractPlaceholderTokensImpl(item.sourceText);
    const targetTokens = __extractPlaceholderTokensImpl(item.targetText);
    if (sourceTokens.length > 0 || targetTokens.length > 0) {
      const pool = targetTokens.slice();
      const missing = [];
      for (const token of sourceTokens) {
        const idx = pool.indexOf(token);
        if (idx === -1) {
          missing.push(token);
        } else {
          pool.splice(idx, 1);
        }
      }
      if (missing.length > 0 || pool.length > 0) {
        const parts = [];
        if (missing.length > 0) parts.push(`译文缺少 ${missing.join("、")}`);
        if (pool.length > 0) parts.push(`译文多出 ${pool.join("、")}`);
        result.issues.push({
          itemId: item.id,
          sourceText: item.sourceText,
          targetText: item.targetText,
          type: "variable",
          typeName: "变量/占位符不一致",
          severity: "high",
          description: parts.join("；"),
        });
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
  App.impl.extractPlaceholderTokens = __extractPlaceholderTokensImpl;
  App.impl.escapeRegex = __escapeRegexImpl;
})();
