// ==================== 性能优化工具函数 ====================
// 优化目标：
// 1. 减少高频DOM查询：使用DOMCache缓存常用DOM元素
// 2. 减少频繁函数调用：使用debounce/throttle限制syncTranslationHeights调用
// 3. 优化渲染性能：使用requestAnimationFrame和批量读写分离
// 4. 分页显示：每页itemsPerPage条，避免一次渲染过多DOM
// 5. 使用DocumentFragment批量插入减少重排
//
// 注意：debounce 和 throttle 已在文件开头统一定义，这里不再重复

// 更新同步高度函数（优化版 - 使用防抖和缓存）
function syncTranslationHeights(afterSync) {
  const App = window.App;
  const impl = App?.impl?.syncTranslationHeights;
  if (typeof impl === "function") return impl(afterSync);
  const legacy =
    typeof __syncTranslationHeightsImpl === "function"
      ? __syncTranslationHeightsImpl
      : null;
  if (typeof legacy === "function") return legacy(afterSync);
  throw new Error(
    "syncTranslationHeights: no implementation found (App.impl.syncTranslationHeights / __syncTranslationHeightsImpl)"
  );
}

// 创建防抖版本的同步函数（300ms防抖）
const debouncedSyncHeights = debounce(syncTranslationHeights, 300);

// 创建节流版本的同步函数（100ms节流）
const throttledSyncHeights = throttle(syncTranslationHeights, 100);
