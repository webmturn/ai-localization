function __exportQualityReportDataImpl() {
  const results = AppState.qualityCheckResults;

  const report = {
    generatedAt: new Date().toISOString(),
    projectName: AppState.project?.name || "未命名项目",
    scope: results?.scope || "project",
    fileName: results?.fileName || null,
    summary: {
      overallScore: results.overallScore,
      totalItems: results.totalCount,
      translatedItems: results.translatedCount,
      issuesCount: results.issues.length,
      termMatches: results.termMatches,
    },
    issues: results.issues.map((issue) => ({
      sourceText: issue.sourceText,
      targetText: issue.targetText,
      type: issue.typeName,
      severity: issue.severity,
      description: issue.description,
    })),
  };

  const content = JSON.stringify(report, null, 2);
  const filename = `quality-report-${
    AppState.project?.name || "project"
  }-${Date.now()}.json`;

  downloadFile(content, filename);
  showNotification("success", "导出成功", "质量报告已导出");
}

function __exportQualityReportPdfImpl() {
  const results = AppState.qualityCheckResults;

  if (!results) {
    showNotification("warning", "无法导出", "没有质量检查结果");
    return;
  }

  if (typeof window.Chart !== "function") {
    try {
      const App = window.App;
      const ensure = App?.services?.ensureChartJs;
      if (typeof ensure === "function") {
        showNotification("info", "准备导出", "正在加载图表组件...");
        ensure()
          .then(function () {
            try {
              __exportQualityReportPdfImpl();
            } catch (e) {
              console.error("exportQualityReportPdf (after load) failed:", e);
              showNotification(
                "error",
                "导出失败",
                e?.message || "PDF导出失败"
              );
            }
          })
          .catch(function (e) {
            console.error("Failed to lazy-load Chart.js:", e);
            showNotification(
              "error",
              "导出失败",
              e?.message || "图表组件加载失败"
            );
          });
        return;
      }
    } catch (_) {}
  }

  const projectName = AppState.project?.name || "未命名项目";
  const generatedAt = new Date();
  const opts = typeof __getQualityCheckOptions === "function" ? __getQualityCheckOptions() : {};

  function clampScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function buildScores() {
    const issues = Array.isArray(results?.issues) ? results.issues : [];
    const emptyIssues = issues.filter((i) => i && i.type === "empty").length;
    const termIssues = issues.filter((i) => i && i.type === "terminology").length;
    const formatIssues = issues.filter((i) => i && i.type === "format").length;
    const lengthIssues = issues.filter((i) => i && i.type === "length").length;
    const varIssues = issues.filter((i) => i && i.type === "variable").length;
    const punctuationIssues = issues.filter((i) => i && i.type === "punctuation").length;
    const numbersIssues = issues.filter((i) => i && i.type === "numbers").length;
    const totalChecked = Number(results?.translatedCount || 0);

    const accuracyScore = clampScore(
      totalChecked > 0 ? (1 - emptyIssues / totalChecked) * 100 : 100
    );
    const termScore = clampScore(
      totalChecked > 0 ? (1 - termIssues / totalChecked) * 100 : 100
    );
    const formatScore = clampScore(
      totalChecked > 0 ? (1 - formatIssues / totalChecked) * 100 : 100
    );
    const lengthScore = clampScore(
      totalChecked > 0 ? (1 - lengthIssues / totalChecked) * 100 : 100
    );
    const varScore = clampScore(
      totalChecked > 0 ? (1 - varIssues / totalChecked) * 100 : 100
    );
    const punctuationScore = clampScore(
      totalChecked > 0 ? (1 - punctuationIssues / totalChecked) * 100 : 100
    );
    const numbersScore = clampScore(
      totalChecked > 0 ? (1 - numbersIssues / totalChecked) * 100 : 100
    );

    return {
      accuracyScore,
      termScore,
      formatScore,
      lengthScore,
      varScore,
      punctuationScore,
      numbersScore,
    };
  }

  function getOnScreenChartDataUrl(id) {
    try {
      const el = document.getElementById(id);
      if (!el || typeof el.toDataURL !== "function") return "";
      return el.toDataURL("image/png", 1.0);
    } catch (_) {
      return "";
    }
  }

  function renderChartHighRes(type, data, options, width, height, pixelRatio) {
    try {
      const ChartCtor = window.Chart;
      if (typeof ChartCtor !== "function") return "";

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      const cfg = {
        type,
        data,
        options: {
          responsive: false,
          animation: false,
          devicePixelRatio: pixelRatio,
          ...(options || {}),
        },
      };

      const chart = new ChartCtor(ctx, cfg);
      try {
        if (typeof chart.resize === "function") chart.resize(width, height);
        if (typeof chart.update === "function") chart.update("none");
      } catch (_) {}

      let url = "";
      try {
        if (typeof chart.toBase64Image === "function") {
          url = chart.toBase64Image();
        }
      } catch (_) {}
      if (!url) {
        try {
          url = canvas.toDataURL("image/png", 1.0);
        } catch (_) {}
      }

      try {
        chart.destroy();
      } catch (_) {}

      return url || "";
    } catch (_) {
      return "";
    }
  }

  const scores = buildScores();
  const {
    accuracyScore,
    termScore,
    formatScore,
    lengthScore,
    varScore,
    punctuationScore,
    numbersScore,
  } = scores;

  const radarDef = [
    { label: "准确性", data: accuracyScore, enabled: true },
    { label: "术语", data: termScore, enabled: opts.checkTerminology },
    { label: "格式", data: formatScore, enabled: opts.checkPlaceholders },
    { label: "长度", data: lengthScore, enabled: opts.checkLength },
    { label: "变量", data: varScore, enabled: opts.checkPlaceholders },
    { label: "标点", data: punctuationScore, enabled: opts.checkPunctuation },
    { label: "数字", data: numbersScore, enabled: opts.checkNumbers },
  ].filter(function (d) { return d.enabled; });
  const radarLabels = radarDef.map(function (d) { return d.label; });
  const radarData = radarDef.map(function (d) { return d.data; });

  const consistencyDef = [
    { label: "术语一致性", data: termScore, enabled: opts.checkTerminology },
    { label: "格式一致性", data: formatScore, enabled: opts.checkPlaceholders },
    { label: "变量一致性", data: varScore, enabled: opts.checkPlaceholders },
  ].filter(function (d) { return d.enabled; });
  const consistencyLabels = consistencyDef.map(function (d) { return d.label; });
  const consistencyData = consistencyDef.map(function (d) { return d.data; });

  const exportTextColor = "#374151";
  const exportGridColor = "rgba(55, 65, 81, 0.2)";

  const accuracyChart =
    radarLabels.length > 0
      ? (renderChartHighRes(
          "radar",
          {
            labels: radarLabels,
            datasets: [
              {
                label: "翻译质量",
                data: radarData,
                backgroundColor: "rgba(37, 99, 235, 0.2)",
                borderColor: "rgba(37, 99, 235, 1)",
                borderWidth: 2,
                pointBackgroundColor: "rgba(37, 99, 235, 1)",
                pointRadius: 3,
              },
            ],
          },
          {
            maintainAspectRatio: false,
            layout: {
              padding: { top: 12, right: 12, bottom: 24, left: 12 },
            },
            scales: {
              r: {
                beginAtZero: true,
                min: 0,
                max: 100,
                ticks: {
                  maxTicksLimit: 6,
                  color: exportTextColor,
                  backdropColor: "transparent",
                },
                grid: { color: exportGridColor },
                angleLines: { color: exportGridColor },
                pointLabels: { color: exportTextColor, padding: 8 },
              },
            },
            plugins: { legend: { display: false } },
          },
          1040,
          1040,
          2
        ) || getOnScreenChartDataUrl("accuracyChart"))
      : "";

  const consistencyChart =
    consistencyLabels.length > 0
      ? (renderChartHighRes(
          "bar",
          {
            labels: consistencyLabels,
            datasets: [
              {
                label: "一致性评分",
                data: consistencyData,
                backgroundColor: [
                  "rgba(245, 158, 11, 0.7)",
                  "rgba(16, 185, 129, 0.7)",
                  "rgba(37, 99, 235, 0.7)",
                ].slice(0, consistencyLabels.length),
                borderColor: [
                  "rgba(245, 158, 11, 1)",
                  "rgba(16, 185, 129, 1)",
                  "rgba(37, 99, 235, 1)",
                ].slice(0, consistencyLabels.length),
                borderWidth: 1,
              },
            ],
          },
          {
            maintainAspectRatio: false,
            scales: {
              x: {
                ticks: { color: exportTextColor },
                grid: { color: exportGridColor },
              },
              y: {
                beginAtZero: true,
                max: 100,
                ticks: { color: exportTextColor },
                grid: { color: exportGridColor },
              },
            },
            plugins: { legend: { display: false } },
          },
          1040,
          600,
          2
        ) || getOnScreenChartDataUrl("consistencyChart"))
      : "";

  const issues = Array.isArray(results.issues) ? results.issues : [];
  const issuesRows = issues
    .map((issue) => {
      const severity = escapeHtml(issue?.severity || "");
      const type = escapeHtml(issue?.typeName || issue?.type || "");
      const desc = escapeHtml(issue?.description || "");
      const sourceText = escapeHtml(issue?.sourceText || "");
      const targetText = escapeHtml(issue?.targetText || "");

      return (
        "<tr>" +
        `<td>${sourceText}</td>` +
        `<td>${targetText}</td>` +
        `<td>${type}</td>` +
        `<td>${severity}</td>` +
        `<td>${desc}</td>` +
        "</tr>"
      );
    })
    .join("");

  const scopeLabel = (() => {
    const scope = results?.scope || "project";
    if (scope === "file") return "按文件";
    if (scope === "selected") return "按选中";
    return "项目";
  })();

  const fileNameLine = results?.fileName
    ? `<div class="meta"><span class="k">文件：</span><span class="v">${escapeHtml(
        results.fileName,
      )}</span></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(projectName)} - 翻译质量报告</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", Arial, sans-serif; margin: 24px; color: #111827; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    .meta { font-size: 12px; color: #374151; line-height: 1.7; }
    .meta .k { color: #6b7280; }
    .meta .v { font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
    .kv { display: grid; grid-template-columns: 140px 1fr; gap: 6px 12px; font-size: 12px; }
    .kv .k { color: #6b7280; }
    .kv .v { font-weight: 600; }
    .rules { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; font-size: 12px; }
    .rule-item { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
    .rule-item.off { opacity: 0.6; color: #6b7280; }
    .rule-item .name { font-weight: 600; }
    .rule-item .status { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    .chartImg { width: 100%; max-width: 520px; border: 1px solid #e5e7eb; border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; vertical-align: top; font-size: 11px; word-break: break-word; white-space: pre-wrap; }
    th { background: #f9fafb; text-align: left; }
    .hint { font-size: 12px; color: #6b7280; margin-top: 10px; }
    @media print {
      body { margin: 0; padding: 16mm; }
      .no-print { display: none !important; }
      .chartImg { max-width: none; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 14px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb;">
    <div style="font-size: 12px; color: #374151;">提示：在打印对话框中选择“另存为 PDF”，即可导出 PDF 文件。</div>
  </div>

  <h1>翻译质量报告</h1>
  <div class="meta"><span class="k">项目：</span><span class="v">${escapeHtml(
    projectName,
  )}</span></div>
  <div class="meta"><span class="k">生成时间：</span><span class="v">${escapeHtml(
    generatedAt.toLocaleString("zh-CN"),
  )}</span></div>
  <div class="meta"><span class="k">检查范围：</span><span class="v">${escapeHtml(
    scopeLabel,
  )}</span></div>
  ${fileNameLine}

  <h2>汇总</h2>
  <div class="card">
    <div class="kv">
      <div class="k">总体评分</div><div class="v">${escapeHtml(
        results.overallScore,
      )}/100</div>
      <div class="k">检查总数</div><div class="v">${escapeHtml(
        results.totalCount,
      )}</div>
      <div class="k">已翻译项数</div><div class="v">${escapeHtml(
        results.translatedCount,
      )}</div>
      <div class="k">问题数量</div><div class="v">${escapeHtml(
        issues.length,
      )}</div>
      <div class="k">术语命中</div><div class="v">${escapeHtml(
        results.termMatches,
      )}</div>
    </div>
  </div>

  <h2>检查规则</h2>
  <div class="rules">
    <div class="rule-item"><span class="name">术语一致性</span><div class="status">${opts.checkTerminology ? "开启" : "已关闭"}</div></div>
    <div class="rule-item ${opts.checkPlaceholders ? "" : "off"}"><span class="name">格式保持 / 变量</span><div class="status">${opts.checkPlaceholders ? "开启" : "已关闭"}</div></div>
    <div class="rule-item ${opts.checkLength ? "" : "off"}"><span class="name">长度检查</span><div class="status">${opts.checkLength ? "开启" : "已关闭"}</div></div>
    <div class="rule-item"><span class="name">空译文检查</span><div class="status">开启</div></div>
    <div class="rule-item"><span class="name">重复检查</span><div class="status">开启</div></div>
    <div class="rule-item ${opts.checkPunctuation ? "" : "off"}"><span class="name">标点检查</span><div class="status">${opts.checkPunctuation ? "开启" : "已关闭"}</div></div>
    <div class="rule-item ${opts.checkNumbers ? "" : "off"}"><span class="name">数字一致性</span><div class="status">${opts.checkNumbers ? "开启" : "已关闭"}</div></div>
  </div>

  <h2>图表</h2>
  <div class="charts">
    <div>
      <div class="meta" style="margin-bottom: 6px;"><span class="v">雷达图</span></div>
      ${
        accuracyChart
          ? `<img class="chartImg" src="${accuracyChart}" alt="accuracyChart" />`
          : `<div class="card meta">${radarLabels.length === 0 ? "当前设置下未启用雷达图维度" : "未找到图表（accuracyChart）"}</div>`
      }
    </div>
    <div>
      <div class="meta" style="margin-bottom: 6px;"><span class="v">一致性柱状图</span></div>
      ${
        consistencyChart
          ? `<img class="chartImg" src="${consistencyChart}" alt="consistencyChart" />`
          : `<div class="card meta">${consistencyLabels.length === 0 ? "当前设置下未启用一致性图表维度" : "未找到图表（consistencyChart）"}</div>`
      }
    </div>
  </div>

  <h2>问题列表</h2>
  <div class="card" style="padding: 0; overflow: hidden;">
    <table>
      <thead>
        <tr>
          <th style="width: 26%;">原文</th>
          <th style="width: 26%;">译文</th>
          <th style="width: 12%;">问题类型</th>
          <th style="width: 10%;">严重程度</th>
          <th style="width: 26%;">说明</th>
        </tr>
      </thead>
      <tbody>
        ${issuesRows || '<tr><td colspan="5" class="meta">暂无问题</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="hint">注：该 PDF 通过浏览器打印生成，内容来自当前质量检查结果。</div>

  <script>
    window.addEventListener('load', function () {
      try {
        setTimeout(function () {
          window.focus();
          window.print();
          setTimeout(function () { window.close(); }, 800);
        }, 200);
      } catch (e) {}
    });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    showNotification(
      "warning",
      "无法导出",
      "浏览器拦截了弹窗，请允许弹窗后重试",
    );
    return;
  }

  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch (e) {
    try {
      w.close();
    } catch (_) {}
    showNotification("error", "导出失败", "无法生成 PDF 打印页");
    return;
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.exportQualityReportData = __exportQualityReportDataImpl;
  App.impl.exportQualityReportPdf = __exportQualityReportPdfImpl;
})();
