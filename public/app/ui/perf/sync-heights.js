// 更新同步高度函数（优化版 - 使用防抖和缓存）
function __syncTranslationHeightsImpl(afterSync) {
  try {
    const after = typeof afterSync === "function" ? afterSync : null;
    // 移动端使用合并列表，不需要双列高度同步
    if (isMobileViewport()) {
      if (after) requestAnimationFrame(after);
      return;
    }

    const sourceListEl = DOMCache.get("sourceList");
    const targetListEl = DOMCache.get("targetList");
    if (!sourceListEl || !targetListEl) {
      if (after) requestAnimationFrame(after);
      return;
    }
    const sourceItems = DOMCache.queryAll(".responsive-translation-item", sourceListEl);
    const targetItems = DOMCache.queryAll(".responsive-translation-item", targetListEl);

    if (sourceItems.length !== targetItems.length || sourceItems.length === 0) {
      if (after) requestAnimationFrame(after);
      return;
    }

    // 获取屏幕尺寸以确定最小高度 （isMobile 已在上方 early-return）
    var vw = window.innerWidth;
    var isTablet = vw >= 768 && vw < 1024;
    var baseMinHeight = AppState.ui.translationDensity === "comfortable" ? (isTablet ? 80 : 90) : 64;

    // 横屏且高度有限的情况
    if (window.matchMedia("(orientation: landscape)").matches && window.innerHeight < 600) {
      baseMinHeight = 50;
    }

    // 使用 requestAnimationFrame 和批量读写分离减少重排
    requestAnimationFrame(() => {
      // 预计算元素对（避免在 reset 和 measure 阶段各查询一次）
      var pairs = [];
      for (var i = 0; i < sourceItems.length; i++) {
        var si = sourceItems[i];
        var ti = targetItems[i];
        if (!si || !ti) continue;
        var sc = si.querySelector(".item-content");
        var tc = ti.querySelector(".item-content");
        if (!sc || !tc) continue;
        pairs.push({ si: si, ti: ti, sc: sc, tc: tc, textarea: ti.querySelector("textarea") });
      }

      // 批量写：重置高度
      for (var j = 0; j < pairs.length; j++) {
        var p = pairs[j];
        p.si.style.removeProperty("height");
        p.ti.style.removeProperty("height");
        if (p.sc.style) p.sc.style.removeProperty("min-height");
        if (p.tc.style) p.tc.style.removeProperty("min-height");
        if (p.textarea) {
          p.textarea.style.height = "0px";
          p.textarea.style.minHeight = "0px";
        }
      }

      // 先按内容撑开输入框，再测量含状态栏和内边距的整行高度。
      var textareaHeights = pairs.map((p) => p.textarea ? p.textarea.scrollHeight : 0);
      for (var t = 0; t < pairs.length; t++) {
        // scrollHeight 不含输入框的上下边框（各 2px），需计入以完整显示末行。
        if (pairs[t].textarea) pairs[t].textarea.style.height = Math.max(28, textareaHeights[t] + 4) + "px";
      }
      // 批量读：测量高度
      for (var k = 0; k < pairs.length; k++) {
        var q = pairs[k];
        var sh = Math.max(q.sc.scrollHeight + 1, baseMinHeight);
        var th = Math.max(q.tc.scrollHeight + 1, baseMinHeight);
        q.h = Math.max(sh, th);
      }

      // 批量写：应用高度
      for (var m = 0; m < pairs.length; m++) {
        var r = pairs[m];
        var px = r.h + "px";
        r.si.style.height = px;
        r.ti.style.height = px;
        if (r.sc.style) r.sc.style.minHeight = (r.h - 1) + "px";
        if (r.tc.style) r.tc.style.minHeight = (r.h - 1) + "px";
      }

      // 将滚动回调推迟到下一帧，避免在高度写操作后立即读取布局属性导致强制重排
      if (after) requestAnimationFrame(after);
    });
  } catch (error) {
    (loggers.app || console).error("同步高度时出错:", error);
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.syncTranslationHeights = __syncTranslationHeightsImpl;
})();
