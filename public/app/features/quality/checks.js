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

function __normalizeNumberTokenImpl(token) {
  // 数字 token 规范化为统一形态以便按值比较：
  // - 千分位分隔（1,000 / 1.000 / 1,000.50）→ 1000 / 1000.50
  // - 欧式小数逗号（1,5）→ 1.5
  // - 前导零（01）→ 1
  // - 多点版本号（2.0.1）无法判定语义，保持原样
  const stripZeros = (s) => s.replace(/^0+(?=\d)/, "") || "0";
  let t = String(token).replace(/\s+/g, "");
  const hasComma = t.indexOf(",") !== -1;
  const hasDot = t.indexOf(".") !== -1;
  if (!hasComma && !hasDot) return stripZeros(t);
  if (hasComma && hasDot) {
    // 同时含逗号与点：靠后者为小数点，其余为千分位
    const lastComma = t.lastIndexOf(",");
    const lastDot = t.lastIndexOf(".");
    const sepIndex = lastComma > lastDot ? lastComma : lastDot;
    return (
      stripZeros(t.slice(0, sepIndex).replace(/[.,]/g, "")) +
      "." +
      t.slice(sepIndex + 1)
    );
  }
  const sep = hasComma ? "," : ".";
  const parts = t.split(sep);
  if (parts.length > 2) {
    // 多段分隔：每段 3 位视为千分位，否则按版本号等原样保留
    if (parts.slice(1).every((p) => p.length === 3)) {
      return stripZeros(parts.join(""));
    }
    return t;
  }
  const intPart = parts[0];
  const decPart = parts[1];
  if (decPart.length === 3) return stripZeros(intPart + decPart); // 1,000 式千分位
  return stripZeros(intPart) + "." + decPart;
}

function __extractNumbersImpl(text) {
  // 提取数字 token（含规范化值）。先剔除占位符/格式符，
  // 避免匹配到 %2$d、{count2} 等内部的数字。
  const numbers = [];
  if (!text) return numbers;
  const stripped = String(text).replace(
    /\{\{[^{}]+\}\}|%\d+\$[sdf]|\{[^{}]+\}|%[sd]/g,
    " "
  );
  const tokens = stripped.match(/\d+(?:[.,]\d+)*/g) || [];
  for (const token of tokens) {
    numbers.push({
      original: token,
      canonical: __normalizeNumberTokenImpl(token),
    });
  }
  return numbers;
}

function __parseChineseNumberImpl(str) {
  // 解析中文数字段（支持 十/百/千/万/亿 与 两/〇）
  const digits = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  const units = { 十: 10, 百: 100, 千: 1000 };
  const parseSection = (section) => {
    let total = 0;
    let current = 0;
    for (const ch of section) {
      if (ch in digits) {
        current = digits[ch];
      } else if (ch in units) {
        if (current === 0) current = 1; // 十五 → 1*10+5
        total += current * units[ch];
        current = 0;
      }
    }
    return total + current;
  };
  let total = 0;
  let rest = str;
  const yiParts = rest.split("亿");
  if (yiParts.length === 2) {
    total += parseSection(yiParts[0]) * 100000000;
    rest = yiParts[1];
  }
  const wanParts = rest.split("万");
  if (wanParts.length === 2) {
    total += parseSection(wanParts[0]) * 10000;
    rest = wanParts[1];
  }
  return total + parseSection(rest);
}

function __extractChineseNumberValuesImpl(text) {
  // 提取译文中以中文数字表达的数值（第五关 → 5、三条 → 3），
  // 仅用作数字检查的消误报兜底池；0 值段忽略。
  const values = [];
  if (!text) return values;
  const pattern = /[零〇一二两三四五六七八九十百千万亿]+/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const value = __parseChineseNumberImpl(match[0]);
    if (value > 0) values.push(value);
  }
  return values;
}

// 术语词边界匹配：拉丁字母/数字术语要求前后无 [a-z0-9_] 连续字符，
// 排除子串误命中（如 "king" 命中术语 "in"、"_count_" 命中术语 "count"）；
// 纯 CJK/标点术语无单词边界概念，退化为子串包含。
function __isTermMatchImpl(text, termLower) {
  if (!text || !termLower) return false;
  if (!/[a-z0-9]/i.test(termLower)) return text.includes(termLower);
  const escaped = termLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9_])${escaped}(?![a-z0-9_])`, "i").test(text);
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

  // 术语上下文由 run() 入参注入（检查开始时的快照，截断在注入侧完成）；
  // 本模块不直读 TerminologyStore / AppState.terminology（依赖注入，可测）
  const __termList = Array.isArray(terms) ? terms : [];
  if (opts.checkTerminology && __termList.length > 0) {
    const sourceLower = item.sourceText.toLowerCase();
    const targetLower = item.targetText.toLowerCase();
    for (const term of __termList) {
      const termSourceLower = (term.source || "").toLowerCase();
      const termTargetLower = (term.target || "").toLowerCase();
      // 空 source 术语无法界定命中，跳过（旧实现 includes("") 恒真导致误计数）；
      // 空 target 术语无法校验译文是否正确使用——计命中会虚增一致性百分比
      // （Bug 修复：曾按"已正确使用"处理），不计命中、不产 issue，静默跳过
      if (!termSourceLower || !termTargetLower) continue;
      // 先子串快速排除，再做词边界精确判定（边界匹配蕴含子串命中）
      if (
        !sourceLower.includes(termSourceLower) ||
        !__isTermMatchImpl(sourceLower, termSourceLower)
      ) {
        continue;
      }
      result.termMatches++;
      // 译文侧同样用词边界判定，避免子串恰好包含
      // （如 "rapid" 含 "api"）被误判为已使用
      if (!__isTermMatchImpl(targetLower, termTargetLower)) {
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
    // 数字按规范化值做多重集比较（而非字面子串匹配）：
    // 消除日期本地化（2024-01-01 → 2024年1月1日）、欧式小数逗号（1.5 → 1,5）、
    // 千分位差异（1,000 → 1.000）等误报；中文数字表达（第五关）经兜底池消除。
    const sourceNumbers = __extractNumbersImpl(item.sourceText);
    const targetNumbers = __extractNumbersImpl(item.targetText);
    const pool = targetNumbers.slice();
    const missing = [];
    for (const num of sourceNumbers) {
      const idx = pool.findIndex((t) => t.canonical === num.canonical);
      if (idx === -1) {
        missing.push(num);
      } else {
        pool.splice(idx, 1);
      }
    }
    // 中文数字兜底：译文中以中文数字表达的同值数字视为已保留（仅消误报）
    if (missing.length > 0) {
      const cnValues = __extractChineseNumberValuesImpl(item.targetText);
      for (let i = missing.length - 1; i >= 0; i--) {
        const idx = cnValues.indexOf(Number(missing[i].canonical));
        if (idx !== -1) {
          cnValues.splice(idx, 1);
          missing.splice(i, 1);
        }
      }
    }
    if (missing.length > 0) {
      result.issues.push({
        itemId: item.id,
        sourceText: item.sourceText,
        targetText: item.targetText,
        type: "numbers",
        typeName: "数字不一致",
        severity: "medium",
        description: `原文中的数字 ${missing
          .map((n) => `“${n.original}”`)
          .join("、")} 在译文中未保留`,
      });
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
  App.impl.isTermMatch = __isTermMatchImpl;
  App.impl.extractPlaceholderTokens = __extractPlaceholderTokensImpl;
  App.impl.normalizeNumberToken = __normalizeNumberTokenImpl;
  App.impl.extractNumbers = __extractNumbersImpl;
  App.impl.parseChineseNumber = __parseChineseNumberImpl;
  App.impl.extractChineseNumberValues = __extractChineseNumberValuesImpl;
  App.impl.escapeRegex = __escapeRegexImpl;
})();
