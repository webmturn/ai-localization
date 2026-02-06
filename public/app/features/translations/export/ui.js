// 切换用户菜单
let userMenuOutsideClickListenerId = null;
function toggleUserMenu(e) {
  e.stopPropagation(); // 阻止事件冒泡
  const menu = document.getElementById("userMenu");
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
  const menu = document.getElementById("userMenu");
  const menuBtn = document.getElementById("userMenuBtn");

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

// 打开模态框
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    try {
      modal.scrollTop = 0;
      modal.scrollLeft = 0;
    } catch (_) {}

    try {
      const content =
        modal.querySelector(".modal-content") ||
        modal.querySelector(":scope > div");
      if (content) {
        content.scrollTop = 0;
        content.scrollLeft = 0;
      }
    } catch (_) {}
    if (modalId === "qualityReportModal" && typeof window.syncQualityRuleCards === "function") {
      window.syncQualityRuleCards();
    }
    if (modalId === "settingsModal" && typeof window.loadProjectPromptTemplatesToUI === "function") {
      try {
        window.loadProjectPromptTemplatesToUI();
      } catch (_) {}
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
  }
}

// 关闭模态框
function closeModal(eventOrModalId) {
  // 如果传入的是字符串，则作为模态框ID处理
  if (typeof eventOrModalId === "string") {
    const modal = document.getElementById(eventOrModalId);
    if (modal) {
      modal.classList.add("hidden");
    }
    return;
  }

  // 如果有事件对象，尝试找到最近的模态框
  if (eventOrModalId && eventOrModalId.target) {
    const modalToClose = eventOrModalId.target.closest(
      ".fixed.inset-0.bg-black.bg-opacity-50",
    );
    if (modalToClose) {
      modalToClose.classList.add("hidden");
      return;
    }
  }

  // 如果没有参数，只关闭最顶层的模态框（最后一个可见的）
  const visibleModals = Array.from(
    document.querySelectorAll(".fixed.inset-0.bg-black.bg-opacity-50"),
  ).filter((modal) => !modal.classList.contains("hidden"));

  if (visibleModals.length > 0) {
    // 只关闭最后一个（z-index最高的）
    visibleModals[visibleModals.length - 1].classList.add("hidden");
  }
}

// 通知相关逻辑已迁移至 app/ui/notification.js

// 工具函数：转义HTML

// 工具函数：截断文本
function truncateText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
