// ==================== 源文件编辑器 ====================
// 在文件树中编辑导入文件的原始内容，保存后重新解析并保留已翻译项
(function () {
  var App = (window.App = window.App || {});
  App.features = App.features || {};
  App.features.files = App.features.files || {};

  var _editingFileName = null;

  // 提取条目匹配键（与格式无关的定位字段）
  function __itemKey(item) {
    if (!item || !item.metadata) return "";
    var m = item.metadata;
    return String(
      m.key || m.resourceId || m.unitId || m.path || m.msgctxt || ""
    ).trim();
  }

  // 校验新内容（按格式做语法检查，失败返回错误信息）
  async function __validateContent(content, fileName) {
    var ext = String(fileName || "").split(".").pop().toLowerCase();
    if (["xml", "xlf", "xliff", "resx", "ts"].includes(ext)) {
      try {
        var doc = new DOMParser().parseFromString(content, "application/xml");
        var perr = doc.querySelector("parsererror");
        if (perr) return "XML 解析错误：" + (perr.textContent || "").slice(0, 200);
      } catch (e) {
        return "XML 解析错误：" + e.message;
      }
    } else if (ext === "json") {
      try { JSON.parse(content); }
      catch (e) { return "JSON 解析错误：" + e.message; }
    } else if (ext === "yaml" || ext === "yml") {
      try {
        if (typeof window.jsyaml === "undefined") {
          var ensure = window.App?.services?.ensureJsYaml;
          if (typeof ensure === "function") await ensure();
        }
        if (typeof window.jsyaml !== "undefined") window.jsyaml.load(content);
      } catch (e) {
        return "YAML 解析错误：" + e.message;
      }
    }
    return null;
  }

  // 打开编辑器
  async function openSourceEditor(fileName) {
    if (!fileName) return;
    var meta = AppState.fileMetadata?.[fileName] || {};
    var content = meta.originalContent;
    if (typeof content !== "string") {
      // 尝试从 IndexedDB 加载原始内容
      try {
        if (meta.contentKey && typeof idbGetFileContent === "function") {
          content = await idbGetFileContent(meta.contentKey);
        }
      } catch (e) {
        (loggers.app || console).debug("load original content:", e);
      }
    }
    if (typeof content !== "string") {
      showNotification("warning", "无原始内容", "该文件没有可编辑的原始内容");
      return;
    }

    _editingFileName = fileName;
    var nameEl = DOMCache.get("sourceEditorFileName");
    if (nameEl) nameEl.textContent = fileName;
    var ta = DOMCache.get("sourceEditorContent");
    if (ta) ta.value = content;
    var errEl = DOMCache.get("sourceEditorError");
    if (errEl) {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
    if (typeof openModal === "function") openModal("sourceEditorModal");
    else {
      var m = DOMCache.get("sourceEditorModal");
      if (m) m.classList.remove("hidden");
    }
  }

  // 保存：校验 → 重新解析 → 合并保留已翻译项 → 持久化
  async function saveSourceEditor() {
    var fileName = _editingFileName;
    if (!fileName) return;

    var ta = DOMCache.get("sourceEditorContent");
    var newContent = ta ? ta.value : "";
    var errEl = DOMCache.get("sourceEditorError");

    // 1. 语法校验
    var errMsg = await __validateContent(newContent, fileName);
    if (errMsg) {
      if (errEl) {
        errEl.textContent = errMsg;
        errEl.classList.remove("hidden");
      }
      return;
    }

    try {
      // 2. 重新解析
      var fileObj = new File([newContent], fileName, {
        type: AppState.fileMetadata?.[fileName]?.type || "text/plain",
      });
      var result = await App.impl.parseFileAsync(fileObj);
      if (!result || result.success === false) {
        var errItem = result && result.items && result.items[0];
        throw new Error((errItem && errItem.context) || "解析失败");
      }
      var newItems = result && Array.isArray(result.items) ? result.items : [];

      // 3. 合并保留已翻译项（按 key/路径匹配回填译文与状态）
      var oldFileItems = (AppState.project?.translationItems || []).filter(
        function (it) { return it?.metadata?.file === fileName; }
      );
      var oldByKey = new Map();
      for (var oi = 0; oi < oldFileItems.length; oi++) {
        var ok = __itemKey(oldFileItems[oi]);
        if (ok) oldByKey.set(ok, oldFileItems[oi]);
        else oldByKey.set(String(oldFileItems[oi].sourceText), oldFileItems[oi]);
      }
      for (var ni = 0; ni < newItems.length; ni++) {
        var nk = __itemKey(newItems[ni]) || String(newItems[ni].sourceText);
        var oldIt = oldByKey.get(nk);
        if (oldIt && oldIt.targetText && String(oldIt.targetText).trim()) {
          newItems[ni].targetText = oldIt.targetText;
          newItems[ni].status = oldIt.status || "translated";
          newItems[ni].qualityScore = oldIt.qualityScore || 85;
        }
      }

      // 4. 更新状态：替换该文件的条目 + 更新原始内容
      var kept = (AppState.project?.translationItems || []).filter(
        function (it) { return it?.metadata?.file !== fileName; }
      );
      AppState.project.translationItems = kept.concat(newItems);
      AppState.translations.items = AppState.project.translationItems;
      AppState.translations.filtered = [...AppState.translations.items];

      var meta = AppState.fileMetadata?.[fileName] || {};
      meta.originalContent = newContent;
      meta.size = new Blob([newContent]).size;
      meta.updatedAt = new Date().toISOString();
      if (AppState.project?.fileMetadata) {
        AppState.project.fileMetadata[fileName] = meta;
      }
      try {
        if (meta.contentKey && typeof idbPutFileContent === "function") {
          await idbPutFileContent(meta.contentKey, newContent);
        }
      } catch (e) {
        (loggers.storage || console).warn("更新 IndexedDB 文件内容失败:", e);
      }

      // 5. 持久化项目 + 刷新 UI
      if (typeof autoSaveManager !== "undefined" && autoSaveManager) {
        autoSaveManager.markDirty();
        Promise.resolve(autoSaveManager.saveProject()).catch(function (e) {
          (loggers.storage || console).error("保存项目失败:", e);
        });
      }
      if (typeof updateFileTree === "function") updateFileTree();
      if (typeof updateTranslationLists === "function") updateTranslationLists();
      if (typeof updateCounters === "function") updateCounters();
      if (typeof invalidateSearchCache === "function") invalidateSearchCache();

      if (typeof closeModal === "function") closeModal("sourceEditorModal");
      else {
        var m2 = DOMCache.get("sourceEditorModal");
        if (m2) m2.classList.add("hidden");
      }
      _editingFileName = null;

      showNotification(
        "success",
        "源文件已更新",
        `已重新解析 ${fileName}（${newItems.length} 项，已保留翻译）`
      );
    } catch (e) {
      (loggers.app || console).error("保存源文件失败:", e);
      if (errEl) {
        errEl.textContent = "解析失败：" + (e && e.message || e);
        errEl.classList.remove("hidden");
      }
    }
  }

  function closeSourceEditor() {
    if (typeof closeModal === "function") closeModal("sourceEditorModal");
    else {
      var m = DOMCache.get("sourceEditorModal");
      if (m) m.classList.add("hidden");
    }
    _editingFileName = null;
  }

  // 事件注册
  function registerSourceEditorEvents() {
    var saveBtn = DOMCache.get("sourceEditorSaveBtn");
    if (saveBtn) {
      if (typeof EventManager !== "undefined" && EventManager.add) {
        EventManager.add(saveBtn, "click", saveSourceEditor, {
          tag: "ui", scope: "sourceEditor", label: "sourceEditorSaveBtn:click",
        });
      } else {
        saveBtn.addEventListener("click", saveSourceEditor);
      }
    }
    var cancelBtn = DOMCache.get("sourceEditorCancelBtn");
    if (cancelBtn) {
      if (typeof EventManager !== "undefined" && EventManager.add) {
        EventManager.add(cancelBtn, "click", closeSourceEditor, {
          tag: "ui", scope: "sourceEditor", label: "sourceEditorCancelBtn:click",
        });
      } else {
        cancelBtn.addEventListener("click", closeSourceEditor);
      }
    }
    // Ctrl+Enter 保存
    var ta = DOMCache.get("sourceEditorContent");
    if (ta) {
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          saveSourceEditor();
        }
        if (e.key === "Escape") closeSourceEditor();
      });
    }
  }

  App.features.files.openSourceEditor = openSourceEditor;
  window.openSourceEditor = openSourceEditor;
  window.saveSourceEditor = saveSourceEditor;
  window.closeSourceEditor = closeSourceEditor;
  window.registerSourceEditorEvents = registerSourceEditorEvents;
})();
