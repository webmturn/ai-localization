let qualityCheckEventListenersInitialized = false;
function initQualityCheckEventListeners() {
  if (qualityCheckEventListenersInitialized) return;
  qualityCheckEventListenersInitialized = true;

  const runQualityCheckBtn = DOMCache.get("runQualityCheckBtn");
  if (runQualityCheckBtn)
    EventManager.add(runQualityCheckBtn, "click", runQualityCheck, {
      tag: "quality",
      scope: "qualityReport",
      label: "runQualityCheckBtn:click",
    });

  const issueFilterSeverity = DOMCache.get("issueFilterSeverity");
  if (issueFilterSeverity)
    EventManager.add(issueFilterSeverity, "change", filterIssues, {
      tag: "quality",
      scope: "qualityReport",
      label: "issueFilterSeverity:change",
    });

  const issueFilterType = DOMCache.get("issueFilterType");
  if (issueFilterType)
    EventManager.add(issueFilterType, "change", filterIssues, {
      tag: "quality",
      scope: "qualityReport",
      label: "issueFilterType:change",
    });

  const resetIssueFilterBtn = DOMCache.get("resetIssueFilter");
  if (resetIssueFilterBtn)
    EventManager.add(resetIssueFilterBtn, "click", resetIssueFilter, {
      tag: "quality",
      scope: "qualityReport",
      label: "resetIssueFilterBtn:click",
    });

  const exportQualityReportBtn = DOMCache.get("exportQualityReport");
  if (exportQualityReportBtn)
    EventManager.add(exportQualityReportBtn, "click", exportQualityReportData, {
      tag: "quality",
      scope: "qualityReport",
      label: "exportQualityReportBtn:click",
    });

  const exportQualityReportPdfBtn = DOMCache.get(
    "exportQualityReportPdf",
  );
  if (exportQualityReportPdfBtn)
    EventManager.add(
      exportQualityReportPdfBtn,
      "click",
      exportQualityReportPdf,
      {
        tag: "quality",
        scope: "qualityReport",
        label: "exportQualityReportPdfBtn:click",
      },
    );
}
