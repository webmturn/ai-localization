// ==================== 翻译共享工具函数 ====================
// 从 batch.js 和 deepseek.js 中提取的重复逻辑

/**
 * 从翻译项中提取 key/标识符
 * @param {Object} item - 翻译项
 * @returns {string}
 */
function translationGetItemKey(item) {
  if (!item) return "";
  try {
    return String(
      item?.metadata?.resourceId ||
        item?.metadata?.key ||
        item?.metadata?.path ||
        item?.metadata?.unitId ||
        item?.metadata?.contextName ||
        item?.id ||
        ""
    );
  } catch (_) {
    return "";
  }
}

/**
 * 从翻译项中提取文件基础名（不含路径）
 * @param {Object} item - 翻译项
 * @returns {string}
 */
function translationGetFileBase(item) {
  try {
    const f = String(item?.metadata?.file || "");
    if (!f) return "";
    const parts = f.split(/\\|\//g);
    return parts[parts.length - 1] || f;
  } catch (_) {
    return "";
  }
}

/**
 * 从翻译项中提取文件扩展名
 * @param {Object} item - 翻译项
 * @returns {string}
 */
function translationGetFileType(item) {
  const file = item?.metadata?.file || "";
  const ext = file.split(".").pop() || "";
  return (ext || "").toLowerCase();
}

/**
 * 将文本截断为指定长度的摘要
 * @param {string} text - 原始文本
 * @param {number} maxLen - 最大长度
 * @returns {string}
 */
function translationToSnippet(text, maxLen) {
  const s = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > maxLen ? s.substring(0, maxLen) + "..." : s;
}

/**
 * 等待翻译暂停状态解除
 * @param {Object} options - 选项
 * @param {Object} options.state - AppState.translations 引用
 * @param {Function} [options.onPause] - 暂停时回调（仅首次触发）
 * @param {Function} [options.onCancel] - 取消时回调（替代默认 return false 行为）
 * @returns {Promise<boolean>} true=继续, false=已取消
 */
async function translationWaitWhilePaused(options = {}) {
  const state = options.state || (typeof AppState !== "undefined" ? AppState.translations : null);
  if (!state) return true;

  let notified = false;
  while (state.isPaused) {
    if (!state.isInProgress) {
      if (options.onCancel) options.onCancel();
      return false;
    }
    if (!notified && options.onPause) {
      options.onPause();
      notified = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return true;
}
