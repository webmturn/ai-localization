// 校对工作区：状态筛选、校对标记和跨页导航，复用现有项目保存与视图 Store。
(function () {
  const hasTranslation = (item) => !!String(item?.targetText || "").trim();
  const currentItems = () => {
    const all = AppState.project?.translationItems || [];
    const file = AppState.translations.selectedFile;
    return file ? all.filter((item) => item.metadata?.file === file) : all;
  };
  const selectedItems = () => {
    const indices = AppState.translations.multiSelected?.length
      ? AppState.translations.multiSelected : [AppState.translations.selected];
    const visible = new Set(AppState.translations.filtered);
    return [...new Set(indices)].map((index) => AppState.project?.translationItems[index]).filter((item) => item && visible.has(item));
  };
  const resetPaginationScroll = (anchorItem) => {
    const scroll = DOMCache.get("translationScrollWrapper");
    if (!scroll) return;
    if (typeof __scrollAnim !== "undefined" && __scrollAnim.raf) {
      cancelAnimationFrame(__scrollAnim.raf);
      __scrollAnim.raf = 0;
    }
    scroll.scrollTop = 0;
    if (!anchorItem) return;
    const expectedPage = AppState.translations.currentPage;
    syncTranslationHeights(() => {
      if (AppState.translations.currentPage !== expectedPage || !AppState.translations.filtered.includes(anchorItem)) return;
      const index = (AppState.project?.translationItems || []).indexOf(anchorItem);
      const container = DOMCache.get(isMobileViewport() ? "mobileCombinedList" : "sourceList");
      const row = container?.querySelector(`.responsive-translation-item[data-index="${index}"]`);
      if (row) scroll.scrollTop = Math.max(0, row.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop - 8);
    });
  };
  const focusItem = (item, editing) => {
    const index = (AppState.project?.translationItems || []).indexOf(item);
    if (index < 0) return false;
    const position = AppState.translations.filtered.indexOf(item);
    if (position < 0) return false;
    const page = Math.floor(position / AppState.translations.itemsPerPage) + 1;
    if (page !== AppState.translations.currentPage) {
      TranslationViewStore.setPage(page);
      updateTranslationLists();
    }
    selectTranslationItem(index, { shouldScroll: true, shouldFocusTextarea: false });
    updateSelectionStyles({ shouldScroll: true, shouldFocusTextarea: false });
    if (editing) {
      const container = DOMCache.get(isMobileViewport() ? "mobileCombinedList" : "targetList");
      const textarea = container?.querySelector(`textarea[data-index="${index}"]`);
      textarea?.focus({ preventScroll: true });
      if (textarea) textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }
    return true;
  };

  App.ui.translationWorkspace = {
    refresh() {
      const items = currentItems();
      const selected = selectedItems();
      const selectedButton = DOMCache.get("translateSelectedBtn");
      const fileButton = DOMCache.get("translateAllBtn");
      const inProgress = typeof BatchProgressStore !== "undefined" && BatchProgressStore.isBatchInProgress();
      if (selectedButton) {
        selectedButton.disabled = !selected.length || inProgress;
        selectedButton.classList.toggle("translation-action-primary", !!selected.length);
        selectedButton.classList.toggle("translation-action-secondary", !selected.length);
        const label = selectedButton.querySelector('[data-role="translation-selection-label"]');
        if (label) label.textContent = selected.length ? `翻译选中 · ${selected.length}` : "翻译选中";
      }
      if (fileButton) {
        fileButton.disabled = !AppState.translations.selectedFile || !items.some((item) => item.status === "pending") || inProgress;
        fileButton.classList.toggle("translation-action-primary", !selected.length);
        fileButton.classList.toggle("translation-action-secondary", !!selected.length);
      }
      const reviewable = selected.filter(hasTranslation);
      const reviewButton = DOMCache.get("reviewSelectedBtn");
      if (reviewButton) {
        reviewButton.disabled = !reviewable.length || inProgress;
        reviewButton.textContent = reviewable.length && reviewable.every((item) => item.status === "approved") ? "取消校对标记" : "标记已校对";
      }
      const counts = { all: items.length, pending: 0, unreviewed: 0, reviewed: 0 };
      items.forEach((item) => counts[!hasTranslation(item) ? "pending" : item.status === "approved" ? "reviewed" : "unreviewed"]++);
      const filter = DOMCache.get("translationStatusFilter");
      if (filter) {
        const labels = { all: "全部条目", pending: "待翻译", unreviewed: "待校对", reviewed: "已校对" };
        for (const option of filter.options) option.textContent = `${labels[option.value]} · ${counts[option.value]}`;
        filter.value = AppState.translations.statusFilter || "all";
      }
      const stats = DOMCache.get("translationSearchCount");
      if (stats) stats.textContent = AppState.translations.filtered.length;
      for (const button of document.querySelectorAll('#targetList [data-action="toggle-reviewed"], #mobileCombinedList [data-action="toggle-reviewed"]')) {
        button.disabled = inProgress || !hasTranslation(AppState.project?.translationItems[Number(button.dataset.index)]);
      }
      this.refreshEngine();
    },
    refreshEngine() {
      const settings = SettingsCache.get() || {};
      const id = settings.translationEngine || settings.defaultEngine || EngineRegistry.getDefaultEngineId();
      const config = EngineRegistry.get(id);
      const model = settings.translationModel || settings.model || config?.defaultModel;
      const label = [config?.name || id, config?.category === "ai" ? model : ""].filter(Boolean).join(" · ");
      const button = DOMCache.get("workspaceEngineSummary");
      if (button) {
        button.querySelector("span").textContent = label;
        button.title = `${label} — 查看翻译引擎设置`;
        button.setAttribute("aria-label", button.title);
      }
    },
    createReviewControls(item, index) {
      const footer = document.createElement("div");
      footer.className = "translation-row-meta";
      const status = document.createElement("span");
      status.className = `translation-status text-xs font-semibold ${getStatusClass(item.status)}`;
      status.textContent = getStatusText(item.status);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "translation-review-toggle";
      button.dataset.action = "toggle-reviewed";
      button.dataset.index = index;
      footer.append(status, button);
      this.refreshReviewControl(footer, item);
      return footer;
    },
    refreshReviewControl(row, item) {
      const button = row.querySelector('[data-action="toggle-reviewed"]');
      if (!button) return;
      const reviewed = item.status === "approved";
      button.disabled = !hasTranslation(item) || (typeof BatchProgressStore !== "undefined" && BatchProgressStore.isBatchInProgress());
      button.textContent = reviewed ? "取消标记" : "标记已校对";
      button.setAttribute("aria-pressed", String(reviewed));
      button.title = reviewed ? "取消已校对标记" : "确认这条译文已经校对";
    },
    setReviewed(items, reviewed) {
      if (typeof BatchProgressStore !== "undefined" && BatchProgressStore.isBatchInProgress()) return;
      const oldFiltered = [...AppState.translations.filtered];
      const position = oldFiltered.indexOf(items[0]);
      let changed = false;
      for (const item of items) {
        if (!hasTranslation(item)) continue;
        const status = reviewed ? "approved" : "edited";
        if (status === item.status) continue;
        item.status = status;
        changed = true;
      }
      if (!changed) return;
      ProjectStore.touchProject();
      autoSaveManager.markDirty();
      applySearchFilter({ preservePage: true });
      TranslationViewStore.setSelection(-1);
      TranslationViewStore.setMultiSelection([]);
      updateTranslationLists();
      // 在待校对筛选中确认后，定位到下一条，保持连续校对。
      const next = items.find((item) => AppState.translations.filtered.includes(item)) || AppState.translations.filtered[Math.max(0, Math.min(position, AppState.translations.filtered.length - 1))];
      if (next) focusItem(next, true);
      this.refresh();
    },
    toggleReviewed(index) {
      const item = AppState.project?.translationItems[index];
      if (item) this.setReviewed([item], item.status !== "approved");
    },
    navigate(index, direction, editing = true) {
      const filtered = AppState.translations.filtered;
      const position = filtered.indexOf(AppState.project?.translationItems[index]);
      const next = filtered[position + direction];
      if (position < 0 || !next) return false;
      return focusItem(next, editing);
    },
    jumpToPage(value) {
      const filtered = AppState.translations.filtered;
      const pageCount = Math.max(1, Math.ceil(filtered.length / AppState.translations.itemsPerPage));
      const input = DOMCache.get("sourcePageInput");
      const reset = () => { if (input) input.value = AppState.translations.currentPage; };
      if (!filtered.length || !/^\d+$/.test(String(value).trim())) { reset(); return false; }
      const page = Math.max(1, Math.min(pageCount, Number(value)));
      if (page === AppState.translations.currentPage) { reset(); return false; }
      const start = (page - 1) * AppState.translations.itemsPerPage;
      const visible = new Set(filtered.slice(start, start + AppState.translations.itemsPerPage));
      const all = AppState.project?.translationItems || [];
      if (!visible.has(all[AppState.translations.selected])) TranslationViewStore.setSelection(-1);
      TranslationViewStore.setMultiSelection((AppState.translations.multiSelected || []).filter((index) => visible.has(all[index])));
      TranslationViewStore.setPage(page);
      updateTranslationLists();
      resetPaginationScroll();
      return true;
    },
    changePageSize(value) {
      const size = Number(value);
      if (![10, 20, 30, 50, 100].includes(size)) return false;
      const filtered = AppState.translations.filtered;
      const selected = AppState.project?.translationItems[AppState.translations.selected];
      const start = (AppState.translations.currentPage - 1) * AppState.translations.itemsPerPage;
      const selectedPosition = filtered.indexOf(selected);
      const anchor = selectedPosition >= start && selectedPosition < start + AppState.translations.itemsPerPage ? selectedPosition : start;
      TranslationViewStore.setItemsPerPage(size);
      const pageCount = Math.max(1, Math.ceil(filtered.length / size));
      TranslationViewStore.setPage(Math.min(pageCount, Math.floor(anchor / size) + 1));
      SettingsCache.update((settings) => { settings.itemsPerPage = size; });
      const preference = DOMCache.get("itemsPerPage");
      if (preference) preference.value = size;
      updateTranslationLists();
      resetPaginationScroll(filtered[anchor]);
      return true;
    },
    bind() {
      const bind = (id, event, action) => {
        const element = DOMCache.get(id);
        if (element) EventManager.add(element, event, action, { tag: "ui", scope: "translationWorkspace", label: `${id}:${event}` });
      };
      bind("translationStatusFilter", "change", (event) => {
        TranslationViewStore.setStatusFilter(event.target.value);
        TranslationViewStore.setSelection(-1);
        TranslationViewStore.setMultiSelection([]);
        applySearchFilter();
        updateTranslationLists();
      });
      bind("reviewSelectedBtn", "click", () => {
        const items = selectedItems().filter(hasTranslation);
        this.setReviewed(items, !items.every((item) => item.status === "approved"));
      });
      bind("workspaceEngineSummary", "click", () => {
        if (window.innerWidth >= 768 && App.ui.workspaceLayout.isProofreading()) {
          App.ui.workspaceLayout.setPanelOpen(true);
          document.querySelector('.sidebar-tab[data-tab="settings"]')?.click();
          DOMCache.get("sidebarTranslationEngine")?.focus();
        } else {
          openModal("settingsModal");
          document.querySelector('.settings-tab-btn[data-tab="engine"]')?.click();
        }
      });
      bind("translationDensity", "change", (event) => applySettings({ translationDensity: event.target.value }));
      bind("paginationPageSize", "change", (event) => this.changePageSize(event.target.value));
      bind("sourcePageInput", "focus", (event) => event.target.select());
      bind("sourcePageInput", "blur", (event) => this.jumpToPage(event.target.value));
      bind("sourcePageInput", "keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.jumpToPage(event.target.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.target.value = AppState.translations.currentPage;
        }
      });
      for (const id of ["targetList", "mobileCombinedList"]) bind(id, "focusout", (event) => {
        if (event.target.tagName !== "TEXTAREA") return;
        requestAnimationFrame(() => {
          if (!AppState.translations.searchQuery && (!AppState.translations.statusFilter || AppState.translations.statusFilter === "all")) return;
          const old = AppState.translations.filtered;
          const active = document.activeElement;
          const index = active?.tagName === "TEXTAREA" && active.closest("#targetList, #mobileCombinedList") ? Number(active.dataset.index) : -1;
          const start = active?.selectionStart;
          const end = active?.selectionEnd;
          applySearchFilter({ preservePage: true });
          const filtered = AppState.translations.filtered;
          if (old.length === filtered.length && old.every((item, i) => item === filtered[i])) return;
          if (!filtered.includes(AppState.project?.translationItems[AppState.translations.selected])) {
            TranslationViewStore.setSelection(-1);
            TranslationViewStore.setMultiSelection([]);
          }
          updateTranslationLists();
          const item = AppState.project?.translationItems[index];
          if (item && focusItem(item, true)) {
            const textarea = document.activeElement;
            textarea.setSelectionRange(start, end);
          }
        });
      });
      this.refresh();
    },
  };
})();
