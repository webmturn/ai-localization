// ==================== 源文件编辑器 ====================
// 在文件树中编辑导入文件的原始内容，保存后重新解析并保留已翻译项
(function () {
  var App = (window.App = window.App || {});
  App.features = App.features || {};
  App.features.files = App.features.files || {};

  var _editingFileName = null;
  var _saving = false;

  // 提取条目匹配键（与格式无关的定位字段）
  function __itemKey(item) {
    if (!item || !item.metadata) return "";
    var m = item.metadata;
    return String(
      m.key || m.resourceId || m.unitId || m.path || m.msgctxt || ""
    ).trim();
  }

  function __indexOldItems(items) {
    var map = new Map();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var k = __itemKey(it);
      var bucket = k ? "k:" + k : "s:" + String(it && it.sourceText);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket).push(it);
    }
    return map;
  }

  function __takeOldItem(map, newItem) {
    var k = __itemKey(newItem);
    var list = k ? map.get("k:" + k) : null;
    if (!list || !list.length) {
      list = map.get("s:" + String(newItem && newItem.sourceText));
    }
    if (!list || !list.length) return null;
    var src = String(newItem && newItem.sourceText);
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].sourceText) === src) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = 0;
    return list.splice(idx, 1)[0];
  }

  function __mergePreservedFields(newItem, oldIt) {
    if (!oldIt) return { sourceChanged: false, keptTranslation: false };
    newItem.id = oldIt.id || newItem.id;
    if (oldIt.context && !newItem.context) newItem.context = oldIt.context;
    if (Array.isArray(oldIt.issues) && oldIt.issues.length) {
      newItem.issues = oldIt.issues.slice();
    }
    var sourceChanged = String(oldIt.sourceText) !== String(newItem.sourceText);
    var keptTranslation = false;
    if (oldIt.targetText && String(oldIt.targetText).trim()) {
      newItem.targetText = oldIt.targetText;
      newItem.status = oldIt.status || "translated";
      newItem.qualityScore =
        oldIt.qualityScore != null ? oldIt.qualityScore : 85;
      keptTranslation = true;
    }
    if (oldIt.metadata && newItem.metadata) {
      var extraKeys = Object.keys(oldIt.metadata);
      for (var ei = 0; ei < extraKeys.length; ei++) {
        var ek = extraKeys[ei];
        if (newItem.metadata[ek] == null && oldIt.metadata[ek] != null) {
          newItem.metadata[ek] = oldIt.metadata[ek];
        }
      }
    }
    return { sourceChanged: sourceChanged, keptTranslation: keptTranslation };
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

  function __setEditorBusy(busy) {
    var saveBtn = DOMCache.get("sourceEditorSaveBtn");
    var ta = DOMCache.get("sourceEditorContent");
    if (saveBtn) saveBtn.disabled = !!busy;
    if (ta) ta.readOnly = !!busy;
  }

  function __showEditorError(errEl, message) {
    if (!errEl) return;
    errEl.textContent = message || "";
    if (message) errEl.classList.remove("hidden");
    else {
      errEl.classList.add("hidden");
      errEl.textContent = "";
    }
  }

  // 打开编辑器
  async function openSourceEditor(fileName) {
    if (!fileName) return;
    var meta = AppState.fileMetadata?.[fileName] || {};
    var content = meta.originalContent;
    if (typeof content !== "string") {
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
    __showEditorError(DOMCache.get("sourceEditorError"), "");
    __setEditorBusy(false);
    if (typeof openModal === "function") openModal("sourceEditorModal");
    else {
      var m = DOMCache.get("sourceEditorModal");
      if (m) m.classList.remove("hidden");
    }
  }

  // 保存：校验 → 重新解析（无导入副作用）→ 合并保留已翻译项 → 再持久化
  async function saveSourceEditor() {
    var fileName = _editingFileName;
    if (!fileName || _saving) return;

    var ta = DOMCache.get("sourceEditorContent");
    var newContent = ta ? ta.value : "";
    var errEl = DOMCache.get("sourceEditorError");

    // 忙标记在校验前置位：__validateContent 内 YAML 校验可能触发 js-yaml 动态加载（异步窗口），
    // 提前置位防止该窗口内双击/Ctrl+Enter 并发双保存
    _saving = true;
    __setEditorBusy(true);

    var errMsg = await __validateContent(newContent, fileName);
    if (errMsg) {
      __showEditorError(errEl, errMsg);
      _saving = false;
      __setEditorBusy(false);
      return;
    }
    __showEditorError(errEl, "");

    try {
      var fileObj = new File([newContent], fileName, {
        type: AppState.fileMetadata?.[fileName]?.type || "text/plain",
      });
      var parseFn =
        (App.impl && App.impl.parseFileAsync) ||
        (typeof parseFileAsync === "function" ? parseFileAsync : null);
      if (typeof parseFn !== "function") {
        throw new Error("未找到文件解析实现");
      }
      var result = await parseFn(fileObj, { silent: true, skipPersist: true });
      if (!result) {
        throw new Error("解析被跳过（该格式可能已在设置中禁用）");
      }
      if (result.success === false) {
        var errItem = result.items && result.items[0];
        throw new Error((errItem && errItem.context) || "解析失败");
      }
      var newItems = Array.isArray(result.items) ? result.items : [];

      var oldFileItems = (AppState.project?.translationItems || []).filter(
        function (it) { return it?.metadata?.file === fileName; }
      );
      var oldByKey = __indexOldItems(oldFileItems);
      var keptCount = 0;
      var sourceChangedCount = 0;
      for (var ni = 0; ni < newItems.length; ni++) {
        var oldIt = __takeOldItem(oldByKey, newItems[ni]);
        var merged = __mergePreservedFields(newItems[ni], oldIt);
        if (merged.keptTranslation) keptCount++;
        if (merged.sourceChanged && merged.keptTranslation) sourceChangedCount++;
      }

      // 经 ProjectStore 替换该文件条目并同步 translations 视图（含项目存在性校验）
      ProjectStore.replaceFileItems(fileName, newItems);

      // 经 ProjectStore 更新文件元数据（含 project.fileMetadata 派生引用维护）
      var meta = AppState.fileMetadata[fileName] || {};
      meta.originalContent = newContent;
      meta.size = new Blob([newContent]).size;
      meta.updatedAt = new Date().toISOString();
      if (!meta.type) meta.type = fileObj.type || "text/plain";
      if (!meta.extension) {
        meta.extension = String(fileName).split(".").pop().toLowerCase();
      }
      ProjectStore.setFileMetadata(fileName, meta);
      try {
        if (meta.contentKey && typeof idbPutFileContent === "function") {
          await idbPutFileContent(meta.contentKey, newContent);
        }
      } catch (e) {
        (loggers.storage || console).warn("更新 IndexedDB 文件内容失败:", e);
      }

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

      _saving = false;
      __setEditorBusy(false);
      if (typeof closeModal === "function") closeModal("sourceEditorModal");
      else {
        var m2 = DOMCache.get("sourceEditorModal");
        if (m2) m2.classList.add("hidden");
      }
      _editingFileName = null;

      var extra =
        sourceChangedCount > 0
          ? "；其中 " + sourceChangedCount + " 项原文已变但仍保留旧译文，请核对"
          : "";
      showNotification(
        "success",
        "源文件已更新",
        "已重新解析 " +
          fileName +
          "（" +
          newItems.length +
          " 项，保留翻译 " +
          keptCount +
          " 项）" +
          extra
      );
    } catch (e) {
      (loggers.app || console).error("保存源文件失败:", e);
      __showEditorError(errEl, "解析失败：" + ((e && e.message) || e));
    } finally {
      _saving = false;
      __setEditorBusy(false);
    }
  }

  function closeSourceEditor() {
    if (_saving) return;
    if (typeof closeModal === "function") closeModal("sourceEditorModal");
    else {
      var m = DOMCache.get("sourceEditorModal");
      if (m) m.classList.add("hidden");
    }
    _editingFileName = null;
  }

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
  window.isSourceEditorBusy = function () { return _saving; };
})();
