/**
 * 快捷键：配置表 + 派发，支持设置内自定义并持久化到 localStorage.translatorSettings.keyboardShortcuts
 */
(function () {
  const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  const modName = isMacPlatform ? "meta" : "ctrl";

  const DEFAULT_SHORTCUTS = [
    { id: "openSettings", label: "打开设置", defaultKeys: "ctrl+,", editable: true },
    { id: "newProject", label: "新建项目", defaultKeys: "ctrl+alt+n", editable: true },
    { id: "openProject", label: "打开项目", defaultKeys: "ctrl+o", editable: true },
    { id: "saveProject", label: "保存项目", defaultKeys: "ctrl+s", editable: true },
    { id: "focusSearch", label: "搜索翻译项", defaultKeys: "ctrl+f", editable: true },
    { id: "translateSelected", label: "翻译选中", defaultKeys: "ctrl+enter", editable: true },
    { id: "translateAll", label: "翻译全部", defaultKeys: "shift+enter", editable: true },
    { id: "cancelTranslation", label: "取消翻译（进行中）", defaultKeys: "ctrl+.", editable: true },
    { id: "selectCurrentPage", label: "全选当前页翻译项", defaultKeys: "ctrl+a", editable: true },
    { id: "clearTargets", label: "清除选中项译文", defaultKeys: "ctrl+shift+backspace", editable: true },
    { id: "prevItem", label: "上一条翻译项", defaultKeys: "ctrl+alt+arrowup", editable: true },
    { id: "nextItem", label: "下一条翻译项", defaultKeys: "ctrl+alt+arrowdown", editable: true },
    { id: "prevPage", label: "上一页", defaultKeys: "ctrl+alt+[", editable: true },
    { id: "nextPage", label: "下一页", defaultKeys: "ctrl+alt+]", editable: true },
    { id: "openTerminology", label: "打开术语库", defaultKeys: "ctrl+alt+t", editable: true },
    { id: "runQualityCheck", label: "运行质量检查", defaultKeys: "ctrl+alt+r", editable: true },
    { id: "openQualityReport", label: "打开质量检查报告", defaultKeys: "ctrl+alt+q", editable: true },
    { id: "escape", label: "关闭模态框 / 清空多选", defaultKeys: "escape", editable: false },
  ];

  const KEYBOARD_SHORTCUT_DEFINITIONS = DEFAULT_SHORTCUTS;

  function getSavedShortcuts() {
    try {
      const s = SettingsCache.get();
      return s && typeof s.keyboardShortcuts === "object" ? s.keyboardShortcuts : {};
    } catch (_) {
      return {};
    }
  }

  /** keyString -> id（含 ctrl/meta 双写，便于跨平台匹配） */
  function getEffectiveShortcuts() {
    const saved = getSavedShortcuts();
    const map = {};
    DEFAULT_SHORTCUTS.forEach(function (def) {
      const keyStr = saved[def.id] != null && String(saved[def.id]).trim() !== ""
        ? String(saved[def.id]).trim().toLowerCase()
        : def.defaultKeys.toLowerCase();
      map[keyStr] = def.id;
      if (keyStr.indexOf("ctrl") !== -1) {
        map[keyStr.replace(/\bctrl\b/g, "meta")] = def.id;
      }
      if (keyStr.indexOf("meta") !== -1) {
        map[keyStr.replace(/\bmeta\b/g, "ctrl")] = def.id;
      }
    });
    return map;
  }

  /** id -> keyString（当前生效的按键，供设置页显示） */
  function getEffectiveShortcutKeys() {
    const saved = getSavedShortcuts();
    const out = {};
    DEFAULT_SHORTCUTS.forEach(function (def) {
      const keyStr = saved[def.id] != null && String(saved[def.id]).trim() !== ""
        ? String(saved[def.id]).trim()
        : def.defaultKeys;
      out[def.id] = keyStr;
    });
    return out;
  }

  /** 将 keydown 事件转为规范化 keyString（小写，逗号键为 ","） */
  function eventToKeyString(e) {
    const parts = [];
    if (isMacPlatform ? e.metaKey : e.ctrlKey) parts.push(modName);
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    let key = (e.key || "").toLowerCase();
    if (key === "comma" || key === ",") key = ",";
    else if (key === " ") key = " ";
    parts.push(key);
    return parts.join("+");
  }

  /** 格式化为显示文案（如 Ctrl+Alt+N） */
  function formatKeyDisplay(keyString) {
    if (!keyString || typeof keyString !== "string") return "";
    const s = keyString.trim();
    if (!s) return "";
    return s
      .split("+")
      .map(function (part) {
        const p = part.toLowerCase();
        if (p === "ctrl") return "Ctrl";
        if (p === "meta") return "⌘";
        if (p === "alt") return "Alt";
        if (p === "shift") return "Shift";
        if (p === "escape") return "Esc";
        if (p === ",") return ",";
        if (p === "arrowup") return "↑";
        if (p === "arrowdown") return "↓";
        if (p === "enter") return "Enter";
        if (p === "[") return "[";
        if (p === "]") return "]";
        if (p.length === 1) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" + ");
  }

  function saveShortcutOverride(id, keyString) {
    try {
      const s = SettingsCache.get();
      s.keyboardShortcuts = s.keyboardShortcuts || {};
      s.keyboardShortcuts[id] = keyString;
      SettingsCache.save(s);
    } catch (_) {
      (loggers.app || console).debug("keyboard saveShortcut:", _);
    }
  }

  function resetShortcutToDefault(id) {
    const def = DEFAULT_SHORTCUTS.find(function (d) { return d.id === id; });
    if (!def) return;
    try {
      const s = SettingsCache.get();
      s.keyboardShortcuts = s.keyboardShortcuts || {};
      delete s.keyboardShortcuts[id];
      SettingsCache.save(s);
    } catch (_) {
      (loggers.app || console).debug("keyboard resetShortcut:", _);
    }
  }

  function runAction(id, e) {
    if (id === "escape") {
      const visibleModals = Array.from(
        DOMCache.queryAll(".fixed.inset-0.bg-black.bg-opacity-50"),
      ).filter(function (modal) { return !modal.classList.contains("hidden"); });
      if (visibleModals.length > 0) {
        if (typeof closeModal === "function") closeModal();
      } else if ((AppState && AppState.translations && AppState.translations.multiSelected || []).length > 0) {
        if (typeof clearMultiSelection === "function") clearMultiSelection();
      }
      return;
    }
    if (id === "newProject") {
      if (typeof openModal === "function") {
        openModal("newProjectModal");
      } else {
        const el = DOMCache.get("newProjectModal");
        if (el) el.classList.remove("hidden");
      }
      return;
    }
    if (id === "openProject" && typeof openProject === "function") {
      openProject();
      return;
    }
    if (id === "saveProject" && typeof saveProject === "function") {
      saveProject();
      return;
    }
    if (id === "openSettings") {
      if (typeof openModal === "function") openModal("settingsModal");
      return;
    }
    if (id === "focusSearch") {
      const desktop = DOMCache.get("translationSearchInput");
      const mobile = DOMCache.get("translationSearchInputMobile");
      const searchInput = isMobileViewport() ? (mobile || desktop) : (desktop || mobile);
      if (searchInput) {
        searchInput.focus();
        if (typeof searchInput.select === "function") searchInput.select();
      }
      return;
    }
    if (id === "clearTargets") {
      const target = e && e.target;
      const isEditable = !!(target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"));
      if (!isEditable && typeof clearSelectedTargets === "function") clearSelectedTargets();
      return;
    }
    if (id === "openTerminology") {
      if (typeof openModal === "function") openModal("terminologyModal");
      return;
    }
    if (id === "openQualityReport") {
      if (typeof openModal === "function") openModal("qualityReportModal");
      return;
    }
    if (id === "translateSelected" && typeof translateSelected === "function") {
      translateSelected();
      return;
    }
    if (id === "translateAll" && typeof translateAll === "function") {
      translateAll();
      return;
    }
    if (id === "cancelTranslation" && typeof cancelTranslation === "function") {
      if (AppState && AppState.translations && AppState.translations.isInProgress) cancelTranslation();
      return;
    }
    if (id === "selectCurrentPage" && typeof selectCurrentPageTranslationItems === "function") {
      const target = e && e.target;
      const isEditable = !!(target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"));
      if (!isEditable) selectCurrentPageTranslationItems();
      return;
    }
    if (id === "prevItem" || id === "nextItem") {
      const target = e && e.target;
      const isEditable = !!(target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"));
      if (isEditable) return;
      const all = Array.isArray(AppState && AppState.project && AppState.project.translationItems) ? AppState.project.translationItems : [];
      if (all.length === 0) return;
      const filtered = Array.isArray(AppState && AppState.translations && AppState.translations.filtered) ? AppState.translations.filtered : all;
      const currentIndex = AppState && AppState.translations && AppState.translations.selected;
      const currentItem = Number.isFinite(currentIndex) && currentIndex >= 0 ? all[currentIndex] : null;
      const currentId = currentItem && currentItem.id;
      let pos = -1;
      if (currentId != null) {
        pos = filtered.findIndex(function (it) { return it && String(it.id) === String(currentId); });
      }
      if (pos === -1 && Number.isFinite(currentIndex) && currentIndex >= 0) {
        const byRef = filtered.indexOf(all[currentIndex]);
        if (byRef >= 0) pos = byRef;
      }
      if (pos === -1) pos = 0;
      const nextPos = id === "nextItem" ? Math.min(filtered.length - 1, pos + 1) : Math.max(0, pos - 1);
      const nextItem = filtered[nextPos];
      if (!nextItem) return;
      let nextIndex = all.indexOf(nextItem);
      if (nextIndex === -1 && nextItem.id != null) {
        nextIndex = all.findIndex(function (it) { return it && String(it.id) === String(nextItem.id); });
      }
      if (!Number.isFinite(nextIndex) || nextIndex < 0) return;
      if (typeof selectTranslationItem === "function") {
        selectTranslationItem(nextIndex, { shouldScroll: true, shouldFocusTextarea: false });
      }
      return;
    }
    if (id === "prevPage" && typeof handlePagination === "function") {
      handlePagination("prev");
      return;
    }
    if (id === "nextPage" && typeof handlePagination === "function") {
      handlePagination("next");
      return;
    }
    if (id === "runQualityCheck" && typeof runQualityCheck === "function") {
      const target = e && e.target;
      const isEditable = !!(target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"));
      if (!isEditable) runQualityCheck();
      return;
    }
  }

  /** 聚焦选中项的译文 textarea */
  function _focusSelectedTextarea() {
    var idx = AppState && AppState.translations ? AppState.translations.selected : -1;
    if (!Number.isFinite(idx) || idx < 0) return;
    var isMobile = isMobileViewport();
    var container = isMobile
      ? DOMCache.get("mobileCombinedList")
      : DOMCache.get("targetList");
    if (!container) return;
    var textarea = container.querySelector('textarea[data-index="' + idx + '"]');
    if (textarea) {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    }
  }

  /** 在相邻 textarea 间导航（Tab 支持） */
  function _navigateTextarea(currentIndex, direction) {
    var isMobile = isMobileViewport();
    var container = isMobile
      ? DOMCache.get("mobileCombinedList")
      : DOMCache.get("targetList");
    if (!container) return;
    var textareas = Array.from(DOMCache.queryAll("textarea[data-index]", container));
    var currentPos = textareas.findIndex(function (ta) {
      return parseInt(ta.dataset.index) === currentIndex;
    });
    if (currentPos === -1) return;
    var nextPos = currentPos + direction;
    if (nextPos < 0 || nextPos >= textareas.length) return;
    var nextTextarea = textareas[nextPos];
    var nextIndex = parseInt(nextTextarea.dataset.index);
    if (typeof selectTranslationItem === "function") {
      selectTranslationItem(nextIndex, { shouldScroll: true, shouldFocusTextarea: false });
    }
    nextTextarea.focus();
    nextTextarea.selectionStart = nextTextarea.selectionEnd = nextTextarea.value.length;
  }

  function registerEventListenersKeyboard(ctx) {
    EventManager.add(
      window,
      "keydown",
      function (e) {
        const target = e.target;
        const isEditable = !!(
          target &&
          (target.isContentEditable ||
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT")
        );

        // ── 翻译列表上下文快捷键（优先于全局快捷键） ──

        // 在译文 textarea 中按 Escape → 退出编辑，焦点回到列表
        if (e.key === "Escape" && isEditable && target.tagName === "TEXTAREA") {
          var inTranslationList = !!(target.closest("#targetList") || target.closest("#mobileCombinedList"));
          if (inTranslationList) {
            e.preventDefault();
            e.stopImmediatePropagation();
            target.blur();
            return;
          }
        }

        // 在译文 textarea 中按 Tab / Shift+Tab → 切换到下/上一条 textarea
        if (e.key === "Tab" && isEditable && target.tagName === "TEXTAREA") {
          var inList = !!(target.closest("#targetList") || target.closest("#mobileCombinedList"));
          if (inList && target.dataset.index) {
            e.preventDefault();
            e.stopImmediatePropagation();
            _navigateTextarea(parseInt(target.dataset.index), e.shiftKey ? -1 : 1);
            return;
          }
        }

        // 非编辑状态 + 有选中翻译项时的快捷键
        if (!isEditable && AppState && AppState.translations && AppState.translations.selected >= 0) {
          // ↑/↓ 无修饰键 → 导航翻译项
          if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            runAction(e.key === "ArrowUp" ? "prevItem" : "nextItem", e);
            return;
          }
          // Enter 无修饰键 → 聚焦选中项的 textarea 开始编辑
          if (e.key === "Enter" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            _focusSelectedTextarea();
            return;
          }
        }

        const keyStr = eventToKeyString(e);
        const effective = getEffectiveShortcuts();
        const actionId = effective[keyStr];
        if (actionId) {
          e.preventDefault();
          e.stopImmediatePropagation();
          runAction(actionId, e);
          return;
        }

        if (e.key === "Escape") return;
      },
      { tag: "app", scope: "keyboard", label: "window:keydownHotkeys", capture: true },
    );
  }

  // 创建键盘服务对象
  const keyboardService = {
    KEYBOARD_SHORTCUT_DEFINITIONS,
    getEffectiveShortcutKeys,
    eventToKeyString,
    formatKeyDisplay,
    saveShortcutOverride,
    resetShortcutToDefault,
    registerEventListenersKeyboard
  };

  // 暴露到全局（向后兼容）
  window.KEYBOARD_SHORTCUT_DEFINITIONS = KEYBOARD_SHORTCUT_DEFINITIONS;
  window.getEffectiveShortcutKeys = getEffectiveShortcutKeys;
  window.eventToKeyString = eventToKeyString;
  window.formatKeyDisplay = formatKeyDisplay;
  window.saveShortcutOverride = saveShortcutOverride;
  window.resetShortcutToDefault = resetShortcutToDefault;
  window.registerEventListenersKeyboard = registerEventListenersKeyboard;

  // 尝试注册到DI系统
  if (typeof window.diContainer !== 'undefined') {
    try {
      window.diContainer.registerFactory('keyboardService', () => keyboardService);
    } catch (error) {
      (loggers.app || console).warn('KeyboardService DI注册失败:', error.message);
    }
  }
})();
