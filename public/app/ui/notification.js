const NOTIFICATION_DURATION = 3500;
const NOTIFICATION_BACKLOG_DURATION = 1200;
const NOTIFICATION_QUEUE_LIMIT = 5;

// 显示通知
// options: { action: Function, actionLabel: string, duration: number, persistent: boolean }
function showNotification(type, title, message, options) {
  const notification = DOMCache.get("notification");
  const icon = DOMCache.get("notificationIcon");
  const iconInner = DOMCache.get("notificationIconInner");
  const notificationTitle = DOMCache.get("notificationTitle");
  const notificationMessage = DOMCache.get("notificationMessage");
  const actionsEl = DOMCache.get("notificationActions");
  const actionBtn = DOMCache.get("notificationActionBtn");
  const queueBadge = DOMCache.get("notificationQueueBadge");
  const progressBar = DOMCache.get("notificationProgressBar");

  const opts = options && typeof options === 'object' ? options : {};

  let notificationQueue;
  try {
    notificationQueue = window.ArchDebug
      ? window.ArchDebug.getFlag('notificationQueue', {
          windowKey: '__notificationQueue',
        })
      : window.__notificationQueue;
  } catch (_) {
    notificationQueue = window.__notificationQueue;
  }
  if (!Array.isArray(notificationQueue)) notificationQueue = [];
  try {
    if (window.ArchDebug) {
      window.ArchDebug.setFlag('notificationQueue', notificationQueue, {
        windowKey: '__notificationQueue',
        mirrorWindow: false,
      });
    } else {
      window.__notificationQueue = notificationQueue;
    }
  } catch (_) {
    try {
      if (!window.ArchDebug) {
        window.__notificationQueue = notificationQueue;
      }
    } catch (_) {
      (loggers.app || console).debug("notification queue register:", _);
    }
  }

  const isVisible =
    notification &&
    notification.classList.contains("translate-x-0") &&
    !notification.classList.contains("-translate-x-full");

  const payload = { type, title, message, options: opts };
  if (isVisible) {
    notificationQueue.push(payload);
    if (notificationQueue.length > NOTIFICATION_QUEUE_LIMIT) {
      notificationQueue.splice(
        0,
        notificationQueue.length - NOTIFICATION_QUEUE_LIMIT
      );
    }
    // 更新队列计数徽章
    _updateQueueBadge(notificationQueue.length);
    clearTimeout(notification.hideTimeout);
    notification.hideTimeout = setTimeout(() => {
      closeNotification();
    }, NOTIFICATION_BACKLOG_DURATION);
    return;
  }

  // 设置通知类型
  let iconClass = "fa-info-circle";
  let bgClass = "bg-blue-50 dark:bg-blue-500/10";
  let textClass = "text-blue-800 dark:text-blue-100";

  if (type === "success") {
    iconClass = "fa-check-circle";
    bgClass = "bg-green-50 dark:bg-emerald-500/20";
    textClass = "text-green-800 dark:text-emerald-400";
  } else if (type === "warning") {
    iconClass = "fa-exclamation-triangle";
    bgClass = "bg-yellow-50 dark:bg-amber-900";
    textClass = "text-yellow-800 dark:text-amber-100";
  } else if (type === "error") {
    iconClass = "fa-exclamation-circle";
    bgClass = "bg-red-50 dark:bg-red-500/10";
    textClass = "text-red-800 dark:text-red-300";
  }

  // 设置图标
  icon.className = `flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${bgClass} ${textClass} mr-3`;
  iconInner.className = `fa ${iconClass}`;

  // 设置标题和消息
  notificationTitle.textContent = title;
  notificationMessage.textContent = message;

  // 设置操作按钮
  if (actionsEl && actionBtn) {
    if (opts.action && typeof opts.action === 'function') {
      actionBtn.textContent = opts.actionLabel || '撤销';
      // 移除旧的点击监听（通过克隆节点）
      const newBtn = actionBtn.cloneNode(true);
      actionBtn.parentNode.replaceChild(newBtn, actionBtn);
      DOMCache.cache && DOMCache.cache.set("notificationActionBtn", newBtn);
      newBtn.addEventListener('click', function () {
        try { opts.action(); } catch (e) {
          (loggers.app || console).error("notification action error:", e);
        }
        closeNotification();
      });
      actionsEl.classList.remove('hidden');
    } else {
      actionsEl.classList.add('hidden');
    }
  }

  // 队列徽章（当前无队列）
  _updateQueueBadge(0);

  // 显示通知（从左侧滑入）
  notification.classList.remove("-translate-x-full", "opacity-0");
  notification.classList.add("translate-x-0", "opacity-100");

  // 添加到body类，可能需要调整布局
  document.body.classList.add("has-notification");

  // 进度条倒计时动画
  const duration = opts.duration || (opts.persistent ? 0 : NOTIFICATION_DURATION);
  _startProgressAnimation(duration);

  // 自动隐藏通知（persistent 模式不自动隐藏）
  clearTimeout(notification.hideTimeout);
  if (duration > 0) {
    notification.hideTimeout = setTimeout(() => {
      closeNotification();
    }, duration);
  }
}

// 进度条倒计时动画
function _startProgressAnimation(duration) {
  const progressBar = DOMCache.get("notificationProgressBar");
  if (!progressBar) return;

  // 取消之前的动画
  if (progressBar._animationId) {
    cancelAnimationFrame(progressBar._animationId);
    progressBar._animationId = null;
  }

  if (!duration || duration <= 0) {
    progressBar.style.width = '100%';
    return;
  }

  progressBar.style.transition = 'none';
  progressBar.style.width = '100%';

  const start = performance.now();
  const animate = (now) => {
    const elapsed = now - start;
    const remaining = Math.max(0, 1 - elapsed / duration);
    progressBar.style.width = (remaining * 100) + '%';
    if (remaining > 0) {
      progressBar._animationId = requestAnimationFrame(animate);
    }
  };
  progressBar._animationId = requestAnimationFrame(animate);
}

// 更新队列计数徽章
function _updateQueueBadge(count) {
  const badge = DOMCache.get("notificationQueueBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = '+' + count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// 关闭通知
function closeNotification() {
  const notification = DOMCache.get("notification");
  if (notification && notification.hideTimeout) {
    clearTimeout(notification.hideTimeout);
    notification.hideTimeout = null;
  }

  // 停止进度条动画
  const progressBar = DOMCache.get("notificationProgressBar");
  if (progressBar && progressBar._animationId) {
    cancelAnimationFrame(progressBar._animationId);
    progressBar._animationId = null;
  }

  // 隐藏操作按钮
  const actionsEl = DOMCache.get("notificationActions");
  if (actionsEl) actionsEl.classList.add('hidden');

  notification.classList.remove("translate-x-0", "opacity-100");
  notification.classList.add("-translate-x-full", "opacity-0");

  // 移除body类
  document.body.classList.remove("has-notification");

  let q;
  try {
    q = window.ArchDebug
      ? window.ArchDebug.getFlag('notificationQueue', {
          windowKey: '__notificationQueue',
        })
      : window.__notificationQueue;
  } catch (_) {
    q = window.__notificationQueue;
  }
  if (Array.isArray(q) && q.length > 0) {
    const next = q.shift();
    setTimeout(() => {
      try {
        showNotification(next.type, next.title, next.message, next.options);
      } catch (_) {
        (loggers.app || console).debug("notification queue dispatch:", _);
      }
    }, 150);
  }
}
