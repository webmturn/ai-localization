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

  // 开发环境提示（始终显示，帮助开发者了解可用工具）
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

/**
 * 切片所有权开发审计（可复用工具，供各 Owner Store 复用）
 *
 * 将 AppState.<slice> 重定义为 accessor：任何未经 Owner Store 方法的
 * 顶层赋值都会打印带调用栈的告警，用于暴露绕过所有权边界的越权写入。
 * 生产环境不安装，零开销、零行为影响。
 *
 * 用法（在 Owner Store 文件末尾）：
 *   if (typeof installSliceOwnershipAudit === "function") {
 *     installSliceOwnershipAudit("ProjectStore", ProjectStore, ["project", "fileMetadata"]);
 *   }
 *
 * 局限：仅审计切片顶层赋值（AppState.<slice> = ...）；属性级写入
 * （AppState.<slice>.x = ...）由 CI 静态检查（scripts/check-state-ownership.mjs）守护。
 *
 * @param {string} ownerName - Owner 名称（告警文案用）
 * @param {Object} ownerObject - Owner Store 对象（其全部方法被标记为 Owner 写入）
 * @param {string[]} slices - 受守护的 AppState 切片名列表
 */
function installSliceOwnershipAudit(ownerName, ownerObject, slices) {
  try {
    const isDev = typeof isDevelopment !== "undefined" && isDevelopment;
    if (!isDev) return;
    if (typeof AppState === "undefined" || !AppState) return;

    // Owner 写入深度计数（嵌套调用安全）：>0 表示当前处于 Owner 写入栈内
    let ownerDepth = 0;

    // 将 Owner Store 全部方法标记为 Owner 写入
    Object.keys(ownerObject).forEach((name) => {
      const original = ownerObject[name];
      if (typeof original !== "function") return;
      ownerObject[name] = function (...args) {
        ownerDepth++;
        try {
          return original.apply(this, args);
        } finally {
          ownerDepth--;
        }
      };
    });

    (slices || []).forEach((slice) => {
      let _value = AppState[slice];
      Object.defineProperty(AppState, slice, {
        get() {
          return _value;
        },
        set(v) {
          if (ownerDepth === 0) {
            (window.loggers?.app || console).warn(
              `[StateOwnership] 检测到绕过 ${ownerName} 直接写入 AppState.${slice}`,
              new Error().stack
            );
          }
          _value = v;
        },
        enumerable: true,
        configurable: true,
      });
    });
  } catch (e) {
    // 审计安装失败不应影响应用运行
    ((typeof window !== "undefined" && window.loggers?.app) || console).debug(
      "Slice ownership audit install failed:",
      e
    );
  }
}
