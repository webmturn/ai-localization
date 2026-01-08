let qualityCheckCharts = { accuracy: null, consistency: null };

// 初始化图表
function initCharts() {
  const App = window.App;
  if (App && App.impl && typeof App.impl.updateQualityCharts === "function") {
    App.impl.updateQualityCharts();
  }
}

// 初始化术语库（从 localStorage 恢复）
