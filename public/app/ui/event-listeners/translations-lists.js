function registerEventListenersTranslationLists(ctx) {
  const sourceList = ctx?.sourceList;
  const targetList = ctx?.targetList;
  const mobileCombinedList = ctx?.mobileCombinedList;

  if (sourceList) {
    // 点击事件委托
    EventManager.add(
      sourceList,
      "click",
      function (e) {
        const item = e.target.closest(".responsive-translation-item");
        if (item && item.dataset.index) {
          const index = parseInt(item.dataset.index);
          const multiKey = e.ctrlKey || e.metaKey;
          if (multiKey) {
            toggleMultiSelection(index);
          } else {
            // 鼠标点击行：只更新选中样式，不滚动、不自动聚焦 textarea
            selectTranslationItem(index, {
              shouldScroll: true,
              shouldFocusTextarea: false,
            });
          }
        }
      },
      {
        tag: "translations",
        scope: "list:source",
        label: "sourceList:clickDelegate",
      }
    );
  }

  if (targetList) {
    // 点击事件委托
    EventManager.add(
      targetList,
      "click",
      function (e) {
        if (e.target && e.target.tagName === "TEXTAREA") return;
        const item = e.target.closest(".responsive-translation-item");
        if (item && item.dataset.index) {
          const index = parseInt(item.dataset.index);
          const multiKey = e.ctrlKey || e.metaKey;
          if (multiKey) {
            toggleMultiSelection(index);
          } else {
            // 鼠标点击译文行（非 textarea）：同样不滚动、不强制聚焦
            selectTranslationItem(index, {
              shouldScroll: true,
              shouldFocusTextarea: false,
            });
          }
        }
      },
      {
        tag: "translations",
        scope: "list:target",
        label: "targetList:clickDelegate",
      }
    );

    // textarea input 事件委托
    EventManager.add(
      targetList,
      "input",
      function (e) {
        if (e.target.tagName === "TEXTAREA" && e.target.dataset.index) {
          updateTranslationItem(
            parseInt(e.target.dataset.index),
            e.target.value
          );
        }
      },
      {
        tag: "translations",
        scope: "list:target",
        label: "targetList:inputDelegate",
      }
    );

    // textarea focus 事件委托
    EventManager.add(
      targetList,
      "focus",
      function (e) {
        if (e.target.tagName === "TEXTAREA" && e.target.dataset.index) {
          selectTranslationItem(parseInt(e.target.dataset.index), {
            shouldScroll: false,
            shouldFocusTextarea: false,
          });
        }
      },
      {
        tag: "translations",
        scope: "list:target",
        label: "targetList:focusDelegate",
        listenerOptions: true,
      }
    );
  }

  if (mobileCombinedList) {
    // 点击事件委托
    EventManager.add(
      mobileCombinedList,
      "click",
      function (e) {
        const rawTarget = e.target;
        const targetEl =
          rawTarget instanceof Element ? rawTarget : rawTarget?.parentElement;

        const actionEl = targetEl ? targetEl.closest("[data-action]") : null;
        if (actionEl && actionEl.dataset.action === "toggle-extra") {
          const item = actionEl.closest(".responsive-translation-item");
          if (!item) return;
          const extra = item.querySelector('[data-role="extra"]');
          if (!extra) return;

          const nextState =
            actionEl.dataset.state === "expanded" ? "collapsed" : "expanded";
          actionEl.dataset.state = nextState;
          actionEl.textContent = nextState === "expanded" ? "收起" : "更多";
          extra.classList.toggle("hidden", nextState !== "expanded");
          return;
        }

        if (targetEl && targetEl.tagName === "TEXTAREA") {
          return;
        }
        // 长按多选后跳过普通点击
        if (longPressFired) { longPressFired = false; return; }
        const item = targetEl
          ? targetEl.closest(".responsive-translation-item")
          : null;
        if (item && item.dataset.index) {
          const index = parseInt(item.dataset.index);
          const multiKey = e.ctrlKey || e.metaKey;
          if (multiKey) {
            toggleMultiSelection(index);
          } else {
            selectTranslationItem(index, {
              shouldScroll: true,
              shouldFocusTextarea: false,
            });
          }
        }
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:clickDelegate",
      }
    );

    // 长按多选（移动端）
    let longPressTimer = null;
    let longPressFired = false;

    EventManager.add(
      mobileCombinedList,
      "touchstart",
      function (e) {
        longPressFired = false;
        const targetEl = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (targetEl && targetEl.tagName === "TEXTAREA") return;
        const item = targetEl ? targetEl.closest(".responsive-translation-item") : null;
        if (!item || !item.dataset.index) return;
        const index = parseInt(item.dataset.index);
        longPressTimer = setTimeout(function () {
          longPressFired = true;
          toggleMultiSelection(index);
          // 触觉反馈（如果浏览器支持）
          if (navigator.vibrate) navigator.vibrate(30);
        }, 500);
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:touchstartLongPress",
        listenerOptions: { passive: true },
      }
    );

    EventManager.add(
      mobileCombinedList,
      "touchend",
      function () {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:touchendLongPress",
        listenerOptions: { passive: true },
      }
    );

    EventManager.add(
      mobileCombinedList,
      "touchmove",
      function () {
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:touchmoveLongPress",
        listenerOptions: { passive: true },
      }
    );

    // textarea input 事件委托
    EventManager.add(
      mobileCombinedList,
      "input",
      function (e) {
        if (e.target.tagName === "TEXTAREA" && e.target.dataset.index) {
          updateTranslationItem(
            parseInt(e.target.dataset.index),
            e.target.value
          );
        }
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:inputDelegate",
      }
    );

    // textarea focus 事件委托
    EventManager.add(
      mobileCombinedList,
      "focus",
      function (e) {
        if (e.target.tagName === "TEXTAREA" && e.target.dataset.index) {
          selectTranslationItem(parseInt(e.target.dataset.index), {
            shouldScroll: false,
            shouldFocusTextarea: false,
          });
        }
      },
      {
        tag: "translations",
        scope: "list:mobileCombined",
        label: "mobileCombinedList:focusDelegate",
        listenerOptions: true,
      }
    );
  }
}
