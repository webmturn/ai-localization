// 切换用户菜单
let userMenuOutsideClickListenerId = null;
function toggleUserMenu(e) {
  e.stopPropagation(); // 阻止事件冒泡
  const menu = DOMCache.get("userMenu");
  if (!menu) return;
  const isHidden = menu.classList.contains("hidden");

  if (isHidden) {
    // 打开菜单
    menu.classList.remove("hidden");

    // 添加全局点击事件监听器，点击外部关闭菜单
    setTimeout(() => {
      if (!userMenuOutsideClickListenerId) {
        userMenuOutsideClickListenerId = EventManager.add(
          document,
          "click",
          closeUserMenuOnClickOutside,
          {
            tag: "user",
            scope: "userMenu",
            label: "document:clickCloseUserMenu",
          },
        );
      }
    }, 0);
  } else {
    // 关闭菜单
    menu.classList.add("hidden");
    if (userMenuOutsideClickListenerId) {
      EventManager.removeById(userMenuOutsideClickListenerId);
      userMenuOutsideClickListenerId = null;
    }
  }
}

// 点击外部关闭用户菜单
function closeUserMenuOnClickOutside(e) {
  const menu = DOMCache.get("userMenu");
  const menuBtn = DOMCache.get("userMenuBtn");

  // 如果点击的不是菜单内部，则关闭菜单
  if (
    menu &&
    !menu.contains(e.target) &&
    (!menuBtn || !menuBtn.contains(e.target))
  ) {
    menu.classList.add("hidden");
    if (userMenuOutsideClickListenerId) {
      EventManager.removeById(userMenuOutsideClickListenerId);
      userMenuOutsideClickListenerId = null;
    }
  }
}

// 模态框焦点陷阱状态
const __modalFocusTrapState = {
  previousActiveElement: null,
  trapHandler: null,
};

const __FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// 打开模态框
function openModal(modalId) {
  const modal = DOMCache.get(modalId);
  if (modal) {
    // 记录触发元素，关闭时恢复焦点
    __modalFocusTrapState.previousActiveElement = document.activeElement;

    modal.classList.remove("hidden");
    try {
      modal.scrollTop = 0;
      modal.scrollLeft = 0;
    } catch (_) {
      (loggers.app || console).debug("modal scroll reset:", _);
    }

    try {
      const content =
        modal.querySelector(".modal-content") ||
        modal.querySelector(":scope > div");
      if (content) {
        content.scrollTop = 0;
        content.scrollLeft = 0;
      }
    } catch (_) {
      (loggers.app || console).debug("modal content scroll reset:", _);
    }
    if (modalId === "qualityReportModal" && typeof window.syncQualityRuleCards === "function") {
      window.syncQualityRuleCards();
    }
    if (modalId === "settingsModal" && typeof window.loadProjectPromptTemplatesToUI === "function") {
      try {
        window.loadProjectPromptTemplatesToUI();
      } catch (_) {
        (loggers.app || console).debug("modal loadPromptTemplates:", _);
      }
    }
    // 打开术语库模态框时刷新列表
    if (modalId === "terminologyModal") {
      if (typeof window.updateTerminologyList === "function") {
        window.updateTerminologyList();
      }
      if (typeof window.updateTerminologyPagination === "function") {
        window.updateTerminologyPagination();
      }
    }

    // 焦点陷阱：将焦点移入模态框并限制 Tab 键范围
    __setupModalFocusTrap(modal);
  }
}

// 关闭模态框
function closeModal(eventOrModalId) {
  // 移除焦点陷阱
  __removeModalFocusTrap();

  // 如果传入的是字符串，则作为模态框ID处理
  if (typeof eventOrModalId === "string") {
    const modal = DOMCache.get(eventOrModalId);
    if (modal) {
      modal.classList.add("hidden");
    }
    __restoreModalFocus();
    return;
  }

  // 如果有事件对象，尝试找到最近的模态框
  if (eventOrModalId && eventOrModalId.target) {
    const modalToClose = eventOrModalId.target.closest(
      ".fixed.inset-0.bg-black.bg-opacity-50",
    );
    if (modalToClose) {
      modalToClose.classList.add("hidden");
      __restoreModalFocus();
      return;
    }
  }

  // 如果没有参数，只关闭最顶层的模态框（最后一个可见的）
  const visibleModals = Array.from(
    DOMCache.queryAll(".fixed.inset-0.bg-black.bg-opacity-50"),
  ).filter((modal) => !modal.classList.contains("hidden"));

  if (visibleModals.length > 0) {
    // 只关闭最后一个（z-index最高的）
    visibleModals[visibleModals.length - 1].classList.add("hidden");
  }
  __restoreModalFocus();
}

// 设置焦点陷阱
function __setupModalFocusTrap(modal) {
  __removeModalFocusTrap();

  // 将焦点移到模态框内第一个可聚焦元素
  requestAnimationFrame(() => {
    const focusable = DOMCache.queryAll(__FOCUSABLE_SELECTOR, modal);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      modal.setAttribute('tabindex', '-1');
      modal.focus();
    }
  });

  // Tab 键循环陷阱
  __modalFocusTrapState.trapHandler = function (e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(DOMCache.queryAll(__FOCUSABLE_SELECTOR, modal));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  __modalFocusTrapState.trapListenerId = EventManager.add(document, 'keydown',
    __modalFocusTrapState.trapHandler,
    { tag: 'modal', label: 'document:keydown:focusTrap' }
  );
}

// 移除焦点陷阱
function __removeModalFocusTrap() {
  if (__modalFocusTrapState.trapListenerId) {
    EventManager.removeById(__modalFocusTrapState.trapListenerId);
    __modalFocusTrapState.trapListenerId = null;
  }
  __modalFocusTrapState.trapHandler = null;
}

// 恢复焦点到触发元素
function __restoreModalFocus() {
  try {
    if (__modalFocusTrapState.previousActiveElement &&
        typeof __modalFocusTrapState.previousActiveElement.focus === 'function') {
      __modalFocusTrapState.previousActiveElement.focus();
    }
  } catch (_) {
    (loggers.app || console).debug("modal focus restore:", _);
  }
  __modalFocusTrapState.previousActiveElement = null;
}

// 通知相关逻辑已迁移至 app/ui/notification.js

// 工具函数：转义HTML

// 工具函数：截断文本
function truncateText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
