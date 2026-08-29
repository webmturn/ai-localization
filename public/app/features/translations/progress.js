// ==================== 翻译进度 UI ====================
// 从 actions.js 拆分出来的独立模块

// 显示翻译进度（常驻内联进度条；模态框仅按需打开查看日志）
function showTranslationProgress() {
  DOMCache.batchUpdate("progress-show", function () {
    // 常驻内联进度条（主界面可见，无需打开模态框）
    const inline = DOMCache.get("inlineTranslationProgress");
    if (inline) inline.classList.remove("hidden");
    const inlineBar = DOMCache.get("inlineProgressBar");
    if (inlineBar) inlineBar.style.width = "0%";
    const inlineStatus = DOMCache.get("inlineProgressStatus");
    if (inlineStatus) inlineStatus.textContent = "准备翻译...";
    const inlineCount = DOMCache.get("inlineProgressCount");
    if (inlineCount) inlineCount.textContent = "0/0";
    // 模态框仅重置内容，不自动弹出（日志按钮按需打开）
    const modal = DOMCache.get("translationProgressModal");
    if (modal) modal.classList.add("hidden");
    const bar = DOMCache.get("progressBar");
    if (bar) bar.style.width = "0%";
    const pct = DOMCache.get("progressPercentage");
    if (pct) pct.textContent = "0%";
    const statusEl = DOMCache.get("progressStatus");
    if (statusEl) statusEl.textContent = "准备翻译...";
    const log = DOMCache.get("progressLog");
    if (log) log.replaceChildren();
    updateTranslationControlState();
  }, { priority: "high" });
}

// 隐藏翻译进度（内联进度条 + 模态框）
function hideTranslationProgress() {
  const inline = DOMCache.get("inlineTranslationProgress");
  if (inline) inline.classList.add("hidden");
  const modal = DOMCache.get("translationProgressModal");
  if (modal) modal.classList.add("hidden");
}

function updateTranslationControlState() {
  const pauseBtn = DOMCache.get("pauseTranslationBtn");
  const resumeBtn = DOMCache.get("resumeTranslationBtn");
  const retryBtn = DOMCache.get("retryFailedTranslationBtn");
  // 常驻内联进度条按钮
  const inlinePauseBtn = DOMCache.get("inlinePauseBtn");
  const inlineResumeBtn = DOMCache.get("inlineResumeBtn");
  const inlineCancelBtn = DOMCache.get("inlineCancelBtn");
  const isInProgress = BatchProgressStore.isBatchInProgress();
  const isPaused = BatchProgressStore.isBatchPaused();
  const hasFailed = BatchProgressStore.getLastFailedItems().length > 0;

  const setState = (btn, enabled) => {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("opacity-50", !enabled);
    btn.classList.toggle("cursor-not-allowed", !enabled);
  };
  const setHidden = (btn, hidden) => {
    if (!btn) return;
    btn.classList.toggle("hidden", !!hidden);
  };

  setState(pauseBtn, isInProgress && !isPaused);
  setState(resumeBtn, isInProgress && isPaused);
  setState(retryBtn, !isInProgress && hasFailed);

  // 内联进度条：暂停/继续互斥显示，取消仅翻译中可用
  setHidden(inlinePauseBtn, !(isInProgress && !isPaused));
  setHidden(inlineResumeBtn, !(isInProgress && isPaused));
  setState(inlinePauseBtn, isInProgress && !isPaused);
  setState(inlineResumeBtn, isInProgress && isPaused);
  setState(inlineCancelBtn, isInProgress);
}

// 更新进度
function updateProgress(current, total, status) {
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  // 进度态写入经 BatchProgressStore（reportProgress 自带数值守卫）
  BatchProgressStore.reportProgress(safeCurrent, safeTotal, status);
  const percentage = safeTotal > 0 ? Math.floor((safeCurrent / safeTotal) * 100) : 0;
  // 使用 batchUpdate 合并多次快速调用的 DOM 写入到同一帧
  DOMCache.batchUpdate("progress", function () {
    const bar = DOMCache.get("progressBar");
    if (bar) bar.style.width = `${percentage}%`;
    const pctEl = DOMCache.get("progressPercentage");
    if (pctEl) pctEl.textContent = `${percentage}%`;
    const statusEl = DOMCache.get("progressStatus");
    if (statusEl) statusEl.textContent = status;
    // 常驻内联进度条同步更新
    const inlineBar = DOMCache.get("inlineProgressBar");
    if (inlineBar) inlineBar.style.width = `${percentage}%`;
    const inlineStatus = DOMCache.get("inlineProgressStatus");
    if (inlineStatus) inlineStatus.textContent = status || "";
    const inlineCount = DOMCache.get("inlineProgressCount");
    if (inlineCount) inlineCount.textContent = `${safeCurrent}/${safeTotal}`;
    updateTranslationControlState();
  });
}

// 添加进度日志
function addProgressLog(message) {
  const log = DOMCache.get("progressLog");
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

  // 使用 batchUpdate 合并快速连续的日志追加到同一帧
  DOMCache.batchUpdate("progress-log", function () {
    log.appendChild(frag);

    const maxLines = 500;
    while (log.children.length > maxLines) {
      log.removeChild(log.firstChild);
    }

    log.scrollTop = log.scrollHeight;
  });
}

// ==================== 常驻内联进度条 ====================

function initInlineTranslationProgress() {
  // 取消翻译
  const inlineCancelBtn = DOMCache.get("inlineCancelBtn");
  if (inlineCancelBtn) {
    EventManager.add(
      inlineCancelBtn,
      "click",
      function () {
        if (typeof cancelTranslation === "function") cancelTranslation();
      },
      {
        tag: "ui",
        scope: "inlineProgress",
        label: "inlineCancelBtn:click",
      }
    );
  }

  // 暂停翻译
  const inlinePauseBtn = DOMCache.get("inlinePauseBtn");
  if (inlinePauseBtn) {
    EventManager.add(
      inlinePauseBtn,
      "click",
      function () {
        if (typeof pauseTranslation === "function") pauseTranslation();
      },
      {
        tag: "ui",
        scope: "inlineProgress",
        label: "inlinePauseBtn:click",
      }
    );
  }

  // 继续翻译
  const inlineResumeBtn = DOMCache.get("inlineResumeBtn");
  if (inlineResumeBtn) {
    EventManager.add(
      inlineResumeBtn,
      "click",
      function () {
        if (typeof resumeTranslation === "function") resumeTranslation();
      },
      {
        tag: "ui",
        scope: "inlineProgress",
        label: "inlineResumeBtn:click",
      }
    );
  }

  // 查看详细日志（按需打开进度模态框）
  const inlineLogBtn = DOMCache.get("inlineLogBtn");
  if (inlineLogBtn) {
    EventManager.add(
      inlineLogBtn,
      "click",
      function () {
        const modal = DOMCache.get("translationProgressModal");
        if (modal) modal.classList.remove("hidden");
      },
      {
        tag: "ui",
        scope: "inlineProgress",
        label: "inlineLogBtn:click",
      }
    );
  }
}

// 暴露到全局（供测试/其他模块调用）
window.initInlineTranslationProgress = initInlineTranslationProgress;

// DOM 就绪后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initInlineTranslationProgress, { once: true });
} else {
  setTimeout(initInlineTranslationProgress, 0);
}
