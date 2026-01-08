let qualityCheckEventListenersInitialized = false;
function initQualityCheckEventListeners() {
  if (qualityCheckEventListenersInitialized) return;
  qualityCheckEventListenersInitialized = true;

  const runQualityCheckBtn = document.getElementById("runQualityCheckBtn");
  if (runQualityCheckBtn)
    EventManager.add(runQualityCheckBtn, "click", runQualityCheck, {
      tag: "quality",
      scope: "qualityReport",
      label: "runQualityCheckBtn:click",
    });

  const issueFilterSeverity = document.getElementById("issueFilterSeverity");
  if (issueFilterSeverity)
    EventManager.add(issueFilterSeverity, "change", filterIssues, {
      tag: "quality",
      scope: "qualityReport",
      label: "issueFilterSeverity:change",
    });

  const issueFilterType = document.getElementById("issueFilterType");
  if (issueFilterType)
    EventManager.add(issueFilterType, "change", filterIssues, {
      tag: "quality",
      scope: "qualityReport",
      label: "issueFilterType:change",
    });

  const resetIssueFilterBtn = document.getElementById("resetIssueFilter");
  if (resetIssueFilterBtn)
    EventManager.add(resetIssueFilterBtn, "click", resetIssueFilter, {
      tag: "quality",
      scope: "qualityReport",
      label: "resetIssueFilterBtn:click",
    });

  const exportQualityReportBtn = document.getElementById("exportQualityReport");
  if (exportQualityReportBtn)
    EventManager.add(exportQualityReportBtn, "click", exportQualityReportData, {
      tag: "quality",
      scope: "qualityReport",
      label: "exportQualityReportBtn:click",
    });

  const exportQualityReportPdfBtn = document.getElementById(
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
