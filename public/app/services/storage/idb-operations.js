// ==================== IndexedDB 底层操作 ====================
// 从 storage-manager.js 拆分出来的独立模块
// 提供 openFileContentDB 及所有 idb* 前缀函数

const __fileContentDB = {
  db: null,
  opening: null,
};

let __notifiedIdbFileContentError = false;
let __notifiedIdbVersionChange = false;
function notifyIndexedDbFileContentErrorOnce(error, action) {
  if (__notifiedIdbFileContentError) return;
  __notifiedIdbFileContentError = true;
  if (typeof showNotification !== "function") return;

  const errName = error && error.name ? String(error.name) : "";
  const errMsg = error && error.message ? String(error.message) : String(error);
  const prefix = action ? `${action}：` : "";

  if (errName === "QuotaExceededError") {
    showNotification(
      "error",
      "存储空间不足",
      `${prefix}IndexedDB 存储空间不足。建议：清理站点数据/减少导入/导出项目备份。`
    );
  } else if (errName === "AbortError") {
    showNotification(
      "warning",
      "IndexedDB写入中止",
      `${prefix}IndexedDB 写入被中止（可能是权限/并发/浏览器策略变化）。`
    );
  } else if (errName === "InvalidStateError") {
    showNotification(
      "warning",
      "IndexedDB状态异常",
      `${prefix}IndexedDB 状态异常（可能连接被关闭或升级中）。`
    );
  } else if (/blocked/i.test(errMsg) || /version/i.test(errMsg)) {
    showNotification(
      "warning",
      "IndexedDB被阻塞",
      `${prefix}IndexedDB 可能被其他标签页占用或正在升级，请关闭其他标签页后重试。`
    );
  } else {
    showNotification(
      "warning",
      "IndexedDB异常",
      `${prefix}IndexedDB 操作失败。若问题持续，请清理站点数据或关闭其他标签页。`
    );
  }
}

function openFileContentDB() {
  if (__fileContentDB.db) return Promise.resolve(__fileContentDB.db);
  if (__fileContentDB.opening) return __fileContentDB.opening;

  __fileContentDB.opening = new Promise((resolve, reject) => {
    const request = indexedDB.open("xml-translator-db", 3);
    request.onblocked = () => {
      (window.loggers?.storage || console).warn(
        "IndexedDB升级/打开被阻塞：可能有其他标签页正在使用旧版本数据库"
      );
      if (typeof showNotification === "function") {
        showNotification(
          "warning",
          "IndexedDB被阻塞",
          "数据库升级被阻塞，请关闭此站点的其他标签页后重试。"
        );
      }
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("fileContents")) {
        db.createObjectStore("fileContents", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("projects")) {
        db.createObjectStore("projects", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("fsHandles")) {
        db.createObjectStore("fsHandles", { keyPath: "key" });
      }
    };
    request.onsuccess = (event) => {
      __fileContentDB.db = event.target.result;
      __fileContentDB.opening = null;

      try {
        __fileContentDB.db.onversionchange = () => {
          if (!__notifiedIdbVersionChange && typeof showNotification === "function") {
            __notifiedIdbVersionChange = true;
            try {
              showNotification(
                "warning",
                "存储已更新",
                "检测到数据库版本变更，当前页面的存储连接将被关闭。建议刷新页面以继续正常保存。"
              );
            } catch (_) {
              (loggers.storage || console).debug("idb versionchange notification:", _);
            }
          }
          try {
            __fileContentDB.db.close();
          } catch (e) {
            // ignore
          }
          __fileContentDB.db = null;
        };
      } catch (e) {
        // ignore
      }

      resolve(__fileContentDB.db);
    };
    request.onerror = () => {
      const err = request.error || new Error("IndexedDB打开失败");
      __fileContentDB.opening = null;
      __fileContentDB.db = null;
      reject(err);
    };
  });

  return __fileContentDB.opening;
}

const __fileContentLsFallbackPrefix = "__fc:";
let __fileContentLsFallbackNotified = false;

function __fileContentLsFallbackWarn(action) {
  if (__fileContentLsFallbackNotified) return;
  __fileContentLsFallbackNotified = true;
  (window.loggers?.storage || console).warn(
    `文件内容${action}：IndexedDB不可用，已降级到 localStorage（容量受限）`
  );
}

function idbPutFileContent(key, content) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        store.put({ key, content, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB写入失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB写入中止"));
      })
  ).catch((e) => {
    try {
      localStorage.setItem(__fileContentLsFallbackPrefix + key, content);
      __fileContentLsFallbackWarn("写入");
      return true;
    } catch (lsErr) {
      throw e;
    }
  });
}

function idbGetFileContent(key) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readonly");
        const store = tx.objectStore("fileContents");
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.content : null);
        req.onerror = () => reject(req.error || new Error("IndexedDB读取失败"));
      })
  ).catch((e) => {
    try {
      const val = localStorage.getItem(__fileContentLsFallbackPrefix + key);
      if (val !== null) {
        __fileContentLsFallbackWarn("读取");
        return val;
      }
    } catch (_) {
      (loggers.storage || console).debug("idb localStorage fallback read:", _);
    }
    throw e;
  });
}

const __projectLsFallbackPrefix = "__proj:";
let __projectLsFallbackNotified = false;

function __projectLsFallbackWarn(action) {
  if (__projectLsFallbackNotified) return;
  __projectLsFallbackNotified = true;
  (window.loggers?.storage || console).warn(
    `项目${action}：IndexedDB不可用，已降级到 localStorage（容量受限）`
  );
}

function idbPutProject(key, projectJson) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const store = tx.objectStore("projects");
        store.put({ key, projectJson, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB写入失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB写入中止"));
      })
  ).catch((e) => {
    try {
      localStorage.setItem(__projectLsFallbackPrefix + key, projectJson);
      __projectLsFallbackWarn("保存");
      return true;
    } catch (lsErr) {
      throw e;
    }
  });
}

function idbGetProject(key) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readonly");
        const store = tx.objectStore("projects");
        const req = store.get(key);
        req.onsuccess = () =>
          resolve(req.result ? req.result.projectJson : null);
        req.onerror = () => reject(req.error || new Error("IndexedDB读取失败"));
      })
  ).catch((e) => {
    try {
      const val = localStorage.getItem(__projectLsFallbackPrefix + key);
      if (val !== null) {
        __projectLsFallbackWarn("读取");
        return val;
      }
    } catch (_) {
      (loggers.storage || console).debug("idb project localStorage fallback read:", _);
    }
    throw e;
  });
}

function idbDeleteProject(key) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        const store = tx.objectStore("projects");
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB删除失败"));
      })
  ).catch((e) => {
    try {
      localStorage.removeItem(__projectLsFallbackPrefix + key);
      __projectLsFallbackWarn("删除");
      return true;
    } catch (lsErr) {
      throw e;
    }
  });
}

const __fsHandleStoreKey = "__fsDirectoryHandle";
const __fsAccessState = {
  handle: null,
  loading: null,
};

function supportsFileSystemAccess() {
  return (
    typeof window !== "undefined" && typeof window.showDirectoryPicker === "function"
  );
}

function idbPutFsHandle(handle) {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fsHandles", "readwrite");
        const store = tx.objectStore("fsHandles");
        store.put({ key: __fsHandleStoreKey, handle, updatedAt: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB写入失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB写入中止"));
      })
  );
}

function idbGetFsHandle() {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fsHandles", "readonly");
        const store = tx.objectStore("fsHandles");
        const req = store.get(__fsHandleStoreKey);
        req.onsuccess = () => resolve(req.result ? req.result.handle : null);
        req.onerror = () => reject(req.error || new Error("IndexedDB读取失败"));
      })
  );
}

function idbDeleteFsHandle() {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fsHandles", "readwrite");
        const store = tx.objectStore("fsHandles");
        const req = store.delete(__fsHandleStoreKey);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB删除失败"));
      })
  );
}

function idbClearAllFileContents() {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB清空失败"));
      })
  );
}

function idbDeleteFileContentsForProject(projectId) {
  if (!projectId) return Promise.resolve(false);
  const prefix = `${projectId}::`;
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        const cursorReq = store.openCursor();
        let deletedCount = 0;
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const k = cursor.key;
            if (typeof k === "string" && k.startsWith(prefix)) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => {
          if (deletedCount > 0) {
            (window.loggers?.storage || console).debug?.(
              `已清理项目 ${projectId} 的 ${deletedCount} 条文件内容缓存`
            );
          }
          resolve(deletedCount > 0);
        };
        tx.onerror = () => reject(tx.error || new Error("IndexedDB删除失败"));
      })
  );
}

function idbGarbageCollectFileContents() {
  const projectId = AppState.project?.id;
  const prefix = projectId ? `${projectId}::` : null;
  const referenced = new Set();

  if (AppState.fileMetadata) {
    for (const [, meta] of Object.entries(AppState.fileMetadata)) {
      if (meta && meta.contentKey) referenced.add(meta.contentKey);
    }
  }

  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        const cursorReq = store.openCursor();
        let deletedCount = 0;
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            const k = cursor.key;
            if (typeof k === "string") {
              const belongsToProject = prefix ? k.startsWith(prefix) : true;
              if (belongsToProject && !referenced.has(k)) {
                cursor.delete();
                deletedCount++;
              }
            }
            cursor.continue();
          }
        };
        tx.oncomplete = () => {
          if (deletedCount > 0) {
            (window.loggers?.storage || console).debug?.(`GC：已清理 ${deletedCount} 条无引用的文件内容缓存`);
          }
          resolve(deletedCount);
        };
        tx.onerror = () => reject(tx.error || new Error("IndexedDB GC 失败"));
      })
  );
}

let __idbGcTimer = null;
function scheduleIdbGarbageCollection(delayMs = 5000) {
  if (__idbGcTimer) {
    clearTimeout(__idbGcTimer);
    __idbGcTimer = null;
  }
  __idbGcTimer = setTimeout(() => {
    __idbGcTimer = null;
    try {
      idbGarbageCollectFileContents().catch((err) => {
        (window.loggers?.storage || console).warn("文件内容GC失败:", err);
      });
    } catch (err) {
      (window.loggers?.storage || console).warn("文件内容GC异常:", err);
    }
  }, delayMs);
}
