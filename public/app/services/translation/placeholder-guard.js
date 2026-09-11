// ==================== 占位符保护 (Placeholder Guard) ====================
// 翻译前提取占位符替换为安全标记，翻译后恢复，防止 AI 引擎误译变量

var PlaceholderGuard = (function () {

  // 占位符模式列表（按优先级排序，长模式先匹配）
  var PATTERNS = [
    // ICU MessageFormat: {count, plural, one{# item} other{# items}}
    { name: "icu",          re: /\{[a-zA-Z_]\w*\s*,\s*(?:plural|select|selectordinal)\s*,[\s\S]*?\}/g },
    // 双花括号: {{variable}} (Handlebars, Angular, Vue, Mustache)
    { name: "doubleBrace",  re: /\{\{[\s\S]*?\}\}/g },
    // JSX/React: {variable} or {func()} — 单花括号内含标识符
    { name: "singleBrace",  re: /\{[a-zA-Z_$][\w$.]*(?:\([^)]*\))?\}/g },
    // Angular 管道: {{ value | pipe }}
    // (already captured by doubleBrace)
    // Ruby/Python format: %{variable} or %(variable)s
    { name: "percentBrace", re: /%[{(][a-zA-Z_]\w*[})]/g },
    // Python .format(): {0}, {name}, {0:>10}
    { name: "pyFormat",     re: /\{\d+(?::[^}]*)?\}/g },
    // C-style printf: %s, %d, %02d, %1$s, %-10.2f
    // 注意：必须要求「不带标志/宽度的转换符」紧跟在 % 之后，且标志集不含尾随空格。
    // 旧写法 /%(?:\d+\$)?[-+0 #]*(?:\d+)?(?:\.\d+)?[...]/ 会把普通百分数误判为占位符：
    // "Save 50% off" 中的 "% o" 被当成「空格标志 + o 转换符」→ 送给模型前被改写成
    // "Save 50«0»ff"，且 validate() 会把正确译文判为无效。
    { name: "printf",       re: /%(?:\d+\$)?[-+0#]*(?:\d+)?(?:\.\d+)?[diouxXeEfgGcspn%@]/g },
    // HTML tags: <br>, <b>, </b>, <a href="...">, <img ... />
    { name: "htmlTag",      re: /<\/?[a-zA-Z][\w-]*(?:\s+[a-zA-Z][\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?)*\s*\/?>/g },
    // XML entities: &amp; &lt; &#x20; &#160;
    { name: "entity",       re: /&(?:#x?[0-9a-fA-F]+|[a-zA-Z]\w*);/g },
    // Android strings: %1$s, %2$d
    { name: "android",      re: /%\d+\$[sd]/g },
    // iOS / ObjC: %@ (already captured by printf but ensure coverage)
    // Qt: %1, %2, ... %99
    { name: "qt",           re: /%\d{1,2}(?![0-9$])/g },
    // i18next: $t(key), {{count}}
    { name: "i18next",      re: /\$t\([^)]+\)/g },
    // Fluent: { $variable }
    { name: "fluent",       re: /\{\s*\$[a-zA-Z_]\w*\s*\}/g },
    // Escaped characters: \n, \t, \\, \"
    { name: "escape",       re: /\\[nrtv0'"\\]/g },
  ];

  // 安全标记前缀/后缀（不太可能出现在自然语言中）
  var TAG_PREFIX = "\u00ab";  // «
  var TAG_SUFFIX = "\u00bb";  // »

  /**
   * 从 openIndex（指向 "{"）开始做花括号配对扫描，返回配平子串。
   * 感知字符串字面量与转义，避免被 "{a:'}'}" 这类内容误导。
   * @returns {{text: string, end: number}|null} end 为收尾 "}" 的下标
   */
  function scanBalancedBraces(text, openIndex) {
    if (text.charAt(openIndex) !== "{") return null;
    var depth = 0;
    var inStr = false;
    var quote = "";
    var escaped = false;
    for (var i = openIndex; i < text.length; i++) {
      var ch = text.charAt(i);
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) inStr = false;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return { text: text.slice(openIndex, i + 1), end: i };
      }
    }
    return null; // 未配平 → 不保护，交由其它模式处理
  }

  /**
   * 判断配平片段是否为 ICU MessageFormat（{name, plural/select/selectordinal, …}）。
   * 必须要求顶层逗号 + 关键字，否则会把普通的单花括号当成 ICU。
   */
  function looksLikeIcu(inner) {
    if (!inner || inner.charAt(0) !== "{") return false;
    var body = inner.slice(1, -1);
    var comma = body.indexOf(",");
    if (comma === -1) return false;
    var type = body.slice(comma + 1).split(",")[0].trim().toLowerCase();
    return type === "plural" || type === "select" || type === "selectordinal";
  }

  /**
   * 判断某个 printf 命中是否其实是「百分数」而不是占位符。
   *
   * 例：`50%off`、`100%increase`、`30%discount` —— `%o`/`%i`/`%d` 恰好落在转换符表里，
   * 但它们左边是数字、右边紧跟字母，语义是百分比。若当成占位符，送给模型的文本会被改写
   * （`50«0»ff`），且正确译文会被 validate() 判为「缺失 %o」。
   *
   * 反向保护：`file%s.txt`（左边是字母）与 `"50%d"`（右边不是字母）仍按占位符处理。
   */
  function isLikelyPercentage(text, start, end) {
    var prev = start > 0 ? text.charAt(start - 1) : "";
    var next = end < text.length ? text.charAt(end) : "";
    return /[0-9]/.test(prev) && /[A-Za-z]/.test(next);
  }

  /**
   * 保护文本中的占位符
   * @param {string} text - 原始文本
   * @returns {{ text: string, map: Array, hasPlaceholders: boolean }}
   */
  function protect(text) {
    if (!text || typeof text !== "string") {
      return { text: text || "", map: [], hasPlaceholders: false };
    }

    var map = [];
    var used = new Set();

    // 登记/复用占位符索引（相同原文共用一个索引）
    function registerMatch(match, patternName) {
      for (var i = 0; i < map.length; i++) {
        if (map[i].original === match) {
          used.add(i);
          return TAG_PREFIX + i + TAG_SUFFIX;
        }
      }
      var idx = map.length;
      map.push({ original: match, name: patternName || "icu", index: idx });
      used.add(idx);
      return TAG_PREFIX + idx + TAG_SUFFIX;
    }

    // ICU MessageFormat 需要花括号配对扫描（PATTERNS[0] = icu）。
    // 原实现用 /\{…,[\s\S]*?\}/ 非贪婪匹配，遇嵌套分支会停在第一个 "}"，
    // 例如 "{count, plural, one{# item} other{# items}}" 只保护到
    // "{count, plural, one{# item}"，模型收到的是 "«0» other{# items}}" 这种
    // 残缺且结构已被破坏的文本。
    var icuOut = [];
    var i = 0;
    while (i < text.length) {
      var ch = text.charAt(i);
      if (ch !== "{") { icuOut.push(ch); i++; continue; }
      var balanced = scanBalancedBraces(text, i);
      if (balanced && looksLikeIcu(balanced.text)) {
        icuOut.push(registerMatch(balanced.text, "icu"));
        i = balanced.end + 1;
        continue;
      }
      icuOut.push(ch);
      i++;
    }
    var result = icuOut.join("");

    // 其余模式：ICU 已被替换为含标记的字符串，跳过它们即可
    for (var p = 1; p < PATTERNS.length; p++) {
      var pattern = PATTERNS[p];
      // 用 IIFE 绑定当前 pattern，否则回调里引用的是循环结束后的最后一个 pattern
      (function (pat) {
        pat.re.lastIndex = 0;
        result = result.replace(pat.re, function (match, offset, whole) {
          // 禁止跨过已生成的标记：例如 "{{{a}}}" 中 ICU 已替换掉 "{a, …}"，
          // 若让 doubleBrace 跨过标记去匹配，会连带吞掉多余的 '}'。
          if (match.indexOf(TAG_PREFIX) !== -1 || match.indexOf(TAG_SUFFIX) !== -1) return match;
          // 百分数误判：`50%off` 不是占位符
          if (pat.name === "printf" && isLikelyPercentage(whole, offset, offset + match.length)) {
            return match;
          }
          return registerMatch(match, pat.name);
        });
      })(pattern);
    }

    return {
      text: result,
      map: map,
      hasPlaceholders: map.length > 0
    };
  }

  /**
   * 恢复翻译结果中的占位符
   * @param {string} translated - 翻译后文本（含标记）
   * @param {Array} map - protect() 返回的 map
   * @returns {string} 恢复占位符后的文本
   */
  function restore(translated, map) {
    if (!translated || !map || map.length === 0) return translated || "";
    // 非字符串（模型返回对象/数组/数字等坏结果）原样返回：交由调用方的结果校验拒绝，
    // 而不是在这里抛 TypeError 把整批（甚至已付费的）结果一起作废。
    if (typeof translated !== "string") return translated;

    var result = translated;

    for (var i = 0; i < map.length; i++) {
      var tag = TAG_PREFIX + i + TAG_SUFFIX;
      // 替换所有该标记的出现
      while (result.indexOf(tag) !== -1) {
        result = result.replace(tag, map[i].original);
      }
    }

    // 清理可能残留的未映射标记
    result = result.replace(new RegExp(TAG_PREFIX + "\\d+" + TAG_SUFFIX, "g"), function (m) {
      var idx = parseInt(m.slice(1, -1), 10);
      return (map[idx] && map[idx].original) || m;
    });

    return result;
  }

  /**
   * 验证翻译结果中占位符是否完整
   * @param {string} source - 源文本
   * @param {string} translated - 译文
   * @returns {{ valid: boolean, missing: string[], extra: string[] }}
   */
  /**
   * 收集文本中的 ICU 片段（与 protect 共用同一套配对扫描）
   * @returns {Array<{text: string, end: number}>}
   */
  function collectIcu(text) {
    var spans = [];
    if (!text) return spans;
    var i = 0;
    while (i < text.length) {
      if (text.charAt(i) !== "{") {
        i++;
        continue;
      }
      var balanced = scanBalancedBraces(text, i);
      if (balanced && looksLikeIcu(balanced.text)) {
        spans.push(balanced);
        i = balanced.end + 1;
        continue;
      }
      i++;
    }
    return spans;
  }

  /**
   * ICU 片段的「骨架」：变量名 + 类型 + 分支键。
   *
   * 分支内部的文本是**要被翻译的**（one{# item} → one{# 项}），因此校验不能按字面比对整段，
   * 只能要求结构一致；这样「正确翻译了分支」与「原样保留」都算通过，
   * 而「整段删掉」「类型被改」「分支键丢失」仍会被判为不匹配。
   */
  function icuSkeleton(span) {
    var body = String(span).slice(1, -1);
    var comma = body.indexOf(",");
    if (comma === -1) return String(span);
    var arg = body.slice(0, comma).trim();
    var rest = body.slice(comma + 1);
    var typeMatch = rest.match(/^\s*([A-Za-z_]+)\s*,/);
    if (!typeMatch) return String(span);
    var type = typeMatch[1].toLowerCase();
    var branches = rest.slice(typeMatch[0].length);
    var keys = [];
    var i = 0;
    while (i < branches.length) {
      while (i < branches.length && /[\s,]/.test(branches.charAt(i))) i++;
      var keyMatch = /^(=\d+|[A-Za-z_]\w*)\s*\{/.exec(branches.slice(i));
      if (!keyMatch) break;
      keys.push(keyMatch[1]);
      i += keyMatch[0].length - 1; // 移到 '{'
      var balanced = scanBalancedBraces(branches, i);
      if (!balanced) break;
      i = balanced.end + 1;
    }
    return "{" + arg + "," + type + "," + keys.join("|") + "}";
  }

  /**
   * 校验译文占位符完整性。
   * ICU 片段按「骨架」比对，其余占位符（%s/{0}/<br>/实体…）按多重集比对。
   * @param {string} source
   * @param {string} translated
   * @returns {{ valid: boolean, missing: string[], extra: string[] }}
   */
  function validate(source, translated) {
    var missing = [];
    var extra = [];

    // 1) ICU：按骨架比对（数量与结构敏感，分支内文本不敏感）
    var srcIcu = collectIcu(source);
    var tgtSkeletons = collectIcu(translated).map(function (s) {
      return icuSkeleton(s.text);
    });
    for (var k = 0; k < srcIcu.length; k++) {
      var skeleton = icuSkeleton(srcIcu[k].text);
      var at = tgtSkeletons.indexOf(skeleton);
      if (at === -1) missing.push(srcIcu[k].text);
      else tgtSkeletons.splice(at, 1);
    }
    for (var k2 = 0; k2 < tgtSkeletons.length; k2++) extra.push(tgtSkeletons[k2]);

    // 2) 其余占位符：多重集比对
    var srcPH = extractSimple(source);
    var tgtPH = extractSimple(translated);
    for (var i = 0; i < srcPH.length; i++) {
      var idx = tgtPH.indexOf(srcPH[i]);
      if (idx === -1) {
        missing.push(srcPH[i]);
      } else {
        tgtPH.splice(idx, 1);
      }
    }
    extra = extra.concat(tgtPH);

    // 分级：标记/编码层面的差异（XML 实体、HTML 标签）不算占位符损坏。
    // 模型把 & 转义成 &amp;、或给译文补 <b> 都是合理行为；若按「多出即失败」处理，
    // 正确译文会在重试若干次后被丢弃（P1）。结构性占位符（%s/{0}/{{x}}/ICU 骨架）仍严格比对。
    var missingStructural = [];
    var benignMissing = [];
    var benignExtra = [];
    var fatalExtra = [];
    for (var mi = 0; mi < missing.length; mi++) {
      if (isMarkupLike(missing[mi])) benignMissing.push(missing[mi]);
      else missingStructural.push(missing[mi]);
    }
    for (var ei = 0; ei < extra.length; ei++) {
      if (isMarkupLike(extra[ei])) benignExtra.push(extra[ei]);
      else fatalExtra.push(extra[ei]);
    }

    return {
      valid: missingStructural.length === 0 && fatalExtra.length === 0,
      // 完整清单（兼容旧调用方）
      missing: missing,
      extra: extra,
      // 分级清单
      missingStructural: missingStructural,
      benignMissing: benignMissing,
      benignExtra: benignExtra,
      fatalExtra: fatalExtra
    };
  }

  /**
   * 该占位符是否属于「标记/编码」层面（XML 实体、HTML 标签）。
   *
   * 这类差异是模型对译文做编码或补标记造成的（`&` → `&amp;`、补 `<b>`），属合理行为；
   * 而 `%s`/`{0}`/`{{x}}`/ICU 骨架这类**结构性**占位符一旦多出或缺失，就是真的改坏了。
   */
  function isMarkupLike(token) {
    var s = String(token == null ? "" : token);
    if (/^&(?:#x?[0-9a-fA-F]+|[a-zA-Z]\w*);$/.test(s)) return true;
    if (/^<\/?[a-zA-Z][\w-]*(?:\s[^>]*)?\/?>$/.test(s)) return true;
    return false;
  }

  /**
   * 提取文本中「ICU 之外」的占位符（ICU 片段先从输入里遮蔽掉，与 protect 的行为对齐）
   * @param {string} text
   * @returns {string[]}
   */
  function extractSimple(text) {
    if (!text) return [];
    var all = [];

    var masked = "";
    var i = 0;
    while (i < text.length) {
      var ch = text.charAt(i);
      if (ch !== "{") {
        masked += ch;
        i++;
        continue;
      }
      var balanced = scanBalancedBraces(text, i);
      if (balanced && looksLikeIcu(balanced.text)) {
        masked += " "; // 遮蔽 ICU 片段，避免其中的 {0}/{{x}} 被重复计入
        i = balanced.end + 1;
        continue;
      }
      masked += ch;
      i++;
    }

    for (var p = 1; p < PATTERNS.length; p++) {
      PATTERNS[p].re.lastIndex = 0;
      var m;
      while ((m = PATTERNS[p].re.exec(masked)) !== null) {
        if (PATTERNS[p].name === "printf" && isLikelyPercentage(masked, m.index, m.index + m[0].length)) {
          continue;
        }
        all.push(m[0]);
      }
    }
    return all;
  }

  /**
   * 提取文本中的所有占位符（ICU 片段 + 其余），供测试/调试使用
   * @param {string} text
   * @returns {string[]}
   */
  function extractAll(text) {
    if (!text) return [];
    return collectIcu(text)
      .map(function (s) {
        return s.text;
      })
      .concat(extractSimple(text));
  }

  // ==================== 公共 API ====================
  return {
    protect: protect,
    restore: restore,
    validate: validate,
    extractAll: extractAll,
    // 暴露内部供测试
    _PATTERNS: PATTERNS,
    _TAG_PREFIX: TAG_PREFIX,
    _TAG_SUFFIX: TAG_SUFFIX
  };
})();

window.PlaceholderGuard = PlaceholderGuard;
