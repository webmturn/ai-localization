function __updateQualityChartsImpl() {
  const opts = typeof __getQualityCheckOptions === "function" ? __getQualityCheckOptions() : {};

  // 维度分数统一由 scoring.js 的 __computeDimensionScoresImpl 计算
  // （此前本文件与 export.js 各持一份同逻辑拷贝，已合并）
  const {
    accuracyScore,
    termScore,
    formatScore,
    lengthScore,
    varScore,
    punctuationScore,
    numbersScore,
    totalItems,
    translatedItems,
  } = __computeDimensionScoresImpl();

  const radarDef = [
    { label: "准确性", data: accuracyScore, enabled: true, applicable: totalItems > 0 },
    { label: "术语", data: termScore, enabled: opts.checkTerminology, applicable: translatedItems > 0 },
    { label: "格式", data: formatScore, enabled: opts.checkPlaceholders, applicable: translatedItems > 0 },
    { label: "长度", data: lengthScore, enabled: opts.checkLength, applicable: translatedItems > 0 },
    { label: "变量", data: varScore, enabled: opts.checkPlaceholders, applicable: translatedItems > 0 },
    { label: "标点", data: punctuationScore, enabled: opts.checkPunctuation, applicable: translatedItems > 0 },
    { label: "数字", data: numbersScore, enabled: opts.checkNumbers, applicable: translatedItems > 0 },
  ];
  const radarFiltered = radarDef.filter(function (d) {
    return d.enabled && d.applicable;
  });
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
              (loggers.app || console).error("updateQualityCharts (after load) failed:", e);
            }
          })
          .catch(function (e) {
            (loggers.app || console).error("Failed to lazy-load Chart.js:", e);
          });
      }
    } catch (e) {
      (loggers.app || console).debug("Chart.js lazy-load check:", e);
    }
    return;
  }

  const accuracyEl = DOMCache.get("accuracyChart");
  if (!accuracyEl || typeof accuracyEl.getContext !== "function") return;
  const accuracyCtx = accuracyEl.getContext("2d");
  if (!accuracyCtx) return;
  if (accuracyLabels.length === 0) {
    if (qualityCheckCharts.accuracy) {
      try { qualityCheckCharts.accuracy.destroy(); } catch (e) { (loggers.app || console).debug("chart.accuracy.destroy:", e); }
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
            top: 20,
            right: 24,
            bottom: 28,
            left: 24,
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
            pointLabels: { color: chartTextColor, padding: 12 },
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
          padding: 12,
        };
        // 与创建时保持一致的内边距，避免标签贴边裁切
        chart.options.layout = {
          padding: { top: 20, right: 24, bottom: 28, left: 24 },
        };
      }
      chart.update("none");
    } catch (e) {
      (loggers.app || console).error("Failed to update accuracy chart:", e);
    }
  }
  }

  const consistencyDef = [
    { label: "术语一致性", data: termScore, enabled: opts.checkTerminology },
    { label: "格式一致性", data: formatScore, enabled: opts.checkPlaceholders },
    { label: "变量一致性", data: varScore, enabled: opts.checkPlaceholders },
  ].filter(function (d) {
    // 三个维度均基于已翻译条目，无可检查条目时一并剔除
    return d.enabled && translatedItems > 0;
  });
  const consistencyLabels = consistencyDef.map(function (d) { return d.label; });
  const consistencyData = consistencyDef.map(function (d) { return d.data; });

  const consistencyEl = DOMCache.get("consistencyChart");
  if (!consistencyEl || typeof consistencyEl.getContext !== "function") return;
  const consistencyCtx = consistencyEl.getContext("2d");
  if (!consistencyCtx) return;
  if (consistencyLabels.length === 0) {
    if (qualityCheckCharts.consistency) {
      try { qualityCheckCharts.consistency.destroy(); } catch (e) { (loggers.app || console).debug("chart.consistency.destroy:", e); }
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
      (loggers.app || console).error("Failed to update consistency chart:", e);
    }
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.updateQualityCharts = __updateQualityChartsImpl;
})();
