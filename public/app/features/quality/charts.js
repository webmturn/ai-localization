function __updateQualityChartsImpl() {
  const results = AppState.qualityCheckResults;
  const issues = results.issues;
  const opts = typeof __getQualityCheckOptions === "function" ? __getQualityCheckOptions() : {};

  function clampScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  const emptyIssues = issues.filter((i) => i.type === "empty").length;
  const termIssues = issues.filter((i) => i.type === "terminology").length;
  const formatIssues = issues.filter((i) => i.type === "format").length;
  const lengthIssues = issues.filter((i) => i.type === "length").length;
  const varIssues = issues.filter((i) => i.type === "variable").length;
  const punctuationIssues = issues.filter((i) => i.type === "punctuation").length;
  const numbersIssues = issues.filter((i) => i.type === "numbers").length;

  const totalChecked = results.translatedCount;

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

  const radarDef = [
    { label: "准确性", data: accuracyScore, enabled: true },
    { label: "术语", data: termScore, enabled: opts.checkTerminology },
    { label: "格式", data: formatScore, enabled: opts.checkPlaceholders },
    { label: "长度", data: lengthScore, enabled: opts.checkLength },
    { label: "变量", data: varScore, enabled: opts.checkPlaceholders },
    { label: "标点", data: punctuationScore, enabled: opts.checkPunctuation },
    { label: "数字", data: numbersScore, enabled: opts.checkNumbers },
  ];
  const radarFiltered = radarDef.filter(function (d) { return d.enabled; });
  const accuracyLabels = radarFiltered.map(function (d) { return d.label; });
  const accuracyData = radarFiltered.map(function (d) { return d.data; });

  const isDarkMode = document.body.classList.contains("dark-mode");
  const chartTextColor = isDarkMode ? "#e5e7eb" : "#374151";
  const chartGridColor = isDarkMode
    ? "rgba(229, 231, 235, 0.2)"
    : "rgba(55, 65, 81, 0.2)";

  const ChartCtor = window.Chart;
  if (typeof ChartCtor !== "function") {
    try {
      const App = window.App;
      const ensure = App?.services?.ensureChartJs;
      if (typeof ensure === "function") {
        ensure()
          .then(function () {
            try {
              __updateQualityChartsImpl();
            } catch (e) {
              console.error("updateQualityCharts (after load) failed:", e);
            }
          })
          .catch(function (e) {
            console.error("Failed to lazy-load Chart.js:", e);
          });
      }
    } catch (_) {}
    return;
  }

  const accuracyEl = document.getElementById("accuracyChart");
  if (!accuracyEl || typeof accuracyEl.getContext !== "function") return;
  const accuracyCtx = accuracyEl.getContext("2d");
  if (!accuracyCtx) return;
  if (accuracyLabels.length === 0) {
    if (qualityCheckCharts.accuracy) {
      try { qualityCheckCharts.accuracy.destroy(); } catch (_) {}
      qualityCheckCharts.accuracy = null;
    }
  } else {
  if (!qualityCheckCharts.accuracy) {
    qualityCheckCharts.accuracy = new ChartCtor(accuracyCtx, {
      type: "radar",
      data: {
        labels: accuracyLabels,
        datasets: [
          {
            label: "翻译质量",
            data: accuracyData,
            backgroundColor: "rgba(37, 99, 235, 0.2)",
            borderColor: "rgba(37, 99, 235, 1)",
            borderWidth: 2,
            pointBackgroundColor: "rgba(37, 99, 235, 1)",
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        layout: {
          padding: {
            top: 12,
            right: 12,
            bottom: 24,
            left: 12,
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 100,
            ticks: {
              maxTicksLimit: 6,
              color: chartTextColor,
              backdropColor: "transparent",
            },
            grid: { color: chartGridColor },
            angleLines: { color: chartGridColor },
            pointLabels: { color: chartTextColor, padding: 8 },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  } else {
    const chart = qualityCheckCharts.accuracy;
    try {
      chart.data.labels = accuracyLabels;
      if (chart.data.datasets && chart.data.datasets[0]) {
        chart.data.datasets[0].data = accuracyData;
      }
      if (chart.options && chart.options.scales && chart.options.scales.r) {
        chart.options.scales.r.ticks = {
          ...(chart.options.scales.r.ticks || {}),
          color: chartTextColor,
          backdropColor: "transparent",
        };
        chart.options.scales.r.grid = { ...(chart.options.scales.r.grid || {}), color: chartGridColor };
        chart.options.scales.r.angleLines = {
          ...(chart.options.scales.r.angleLines || {}),
          color: chartGridColor,
        };
        chart.options.scales.r.pointLabels = {
          ...(chart.options.scales.r.pointLabels || {}),
          color: chartTextColor,
          padding: 8,
        };
      }
      chart.update("none");
    } catch (e) {
      console.error("Failed to update accuracy chart:", e);
    }
  }
  }

  const consistencyDef = [
    { label: "术语一致性", data: termScore, enabled: opts.checkTerminology },
    { label: "格式一致性", data: formatScore, enabled: opts.checkPlaceholders },
    { label: "变量一致性", data: varScore, enabled: opts.checkPlaceholders },
  ].filter(function (d) { return d.enabled; });
  const consistencyLabels = consistencyDef.map(function (d) { return d.label; });
  const consistencyData = consistencyDef.map(function (d) { return d.data; });

  const consistencyEl = document.getElementById("consistencyChart");
  if (!consistencyEl || typeof consistencyEl.getContext !== "function") return;
  const consistencyCtx = consistencyEl.getContext("2d");
  if (!consistencyCtx) return;
  if (consistencyLabels.length === 0) {
    if (qualityCheckCharts.consistency) {
      try { qualityCheckCharts.consistency.destroy(); } catch (_) {}
      qualityCheckCharts.consistency = null;
    }
  } else if (!qualityCheckCharts.consistency) {
    qualityCheckCharts.consistency = new ChartCtor(consistencyCtx, {
      type: "bar",
      data: {
        labels: consistencyLabels,
        datasets: [
          {
            label: "一致性评分",
            data: consistencyData,
            backgroundColor: [
              "rgba(245, 158, 11, 0.7)",
              "rgba(16, 185, 129, 0.7)",
              "rgba(37, 99, 235, 0.7)",
            ],
            borderColor: [
              "rgba(245, 158, 11, 1)",
              "rgba(16, 185, 129, 1)",
              "rgba(37, 99, 235, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        scales: {
          x: {
            ticks: { color: chartTextColor },
            grid: { color: chartGridColor },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: chartTextColor },
            grid: { color: chartGridColor },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  } else {
    const chart = qualityCheckCharts.consistency;
    try {
      chart.data.labels = consistencyLabels;
      if (chart.data.datasets && chart.data.datasets[0]) {
        chart.data.datasets[0].data = consistencyData;
      }
      if (chart.options && chart.options.scales) {
        if (chart.options.scales.x) {
          chart.options.scales.x.ticks = {
            ...(chart.options.scales.x.ticks || {}),
            color: chartTextColor,
          };
          chart.options.scales.x.grid = {
            ...(chart.options.scales.x.grid || {}),
            color: chartGridColor,
          };
        }
        if (chart.options.scales.y) {
          chart.options.scales.y.ticks = {
            ...(chart.options.scales.y.ticks || {}),
            color: chartTextColor,
          };
          chart.options.scales.y.grid = {
            ...(chart.options.scales.y.grid || {}),
            color: chartGridColor,
          };
        }
      }
      chart.update("none");
    } catch (e) {
      console.error("Failed to update consistency chart:", e);
    }
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.updateQualityCharts = __updateQualityChartsImpl;
})();
