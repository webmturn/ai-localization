// ==================== 查找替换功能 ====================
// 从 actions.js 拆分出来的独立模块

function __escapeRegExp(text) {
  return (text || "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function __truncatePreviewText(text, maxLen) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

function __setFindReplacePreviewList(items, limit) {
  const listEl = DOMCache.get("findReplacePreviewList");
  const bodyEl = DOMCache.get("findReplacePreviewListBody");
  const limitEl = DOMCache.get("findReplacePreviewListLimit");

  if (!listEl || !bodyEl || !limitEl) return;

  const safeLimit = typeof limit === "number" ? limit : 0;
  limitEl.textContent = String(safeLimit);

  bodyEl.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    listEl.classList.add("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};

    const row = document.createElement("div");
    row.className = "px-3 py-2";

    const metaLine = document.createElement("div");
    metaLine.className = "text-[11px] text-gray-500 dark:text-gray-400";
    metaLine.textContent = `${it.file || ""}${it.resourceId ? "  ·  " + it.resourceId : ""}`;

    const beforeLine = document.createElement("div");
    beforeLine.className = "mt-1 text-xs text-gray-700 dark:text-gray-200";
    beforeLine.textContent = `原：${it.before || ""}`;

    const afterLine = document.createElement("div");
    afterLine.className = "mt-1 text-xs text-gray-700 dark:text-gray-200";
    afterLine.textContent = `新：${it.after || ""}`;

    row.appendChild(metaLine);
    row.appendChild(beforeLine);
    row.appendChild(afterLine);
    fragment.appendChild(row);
  }

  bodyEl.replaceChildren(fragment);
  listEl.classList.remove("hidden");
}

function __getFindReplaceCandidates(scope) {
  const all = Array.isArray(AppState.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  if (all.length === 0) return [];

  const s = (scope || "file").toString();
  if (s === "project") {
    return all.map((item, idx) => ({ item, idx }));
  }

  const selectedFile = AppState?.translations?.selectedFile;
  if (!selectedFile) {
    return all.map((item, idx) => ({ item, idx }));
  }

  const out = [];
  for (let i = 0; i < all.length; i++) {
    const it = all[i];
    if (!it) continue;
    if (it?.metadata?.file === selectedFile) {
      out.push({ item: it, idx: i });
    }
  }
  return out;
}

function __buildFindReplacePattern(find, useRegex, caseSensitive) {
  const raw = (find || "").toString();
  const isRegex = !!useRegex;
  const flags = `g${caseSensitive ? "" : "i"}`;
  const source = isRegex ? raw : __escapeRegExp(raw);
  return new RegExp(source, flags);
}

function previewFindReplace(options = {}) {
  const silent = !!options.silent;
  const find = DOMCache.get("findReplaceFind")?.value || "";
  const replace = DOMCache.get("findReplaceReplace")?.value || "";
  const scope = DOMCache.get("findReplaceScope")?.value || "file";
  const useRegex = !!DOMCache.get("findReplaceUseRegex")?.checked;
  const caseSensitive =
    !!DOMCache.get("findReplaceCaseSensitive")?.checked;

  const previewEl = DOMCache.get("findReplacePreviewCount");
  if (!previewEl) return 0;

  const appState = getServiceSafely('appState', 'AppState');
    
  if (!appState?.project || !Array.isArray(appState.project.translationItems)) {
    previewEl.textContent = "0";
    __setFindReplacePreviewList([], 0);
    if (!silent) {
      // 使用验证器
      if (typeof TranslationValidators !== 'undefined') {
        const errorManager = getServiceSafely('errorManager', 'errorManager');
        if (errorManager) {
          errorManager.handleError(new Error('请先上传文件或打开项目'), { context: 'previewFindReplace' });
        } else {
          showNotification("warning", "无项目", "请先上传文件或打开项目");
        }
      } else {
        showNotification("warning", "无项目", "请先上传文件或打开项目");
      }
    }
    return 0;
  }

  const trimmed = find.toString();
  if (!trimmed) {
    previewEl.textContent = "0";
    __setFindReplacePreviewList([], 0);
    return 0;
  }

  let regex;
  try {
    regex = __buildFindReplacePattern(trimmed, useRegex, caseSensitive);
  } catch (e) {
    previewEl.textContent = "0";
    __setFindReplacePreviewList([], 0);
    if (!silent) {
      showNotification("error", "正则错误", e?.message || "正则表达式无效");
    }
    return 0;
  }

  const candidates = __getFindReplaceCandidates(scope);
  let matches = 0;

  const previewLimit = 30;
  const previewItems = [];

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i]?.item;
    if (!item) continue;
    const text = (item.targetText || "").toString();
    if (!text) continue;
    try {
      regex.lastIndex = 0;
    } catch (_) { /* regex.lastIndex reset - safe to ignore */ }
    const m = text.match(regex);
    if (m && m.length) {
      matches += m.length;

      if (previewItems.length < previewLimit) {
        let after = "";
        try {
          regex.lastIndex = 0;
        } catch (_) { /* regex.lastIndex reset - safe to ignore */ }
        after = text.replace(regex, replace);

        const meta = item.metadata || {};
        previewItems.push({
          file: (meta.file || "").toString(),
          resourceId: (meta.resourceId || "").toString(),
          before: __truncatePreviewText(text, 80),
          after: __truncatePreviewText(after, 80),
        });
      }
    }
  }

  previewEl.textContent = String(matches);
  __setFindReplacePreviewList(previewItems, previewItems.length);
  return matches;
}

function applyFindReplace() {
  const find = DOMCache.get("findReplaceFind")?.value || "";
  const replace = DOMCache.get("findReplaceReplace")?.value || "";
  const scope = DOMCache.get("findReplaceScope")?.value || "file";
  const useRegex = !!DOMCache.get("findReplaceUseRegex")?.checked;
  const caseSensitive =
    !!DOMCache.get("findReplaceCaseSensitive")?.checked;

  const appState = getServiceSafely('appState', 'AppState');
    
  if (!appState?.project || !Array.isArray(appState.project.translationItems)) {
    // 使用验证器
    if (typeof TranslationValidators !== 'undefined') {
      const errorManager = getServiceSafely('errorManager', 'errorManager');
      if (errorManager) {
        errorManager.handleError(new Error('请先上传文件或打开项目'), { context: 'applyFindReplace' });
      } else {
        showNotification("warning", "无项目", "请先上传文件或打开项目");
      }
    } else {
      showNotification("warning", "无项目", "请先上传文件或打开项目");
    }
    return;
  }

  const trimmed = find.toString();
  if (!trimmed) {
    showNotification("warning", "缺少查找内容", "请输入要查找的文本");
    return;
  }

  let regex;
  try {
    regex = __buildFindReplacePattern(trimmed, useRegex, caseSensitive);
  } catch (e) {
    showNotification("error", "正则错误", e?.message || "正则表达式无效");
    return;
  }

  const candidates = __getFindReplaceCandidates(scope);
  let replacedOccurrences = 0;
  let affectedItems = 0;

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i]?.item;
    const idx = candidates[i]?.idx;
    if (!item || typeof idx !== "number") continue;

    const before = (item.targetText || "").toString();
    if (!before) continue;

    try {
      regex.lastIndex = 0;
    } catch (_) { /* regex.lastIndex reset - safe to ignore */ }

    let changed = false;
    const after = before.replace(regex, () => {
      changed = true;
      replacedOccurrences++;
      return replace;
    });

    if (!changed) continue;

    item.targetText = after;
    item.qualityScore = 0;
    if (after && after.trim()) {
      item.status = "edited";
    } else {
      item.status = "pending";
    }
    affectedItems++;
  }

  const previewEl = DOMCache.get("findReplacePreviewCount");
  if (previewEl) previewEl.textContent = String(replacedOccurrences);

  if (replacedOccurrences === 0) {
    showNotification("info", "未匹配", "没有找到可替换的内容");
    return;
  }

  appState.project.updatedAt = new Date();
  appState.translations.items = appState.project.translationItems;
  
  const autoSave = getServiceSafely('autoSaveManager', 'autoSaveManager');
  if (autoSave) {
    autoSave.markDirty();
  }
  if (typeof invalidateSearchCache === "function") invalidateSearchCache();

  // 使用统一的UI更新器
  if (typeof updateTranslationUI === 'function') {
    updateTranslationUI({ reason: "查找替换完成" });
  } else {
    rebuildFilteredTranslationItems();
    updateTranslationLists();
    updateCounters();
    updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
  }

  showNotification(
    "success",
    "替换完成",
    `已替换 ${replacedOccurrences} 处，影响 ${affectedItems} 项`
  );
  closeModal("findReplaceModal");
}

try {
  if (typeof window !== "undefined") {
    window.previewFindReplace = previewFindReplace;
    window.applyFindReplace = applyFindReplace;
  }
} catch (_) {
  (loggers.app || console).debug("find-replace module init:", _);
}
