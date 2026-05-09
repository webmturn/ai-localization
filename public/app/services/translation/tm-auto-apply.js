// ==================== TM 自动应用 (Translation Memory Auto-Apply) ====================
// 翻译前自动查询 TM，精确匹配直接填充（省 API 调用），模糊匹配记录建议
// 翻译后自动保存新条目到 TM

var TMAutoApply = (function () {

  var _enabled = true;
  var _fuzzyThreshold = 75;
  var _stats = { exactHits: 0, fuzzyHits: 0, saved: 0 };

  // ==================== 配置 ====================

  function setEnabled(val) { _enabled = !!val; }
  function isEnabled() { return _enabled; }
  function setFuzzyThreshold(val) { _fuzzyThreshold = Math.max(0, Math.min(100, parseFloat(val) || 75)); }
  function getStats() { return Object.assign({}, _stats); }
  function resetStats() { _stats = { exactHits: 0, fuzzyHits: 0, saved: 0 }; }

  // ==================== 翻译前查询 TM ====================

  /**
   * 翻译前查询 TM，返回匹配结果
   * @param {string} sourceText - 源文本
   * @param {string} sourceLang - 源语言
   * @param {string} targetLang - 目标语言
   * @returns {Promise<{ hit: boolean, exact: boolean, translation: string|null, similarity: number }>}
   */
  async function lookup(sourceText, sourceLang, targetLang) {
    if (!_enabled || typeof TranslationMemory === "undefined") {
      return { hit: false, exact: false, translation: null, similarity: 0 };
    }

    try {
      // 1. 精确匹配
      var exact = await TranslationMemory.lookupExact(sourceText, sourceLang, targetLang);
      if (exact) {
        _stats.exactHits++;
        // similarity 与 fuzzyMatch 量纲对齐（0-100），不是 0-1
        return { hit: true, exact: true, translation: exact.targetText, similarity: 100 };
      }

      // 2. 模糊匹配
      var fuzzy = await TranslationMemory.fuzzyMatch(sourceText, sourceLang, targetLang, _fuzzyThreshold);
      if (fuzzy && fuzzy.length > 0) {
        var best = fuzzy[0]; // fuzzyMatch 返回 { entry, similarity }
        _stats.fuzzyHits++;
        return {
          hit: true,
          exact: false,
          translation: best.entry.targetText,
          similarity: best.similarity,
          sourceMatch: best.entry.sourceText
        };
      }
    } catch (e) {
      (loggers.translation || console).debug("TMAutoApply lookup error:", e);
    }

    return { hit: false, exact: false, translation: null, similarity: 0 };
  }

  // ==================== 翻译后保存到 TM ====================

  /**
   * 翻译成功后保存到 TM
   * @param {string} sourceText
   * @param {string} targetText
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {string} [engine] - 翻译引擎名
   */
  async function save(sourceText, targetText, sourceLang, targetLang, engine) {
    if (!_enabled || typeof TranslationMemory === "undefined") return;
    if (!sourceText || !targetText) return;

    try {
      await TranslationMemory.save(
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        { engine: engine || "unknown" }
      );
      _stats.saved++;
    } catch (e) {
      (loggers.translation || console).debug("TMAutoApply save error:", e);
    }
  }

  /**
   * 批量保存翻译结果到 TM
   * @param {Array<{sourceText, targetText}>} pairs
   * @param {string} sourceLang
   * @param {string} targetLang
   * @param {string} [engine]
   */
  async function saveBatch(pairs, sourceLang, targetLang, engine) {
    if (!_enabled || typeof TranslationMemory === "undefined") return;
    if (!pairs || pairs.length === 0) return;

    try {
      var entries = pairs
        .filter(function (p) { return p.sourceText && p.targetText; })
        .map(function (p) {
          return {
            sourceText: p.sourceText,
            targetText: p.targetText,
            sourceLang: sourceLang,
            targetLang: targetLang,
            engine: engine || "unknown"
          };
        });

      if (entries.length > 0) {
        await TranslationMemory.saveBatch(entries, sourceLang, targetLang, { engine: engine || "unknown" });
        _stats.saved += entries.length;
      }
    } catch (e) {
      (loggers.translation || console).debug("TMAutoApply saveBatch error:", e);
    }
  }

  // ==================== 公共 API ====================
  return {
    lookup: lookup,
    save: save,
    saveBatch: saveBatch,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    setFuzzyThreshold: setFuzzyThreshold,
    getStats: getStats,
    resetStats: resetStats
  };
})();

window.TMAutoApply = TMAutoApply;
