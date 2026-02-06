// ==================== DeepSeek 高级设置 ====================
// 从 settings.js 拆分出来的独立模块
// 提供 Priming 样本选择、会话上下文查看器等

function __getItemKeyForContext(item) {
  if (!item) return "";
  return (
    item?.metadata?.resourceId ||
    item?.metadata?.key ||
    item?.metadata?.path ||
    item?.metadata?.unitId ||
    item?.metadata?.contextName ||
    item?.id ||
    ""
  );
}

function __getPrimingBaseItems() {
  const all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  const selectedFile = AppState?.translations?.selectedFile;
  if (selectedFile) {
    const filtered = all.filter((it) => it?.metadata?.file === selectedFile);
    if (filtered.length > 0) return filtered;
  }
  const visible = Array.isArray(AppState?.translations?.filtered)
    ? AppState.translations.filtered
    : [];
  return visible.length > 0 ? visible : all;
}

function __getDefaultPrimingSampleIds(items, count) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < items.length && out.length < count; i++) {
    const it = items[i];
    const id = it?.id;
    if (!id || seen.has(id)) continue;
    const source = (it?.sourceText || "").trim();
    if (!source) continue;
    out.push(id);
    seen.add(id);
  }
  return out;
}

function __updatePrimingSelectedCountLabel() {
  try {
    const idsEl = document.getElementById("deepseekPrimingSampleIds");
    const countEl = document.getElementById("deepseekPrimingSelectedCount");
    if (!idsEl || !countEl) return;
    const ids = safeJsonParse(idsEl.value, []);
    countEl.textContent = String(Array.isArray(ids) ? ids.length : 0);
  } catch (_) {}
}

function __renderPrimingSamplesModal() {
  const listEl = document.getElementById("deepseekPrimingSamplesList");
  const idsEl = document.getElementById("deepseekPrimingSampleIds");
  const countInput = document.getElementById("deepseekPrimingSampleCount");
  if (!listEl || !idsEl) return;

  const items = __getPrimingBaseItems();
  const rawCount = parseInt(countInput?.value);
  const desiredCount = Number.isFinite(rawCount)
    ? Math.max(1, Math.min(20, rawCount))
    : 3;

  let selectedIds = safeJsonParse(idsEl.value, []);
  if (!Array.isArray(selectedIds)) selectedIds = [];
  if (selectedIds.length === 0) {
    selectedIds = __getDefaultPrimingSampleIds(items, desiredCount);
    try {
      idsEl.value = JSON.stringify(selectedIds);
    } catch (_) {
      idsEl.value = "[]";
      selectedIds = [];
    }
    __updatePrimingSelectedCountLabel();
  }

  const selectedSet = new Set(selectedIds);
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const id = item.id;
    if (!id) continue;

    const wrap = document.createElement("label");
    wrap.className =
      "flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "mt-1";
    checkbox.dataset.id = String(id);
    checkbox.checked = selectedSet.has(id);

    const body = document.createElement("div");
    body.className = "min-w-0";

    const key = __getItemKeyForContext(item);
    const file = item?.metadata?.file || "";
    const sourceText = (item?.sourceText || "").toString();
    const sourcePreview =
      sourceText.length > 200
        ? sourceText.substring(0, 200) + "..."
        : sourceText;

    const title = document.createElement("div");
    title.className = "text-xs text-gray-500 dark:text-gray-400 break-words";
    title.textContent = `${file ? file + " · " : ""}${key}`;

    const content = document.createElement("div");
    content.className =
      "text-sm text-gray-800 dark:text-gray-100 break-words whitespace-pre-wrap mt-1";
    content.textContent = sourcePreview;

    body.appendChild(title);
    body.appendChild(content);

    wrap.appendChild(checkbox);
    wrap.appendChild(body);

    fragment.appendChild(wrap);
  }

  listEl.replaceChildren(fragment);
}

function __buildDeepseekConversationKey(scope) {
  const projectId = AppState?.project?.id || "";
  if (!projectId) return "";
  const normalizedScope = scope || "project";
  if (normalizedScope === "project") return `deepseek:${projectId}`;

  const selectedFile = AppState?.translations?.selectedFile || "";
  const all = Array.isArray(AppState?.project?.translationItems)
    ? AppState.project.translationItems
    : [];
  const first = all.length > 0 ? all[0] : null;
  const file = selectedFile || first?.metadata?.file || "";

  if (normalizedScope === "file") {
    return `deepseek:${projectId}:file:${file}`;
  }

  const ext = (file.split(".").pop() || "").toLowerCase();
  return `deepseek:${projectId}:type:${ext}`;
}

function __normalizeConversationToFlatMessages(messages) {
  const safe = Array.isArray(messages) ? messages : [];
  const out = [];
  for (let i = 0; i < safe.length; i++) {
    const item = safe[i];
    if (!item) continue;
    if (item.role && item.content !== undefined) {
      out.push({ role: item.role, content: item.content });
    } else if (item.user && item.assistant) {
      out.push({ role: "system", content: item.system || "" });
      if (item.priming && item.priming.content !== undefined) {
        out.push({ role: "user", content: "(Priming) " + (item.priming.content || "") });
      }
      out.push({ role: "user", content: (item.user && item.user.content) || "" });
      out.push({ role: "assistant", content: (item.assistant && item.assistant.content) || "" });
    }
  }
  return out;
}

function __renderDeepseekConversationMessages(messages) {
  const listEl = document.getElementById("deepseekConversationMessages");
  if (!listEl) return;
  listEl.replaceChildren();

  const flat = __normalizeConversationToFlatMessages(messages);
  if (flat.length === 0) {
    const empty = document.createElement("div");
    empty.className =
      "text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3";
    empty.textContent = "当前会话为空";
    listEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < flat.length; i++) {
    const msg = flat[i] || {};
    const row = document.createElement("div");
    row.className =
      "border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900";

    const header = document.createElement("div");
    header.className =
      "flex items-center justify-between gap-3 mb-2 text-xs text-gray-500 dark:text-gray-400";

    const role = document.createElement("div");
    role.className = "font-medium";
    role.textContent = String(msg.role || "");

    const index = document.createElement("div");
    index.textContent = `#${i + 1}`;

    header.appendChild(role);
    header.appendChild(index);

    const body = document.createElement("div");
    body.className =
      "text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words";
    body.textContent = String(msg.content || "");

    row.appendChild(header);
    row.appendChild(body);
    listEl.appendChild(row);
  }
}

function __getDeepseekConversationSnapshot() {
  const out = {};
  try {
    const map = translationService?.deepseekConversations;
    if (!map || typeof map.entries !== "function") return out;
    for (const [key, value] of map.entries()) {
      out[String(key)] = Array.isArray(value) ? value : [];
    }
    return out;
  } catch (_) {
    return out;
  }
}

function registerEventListenersSettingsDeepseek(ctx) {
  const selectPrimingBtn = document.getElementById(
    "selectDeepseekPrimingSamples",
  );
  if (selectPrimingBtn) {
    EventManager.add(
      selectPrimingBtn,
      "click",
      () => {
        __renderPrimingSamplesModal();
        openModal("deepseekPrimingSamplesModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "selectDeepseekPrimingSamples:click",
      },
    );
  }

  const savePrimingBtn = document.getElementById("saveDeepseekPrimingSamples");
  if (savePrimingBtn) {
    EventManager.add(
      savePrimingBtn,
      "click",
      () => {
        const listEl = document.getElementById("deepseekPrimingSamplesList");
        const idsEl = document.getElementById("deepseekPrimingSampleIds");
        const countInput = document.getElementById(
          "deepseekPrimingSampleCount",
        );
        if (!listEl || !idsEl) return;

        const rawCount = parseInt(countInput?.value);
        const desiredCount = Number.isFinite(rawCount)
          ? Math.max(1, Math.min(20, rawCount))
          : 3;

        const items = __getPrimingBaseItems();
        const order = new Map();
        for (let i = 0; i < items.length; i++) {
          const id = items[i]?.id;
          if (id && !order.has(id)) order.set(id, i);
        }

        const checked = Array.from(
          listEl.querySelectorAll('input[type="checkbox"][data-id]'),
        )
          .filter((el) => el.checked)
          .map((el) => String(el.dataset.id));

        checked.sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0));

        const trimmed = checked.slice(0, desiredCount);
        try {
          idsEl.value = JSON.stringify(trimmed);
        } catch (_) {
          idsEl.value = "[]";
        }
        __updatePrimingSelectedCountLabel();
        closeModal("deepseekPrimingSamplesModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "saveDeepseekPrimingSamples:click",
      },
    );
  }

  const clearConversationBtn = document.getElementById(
    "clearDeepseekConversation",
  );
  if (clearConversationBtn) {
    EventManager.add(
      clearConversationBtn,
      "click",
      () => {
        try {
          if (
            translationService &&
            translationService.deepseekConversations &&
            typeof translationService.deepseekConversations.clear === "function"
          ) {
            translationService.deepseekConversations.clear();
          }
        } catch (_) {}
        showNotification("success", "已清空会话", "DeepSeek 会话上下文已清空");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "clearDeepseekConversation:click",
      },
    );
  }

  const viewConversationBtn = document.getElementById(
    "viewDeepseekConversation",
  );
  if (viewConversationBtn) {
    EventManager.add(
      viewConversationBtn,
      "click",
      () => {
        const keySelect = document.getElementById(
          "deepseekConversationKeySelect",
        );
        const metaEl = document.getElementById("deepseekConversationMeta");
        const copyBtn = document.getElementById("copyDeepseekConversation");

        const scope =
          document.getElementById("deepseekConversationScope")?.value ||
          "project";
        const defaultKey = __buildDeepseekConversationKey(scope);

        const snapshot = __getDeepseekConversationSnapshot();
        const keys = Object.keys(snapshot);
        const selectedKey =
          defaultKey && snapshot[defaultKey]
            ? defaultKey
            : keys.length > 0
              ? keys[0]
              : defaultKey;

        if (keySelect) {
          keySelect.replaceChildren();
          const allKeys =
            keys.length > 0 ? keys : selectedKey ? [selectedKey] : [];
          for (let i = 0; i < allKeys.length; i++) {
            const k = allKeys[i];
            const opt = document.createElement("option");
            opt.value = k;
            const arr = Array.isArray(snapshot[k]) ? snapshot[k] : [];
            const first = arr[0];
            const isRounds = first && first.user && first.assistant;
            const countLabel = isRounds ? `${arr.length} 轮` : `${arr.length} 条`;
            opt.textContent = `${k} (${countLabel})`;
            keySelect.appendChild(opt);
          }
          if (selectedKey) keySelect.value = selectedKey;
        }

        const renderSelected = () => {
          const k = keySelect ? keySelect.value : selectedKey;
          const messages = snapshot[k] || [];
          if (metaEl) {
            const enabled = !!document.getElementById(
              "deepseekConversationEnabled",
            )?.checked;
            const rawKey = String(k || "");
            const prefix = rawKey.startsWith("deepseek:") ? "deepseek:" : "";
            const rest = prefix ? rawKey.slice(prefix.length) : rawKey;
            const parts = rest
              ? rest
                  .split(":")
                  .map((p) => String(p || "").trim())
                  .filter(Boolean)
              : [];
            const lines = [
              `范围: ${scope}`,
              `启用记忆: ${enabled ? "是" : "否"}`,
              `Key: ${prefix ? "deepseek" : rawKey ? rawKey.split(":")[0] : ""}`,
            ];

            for (let i = 0; i < parts.length; i += 2) {
              const label = parts[i];
              const value = parts[i + 1];
              if (!label) continue;
              if (value) {
                lines.push(`${label}:${value}`);
              } else {
                lines.push(label);
              }
            }

            metaEl.textContent = lines.filter(Boolean).join("\n");
          }
          __renderDeepseekConversationMessages(messages);
          if (copyBtn) {
            copyBtn.onclick = async () => {
              try {
                const raw = snapshot[k] || [];
                const payload = JSON.stringify(
                  { key: k, scope, messages: raw },
                  null,
                  2,
                );
                if (navigator?.clipboard?.writeText) {
                  await navigator.clipboard.writeText(payload);
                  showNotification(
                    "success",
                    "已复制",
                    "会话内容已复制到剪贴板",
                  );
                } else {
                  throw new Error("clipboard not available");
                }
              } catch (_) {
                showNotification(
                  "warning",
                  "复制失败",
                  "当前环境不支持自动复制",
                );
              }
            };
          }
        };

        if (keySelect) {
          keySelect.onchange = renderSelected;
        }
        renderSelected();
        openModal("deepseekConversationViewerModal");
      },
      {
        tag: "settings",
        scope: "settingsModal",
        label: "viewDeepseekConversation:click",
      },
    );
  }

  __updatePrimingSelectedCountLabel();
}
