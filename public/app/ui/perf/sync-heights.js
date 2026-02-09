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
    const sourceItems = sourceListEl.querySelectorAll(".responsive-translation-item");
    const targetItems = targetListEl.querySelectorAll(".responsive-translation-item");

    if (sourceItems.length !== targetItems.length || sourceItems.length === 0) {
      if (after) requestAnimationFrame(after);
      return;
    }

    // 获取屏幕尺寸以确定最小高度 （isMobile 已在上方 early-return）
    var vw = window.innerWidth;
    var isTablet = vw >= 768 && vw < 1024;
    var baseMinHeight = isTablet ? 80 : 90;

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
        var tc = ti.querySelector("textarea") || ti.querySelector(".item-content");
        if (!sc || !tc) continue;
        pairs.push({ si: si, ti: ti, sc: sc, tc: tc });
      }

      // 批量写：重置高度
      for (var j = 0; j < pairs.length; j++) {
        var p = pairs[j];
        p.si.style.removeProperty("height");
        p.ti.style.removeProperty("height");
        if (p.sc.style) p.sc.style.removeProperty("min-height");
        if (p.tc.style) p.tc.style.removeProperty("min-height");
      }

      // 批量读：测量高度
      for (var k = 0; k < pairs.length; k++) {
        var q = pairs[k];
        var sh = Math.max(q.sc.scrollHeight, baseMinHeight);
        var th = Math.max(q.tc.scrollHeight, baseMinHeight);
        q.h = Math.max(sh, th);
      }

      // 批量写：应用高度
      for (var m = 0; m < pairs.length; m++) {
        var r = pairs[m];
        var px = r.h + "px";
        r.si.style.height = px;
        r.ti.style.height = px;
        if (r.sc.style) r.sc.style.minHeight = px;
        if (r.tc.style) r.tc.style.minHeight = px;
      }

      if (after) after();
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
