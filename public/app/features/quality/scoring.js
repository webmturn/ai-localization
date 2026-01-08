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
  const qualityScore = Math.max(0, 40 - qualityPenalty);

  score += qualityScore;

  qr.overallScore = Math.min(100, Math.round(score));
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.calculateOverallScore = __calculateOverallScoreImpl;
})();
