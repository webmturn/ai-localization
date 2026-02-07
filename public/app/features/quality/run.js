let __qualityIsChecking = false;

async function __mapWithConcurrencyImpl(items, mapper, concurrency) {
  const list = Array.isArray(items) ? items : [];
  const n = Math.max(1, Math.floor(Number(concurrency) || 1));
  const workerCount = Math.min(n, list.length);
  const results = new Array(list.length);
  let nextIndex = 0;
  let processed = 0;
  const yieldEvery = 20;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= list.length) return;
      results[i] = await mapper(list[i], i);

      processed++;
      if (processed % yieldEvery === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  const workers = [];
  for (let i = 0; i < workerCount; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function __runQualityCheckImpl() {
  if (__qualityIsChecking) {
    showNotification("warning", "检查中", "质量检查正在进行中，请稍候");
    return;
  }

  if (!AppState.project) {
    showNotification("warning", "无项目", "请先创建或打开项目");
    return;
  }

  const allItems =
    (Array.isArray(AppState.translations?.items) &&
      AppState.translations.items) ||
    (Array.isArray(AppState.project.translationItems) &&
      AppState.project.translationItems) ||
    [];

  let checkScope = AppState?.quality?.checkScope;
  if (!checkScope) {
    try {
      const s = SettingsCache.get();
      checkScope = s.qualityCheckScope;
    } catch (_) {
      (loggers.app || console).debug("qualityCheck readScope:", _);
    }
  }
  if (checkScope !== "file" && checkScope !== "project") {
    checkScope = "project";
  }

  let items = allItems;
  let scopeFileName = null;
  if (checkScope === "file") {
    const selectedFile = AppState?.translations?.selectedFile;
    if (!selectedFile) {
      showNotification(
        "warning",
        "未选择文件",
        "请先在左侧文件列表选择要检查的文件"
      );
      return;
    }
    scopeFileName = selectedFile;
    items = allItems.filter((item) => item?.metadata?.file === selectedFile);
  }

  if (items.length === 0) {
    showNotification("warning", "无数据", "请先加载项目或添加翻译项");
    return;
  }

  __qualityIsChecking = true;
  __qualityCheckCache.clear();

  const originalProjectItems = AppState?.project?.translationItems;

  try {
    if (AppState?.project && Array.isArray(originalProjectItems)) {
      AppState.project.translationItems = items;
    }
  } catch (_) {
    (loggers.app || console).debug("qualityCheck restoreItems:", _);
  }
  const progressBar = DOMCache.get("checkProgressBar");
  const progressPercent = DOMCache.get("checkProgressPercent");
  const progressStatus = DOMCache.get("checkProgressStatus");
  const progressContainer = DOMCache.get("qualityCheckProgress");
  const runBtn = DOMCache.get("runQualityCheckBtn");

  if (runBtn) {
    runBtn.disabled = true;
    const icon = document.createElement("i");
    icon.className = "fa fa-spinner fa-spin mr-2";
    runBtn.replaceChildren(icon, document.createTextNode("检查中..."));
  }

  if (progressContainer) progressContainer.classList.remove("hidden");

  const qr = AppState.qualityCheckResults;
  qr.overallScore = 0;
  qr.translatedCount = 0;
  qr.totalCount = items.length;
  qr.issues = [];
  qr.termMatches = 0;
  qr.lastCheckTime = new Date();
  qr.scope = checkScope;
  qr.fileName = scopeFileName;

  try {
    let checkConcurrency = AppState?.quality?.checkConcurrency;
    if (!checkConcurrency) {
      try {
        const s = SettingsCache.get();
        checkConcurrency = s.qualityCheckConcurrency;
      } catch (_) {
        (loggers.app || console).debug("qualityCheck readConcurrency:", _);
      }
    }
    const concurrency = Math.max(
      1,
      Math.min(50, Math.floor(Number(checkConcurrency) || 8))
    );

    const batchSize = 50;
    const batches = Math.ceil(items.length / batchSize);

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, items.length);
      const batch = items.slice(start, end);

      const batchResults = await __processBatchImpl(batch, { concurrency });

      qr.translatedCount += batchResults.translatedCount;
      qr.issues.push(...batchResults.issues);
      qr.termMatches += batchResults.termMatches;

      const progress = Math.round((end / items.length) * 100);
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (progressPercent) progressPercent.textContent = `${progress}%`;
      if (progressStatus)
        progressStatus.textContent = `已检查 ${end}/${items.length} 项...`;

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const targetToItems = new Map();
    items.forEach((it) => {
      const t = (it.targetText || "").trim();
      if (!t) return;
      let list = targetToItems.get(t);
      if (!list) {
        list = [];
        targetToItems.set(t, list);
      }
      list.push({ itemId: it.id, sourceText: it.sourceText || "", targetText: it.targetText || "" });
    });
    targetToItems.forEach((list) => {
      if (list.length <= 1) return;
      list.forEach(({ itemId, sourceText, targetText }) => {
        qr.issues.push({
          itemId,
          sourceText,
          targetText,
          type: "duplicate",
          typeName: "重复译文",
          severity: "medium",
          description: `与另外 ${list.length - 1} 条译文完全相同，可能为漏译或复制`,
        });
      });
    });

    __calculateOverallScoreImpl();

    setTimeout(() => {
      if (progressContainer) progressContainer.classList.add("hidden");

      __updateQualityReportUIImpl();

      showNotification(
        "success",
        "检查完成",
        `已完成 ${items.length} 项翻译的质量检查，发现 ${qr.issues.length} 个问题`
      );
    }, 300);
  } catch (error) {
    (loggers.app || console).error("质量检查错误:", error);
    showNotification(
      "error",
      "检查失败",
      `质量检查过程中出错: ${error.message}`
    );
    if (progressContainer) progressContainer.classList.add("hidden");
  } finally {
    try {
      if (AppState?.project && Array.isArray(originalProjectItems)) {
        AppState.project.translationItems = originalProjectItems;
      }
    } catch (_) {
      (loggers.app || console).debug("qualityCheck finalRestore:", _);
    }

    __qualityIsChecking = false;

    if (runBtn) {
      runBtn.disabled = false;
      const icon = document.createElement("i");
      icon.className = "fa fa-refresh mr-2";
      runBtn.replaceChildren(icon, document.createTextNode("重新检查"));
    }
  }
}

async function __processBatchImpl(items) {
  let options = null;
  if (arguments && arguments.length >= 2) {
    options = arguments[1];
  }

  const concurrency = Math.max(
    1,
    Math.min(50, Math.floor(Number(options?.concurrency) || 8))
  );

  const batchResults = {
    translatedCount: 0,
    issues: [],
    termMatches: 0,
  };

  const results = await __mapWithConcurrencyImpl(
    items,
    (item) => __checkTranslationItemCachedImpl(item),
    concurrency
  );

  results.forEach((result) => {
    if (result.isTranslated) batchResults.translatedCount++;
    batchResults.issues.push(...result.issues);
    batchResults.termMatches += result.termMatches;
  });

  return batchResults;
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.runQualityCheck = __runQualityCheckImpl;
  App.impl.processBatch = __processBatchImpl;
})();
