const NOTIFICATION_DURATION = 3500;
const NOTIFICATION_BACKLOG_DURATION = 1200;
const NOTIFICATION_QUEUE_LIMIT = 5;

// 显示通知
function showNotification(type, title, message) {
  const notification = document.getElementById("notification");
  const icon = document.getElementById("notificationIcon");
  const iconInner = document.getElementById("notificationIconInner");
  const notificationTitle = document.getElementById("notificationTitle");
  const notificationMessage = document.getElementById("notificationMessage");

  if (!window.__notificationQueue) window.__notificationQueue = [];

  const isVisible =
    notification &&
    notification.classList.contains("translate-x-0") &&
    !notification.classList.contains("-translate-x-full");

  const payload = { type, title, message };
  if (isVisible) {
    window.__notificationQueue.push(payload);
    if (window.__notificationQueue.length > NOTIFICATION_QUEUE_LIMIT) {
      window.__notificationQueue.splice(
        0,
        window.__notificationQueue.length - NOTIFICATION_QUEUE_LIMIT
      );
    }
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

  // 显示通知（从左侧滑入）
  notification.classList.remove("-translate-x-full", "opacity-0");
  notification.classList.add("translate-x-0", "opacity-100");

  // 添加到body类，可能需要调整布局
  document.body.classList.add("has-notification");

  // 自动隐藏通知
  clearTimeout(notification.hideTimeout);
  notification.hideTimeout = setTimeout(() => {
    closeNotification();
  }, NOTIFICATION_DURATION);
}

// 关闭通知
function closeNotification() {
  const notification = document.getElementById("notification");
  if (notification && notification.hideTimeout) {
    clearTimeout(notification.hideTimeout);
    notification.hideTimeout = null;
  }
  notification.classList.remove("translate-x-0", "opacity-100");
  notification.classList.add("-translate-x-full", "opacity-0");

  // 移除body类
  document.body.classList.remove("has-notification");

  const q = window.__notificationQueue;
  if (Array.isArray(q) && q.length > 0) {
    const next = q.shift();
    setTimeout(() => {
      try {
        showNotification(next.type, next.title, next.message);
      } catch (_) {}
    }, 150);
  }
}
