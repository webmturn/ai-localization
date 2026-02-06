// ==================== 翻译进度 UI ====================
// 从 actions.js 拆分出来的独立模块

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
