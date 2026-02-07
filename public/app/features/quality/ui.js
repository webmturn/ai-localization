function __syncQualityRuleCardsImpl() {
  const container = DOMCache.get("qualityRuleCards");
  if (!container) return;
  const opts = typeof __getQualityCheckOptions === "function" ? __getQualityCheckOptions() : {};
  const cardById = {
    terminology: opts.checkTerminology,
    placeholders: opts.checkPlaceholders,
    length: opts.checkLength,
    empty: true,
    duplicate: true,
    variable: opts.checkPlaceholders,
    punctuation: opts.checkPunctuation,
    numbers: opts.checkNumbers,
  };
  container.querySelectorAll(".quality-rule-card[data-check-id]").forEach(function (card) {
    const id = card.getAttribute("data-check-id");
    const enabled = cardById[id] !== false;
    if (enabled) {
      card.classList.remove("quality-rule-disabled");
      card.style.display = "";
      card.style.opacity = "";
      const badge = card.querySelector(".quality-rule-badge");
      if (badge) badge.remove();
    } else {
      card.classList.add("quality-rule-disabled");
      card.style.opacity = "0.55";
      let badge = card.querySelector(".quality-rule-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "quality-rule-badge ml-2 text-xs text-gray-500 dark:text-gray-400";
        badge.textContent = "已关闭";
        const titleRow = card.querySelector(".flex.items-center.mb-2");
        if (titleRow) titleRow.appendChild(badge);
      }
      badge.textContent = "已关闭";
    }
  });
}

function __resetIssueFilterImpl() {
  DOMCache.get("issueFilterSeverity").value = "all";
  DOMCache.get("issueFilterType").value = "all";
  filterIssues();
}

function __updateQualityReportUIImpl() {
  const results = AppState.qualityCheckResults;

  if (!results) {
    (loggers.app || console).error("没有质量检查结果");
    return;
  }

  DOMCache.get(
    "overallScore"
  ).textContent = `${results.overallScore}/100`;
  DOMCache.get(
    "overallScoreBar"
  ).style.width = `${results.overallScore}%`;

  const translatedPercent =
    results.totalCount > 0
      ? Math.round((results.translatedCount / results.totalCount) * 100)
      : 0;
  DOMCache.get(
    "translatedCount"
  ).textContent = `${results.translatedCount}/${results.totalCount}`;
  DOMCache.get(
    "translatedBar"
  ).style.width = `${translatedPercent}%`;

  DOMCache.get("issuesCount").textContent = results.issues.length;

  const highIssues = results.issues.filter((i) => i.severity === "high").length;
  const mediumIssues = results.issues.filter(
    (i) => i.severity === "medium"
  ).length;
  const lowIssues = results.issues.filter((i) => i.severity === "low").length;

  DOMCache.get("highIssues").textContent = highIssues;
  DOMCache.get("mediumIssues").textContent = mediumIssues;
  DOMCache.get("lowIssues").textContent = lowIssues;

  const termConsistency = results.termMatches > 0 ? 100 : 0;
  DOMCache.get(
    "termConsistency"
  ).textContent = `${termConsistency}%`;
  DOMCache.get("termMatches").textContent = results.termMatches;

  if (results.lastCheckTime) {
    const timeStr = results.lastCheckTime.toLocaleString("zh-CN");
    DOMCache.get("lastCheckTime").textContent = timeStr;
  }

  __syncQualityRuleCardsImpl();
  __updateIssuesTableImpl();
  __updateQualityChartsImpl();
}

let __issuesTableDelegateTarget = null;

function __updateIssuesTableImpl(filter = { severity: "all", type: "all" }) {
  const tbody = DOMCache.get("issuesTableBody");
  const issueCountBadge = DOMCache.get("issueCountBadge");
  const issues = AppState.qualityCheckResults.issues;

  if (!tbody) return;

  if (__issuesTableDelegateTarget !== tbody) {
    __issuesTableDelegateTarget = tbody;
    EventManager.add(
      tbody,
      "click",
      function (e) {
        const btn = e.target?.closest?.(
          'button[data-action="focusTranslationItem"]'
        );
        if (!btn || !tbody.contains(btn)) return;

        const itemId = btn.dataset.itemId;
        if (typeof isDevelopment !== "undefined" && isDevelopment) {
          (loggers.app || console).info("[quality:view] tbody delegate click", { itemId, btn });
        }

        if (itemId == null) return;
        __focusTranslationItemImpl(itemId);
      },
      {
        tag: "quality",
        scope: "qualityReport",
        label: "issuesTableBody:clickDelegate",
      }
    );
  }

  EventManager.pruneDisconnected();

  const oldFocusButtons = tbody.querySelectorAll(
    'button[data-action="focusTranslationItem"]'
  );
  oldFocusButtons.forEach((btn) => {
    EventManager.removeByTarget(btn);
  });

  let filteredIssues = issues;

  if (filter.severity !== "all") {
    filteredIssues = filteredIssues.filter(
      (i) => i.severity === filter.severity
    );
  }

  if (filter.type !== "all") {
    filteredIssues = filteredIssues.filter((i) => i.type === filter.type);
  }

  if (issueCountBadge) {
    const totalIssues = AppState.qualityCheckResults.issues.length;
    const filteredCount = filteredIssues.length;

    if (filter.severity !== "all" || filter.type !== "all") {
      issueCountBadge.textContent = `${filteredCount} / ${totalIssues} 个问题`;
      issueCountBadge.className =
        "px-2.5 py-1 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 text-xs font-semibold rounded-full";
    } else {
      issueCountBadge.textContent = `${totalIssues} 个问题`;
      issueCountBadge.className =
        totalIssues > 0
          ? "px-2.5 py-1 bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold rounded-full"
          : "px-2.5 py-1 bg-green-100 dark:bg-emerald-500/20 text-green-700 dark:text-emerald-400 text-xs font-semibold rounded-full";
    }
  }

  if (filteredIssues.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "px-4 py-8 text-center text-gray-500 dark:text-gray-400";

    const icon = document.createElement("i");
    icon.className =
      "fa fa-check-circle text-3xl text-green-300 dark:text-green-400 mb-2 block";

    const p1 = document.createElement("p");
    p1.textContent = "暂无问题";

    const p2 = document.createElement("p");
    p2.className = "text-sm mt-1";
    p2.textContent = "所有翻译项均通过质量检查";

    td.appendChild(icon);
    td.appendChild(p1);
    td.appendChild(p2);
    tr.appendChild(td);

    tbody.replaceChildren(tr);
    return;
  }

  const fragment = document.createDocumentFragment();

  const maxDisplay = 200;
  const displayIssues = filteredIssues.slice(0, maxDisplay);

  displayIssues.forEach((issue) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700";

    const severityClass = {
      high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
      medium:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
      low: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
    }[issue.severity];

    const severityText = {
      high: "高",
      medium: "中",
      low: "低",
    }[issue.severity];

    const td1 = document.createElement("td");
    td1.className =
      "px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate";
    td1.title = issue.sourceText;
    td1.textContent = truncateText(issue.sourceText, 50);

    const td2 = document.createElement("td");
    td2.className =
      "px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate";
    td2.title = issue.targetText;
    td2.textContent = truncateText(issue.targetText, 50);

    const td3 = document.createElement("td");
    td3.className = "px-4 py-3 text-sm text-gray-900 dark:text-gray-100";
    td3.textContent = issue.typeName;

    const td4 = document.createElement("td");
    td4.className = "px-4 py-3 text-sm";
    const span = document.createElement("span");
    span.className = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityClass}`;
    span.textContent = severityText;
    td4.appendChild(span);

    const td5 = document.createElement("td");
    td5.className = "px-4 py-3 text-sm text-gray-600 dark:text-gray-300";
    td5.textContent = issue.description;

    const td6 = document.createElement("td");
    td6.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400";
    const btn = document.createElement("button");
    btn.className = "text-primary hover:text-primary/80";
    btn.type = "button";
    btn.dataset.action = "focusTranslationItem";
    btn.dataset.itemId = String(issue.itemId);
    btn.textContent = "查看";
    td6.appendChild(btn);

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
    tr.appendChild(td6);

    fragment.appendChild(tr);
  });

  tbody.replaceChildren(fragment);

  if (filteredIssues.length > maxDisplay) {
    const tr = document.createElement("tr");
    tr.className =
      "bg-yellow-50 dark:bg-yellow-900/20 border-t-2 border-yellow-200 dark:border-yellow-700";

    const td = document.createElement("td");
    td.colSpan = 6;
    td.className = "px-4 py-4 text-center";

    const container = document.createElement("div");
    container.className = "flex flex-col items-center gap-2";

    const icon = document.createElement("i");
    icon.className =
      "fa fa-exclamation-triangle text-yellow-500 dark:text-amber-400 text-2xl";

    const p1 = document.createElement("p");
    p1.className = "text-sm font-medium text-gray-700 dark:text-gray-200";
    p1.appendChild(document.createTextNode("还有 "));
    const count = document.createElement("span");
    count.className = "text-lg font-bold text-yellow-600 dark:text-amber-400";
    count.textContent = String(filteredIssues.length - maxDisplay);
    p1.appendChild(count);
    p1.appendChild(document.createTextNode(" 个问题未显示"));

    const p2 = document.createElement("p");
    p2.className = "text-xs text-gray-600 dark:text-gray-400";
    const filterIcon = document.createElement("i");
    filterIcon.className = "fa fa-filter mr-1";
    p2.appendChild(filterIcon);
    p2.appendChild(document.createTextNode("请使用上方的 "));
    const strong = document.createElement("span");
    strong.className = "font-semibold text-primary";
    strong.textContent = "“筛选条件”";
    p2.appendChild(strong);
    p2.appendChild(document.createTextNode(" 下拉框细化查看"));

    container.appendChild(icon);
    container.appendChild(p1);
    container.appendChild(p2);
    td.appendChild(container);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

async function __focusTranslationItemImpl(itemId) {
  closeModal("qualityReportModal");

  const allItems = AppState.project?.translationItems || [];
  const normalizedItemId = itemId;
  const isNumericIndex =
    typeof normalizedItemId === "number" ||
    (typeof normalizedItemId === "string" && /^\d+$/.test(normalizedItemId));

  const parsedIndex = isNumericIndex ? Number(normalizedItemId) : -1;
  const index =
    isNumericIndex && parsedIndex >= 0 && parsedIndex < allItems.length
      ? parsedIndex
      : allItems.findIndex(
          (item) =>
            item?.id === normalizedItemId ||
            String(item?.id) === String(normalizedItemId)
        );

  if (index === -1) {
    (loggers.app || console).error("未找到翻译项:", itemId);
    return;
  }

  if (typeof isDevelopment !== "undefined" && isDevelopment) {
    try {
      (loggers.app || console).info("[quality:view] focus", {
        itemId,
        normalizedItemId,
        isNumericIndex,
        index,
        currentPage: AppState.translations.currentPage,
        itemsPerPage: AppState.translations.itemsPerPage,
      });
    } catch (_) {
      (loggers.app || console).debug("quality ui dispatch event:", _);
    }
  }

  const itemsPerPage = AppState.translations.itemsPerPage;
  const filteredItems = Array.isArray(AppState.translations.filtered)
    ? AppState.translations.filtered
    : [];

  const filteredIndex = filteredItems.findIndex(
    (item) =>
      item?.id === normalizedItemId ||
      String(item?.id) === String(normalizedItemId)
  );
  const targetPage =
    filteredIndex >= 0
      ? Math.floor(filteredIndex / itemsPerPage) + 1
      : Math.floor(index / itemsPerPage) + 1;

  const didResetFilter = filteredIndex === -1;
  if (filteredIndex === -1) {
    AppState.translations.searchQuery = "";
    AppState.translations.filtered = [...allItems];
  }

  const beforeVersion = AppState.translations.renderVersion || 0;
  let willUpdateList = false;

  if (AppState.translations.currentPage !== targetPage) {
    if (typeof isDevelopment !== "undefined" && isDevelopment) {
      (loggers.app || console).info(`切换到第 ${targetPage} 页以显示索引 ${index} 的项`);
    }
    AppState.translations.currentPage = targetPage;
    willUpdateList = true;
    updateTranslationLists();
  } else if (didResetFilter) {
    willUpdateList = true;
    updateTranslationLists();
  }

  selectTranslationItem(index, {
    shouldScroll: false,
    shouldFocusTextarea: false,
  });

  const targetVersion = willUpdateList ? beforeVersion + 1 : beforeVersion;
  await __waitForTranslationsRendered(targetVersion, 2000);

  const highlight = (el) => {
    if (!el) return;
    el.classList.add("bg-yellow-100", "dark:bg-yellow-900/20");
    setTimeout(() => {
      el.classList.remove("bg-yellow-100", "dark:bg-yellow-900/20");
    }, 3000);
  };

  const escapeCss = (value) => {
    try {
      return CSS && typeof CSS.escape === "function"
        ? CSS.escape(value)
        : value;
    } catch (_) {
      return value;
    }
  };

  const idValue = allItems[index]?.id;
  const idStr =
    idValue === undefined || idValue === null ? null : String(idValue);
  const selectorById = idStr
    ? `.responsive-translation-item[data-id="${escapeCss(idStr)}"]`
    : null;
  const selectorByIndex = `.responsive-translation-item[data-index="${index}"]`;

  const isMobile = window.innerWidth < 768;
  const smartScrollToComfortZone = (el, behavior = "smooth") => {
    if (!el) return;
    const container =
      DOMCache.get("translationScrollWrapper") ||
      el.closest(".translation-scroll-wrapper");
    if (!container) {
      el.scrollIntoView({ behavior, block: "nearest" });
      return;
    }

    const containerHeight = container.clientHeight || 0;
    if (!containerHeight) {
      el.scrollIntoView({ behavior, block: "nearest" });
      return;
    }

    let offsetTop = 0;
    let node = el;
    while (node && node !== container) {
      offsetTop += node.offsetTop || 0;
      node = node.offsetParent;
    }

    const itemHeight = el.offsetHeight || 0;
    const current = container.scrollTop;
    const maxScroll = Math.max(0, container.scrollHeight - containerHeight);
    const margin = Math.min(80, containerHeight * 0.15);

    const itemTop = offsetTop;
    const itemBottom = offsetTop + itemHeight;

    const visibleTop = current + margin;
    const visibleBottom = current + containerHeight - margin;

    let target = current;

    if (itemBottom > visibleBottom) {
      target = itemBottom - containerHeight + margin;
    } else if (itemTop < visibleTop) {
      target = itemTop - margin;
    } else {
      return;
    }

    target = Math.max(0, Math.min(maxScroll, target));
    if (Math.abs(target - current) < 2) return;

    container.scrollTo({ top: target, behavior });
  };
  if (isMobile) {
    const mobileCombinedList = DOMCache.get("mobileCombinedList");
    const mobileItem = mobileCombinedList
      ? mobileCombinedList.querySelector(selectorById || selectorByIndex)
      : null;
    if (mobileItem) {
      smartScrollToComfortZone(mobileItem, "smooth");
      highlight(mobileItem);
      return;
    }
  }

  const sourceList = DOMCache.get("sourceList");
  const targetList = DOMCache.get("targetList");
  const sourceItem = sourceList
    ? sourceList.querySelector(selectorById || selectorByIndex)
    : null;
  const targetItem = targetList
    ? targetList.querySelector(selectorById || selectorByIndex)
    : null;

  if (sourceItem && targetItem) {
    smartScrollToComfortZone(sourceItem, "smooth");
    highlight(sourceItem);
    highlight(targetItem);
    return;
  }

  (loggers.app || console).error(
    "未找到 DOM 元素:",
    index,
    "当前页:",
    AppState.translations.currentPage,
    "目标页:",
    targetPage
  );
}

(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.impl.resetIssueFilter = __resetIssueFilterImpl;
  App.impl.updateQualityReportUI = __updateQualityReportUIImpl;
  App.impl.updateIssuesTable = __updateIssuesTableImpl;
  App.impl.focusTranslationItem = __focusTranslationItemImpl;
  if (typeof window !== "undefined") {
    window.syncQualityRuleCards = __syncQualityRuleCardsImpl;
  }
})();
