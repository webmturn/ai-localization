let __qualityIsChecking = false;

function __bigramSimilarityImpl(a, b) {
  // 字符二元组 Dice 相似度（0~1），用于判断两条原文是否相近
  if (a === b) return 1;
  if (!a || !b || a.length < 2 || b.length < 2) return 0;
  const makeBigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      map.set(gram, (map.get(gram) || 0) + 1);
    }
    return map;
  };
  const mapA = makeBigrams(a);
  const mapB = makeBigrams(b);
  let intersection = 0;
  for (const [gram, countA] of mapA) {
    const countB = mapB.get(gram);
    if (countB) intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

// 原文相似度阈值：低于此值视为"不同原文共享译文"（合法，如 OK/Yes/Sure → 确定）
const __DUPLICATE_SOURCE_SIMILARITY_THRESHOLD = 0.4;

function __detectDuplicateIssuesImpl(items) {
  // 重复译文检测：按目标文本分组后，仅当组内存在原文相近的条目时才报告
  // （疑似复制粘贴/漏译）；原文差异大的共享译文不报，避免误报。
  const issues = [];
  const targetToItems = new Map();
  (Array.isArray(items) ? items : []).forEach((it) => {
    const t = (it.targetText || "").trim();
    if (!t) return;
    let list = targetToItems.get(t);
    if (!list) {
      list = [];
      targetToItems.set(t, list);
    }
    list.push({
      itemId: it.id,
      sourceText: it.sourceText || "",
      targetText: it.targetText || "",
    });
  });
  targetToItems.forEach((list) => {
    if (list.length <= 1) return;
    const suspicious = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (
          __bigramSimilarityImpl(list[i].sourceText, list[j].sourceText) >=
          __DUPLICATE_SOURCE_SIMILARITY_THRESHOLD
        ) {
          suspicious.add(i);
          suspicious.add(j);
        }
      }
    }
    if (suspicious.size === 0) return;
    suspicious.forEach((idx) => {
      const { itemId, sourceText, targetText } = list[idx];
      issues.push({
        itemId,
        sourceText,
        targetText,
        type: "duplicate",
        typeName: "重复译文",
        severity: "medium",
        description: `与另外 ${suspicious.size - 1} 条译文完全相同且原文相近，可能为漏译或复制`,
      });
    });
  });
  return issues;
}

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

  // 全量条目：视图稳定引用优先（swap 窗口期间仍为全量），canonical 兜底
  const allItems =
    (typeof TranslationViewStore !== "undefined" &&
      TranslationViewStore.getViewItems()) ||
    (typeof ProjectStore !== "undefined" &&
      ProjectStore.getTranslationItems()) ||
    [];

  let checkScope = AppState?.quality?.checkScope;
  if (!checkScope) {
    try {
      const s = SettingsCache.get();
      checkScope = s.qualityCheckScope;
    } catch (e) {
      (loggers.app || console).debug("qualityCheck readScope:", e);
    }
  }
  if (checkScope !== "file" && checkScope !== "project") {
    checkScope = "project";
  }

  let items = allItems;
  let scopeFileName = null;
  if (checkScope === "file") {
    // 选中文件经 TranslationViewStore getter（视图态唯一 Owner）
    const selectedFile =
      (typeof TranslationViewStore !== "undefined" &&
        TranslationViewStore.getSelectedFile()) ||
      null;
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

  // 术语上下文快照：检查开始时一次性注入下游检查函数
  // （features/quality 不直读 TerminologyStore / AppState.terminology）。
  // 性能上限：最多取前 100 条术语参与逐项检查，超出部分记录截断数供 UI 提示。
  const __TERM_CHECK_LIMIT = 100;
  const termListAll =
    (typeof TerminologyStore !== "undefined" &&
      Array.isArray(TerminologyStore.getList()) &&
      TerminologyStore.getList()) ||
    [];
  const termContext = termListAll.slice(0, __TERM_CHECK_LIMIT);
  const termsTruncatedCount = Math.max(
    0,
    termListAll.length - termContext.length
  );

  __qualityIsChecking = true;
  __qualityCheckCache.clear();

  const originalProjectItems = AppState?.project?.translationItems;

  try {
    if (AppState?.project && Array.isArray(originalProjectItems)) {
      // 经 ProjectStore 临时换出条目（仅换 canonical，不动视图；结束后恢复）
      ProjectStore.swapTranslationItems(items);
    }
  } catch (e) {
    (loggers.app || console).debug("qualityCheck restoreItems:", e);
  }
  const progressBar = DOMCache.get("checkProgressBar");
  const progressPercent = DOMCache.get("checkProgressPercent");
  const progressStatus = DOMCache.get("checkProgressStatus");
  const progressContainer = DOMCache.get("qualityCheckProgress");
  const runBtn = DOMCache.get("runQualityCheckBtn");

  if (runBtn) {
    runBtn.disabled = true;
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-spinner fa-spin mr-2";
    runBtn.replaceChildren(icon, document.createTextNode("检查中..."));
  }

  if (progressContainer) progressContainer.classList.remove("hidden");

  const qr = AppState.qualityCheckResults;
  qr.overallScore = 0;
  qr.translatedCount = 0;
  qr.totalCount = items.length;
  qr.issues = [];
  qr.termMatches = 0;
  qr.termsTruncatedCount = termsTruncatedCount;
  qr.lastCheckTime = new Date();
  qr.scope = checkScope;
  qr.fileName = scopeFileName;

  try {
    let checkConcurrency = AppState?.quality?.checkConcurrency;
    if (!checkConcurrency) {
      try {
        const s = SettingsCache.get();
        checkConcurrency = s.qualityCheckConcurrency;
      } catch (e) {
        (loggers.app || console).debug("qualityCheck readConcurrency:", e);
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

      const batchResults = await __processBatchImpl(batch, {
        concurrency,
        terms: termContext,
      });

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

    // 重复译文检测（按目标文本分组 + 原文相似度门槛，避免合法共享译文误报）
    qr.issues.push(...__detectDuplicateIssuesImpl(items));

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
        // 经 ProjectStore 恢复原条目（仅换 canonical，与换出时对称）
        ProjectStore.swapTranslationItems(originalProjectItems);
      }
    } catch (e) {
      (loggers.app || console).debug("qualityCheck finalRestore:", e);
    }

    __qualityIsChecking = false;

    if (runBtn) {
      runBtn.disabled = false;
      const icon = document.createElement("i");
      icon.className = "fa-solid fa-arrows-rotate mr-2";
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

  // 术语上下文由 run() 注入（快照）；缺省时为空列表（跳过术语检查）
  const terms = Array.isArray(options?.terms) ? options.terms : [];

  const batchResults = {
    translatedCount: 0,
    issues: [],
    termMatches: 0,
  };

  const results = await __mapWithConcurrencyImpl(
    items,
    (item) => __checkTranslationItemCachedImpl(item, terms),
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
  App.impl.detectDuplicateIssues = __detectDuplicateIssuesImpl;
  App.impl.bigramSimilarity = __bigramSimilarityImpl;
})();
