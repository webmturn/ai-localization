// ==================== 翻译进度 UI ====================
// 从 actions.js 拆分出来的独立模块

// 显示翻译进度模态框
function showTranslationProgress() {
  DOMCache.batchUpdate("progress-show", function () {
    const modal = DOMCache.get("translationProgressModal");
    if (modal) modal.classList.remove("hidden");
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

// 隐藏翻译进度模态框
function hideTranslationProgress() {
  const modal = DOMCache.get("translationProgressModal");
  if (modal) modal.classList.add("hidden");
}

function updateTranslationControlState() {
  const pauseBtn = DOMCache.get("pauseTranslationBtn");
  const resumeBtn = DOMCache.get("resumeTranslationBtn");
  const retryBtn = DOMCache.get("retryFailedTranslationBtn");
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
  // 使用 batchUpdate 合并多次快速调用的 DOM 写入到同一帧
  DOMCache.batchUpdate("progress", function () {
    const bar = DOMCache.get("progressBar");
    if (bar) bar.style.width = `${percentage}%`;
    const pctEl = DOMCache.get("progressPercentage");
    if (pctEl) pctEl.textContent = `${percentage}%`;
    const statusEl = DOMCache.get("progressStatus");
    if (statusEl) statusEl.textContent = status;
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
