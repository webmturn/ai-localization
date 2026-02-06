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
      const raw = localStorage.getItem("translatorSettings");
      if (!raw) return {};
      const s = JSON.parse(raw);
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
      const raw = localStorage.getItem("translatorSettings");
      const s = raw ? JSON.parse(raw) : {};
      s.keyboardShortcuts = s.keyboardShortcuts || {};
      s.keyboardShortcuts[id] = keyString;
      localStorage.setItem("translatorSettings", JSON.stringify(s));
    } catch (_) {}
  }

  function resetShortcutToDefault(id) {
    const def = DEFAULT_SHORTCUTS.find(function (d) { return d.id === id; });
    if (!def) return;
    try {
      const raw = localStorage.getItem("translatorSettings");
      const s = raw ? JSON.parse(raw) : {};
      s.keyboardShortcuts = s.keyboardShortcuts || {};
      delete s.keyboardShortcuts[id];
      localStorage.setItem("translatorSettings", JSON.stringify(s));
    } catch (_) {}
  }

  function runAction(id, e) {
    if (id === "escape") {
      const visibleModals = Array.from(
        document.querySelectorAll(".fixed.inset-0.bg-black.bg-opacity-50"),
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
        const el = document.getElementById("newProjectModal");
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
      const desktop = document.getElementById("translationSearchInput");
      const mobile = document.getElementById("translationSearchInputMobile");
      const searchInput = window.innerWidth < 768 ? (mobile || desktop) : (desktop || mobile);
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
      console.warn('KeyboardService DI注册失败:', error.message);
    }
  }
})();
