function rebuildFilteredTranslationItems(options = {}) {
  const all = Array.isArray(AppState.project?.translationItems)
    ? AppState.project.translationItems
    : [];

  const selectedFile =
    options && Object.prototype.hasOwnProperty.call(options, "selectedFile")
      ? options.selectedFile
      : AppState?.translations?.selectedFile;

  let base = selectedFile
    ? all.filter((item) => item?.metadata?.file === selectedFile)
    : all;

  const searchQuery = (AppState?.translations?.searchQuery || "")
    .toString()
    .toLowerCase()
    .trim();

  if (searchQuery) {
    base = base.filter((item) => {
      if (!item) return false;
      const sourceText = (item.sourceText || "").toLowerCase();
      const targetText = (item.targetText || "").toLowerCase();
      const context = (item.context || "").toLowerCase();
      const resourceId = ((item.metadata || {}).resourceId || "").toLowerCase();
      return (
        sourceText.includes(searchQuery) ||
        targetText.includes(searchQuery) ||
        context.includes(searchQuery) ||
        resourceId.includes(searchQuery)
      );
    });
  }

  AppState.translations.filtered = [...base];
}

function formatTranslationError(errorLike, engine) {
  const rawMessage =
    (errorLike && typeof errorLike === "object" && "message" in errorLike
      ? errorLike.message
      : null) ||
    (errorLike && typeof errorLike === "object" && "error" in errorLike
      ? errorLike.error
      : null) ||
    String(errorLike || "");

  const message = (rawMessage || "").toString();
  const msgLower = message.toLowerCase();

  const status =
    (errorLike && typeof errorLike === "object" && errorLike.status) || null;
  const code =
    (errorLike && typeof errorLike === "object" && errorLike.code) || null;

  const normalizedEngine = (engine || "").toString().toLowerCase();
  const engineLabel =
    normalizedEngine === "openai"
      ? "OpenAI"
      : normalizedEngine === "deepseek"
        ? "DeepSeek"
        : normalizedEngine === "google"
          ? "Google"
          : (engine || "").toString().toUpperCase();

  const isAuthMessage =
    msgLower.includes("api密钥") ||
    msgLower.includes("invalid api key") ||
    msgLower.includes("unauthorized") ||
    msgLower.includes("authentication") ||
    msgLower.includes("forbidden") ||
    msgLower.includes("permission") ||
    msgLower.includes("401") ||
    msgLower.includes("403");

  if (code === "USER_CANCELLED" || message === "用户取消") {
    return {
      type: "info",
      title: "翻译已取消",
      message: "翻译过程已被用户取消",
      detail: message || "用户取消",
    };
  }

  if (code === "TIMEOUT" || msgLower.includes("请求超时") || msgLower.includes("timeout")) {
    return {
      type: "error",
      title: "请求超时",
      message: `请求 ${engineLabel} 超时。请检查网络后重试，或在设置中调大“超时(秒)”。`,
      detail: message,
    };
  }

  if (
    msgLower.includes("failed to fetch") ||
    msgLower.includes("networkerror") ||
    msgLower.includes("load failed") ||
    msgLower.includes("fetch") && msgLower.includes("error")
  ) {
    return {
      type: "error",
      title: "网络请求失败",
      message: `无法连接到 ${engineLabel} 服务。可能原因：网络不可用、代理/防火墙拦截、浏览器跨域限制。请检查网络后重试。`,
      detail: message,
    };
  }

  if (message.includes("API密钥未配置")) {
    return {
      type: "error",
      title: "API密钥未配置",
      message: `请在设置中配置 ${engineLabel} API密钥后重试`,
      detail: message,
    };
  }

  if (message.includes("API密钥格式不正确")) {
    return {
      type: "error",
      title: "API密钥格式不正确",
      message: `当前 ${engineLabel} API密钥格式不正确，请在设置中更新后重试`,
      detail: message,
    };
  }

  if (status === 401 || status === 403 || (isAuthMessage && (status === null || status === undefined))) {
    return {
      type: "error",
      title: "鉴权失败",
      message: `访问 ${engineLabel} 被拒绝（${status || "401/403"}）。请检查 API Key 是否正确、是否过期、以及是否有权限访问所选模型。`,
      detail: message,
    };
  }

  if (status === 429 || msgLower.includes("rate limit") || msgLower.includes("too many requests")) {
    return {
      type: "warning",
      title: "请求过于频繁",
      message: `触发 ${engineLabel} 限流（429）。请稍后重试，或在设置中降低并发/批处理大小。`,
      detail: message,
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      type: "error",
      title: "服务异常",
      message: `${engineLabel} 服务暂时不可用（${status}）。请稍后重试。`,
      detail: message,
    };
  }

  return {
    type: "error",
    title: "翻译失败",
    message: message || "未知错误",
    detail: message || "未知错误",
  };
}

function __truncateForNotification(text, maxLen) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

function showSplitNotification(type, title, message, detail) {
  const msg = (message || "").toString();
  const det = (detail || "").toString();

  const shortMsg = __truncateForNotification(msg, 90);
  showNotification(type, title, shortMsg);

  const shouldShowDetail = det && det.trim() && det.trim() !== msg.trim();
  const isLong = msg.length > 90 || det.length > 0;
  if (shouldShowDetail || isLong) {
    const detailText = __truncateForNotification(det || msg, 220);
    showNotification("info", "详细信息", detailText);
  }
}

function __escapeRegExp(text) {
  return (text || "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function __truncatePreviewText(text, maxLen) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

function __setFindReplacePreviewList(items, limit) {
  const listEl = document.getElementById("findReplacePreviewList");
  const bodyEl = document.getElementById("findReplacePreviewListBody");
  const limitEl = document.getElementById("findReplacePreviewListLimit");

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
  const find = document.getElementById("findReplaceFind")?.value || "";
  const replace = document.getElementById("findReplaceReplace")?.value || "";
  const scope = document.getElementById("findReplaceScope")?.value || "file";
  const useRegex = !!document.getElementById("findReplaceUseRegex")?.checked;
  const caseSensitive =
    !!document.getElementById("findReplaceCaseSensitive")?.checked;

  const previewEl = document.getElementById("findReplacePreviewCount");
  if (!previewEl) return 0;

  if (!AppState.project || !Array.isArray(AppState.project.translationItems)) {
    previewEl.textContent = "0";
    __setFindReplacePreviewList([], 0);
    if (!silent) {
      showNotification("warning", "无项目", "请先上传文件或打开项目");
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
    } catch (_) {}
    const m = text.match(regex);
    if (m && m.length) {
      matches += m.length;

      if (previewItems.length < previewLimit) {
        let after = "";
        try {
          regex.lastIndex = 0;
        } catch (_) {}
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
  const find = document.getElementById("findReplaceFind")?.value || "";
  const replace = document.getElementById("findReplaceReplace")?.value || "";
  const scope = document.getElementById("findReplaceScope")?.value || "file";
  const useRegex = !!document.getElementById("findReplaceUseRegex")?.checked;
  const caseSensitive =
    !!document.getElementById("findReplaceCaseSensitive")?.checked;

  if (!AppState.project || !Array.isArray(AppState.project.translationItems)) {
    showNotification("warning", "无项目", "请先上传文件或打开项目");
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
    } catch (_) {}

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

  const previewEl = document.getElementById("findReplacePreviewCount");
  if (previewEl) previewEl.textContent = String(replacedOccurrences);

  if (replacedOccurrences === 0) {
    showNotification("info", "未匹配", "没有找到可替换的内容");
    return;
  }

  AppState.project.updatedAt = new Date();
  AppState.translations.items = AppState.project.translationItems;
  autoSaveManager.markDirty();

  rebuildFilteredTranslationItems();
  updateTranslationLists();
  updateCounters();
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });

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
} catch (_) {}

function clearSelectedTargets() {
  if (AppState.translations.selected === -1 || !AppState.project) {
    showNotification("warning", "未选择项", "请先选择要清除译文的项");
    return;
  }

  const selectedIndices =
    (AppState.translations.multiSelected || []).length > 0
      ? Array.from(new Set(AppState.translations.multiSelected)).sort(
          (a, b) => a - b,
        )
      : [AppState.translations.selected];

  let cleared = 0;
  for (const idx of selectedIndices) {
    const item = AppState.project.translationItems?.[idx];
    if (!item) continue;
    item.qualityScore = 0;
    updateTranslationItem(idx, "");
    cleared++;
  }

  if (cleared > 0) {
    autoSaveManager.markDirty();
  }

  rebuildFilteredTranslationItems();

  updateTranslationLists();
  updateCounters();
  updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });

  if (selectedIndices.length > 1) {
    showNotification("success", "清除完成", `已清除 ${cleared} 项译文`);
  } else {
    showNotification("success", "清除完成", "已清除选中项译文");
  }
}

// 翻译选中项
async function translateSelected() {
  if (AppState.translations.selected === -1 || !AppState.project) {
    showNotification("warning", "未选择项", "请先选择要翻译的项");
    return;
  }

  const selectedIndices =
    (AppState.translations.multiSelected || []).length > 0
      ? Array.from(new Set(AppState.translations.multiSelected)).sort(
          (a, b) => a - b,
        )
      : [AppState.translations.selected];
  const selectedItems = selectedIndices
    .map((idx) => AppState.project.translationItems?.[idx])
    .filter(Boolean);

  if (selectedItems.length === 0) {
    showNotification("warning", "未选择项", "请先选择要翻译的项");
    return;
  }

  showTranslationProgress();
  updateProgress(0, selectedItems.length, "准备翻译...");

  const sourceLang = AppState.project.sourceLanguage || "en";
  const targetLang = AppState.project.targetLanguage || "zh";

  const settings = safeJsonParse(
    localStorage.getItem("translatorSettings"),
    {},
  );
  const engine =
    settings.translationEngine ||
    settings.defaultEngine ||
    document.getElementById("translationEngine")?.value ||
    "deepseek";

  AppState.translations.isInProgress = true;
  AppState.translations.isPaused = false;
  AppState.translations.lastFailedItems = [];
  AppState.translations.lastBatchContext = {
    scope: "selected",
    sourceLang,
    targetLang,
    engine,
    selectedFile: AppState?.translations?.selectedFile || null,
  };
  updateTranslationControlState();

  let translationCount = 0;
  const batchUpdateInterval = 20;
  const updateUIIfNeeded = () => {
    translationCount++;
    if (translationCount % batchUpdateInterval === 0) {
      rebuildFilteredTranslationItems();
      updateTranslationLists();
      updateCounters();
    }
  };

  try {
    const { results, errors } = await translationService.translateBatch(
      selectedItems,
      sourceLang,
      targetLang,
      engine,
      (completed, total, message) => {
        updateProgress(completed, total, message);
        updateUIIfNeeded();
      },
    );

    hideTranslationProgress();

    const actualErrors = errors.filter((e) => e.error !== "用户取消");
    const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
    AppState.translations.lastFailedItems = actualErrors
      .map((e) => e?.item)
      .filter(Boolean);

    if (!AppState.translations.isInProgress && cancelledCount > 0) {
      showNotification(
        "info",
        "翻译已取消",
        `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`,
      );
    } else if (actualErrors.length === 0) {
      showNotification(
        "success",
        "翻译完成",
        `已成功翻译 ${results.length} 项`,
      );
    } else {
      const firstErr = actualErrors[0];
      const f = formatTranslationError(firstErr, engine);
      showNotification(
        "warning",
        "翻译部分完成",
        `成功 ${results.length} 项，失败 ${actualErrors.length} 项`,
      );
      showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
    }

    autoSaveManager.markDirty();

    rebuildFilteredTranslationItems();

    updateTranslationLists();
    updateCounters();
    updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
  } catch (error) {
    hideTranslationProgress();
    if (!error?.__notified) {
      const f = formatTranslationError(error, engine);
      showSplitNotification(f.type, f.title, f.message, f.detail);
    }
    AppState.translations.lastFailedItems = [...selectedItems];
  } finally {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    updateTranslationControlState();
  }
}

// 翻译所有项
async function translateAll() {
  if (!AppState.project || !AppState.project.translationItems.length) {
    showNotification("warning", "无翻译项", "请先上传文件");
    return;
  }

  const selectedFile = AppState?.translations?.selectedFile;
  if (!selectedFile) {
    showNotification(
      "warning",
      "未选择文件",
      "请先在左侧文件列表选择要翻译的文件",
    );
    return;
  }

  // 获取待翻译的项
  const pendingItems = AppState.project.translationItems
    .filter((item) => item?.metadata?.file === selectedFile)
    .filter((item) => item.status === "pending");

  if (pendingItems.length === 0) {
    showNotification("info", "无需翻译", "所有项都已翻译完成");
    return;
  }

  // 显示翻译进度模态框
  showTranslationProgress();

  // 设置进度初始值
  updateProgress(0, pendingItems.length, "准备翻译...");

  // 获取语言设置
  const sourceLang = AppState.project.sourceLanguage || "en";
  const targetLang = AppState.project.targetLanguage || "zh";

  // 获取翻译引擎
  const settings = safeJsonParse(
    localStorage.getItem("translatorSettings"),
    {},
  );
  const engine =
    settings.translationEngine ||
    settings.defaultEngine ||
    document.getElementById("translationEngine")?.value ||
    "deepseek";

  // 开始批量翻译
  AppState.translations.isInProgress = true;
  AppState.translations.isPaused = false;
  AppState.translations.lastFailedItems = [];
  AppState.translations.lastBatchContext = {
    scope: "file",
    sourceLang,
    targetLang,
    engine,
    selectedFile: selectedFile || null,
  };
  updateTranslationControlState();

  // 批量翻译时禁用UI更新，只在结束时更新一次
  let translationCount = 0;
  const batchUpdateInterval = 20; // 每20条更新一次UI

  const updateUIIfNeeded = () => {
    translationCount++;
    // 每20条更新一次UI，提供适度的视觉反馈
    if (translationCount % batchUpdateInterval === 0) {
      console.log(`批量更新UI: 已翻译 ${translationCount} 条`);
      rebuildFilteredTranslationItems({ selectedFile });
      updateTranslationLists();
      updateCounters();
    }
  };

  try {
    // 调用批量翻译
    const { results, errors } = await translationService.translateBatch(
      pendingItems,
      sourceLang,
      targetLang,
      engine,
      // 进度回调函数
      (completed, total, message) => {
        updateProgress(completed, total, message);
        // 每20条更新一次UI，而不是每条都更新
        updateUIIfNeeded();
      },
    );

    // 翻译完成或取消
    hideTranslationProgress();

    // 统计实际错误（排除用户取消）
    const actualErrors = errors.filter((e) => e.error !== "用户取消");
    const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
    AppState.translations.lastFailedItems = actualErrors
      .map((e) => e?.item)
      .filter(Boolean);

    if (!AppState.translations.isInProgress && cancelledCount > 0) {
      // 用户取消
      showNotification(
        "info",
        "翻译已取消",
        `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`,
      );
    } else if (actualErrors.length === 0) {
      // 全部成功
      showNotification(
        "success",
        "翻译完成",
        `已成功翻译 ${results.length} 项`,
      );
    } else {
      // 部分失败
      const firstErr = actualErrors[0];
      const f = formatTranslationError(firstErr, engine);
      showNotification(
        "warning",
        "翻译部分完成",
        `成功 ${results.length} 项，失败 ${actualErrors.length} 项`,
      );
      showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
    }

    // 标记为已修改，触发自动保存
    autoSaveManager.markDirty();

    // 翻译完成后执行最后一次完整更新
    console.log("批量翻译完成，执行最后更新...");
    rebuildFilteredTranslationItems({ selectedFile });
    updateTranslationLists();
    updateCounters();
  } catch (error) {
    hideTranslationProgress();
    const f = formatTranslationError(error, engine);
    showSplitNotification(f.type, f.title, f.message, f.detail);
    console.error("批量翻译错误:", error);
    AppState.translations.lastFailedItems = [...pendingItems];
  } finally {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    updateTranslationControlState();
  }
}

// 取消翻译
function cancelTranslation() {
  AppState.translations.isInProgress = false;
  AppState.translations.isPaused = false;

  // 取消所有活动的网络请求
  networkUtils.cancelAll();

  hideTranslationProgress();
  updateTranslationControlState();
  showNotification("info", "翻译已取消", "翻译过程已被用户取消");
}

function pauseTranslation() {
  if (!AppState.translations.isInProgress) {
    showNotification("info", "无进行中的任务", "当前没有可暂停的翻译任务");
    return;
  }
  if (AppState.translations.isPaused) return;
  AppState.translations.isPaused = true;
  updateTranslationControlState();
  const { current, total } = AppState.translations.progress || {};
  updateProgress(current || 0, total || 0, "暂停中（等待当前请求完成）");
  addProgressLog({
    level: "warn",
    message: "已发送暂停请求，将在当前请求完成后暂停。",
  });
}

function resumeTranslation() {
  if (!AppState.translations.isInProgress) {
    showNotification("info", "无进行中的任务", "当前没有可继续的翻译任务");
    return;
  }
  if (!AppState.translations.isPaused) return;
  AppState.translations.isPaused = false;
  updateTranslationControlState();
  const { current, total } = AppState.translations.progress || {};
  updateProgress(current || 0, total || 0, "继续翻译...");
  addProgressLog({ level: "info", message: "继续翻译" });
}

async function retryFailedTranslations() {
  if (AppState.translations.isInProgress) {
    showNotification("warning", "任务进行中", "请先等待当前翻译任务完成");
    return;
  }

  const failedItems = Array.isArray(AppState.translations.lastFailedItems)
    ? AppState.translations.lastFailedItems.filter(Boolean)
    : [];
  if (failedItems.length === 0) {
    showNotification("info", "无失败项", "暂无可重试的翻译项");
    return;
  }

  const ctx = AppState.translations.lastBatchContext || {};
  const sourceLang = ctx.sourceLang || AppState.project?.sourceLanguage || "en";
  const targetLang = ctx.targetLang || AppState.project?.targetLanguage || "zh";
  const engine =
    ctx.engine ||
    document.getElementById("translationEngine")?.value ||
    "deepseek";
  const selectedFile = ctx.selectedFile || AppState?.translations?.selectedFile;

  showTranslationProgress();
  updateProgress(0, failedItems.length, "准备重试...");

  AppState.translations.isInProgress = true;
  AppState.translations.isPaused = false;
  updateTranslationControlState();

  let translationCount = 0;
  const batchUpdateInterval = 20;
  const updateUIIfNeeded = () => {
    translationCount++;
    if (translationCount % batchUpdateInterval === 0) {
      if (selectedFile) {
        rebuildFilteredTranslationItems({ selectedFile });
      } else {
        rebuildFilteredTranslationItems();
      }
      updateTranslationLists();
      updateCounters();
    }
  };

  try {
    const { results, errors } = await translationService.translateBatch(
      failedItems,
      sourceLang,
      targetLang,
      engine,
      (completed, total, message) => {
        updateProgress(completed, total, message);
        updateUIIfNeeded();
      },
    );

    hideTranslationProgress();

    const actualErrors = errors.filter((e) => e.error !== "用户取消");
    const cancelledCount = errors.filter((e) => e.error === "用户取消").length;
    AppState.translations.lastFailedItems = actualErrors
      .map((e) => e?.item)
      .filter(Boolean);

    if (!AppState.translations.isInProgress && cancelledCount > 0) {
      showNotification(
        "info",
        "翻译已取消",
        `已翻译 ${results.length} 项，取消 ${cancelledCount} 项`
      );
    } else if (actualErrors.length === 0) {
      showNotification(
        "success",
        "重试完成",
        `已成功翻译 ${results.length} 项`
      );
    } else {
      const firstErr = actualErrors[0];
      const f = formatTranslationError(firstErr, engine);
      showNotification(
        "warning",
        "重试部分完成",
        `成功 ${results.length} 项，失败 ${actualErrors.length} 项`
      );
      showSplitNotification("warning", `失败原因：${f.title}`, f.message, f.detail);
    }

    autoSaveManager.markDirty();
    if (selectedFile) {
      rebuildFilteredTranslationItems({ selectedFile });
    } else {
      rebuildFilteredTranslationItems();
    }
    updateTranslationLists();
    updateCounters();
    updateSelectionStyles({ shouldScroll: false, shouldFocusTextarea: false });
  } catch (error) {
    hideTranslationProgress();
    const f = formatTranslationError(error, engine);
    showSplitNotification(f.type, f.title, f.message, f.detail);
    console.error("重试翻译错误:", error);
  } finally {
    AppState.translations.isInProgress = false;
    AppState.translations.isPaused = false;
    updateTranslationControlState();
  }
}

// 显示翻译进度模态框
function showTranslationProgress() {
  document
    .getElementById("translationProgressModal")
    .classList.remove("hidden");
  document.getElementById("progressBar").style.width = "0%";
  document.getElementById("progressPercentage").textContent = "0%";
  document.getElementById("progressStatus").textContent = "准备翻译...";
  const log = document.getElementById("progressLog");
  if (log) log.replaceChildren();
  updateTranslationControlState();
}

// 隐藏翻译进度模态框
function hideTranslationProgress() {
  document.getElementById("translationProgressModal").classList.add("hidden");
}

function updateTranslationControlState() {
  const pauseBtn = document.getElementById("pauseTranslationBtn");
  const resumeBtn = document.getElementById("resumeTranslationBtn");
  const retryBtn = document.getElementById("retryFailedTranslationBtn");
  const isInProgress = !!AppState.translations.isInProgress;
  const isPaused = !!AppState.translations.isPaused;
  const hasFailed =
    Array.isArray(AppState.translations.lastFailedItems) &&
    AppState.translations.lastFailedItems.length > 0;

  const setState = (btn, enabled) => {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("opacity-50", !enabled);
    btn.classList.toggle("cursor-not-allowed", !enabled);
  };

  setState(pauseBtn, isInProgress && !isPaused);
  setState(resumeBtn, isInProgress && isPaused);
  setState(retryBtn, !isInProgress && hasFailed);
}

// 更新进度
function updateProgress(current, total, status) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  AppState.translations.progress = {
    current: safeCurrent,
    total: safeTotal,
    status: status || "",
  };
  const percentage = safeTotal > 0 ? Math.floor((safeCurrent / safeTotal) * 100) : 0;
  document.getElementById("progressBar").style.width = `${percentage}%`;
  document.getElementById("progressPercentage").textContent = `${percentage}%`;
  document.getElementById("progressStatus").textContent = status;
  updateTranslationControlState();
}

// 添加进度日志
function addProgressLog(message) {
  const log = document.getElementById("progressLog");
  if (!log) return;

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ts = `${hh}:${mm}:${ss}`;

  const items = Array.isArray(message) ? message : [message];
  const frag = document.createDocumentFragment();

  for (const it of items) {
    let level = "info";
    let text = "";

    if (it && typeof it === "object" && !Array.isArray(it)) {
      level = (it.level || it.type || "info").toString().toLowerCase();
      text =
        it.message !== undefined
          ? String(it.message)
          : it.text !== undefined
            ? String(it.text)
            : JSON.stringify(it);
    } else {
      text = String(it);
    }

    const li = document.createElement("li");
    li.className = `slide-in log-${level}`;
    li.textContent = `[${ts}] ${text}`;
    frag.appendChild(li);
  }

  log.appendChild(frag);

  const maxLines = 500;
  while (log.children.length > maxLines) {
    log.removeChild(log.firstChild);
  }

  log.scrollTop = log.scrollHeight;
}

// 翻译功能（使用真实API）
async function translateText(
  text,
  sourceLang = "en",
  targetLang = "zh",
  context = null,
) {
  if (!text || !text.trim()) {
    return text;
  }

  let engine = "deepseek";
  try {
    // 获取翻译引擎
    const settings = safeJsonParse(
      localStorage.getItem("translatorSettings"),
      {},
    );
    engine = (
      settings.translationEngine ||
      settings.defaultEngine ||
      document.getElementById("translationEngine")?.value ||
      "deepseek"
    ).toLowerCase();

    // 调用翻译服务（传递上下文）
    const translated = await translationService.translate(
      text,
      sourceLang,
      targetLang,
      engine,
      context,
    );
    return translated;
  } catch (error) {
    console.error("翻译失败:", error);

    const f = formatTranslationError(error, engine);
    showSplitNotification(f.type, f.title, f.message, f.detail);

    error.__notified = true;
    throw error;
  }
}

// 备用的模拟翻译功能（仅用于演示）
function mockTranslate(text) {
  // 简单的模拟翻译，当API调用失败时使用
  const translations = {
    "Welcome to our application": "欢迎使用我们的应用",
    "Please login to continue": "请登录以继续",
    "The API endpoint requires authentication.": "API端点需要身份验证。",
    "Please refer to the documentation for more details.":
      "请参考文档以获取更多详细信息。",
    "You have successfully updated your profile.": "您已成功更新个人资料。",
    "Please enter a valid email address.": "请输入有效的电子邮件地址。",
    "Hello, world!": "你好，世界！",
    "This is a sample XML file for demonstration purposes.":
      "这是一个用于演示目的的示例XML文件。",
    "This is a sample JSON file.": "这是一个示例JSON文件。",
    "Sample text from": "来自的示例文本",
  };

  // 检查是否有预定义的翻译
  for (const [key, value] of Object.entries(translations)) {
    if (text.includes(key)) {
      return text.replace(key, value);
    }
  }

  // 如果没有预定义的翻译，返回带有标记的原文
  return `[翻译] ${text}`;
}

// 导出翻译
