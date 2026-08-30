function __calculateOverallScoreImpl() {
  const qr = AppState.qualityCheckResults;
  const totalItems = qr.totalCount;
  const translatedItems = qr.translatedCount;
  const issues = qr.issues;

  if (totalItems === 0) {
    qr.overallScore = 0;
    return;
  }

  let score = (translatedItems / totalItems) * 60;

  const highIssues = issues.filter((i) => i.severity === "high").length;
  const mediumIssues = issues.filter((i) => i.severity === "medium").length;
  const lowIssues = issues.filter((i) => i.severity === "low").length;

  const qualityPenalty = highIssues * 3 + mediumIssues * 1.5 + lowIssues * 0.5;
  // 惩罚先抵扣质量分（40），溢出部分继续侵蚀翻译率分（60），
  // 避免"全部翻译但问题极多"仍停留在 60 分下限的错觉
  score += 40 - qualityPenalty;

  qr.overallScore = Math.min(100, Math.max(0, Math.round(score)));
}

// ==================== 维度分数（charts / export 共享） ====================
// 此前 charts.js 与 export.js 各持一份同逻辑拷贝（修 bug 时须双改，已合并）。
// 维度分数 = 1 - 受影响条目占比：
// - 分子：该类型 issue 涉及的条目数（按 itemId 去重，避免同一译文多个
//   issue 重复扣分）；
// - 分母：empty 对全部条目计数，其余仅已翻译条目可检查；
// - 分母为 0（无可检查条目）时该维度不适用（调用方应剔除该维度）——
//   否则全空项目会出现"准确性 100"与总分 31 的自相矛盾。
function __computeDimensionScoresImpl() {
  const results = AppState.qualityCheckResults;

  function clampScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  const issues = Array.isArray(results?.issues) ? results.issues : [];
  function countAffectedItems(type) {
    const ids = new Set();
    for (const i of issues) {
      if (i && i.type === type && i.itemId !== undefined && i.itemId !== null) {
        ids.add(String(i.itemId));
      }
    }
    return ids.size;
  }

  const totalItems = Number(results?.totalCount) || 0;
  const translatedItems = Number(results?.translatedCount) || 0;

  return {
    accuracyScore: clampScore(
      totalItems > 0 ? (1 - countAffectedItems("empty") / totalItems) * 100 : 0
    ),
    termScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("terminology") / translatedItems) * 100
        : 0
    ),
    formatScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("format") / translatedItems) * 100
        : 0
    ),
    lengthScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("length") / translatedItems) * 100
        : 0
    ),
    varScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("variable") / translatedItems) * 100
        : 0
    ),
    punctuationScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("punctuation") / translatedItems) * 100
        : 0
    ),
    numbersScore: clampScore(
      translatedItems > 0
        ? (1 - countAffectedItems("numbers") / translatedItems) * 100
        : 0
    ),
    totalItems,
    translatedItems,
  };
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.calculateOverallScore = __calculateOverallScoreImpl;
  App.impl.computeDimensionScores = __computeDimensionScoresImpl;
})();
