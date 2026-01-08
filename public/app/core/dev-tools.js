/**
 * 开发环境检测
 * 通过 URL 参数、localStorage 或 hostname 判断
 */
const isDevelopment = (() => {
  // 方法1：检查 URL 参数 ?debug=true
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("debug") === "true") return true;

  // 方法2：检查 localStorage
  if (localStorage.getItem("debugMode") === "true") return true;

  // 方法3：检查是否为本地开发环境
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "")
    return true;

  // 默认为生产环境
  return false;
})();

/**
 * 内存监控工具（仅开发环境可用）
 * 用法：
 * 1. 在本地环境自动启用
 * 2. 生产环境加 ?debug=true 启用
 * 3. 控制台输入 localStorage.setItem('debugMode', 'true') 然后刷新
 *
 * 显示：DOM缓存数量、事件监听器数量、内存使用情况
 */
if (isDevelopment) {
  window.debugMemory = function () {
    console.group("📊 内存使用情况");

    // DOM缓存统计
    console.log("🗄️  DOM缓存数量:", DOMCache.cache.size);
    console.log("🔑 DOM缓存键名:", Array.from(DOMCache.cache.keys()));

    // 事件监听器统计
    const eventStats = EventManager.getStats();
    console.log("🎯 事件监听器总数:", eventStats.total);
    console.log("📊 按事件类型分组:", eventStats.byEvent);
    console.log("🎯 按目标类型分组:", eventStats.byTarget);

    // 翻译请求统计
    console.log(
      "🔄 活跃翻译请求:",
      translationService?.activeRequests?.size || 0
    );

    // 内存统计（仅Chrome支持）
    if (performance.memory) {
      console.log(
        "💾 JS Heap 大小:",
        (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + " MB"
      );
      console.log(
        "💾 JS Heap 限制:",
        (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + " MB"
      );
      const usage = (
        (performance.memory.usedJSHeapSize /
          performance.memory.jsHeapSizeLimit) *
        100
      ).toFixed(2);
      console.log("📊 内存使用率:", usage + "%");
    } else {
      console.log("⚠️  当前浏览器不支持 performance.memory API");
    }

    console.groupEnd();

    // 返回统计数据，方便编程使用
    return {
      domCache: DOMCache.cache.size,
      events: eventStats,
      activeRequests: translationService?.activeRequests?.size || 0,
      memory: performance.memory
        ? {
            used:
              (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + " MB",
            limit:
              (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + " MB",
            usage:
              (
                (performance.memory.usedJSHeapSize /
                  performance.memory.jsHeapSizeLimit) *
                100
              ).toFixed(2) + "%",
          }
        : null,
    };
  };

  // 开发环境提示
  console.log(
    "%c🛠️ 开发模式已启用",
    "color: #2563eb; font-weight: bold; font-size: 14px;"
  );
  console.log("📊 输入 debugMemory() 查看内存使用情况");
  console.log("📊 输入 EventManager.getStats() 查看事件监听器统计");
} else {
  // 生产环境：禁用调试工具
  window.debugMemory = function () {
    console.warn("⚠️  debugMemory() 仅在开发环境可用");
    console.log("🔒 要启用调试模式，请在 URL 中添加 ?debug=true");
    return null;
  };
}
