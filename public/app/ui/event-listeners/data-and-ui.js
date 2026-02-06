function registerEventListenersDataAndUi(ctx) {
  // 数据管理功能已拆分到 data-management.js
  if (typeof registerEventListenersDataManagement === 'function') {
    registerEventListenersDataManagement(ctx);
  }

  // 密码显示/隐藏切换
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    EventManager.add(
      btn,
      "click",
      function () {
        const targetId = this.getAttribute("data-target");
        const input = document.getElementById(targetId);
        const icon = this.querySelector("i");

        if (input && icon) {
          if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
          } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
          }
        }
      },
      { tag: "ui", scope: "settings", label: "togglePassword:click" }
    );
  });

  // 主题和字体大小实时预览
  const themeMode = document.getElementById("themeMode");
  const fontSize = document.getElementById("fontSize");

  if (themeMode) {
    EventManager.add(
      themeMode,
      "change",
      function () {
        applySettings({ themeMode: this.value });
      },
      { tag: "settings", scope: "appearance", label: "themeMode:change" }
    );
  }

  if (fontSize) {
    EventManager.add(
      fontSize,
      "change",
      function () {
        applySettings({ fontSize: this.value });
      },
      { tag: "settings", scope: "appearance", label: "fontSize:change" }
    );
  }

  const sourceSelectionIndicatorEnabled = document.getElementById(
    "sourceSelectionIndicatorEnabled"
  );
  const sourceSelectionIndicatorUnselectedStyle = document.getElementById(
    "sourceSelectionIndicatorUnselectedStyle"
  );

  if (sourceSelectionIndicatorEnabled) {
    EventManager.add(
      sourceSelectionIndicatorEnabled,
      "change",
      function () {
        applySettings({ sourceSelectionIndicatorEnabled: this.checked });
      },
      {
        tag: "settings",
        scope: "appearance",
        label: "sourceSelectionIndicatorEnabled:change",
      }
    );
  }

  if (sourceSelectionIndicatorUnselectedStyle) {
    EventManager.add(
      sourceSelectionIndicatorUnselectedStyle,
      "change",
      function () {
        applySettings({ sourceSelectionIndicatorUnselectedStyle: this.value });
      },
      {
        tag: "settings",
        scope: "appearance",
        label: "sourceSelectionIndicatorUnselectedStyle:change",
      }
    );
  }

  // 关闭模态框
  document.querySelectorAll(".close-modal").forEach((btn) => {
    EventManager.add(btn, "click", closeModal, {
      tag: "ui",
      scope: "modal",
      label: "closeModalBtn:click",
    });
  });

  // 关闭通知
  const closeNotificationBtn = document.getElementById("closeNotification");
  if (closeNotificationBtn)
    EventManager.add(closeNotificationBtn, "click", closeNotification, {
      tag: "ui",
      scope: "notification",
      label: "closeNotificationBtn:click",
    });

  // 标签页切换（仅右侧面板的 .sidebar-tab，避免影响“浏览文件”“导出翻译”等按钮）
  const tabs = document.querySelectorAll(".sidebar-tab");
  tabs.forEach((tab) => {
    EventManager.add(
      tab,
      "click",
      () => {
        // 移除所有标签页的活动状态
        tabs.forEach((t) => {
          t.classList.remove("border-b-2", "border-primary", "text-primary");
          t.classList.add(
            "text-gray-500",
            "hover:text-gray-700",
            "dark:text-gray-400",
            "dark:hover:text-gray-200"
          );
        });

        // 添加当前标签页的活动状态
        tab.classList.add("border-b-2", "border-primary", "text-primary");
        tab.classList.remove(
          "text-gray-500",
          "hover:text-gray-700",
          "dark:text-gray-400",
          "dark:hover:text-gray-200"
        );

        // 根据标签页切换内容
        if (tab.textContent.trim() === "术语库") {
          document
            .getElementById("terminologyModal")
            .classList.remove("hidden");
          // 刷新术语库列表
          if (typeof window.updateTerminologyList === "function") {
            window.updateTerminologyList();
          }
          if (typeof window.updateTerminologyPagination === "function") {
            window.updateTerminologyPagination();
          }
        } else if (tab.textContent.trim() === "质量检查") {
          document
            .getElementById("qualityReportModal")
            .classList.remove("hidden");
          if (typeof window.syncQualityRuleCards === "function") window.syncQualityRuleCards();
        }
      },
      { tag: "ui", scope: "tabs", label: "asideTab:click" }
    );
  });

  // 移动端侧边栏切换
  const toggleLeftSidebar = document.getElementById("toggleLeftSidebar");
  const toggleRightSidebar = document.getElementById("toggleRightSidebar");
  const leftSidebar = document.getElementById("leftSidebar");
  const rightSidebar = document.getElementById("rightSidebar");

  const isDesktopLayout = () =>
    window.matchMedia && window.matchMedia("(min-width: 768px)").matches;

  const applySidebarWidthsForLayout = () => {
    const desktop = isDesktopLayout();
    const viewportWidth = window.innerWidth || 0;

    if (leftSidebar) {
      if (desktop) {
        leftSidebar.style.removeProperty("max-width");
        const savedLeftWidth = localStorage.getItem("leftSidebarWidth");
        if (savedLeftWidth) {
          const maxLeft = Math.min(500, Math.floor(viewportWidth * 0.45));
          const width = Math.max(200, Math.min(maxLeft, Number(savedLeftWidth)));
          leftSidebar.style.width = width + "px";
          leftSidebar.style.setProperty("--sidebar-width", width + "px");
        } else {
          leftSidebar.style.removeProperty("width");
          leftSidebar.style.removeProperty("--sidebar-width");
        }
      } else {
        leftSidebar.style.width = "100%";
        leftSidebar.style.maxWidth = "100%";
        leftSidebar.style.setProperty("--sidebar-width", "100%");
      }
    }

    if (rightSidebar) {
      if (desktop) {
        rightSidebar.style.removeProperty("max-width");
        const savedRightWidth = localStorage.getItem("rightSidebarWidth");
        if (savedRightWidth) {
          const maxRight = Math.min(600, Math.floor(viewportWidth * 0.45));
          const width = Math.max(280, Math.min(maxRight, Number(savedRightWidth)));
          rightSidebar.style.width = width + "px";
          rightSidebar.style.setProperty("--sidebar-width", width + "px");
        } else {
          rightSidebar.style.removeProperty("width");
          rightSidebar.style.removeProperty("--sidebar-width");
        }
      } else {
        rightSidebar.style.width = "100%";
        rightSidebar.style.maxWidth = "100%";
        rightSidebar.style.setProperty("--sidebar-width", "100%");
      }
    }
  };

  applySidebarWidthsForLayout();

  EventManager.add(
    window,
    "resize",
    () => {
      applySidebarWidthsForLayout();
    },
    { tag: "ui", scope: "sidebar", label: "sidebar:resizeApplyWidths" }
  );

  if (toggleLeftSidebar && leftSidebar) {
    EventManager.add(
      toggleLeftSidebar,
      "click",
      () => {
        leftSidebar.classList.toggle("show-sidebar");
        // 关闭右侧边栏
        if (rightSidebar && rightSidebar.classList.contains("show-sidebar")) {
          rightSidebar.classList.remove("show-sidebar");
        }
        applySidebarWidthsForLayout();
      },
      { tag: "ui", scope: "sidebar", label: "toggleLeftSidebar:click" }
    );
  }

  if (toggleRightSidebar && rightSidebar) {
    EventManager.add(
      toggleRightSidebar,
      "click",
      () => {
        rightSidebar.classList.toggle("show-sidebar");
        // 关闭左侧边栏
        if (leftSidebar && leftSidebar.classList.contains("show-sidebar")) {
          leftSidebar.classList.remove("show-sidebar");
        }
        applySidebarWidthsForLayout();
      },
      { tag: "ui", scope: "sidebar", label: "toggleRightSidebar:click" }
    );
  }

  // ==================== 按钮点击旋转效果（可复用） ====================
  document.body.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".btn-click-spin-trigger");
      if (!btn) return;
      const spinClass = btn.dataset.spin === "180" ? "btn-click-spin-180" : "btn-click-spin";
      const target = btn.dataset.spinTarget === "icon" ? btn.querySelector("i") : btn;
      if (!target) return;
      target.classList.add(spinClass);
      const onAnimationEnd = () => {
        target.classList.remove(spinClass);
        target.removeEventListener("animationend", onAnimationEnd);
      };
      target.addEventListener("animationend", onAnimationEnd, { once: true });
    },
    true
  );

  // ==================== 语言交换按钮 ====================
  const swapLanguagesBtn = document.getElementById("swapLanguagesBtn");
  const sourceLanguage = document.getElementById("sourceLanguage");
  const targetLanguage = document.getElementById("targetLanguage");

  if (swapLanguagesBtn && sourceLanguage && targetLanguage) {
    EventManager.add(
      swapLanguagesBtn,
      "click",
      () => {
        const tempValue = sourceLanguage.value;
        sourceLanguage.value = targetLanguage.value;
        targetLanguage.value = tempValue;

        // 触发 change 事件以同步其他组件
        sourceLanguage.dispatchEvent(new Event("change", { bubbles: true }));
        targetLanguage.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { tag: "ui", scope: "toolbar", label: "swapLanguages:click" }
    );
  }

  // ==================== 侧边栏拖拽调整宽度 ====================
  const sidebarResizers = document.querySelectorAll(".sidebar-resizer");
  
  sidebarResizers.forEach((resizer) => {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let sidebar = null;
    
    const onMouseDown = (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      
      const sidebarType = resizer.dataset.sidebar;
      sidebar = sidebarType === "left" ? leftSidebar : rightSidebar;
      
      if (sidebar) {
        startWidth = sidebar.offsetWidth;
        document.body.classList.add("sidebar-resizing");
        resizer.classList.add("resizing");
      }
    };
    
    const onMouseMove = (e) => {
      if (!isResizing || !sidebar) return;
      
      const sidebarType = resizer.dataset.sidebar;
      let newWidth;
      
      if (sidebarType === "left") {
        newWidth = startWidth + (e.clientX - startX);
      } else {
        newWidth = startWidth - (e.clientX - startX);
      }
      
      // 应用最小/最大宽度限制
      const minWidth = sidebarType === "left" ? 200 : 280;
      const maxWidth = sidebarType === "left" ? 500 : 600;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      sidebar.style.width = newWidth + "px";
      sidebar.style.setProperty("--sidebar-width", newWidth + "px");
    };
    
    const onMouseUp = () => {
      if (isResizing && sidebar) {
        // 保存宽度到 localStorage
        const sidebarType = resizer.dataset.sidebar;
        const key = sidebarType === "left" ? "leftSidebarWidth" : "rightSidebarWidth";
        localStorage.setItem(key, sidebar.offsetWidth);
      }
      
      isResizing = false;
      sidebar = null;
      document.body.classList.remove("sidebar-resizing");
      resizer.classList.remove("resizing");
    };
    
    EventManager.add(resizer, "mousedown", onMouseDown, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mousedown",
    });
    
    EventManager.add(document, "mousemove", onMouseMove, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mousemove",
    });
    
    EventManager.add(document, "mouseup", onMouseUp, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mouseup",
    });
  });

  // ==================== 右侧面板标签页增强 ====================
  const sidebarTabs = document.querySelectorAll(".sidebar-tab");
  
  sidebarTabs.forEach((tab) => {
    EventManager.add(
      tab,
      "click",
      () => {
        const tabName = tab.dataset.tab;
        
        // 更新标签页状态
        sidebarTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        
        // 根据标签页打开相应的模态框或面板
        if (tabName === "terminology") {
          const terminologyModal = document.getElementById("terminologyModal");
          if (terminologyModal) terminologyModal.classList.remove("hidden");
          // 刷新术语库列表
          if (typeof window.updateTerminologyList === "function") {
            window.updateTerminologyList();
          }
          if (typeof window.updateTerminologyPagination === "function") {
            window.updateTerminologyPagination();
          }
        } else if (tabName === "quality") {
          const qualityReportModal = document.getElementById("qualityReportModal");
          if (qualityReportModal) qualityReportModal.classList.remove("hidden");
          if (typeof window.syncQualityRuleCards === "function") window.syncQualityRuleCards();
        }
        // settings 标签页不需要打开模态框，显示当前面板内容
      },
      { tag: "ui", scope: "tabs", label: "sidebarTab:click" }
    );
  });
}
