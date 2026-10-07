// ==================== 翻译共享工具函数 ====================
// 从 batch.js 和 AI 引擎中提取的共享逻辑

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
  } catch (e) {
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
  } catch (e) {
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
 * 检测错误是否为 API Key 相关错误
 * @param {Error} error - 错误对象
 * @returns {boolean}
 */
function translationIsApiKeyError(error) {
  const code = error?.code;
  if (code === "API_KEY_MISSING" || code === "API_KEY_INVALID") return true;

  const msg = (error?.message ? String(error.message) : String(error || "")).trim();
  const lower = msg.toLowerCase();
  return (
    (/api\s*key/.test(lower) &&
      (/missing/.test(lower) || /not\s*configured/.test(lower) || /invalid/.test(lower))) ||
    /密钥未配置/.test(msg) ||
    /api密钥未配置/.test(lower) ||
    /未配置.*密钥/.test(msg)
  );
}

/**
 * 检测错误是否为用户取消操作
 * @param {Error} error - 错误对象
 * @param {boolean} isInProgress - 当前是否仍在翻译中
 * @returns {boolean}
 */
function translationIsUserCancelled(error, isInProgress) {
  return (
    error?.code === "USER_CANCELLED" ||
    error?.message === "用户取消" ||
    error?.message === "请求已取消或超时" ||
    error?.message === "请求已取消" ||
    (!isInProgress &&
      (error?.name === "AbortError" ||
        /aborted|abort|cancell/i.test(error?.message || "")))
  );
}

/**
 * 将批量翻译中所有项标记为错误
 * @param {Array} items - 翻译项数组
 * @param {Array} errorsArray - 错误结果数组（push 目标）
 * @param {string} errorMsg - 错误消息
 * @param {Object} [extra] - 附加字段 (status, code, provider, url)
 */
function translationMarkAllAsErrors(items, errorsArray, errorMsg, extra = {}) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) item.status = "pending";
    errorsArray.push({
      success: false,
      index: i,
      error: errorMsg,
      ...extra,
      item,
    });
  }
}

/**
 * 批量翻译是否已被用户取消。
 * 用于在「发起请求之前」和「重试之前」尽早短路，避免取消后仍继续消耗配额。
 * 语义与 ai-engine-base.js 内部的 _aiIsCancelled() 一致（同一取消协议）。
 * BatchProgressStore 不存在时视为未取消（保持既有行为）。
 * @returns {boolean}
 */
function translationIsCancelled(generation) {
  try {
    if (typeof BatchProgressStore === "undefined" || !BatchProgressStore) return false;
    if (generation !== undefined && typeof BatchProgressStore.getGeneration === "function" &&
        generation !== BatchProgressStore.getGeneration()) return true;
    if (typeof BatchProgressStore.isUserCancelled !== "function") return false;
    return !!BatchProgressStore.isUserCancelled();
  } catch (e) {
    return false;
  }
}

/**
 * 构造用户取消错误（带 partialOutputs 前缀语义，供上层保留已完成结果）
 * @param {Array} [partialOutputs] - 已完成的输出前缀
 * @returns {Error}
 */
function translationMakeCancelError(partialOutputs) {
  const err = new Error("用户取消");
  err.code = "USER_CANCELLED";
  if (Array.isArray(partialOutputs)) err.partialOutputs = partialOutputs;
  return err;
}

/**
 * 校验单条翻译结果是否可用于写入 targetText。
 *
 * 拒绝以下情况，避免把「坏结果」当成成功译文落库：
 *  - 非字符串（模型返回对象/数组，写入后会渲染成 "[object Object]"）
 *  - null / undefined（缺失项）
 *  - 纯空白
 *  - 占位符丢失或损坏（PlaceholderGuard.validate 此前从未在生产代码中被调用）
 *
 * @param {string} sourceText - 原文
 * @param {*} translated - 模型返回的译文
 * @param {Object} [opts]
 * @param {boolean} [opts.allowEmptySource=true] - 原文为空时允许译文为空
 * @returns {{ok: boolean, reason?: string, translated?: string}}
 */
function translationValidateResult(sourceText, translated, opts = {}) {
  if (typeof translated !== "string") {
    return {
      ok: false,
      reason: translated === null || translated === undefined
        ? "译文缺失（模型未返回该项）"
        : "译文类型异常（期望字符串，实际 " + typeof translated + "）",
    };
  }

  const src = typeof sourceText === "string" ? sourceText : String(sourceText ?? "");
  const allowEmptySource = opts.allowEmptySource !== false;

  if (allowEmptySource && !src.trim()) {
    return { ok: true, translated };
  }
  if (!translated.trim()) {
    return { ok: false, reason: "译文为空" };
  }

  // 占位符完整性：源文中的结构性占位符必须在译文中原样保留
  // （实体/HTML 标签层面的差异已由 PlaceholderGuard 归入 benign*，不在此拦截）
  try {
    if (typeof PlaceholderGuard !== "undefined" && PlaceholderGuard && typeof PlaceholderGuard.validate === "function") {
      var v = PlaceholderGuard.validate(src, translated);
      if (v && v.valid === false) {
        var missList = Array.isArray(v.missingStructural) ? v.missingStructural : v.missing || [];
        var extraList = Array.isArray(v.fatalExtra) ? v.fatalExtra : v.extra || [];
        return {
          ok: false,
          reason:
            "占位符不匹配" +
            (missList.length ? "（缺失 " + missList.join(", ") + "）" : "") +
            (extraList.length ? "（多出 " + extraList.join(", ") + "）" : ""),
        };
      }
    }
  } catch (e) {
    // 校验本身出错不应阻断翻译流程
  }

  return { ok: true, translated };
}

/**
 * 单条译文的统一收尾：占位符还原 → 术语库 → 结果校验。
 *
 * 正常批量路径与「取消后保留已完成结果」路径必须共用本函数。
 * 背景（P0）：引擎侧会把占位符替换成 «N» 哨兵（ai-engine-base.js），若取消分支不做还原，
 * 哨兵会被直接写进 targetText 并标记为已翻译，随后自动保存 + 导出（静默数据损坏）。
 *
 * @param {Object} item - 待写入的条目（读取 sourceText / __phGuardMap）
 * @param {*} translated - 引擎返回的译文（可能是非字符串的坏结果）
 * @param {Object} [service] - TranslationService 实例（用于 applyTerminologyToTranslation）
 * @returns {{ok: boolean, translated: *, reason?: string}}
 */
function translationFinalizeResult(item, translated, service) {
  var value = translated;

  // 1) 占位符还原
  if (typeof PlaceholderGuard !== "undefined" && PlaceholderGuard) {
    var map = item && item.__phGuardMap;
    if ((!map || !map.length) && item && typeof PlaceholderGuard.protect === "function") {
      try {
        var ph = PlaceholderGuard.protect(item.sourceText);
        if (ph && ph.hasPlaceholders) map = ph.map;
      } catch (e) {
        map = null;
      }
    }
    if (map && map.length && typeof PlaceholderGuard.restore === "function") {
      try {
        value = PlaceholderGuard.restore(value, map);
      } catch (e) {
        // 非字符串等异常输入：保持原值，交由下面的校验拒绝
      }
    }
  }
  // 映射用完即弃，避免随条目进入持久化/项目导出
  if (item && item.__phGuardMap) {
    try { delete item.__phGuardMap; } catch (e) {}
  }

  // 2) 术语库（与正常路径一致，幂等）
  if (service && typeof service.applyTerminologyToTranslation === "function") {
    try {
      value = service.applyTerminologyToTranslation(value);
    } catch (e) {}
  }

  // 3) 结果校验
  if (typeof translationValidateResult === "function" && item) {
    var vr = translationValidateResult(item.sourceText, value);
    if (!vr.ok) return { ok: false, reason: vr.reason, translated: value };
  }

  return { ok: true, translated: value };
}
