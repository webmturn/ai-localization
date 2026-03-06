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
    { name: "printf",       re: /%(?:\d+\$)?[-+0 #]*(?:\d+)?(?:\.\d+)?[diouxXeEfgGcspn%@]/g },
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
    var result = text;

    for (var p = 0; p < PATTERNS.length; p++) {
      var pattern = PATTERNS[p];
      // 重置正则 lastIndex
      pattern.re.lastIndex = 0;

      result = result.replace(pattern.re, function (match, offset) {
        // 避免重复保护已替换的标记
        if (match.indexOf(TAG_PREFIX) !== -1) return match;

        // 相同的占位符共用一个索引
        var key = match;
        var idx;
        var existing = -1;
        for (var i = 0; i < map.length; i++) {
          if (map[i].original === key) { existing = i; break; }
        }
        if (existing >= 0) {
          idx = existing;
        } else {
          idx = map.length;
          map.push({ original: match, name: pattern.name, index: idx });
        }

        var tag = TAG_PREFIX + idx + TAG_SUFFIX;
        used.add(idx);
        return tag;
      });
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
  function validate(source, translated) {
    var srcPH = extractAll(source);
    var tgtPH = extractAll(translated);

    var missing = [];
    var extra = [];

    // 检查源文本的占位符是否都在译文中
    for (var i = 0; i < srcPH.length; i++) {
      var idx = tgtPH.indexOf(srcPH[i]);
      if (idx === -1) {
        missing.push(srcPH[i]);
      } else {
        tgtPH.splice(idx, 1);
      }
    }

    extra = tgtPH;

    return {
      valid: missing.length === 0 && extra.length === 0,
      missing: missing,
      extra: extra
    };
  }

  /**
   * 提取文本中的所有占位符
   * @param {string} text
   * @returns {string[]}
   */
  function extractAll(text) {
    if (!text) return [];
    var all = [];
    for (var p = 0; p < PATTERNS.length; p++) {
      PATTERNS[p].re.lastIndex = 0;
      var m;
      while ((m = PATTERNS[p].re.exec(text)) !== null) {
        all.push(m[0]);
      }
    }
    return all;
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
