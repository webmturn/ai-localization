// 桌面布局偏好和工作区上下文；移动端仍使用原有抽屉。
(function () {
  let panelOpen = false;
  const isProofreading = () => AppState.ui.desktopLayout === "proofreading";
  const updateContext = (items, currentItems) => {
    const project = AppState.project;
    const all = items || project?.translationItems || [];
    const file = AppState.translations.selectedFile;
    const current = currentItems || (file ? all.filter((item) => item.metadata?.file === file) : all);
    const name = DOMCache.get("workspaceProjectName");
    if (name) {
      name.textContent = project?.name || "尚未打开项目";
      name.title = name.textContent;
    }
    const projectCount = DOMCache.get("workspaceProjectCount");
    if (projectCount) projectCount.textContent = `${all.length} 项`;
    const fileName = DOMCache.get("workspaceFileName");
    if (fileName) {
      fileName.textContent = file || "全部项目条目";
      fileName.title = fileName.textContent;
    }
    const progress = DOMCache.get("workspaceFileProgress");
    if (progress) {
      const completed = current.filter((item) => ["translated", "edited", "approved"].includes(item.status)).length;
      const reviewed = current.filter((item) => item.status === "approved").length;
      progress.textContent = `已翻译 ${completed}/${current.length} · 已校对 ${reviewed}/${current.length}`;
    }
    const exportButton = DOMCache.get("workspaceExportBtn");
    if (exportButton) exportButton.disabled = !all.length;
    const hasFiles = all.length > 0 || Object.keys(AppState.fileMetadata || {}).length > 0;
    document.body.classList.toggle("compact-file-import", AppState.ui.compactFileImport && hasFiles);
  };
  const syncPanel = () => {
    document.body.classList.toggle("desktop-settings-collapsed", !panelOpen);
    const button = DOMCache.get("workspaceSettingsBtn");
    if (button) {
      button.setAttribute("aria-expanded", String(panelOpen));
      button.classList.toggle("active", panelOpen);
    }
    window.dispatchEvent(new CustomEvent("workspace:layout-changed"));
  };
  App.ui.workspaceLayout = {
    isProofreading,
    isPanelOpen: () => panelOpen,
    sidebarStorageKey: (side) => isProofreading() ? `${side}ProofreadingSidebarWidth` : `${side}SidebarWidth`,
    updateContext,
    syncResourcePlacement() {
      const desktopRail = isProofreading() && window.innerWidth >= 768;
      const slot = DOMCache.get(desktopRail ? "workspaceMemorySlot" : "sidebarMemorySlot");
      const button = DOMCache.get("openTMManagerBtn");
      // 移动同一个入口，保留记忆库监听器、数量徽章和模态框焦点恢复。
      if (slot && button && button.parentElement !== slot) slot.appendChild(button);
    },
    apply() {
      document.body.classList.toggle("proofreading-layout", isProofreading());
      panelOpen = AppState.ui.desktopSettingsPanel === "expanded";
      this.syncResourcePlacement();
      updateContext();
      syncPanel();
    },
    setPanelOpen(open) {
      const sidebar = DOMCache.get("rightSidebar");
      if (!open && sidebar?.contains(document.activeElement)) DOMCache.get("workspaceSettingsBtn")?.focus();
      panelOpen = !!open;
      syncPanel();
    },
    closePanelIfOpen() {
      if (!panelOpen || !isProofreading() || window.innerWidth < 768) return false;
      this.setPanelOpen(false);
      return true;
    },
    bind() {
      const bind = (id, action) => {
        const button = DOMCache.get(id);
        if (button) EventManager.add(button, "click", action, { tag: "ui", scope: "workspace", label: `${id}:click` });
      };
      bind("workspaceSettingsBtn", () => this.setPanelOpen(!panelOpen));
      bind("workspaceCloseSettingsBtn", () => this.setPanelOpen(false));
      bind("workspaceExportBtn", () => DOMCache.get("exportBtn")?.click());
      bind("workspaceTerminologyBtn", () => document.querySelector('.sidebar-tab[data-tab="terminology"]')?.click());
      bind("workspaceQualityBtn", () => document.querySelector('.sidebar-tab[data-tab="quality"]')?.click());
      bind("workspacePreferencesBtn", () => {
        openModal("settingsModal");
        document.querySelector('.settings-tab-btn[data-tab="appearance"]')?.click();
      });
      EventManager.add(document, "keydown", (event) => {
        if (event.key === "Escape" && !document.querySelector('[role="dialog"]:not(.hidden)')) {
          this.closePanelIfOpen();
        }
      }, { tag: "ui", scope: "workspace", label: "workspace:escape" });
      this.apply();
      App.ui.translationWorkspace?.bind();
    },
  };
})();
