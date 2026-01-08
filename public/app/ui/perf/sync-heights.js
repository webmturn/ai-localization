// 更新同步高度函数（优化版 - 使用防抖和缓存）
function __syncTranslationHeightsImpl(afterSync) {
  try {
    const after = typeof afterSync === "function" ? afterSync : null;
    // 移动端使用合并列表，不需要双列高度同步
    if (window.innerWidth < 768) {
      if (after) requestAnimationFrame(after);
      return;
    }

    const sourceItems = document.querySelectorAll(
      "#sourceList .responsive-translation-item"
    );
    const targetItems = document.querySelectorAll(
      "#targetList .responsive-translation-item"
    );

    if (sourceItems.length !== targetItems.length || sourceItems.length === 0) {
      if (after) requestAnimationFrame(after);
      return;
    }

    // 获取屏幕尺寸以确定最小高度
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;

    let baseMinHeight = 60;

    if (isMobile) {
      baseMinHeight = 70;
    } else if (isTablet) {
      baseMinHeight = 80;
    } else {
      baseMinHeight = 90;
    }

    // 横屏且高度有限的情况
    if (isLandscape && window.innerHeight < 600) {
      baseMinHeight = 50;
    }

    // 使用 requestAnimationFrame 和批量读写分离减少重排
    requestAnimationFrame(() => {
      sourceItems.forEach((sourceItem, index) => {
        const targetItem = targetItems[index];
        if (!sourceItem || !targetItem) return;

        sourceItem.style.removeProperty("height");
        targetItem.style.removeProperty("height");

        const sourceContent = sourceItem.querySelector(".item-content");
        const targetContent =
          targetItem.querySelector("textarea") ||
          targetItem.querySelector(".item-content");

        if (sourceContent?.style) {
          sourceContent.style.removeProperty("min-height");
        }
        if (targetContent?.style) {
          targetContent.style.removeProperty("min-height");
        }
      });

      const heights = [];
 
      sourceItems.forEach((sourceItem, index) => {
        const targetItem = targetItems[index];
        if (!sourceItem || !targetItem) return;

        const sourceContent = sourceItem.querySelector(".item-content");
        const targetContent =
          targetItem.querySelector("textarea") ||
          targetItem.querySelector(".item-content");

        if (!sourceContent || !targetContent) return;

        const sourceHeight = Math.max(
          sourceContent.scrollHeight,
          baseMinHeight
        );
        const targetHeight = Math.max(
          targetContent.scrollHeight,
          baseMinHeight
        );
        const maxHeight = Math.max(sourceHeight, targetHeight);

        heights.push({
          sourceItem,
          targetItem,
          sourceContent,
          targetContent,
          maxHeight,
        });
      });

      heights.forEach(
        ({
          sourceItem,
          targetItem,
          sourceContent,
          targetContent,
          maxHeight,
        }) => {
          sourceItem.style.height = maxHeight + "px";
          targetItem.style.height = maxHeight + "px";

          if (sourceContent.style) {
            sourceContent.style.minHeight = maxHeight + "px";
          }
          if (targetContent.style) {
            targetContent.style.minHeight = maxHeight + "px";
          }
        }
      );

      if (after) after();
    });
  } catch (error) {
    console.error("同步高度时出错:", error);
  }
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.syncTranslationHeights = __syncTranslationHeightsImpl;
})();
