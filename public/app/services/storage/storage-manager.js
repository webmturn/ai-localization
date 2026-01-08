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
    const request = indexedDB.open("xml-translator-db", 2);
    request.onblocked = () => {
      console.warn(
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
            } catch (_) {}
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
  );
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
  );
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
  );
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
  );
}

class LocalStorageProjectStorage {
  constructor() {
    this.backendId = "localStorage";
    this.currentProjectKey = "currentProject";
  }

  async loadJson(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  async saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  }

  async remove(key) {
    localStorage.removeItem(key);
    return true;
  }

  async loadCurrentProject() {
    return this.loadJson(this.currentProjectKey);
  }

  async saveCurrentProject(project) {
    return this.saveJson(this.currentProjectKey, project);
  }

  async clearCurrentProject() {
    return this.remove(this.currentProjectKey);
  }
}

class IndexedDbProjectStorage {
  constructor() {
    this.backendId = "indexeddb";
    this.currentProjectKey = "currentProject";
  }

  async loadJson(key) {
    const json = await idbGetProject(key);
    if (!json) return null;
    return safeJsonParse(json, null);
  }

  async saveJson(key, value) {
    return idbPutProject(key, JSON.stringify(value));
  }

  async remove(key) {
    return idbDeleteProject(key);
  }

  async loadCurrentProject() {
    return this.loadJson(this.currentProjectKey);
  }

  async saveCurrentProject(project) {
    return this.saveJson(this.currentProjectKey, project);
  }

  async clearCurrentProject() {
    return this.remove(this.currentProjectKey);
  }
}

class FileSystemProjectStorage {
  constructor() {
    this.backendId = "filesystem";
  }

  async loadCurrentProject() {
    throw new Error("FileSystemProjectStorage未实现");
  }

  async saveCurrentProject() {
    throw new Error("FileSystemProjectStorage未实现");
  }

  async clearCurrentProject() {
    throw new Error("FileSystemProjectStorage未实现");
  }
}

class StorageManager {
  constructor() {
    this.backends = {
      indexeddb: new IndexedDbProjectStorage(),
      localStorage: new LocalStorageProjectStorage(),
      filesystem: new FileSystemProjectStorage(),
    };
    this.preferredBackendId = "indexeddb";
    this.indexedDbAvailable = true;
    this.__idbAvailabilityChecked = false;
    this.__notifiedIdbUnavailable = false;
    this.__notifiedFsUnavailable = false;
    this.__notifiedSaveFallback = false;

    this.__metaActiveProjectIdKey = "__meta__:activeProjectId";
    this.__metaProjectsIndexKey = "__meta__:projectsIndex";
    this.__projectKeyPrefix = "project:";
    this.__legacyCurrentProjectKey = "currentProject";
  }

  __normalizeProjectId(project) {
    if (project && project.id) return project;
    const fallbackId = `project-${Date.now()}`;
    const next = { ...(project || {}) };
    next.id = next.id || fallbackId;
    return next;
  }

  __buildProjectStorageKey(projectId) {
    return `${this.__projectKeyPrefix}${projectId}`;
  }

  async __loadJsonFromBackend(backend, key) {
    if (!backend) return null;
    if (typeof backend.loadJson === "function") {
      return backend.loadJson(key);
    }
    return null;
  }

  async __saveJsonToBackend(backend, key, value) {
    if (!backend) return false;
    if (typeof backend.saveJson === "function") {
      return backend.saveJson(key, value);
    }
    return false;
  }

  async __removeFromBackend(backend, key) {
    if (!backend) return false;
    if (typeof backend.remove === "function") {
      return backend.remove(key);
    }
    return false;
  }

  async __withBackends() {
    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();
    const fallbacks = ["indexeddb", "localStorage"]
      .map((id) => this.backends[id])
      .filter((b) => b && b.backendId !== preferred.backendId);
    return { preferred, fallbacks };
  }

  async getActiveProjectId() {
    const { preferred, fallbacks } = await this.__withBackends();
    const all = [preferred, ...fallbacks];
    for (const backend of all) {
      try {
        const val = await this.__loadJsonFromBackend(
          backend,
          this.__metaActiveProjectIdKey
        );
        if (typeof val === "string" && val) return val;
      } catch (_) {}
    }
    return null;
  }

  async setActiveProjectId(projectId) {
    if (!projectId) return false;
    const { preferred } = await this.__withBackends();
    try {
      await this.__saveJsonToBackend(
        preferred,
        this.__metaActiveProjectIdKey,
        String(projectId)
      );
      return true;
    } catch (e) {
      console.error("保存 activeProjectId 失败:", e);
      return false;
    }
  }

  async loadProjectsIndex() {
    const { preferred, fallbacks } = await this.__withBackends();
    const all = [preferred, ...fallbacks];
    for (const backend of all) {
      try {
        const idx = await this.__loadJsonFromBackend(
          backend,
          this.__metaProjectsIndexKey
        );
        if (Array.isArray(idx)) return idx;
      } catch (_) {}
    }
    return [];
  }

  async saveProjectsIndex(index) {
    const { preferred } = await this.__withBackends();
    const safe = Array.isArray(index) ? index : [];
    await this.__saveJsonToBackend(
      preferred,
      this.__metaProjectsIndexKey,
      safe
    );
    return true;
  }

  async listProjects() {
    const idx = await this.loadProjectsIndex();
    return (idx || [])
      .filter((p) => p && p.id)
      .slice()
      .sort((a, b) =>
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
      );
  }

  async loadProjectById(projectId) {
    if (!projectId) return null;
    const key = this.__buildProjectStorageKey(projectId);
    const { preferred, fallbacks } = await this.__withBackends();
    const all = [preferred, ...fallbacks];
    for (const backend of all) {
      try {
        const project = await this.__loadJsonFromBackend(backend, key);
        if (project) return project;
      } catch (_) {}
    }
    return null;
  }

  async saveProject(project) {
    const normalized = this.__normalizeProjectId(project);
    const key = this.__buildProjectStorageKey(normalized.id);
    const { preferred } = await this.__withBackends();

    const nowIso = new Date().toISOString();
    normalized.updatedAt = nowIso;
    normalized.createdAt = normalized.createdAt || nowIso;

    await this.__saveJsonToBackend(preferred, key, normalized);
    await this.__saveJsonToBackend(
      preferred,
      this.__legacyCurrentProjectKey,
      normalized
    );
    await this.__saveJsonToBackend(
      preferred,
      this.__metaActiveProjectIdKey,
      normalized.id
    );

    const idx = await this.loadProjectsIndex();
    const next = Array.isArray(idx) ? idx.slice() : [];
    const entry = {
      id: normalized.id,
      name: normalized.name || "未命名",
      sourceLanguage: normalized.sourceLanguage,
      targetLanguage: normalized.targetLanguage,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };
    const i = next.findIndex((p) => p && p.id === normalized.id);
    if (i >= 0) next[i] = { ...next[i], ...entry };
    else next.push(entry);
    await this.saveProjectsIndex(next);

    return true;
  }

  async deleteProject(projectId) {
    if (!projectId) return false;
    const { preferred, fallbacks } = await this.__withBackends();
    const key = this.__buildProjectStorageKey(projectId);

    const allBackends = [preferred, ...(fallbacks || [])].filter(Boolean);
    for (const backend of allBackends) {
      try {
        if (backend.backendId === "indexeddb") {
          const ok = await this.checkIndexedDbAvailability();
          if (!ok) continue;
        }
        await this.__removeFromBackend(backend, key);
      } catch (e) {
        console.warn("删除项目记录失败:", backend?.backendId, projectId, e);
      }
    }

    try {
      const ok = await this.checkIndexedDbAvailability();
      if (ok) {
        await idbDeleteFileContentsForProject(projectId);
      }
    } catch (e) {
      console.warn("清理项目文件内容失败:", e);
    }

    const idx = await this.loadProjectsIndex();
    const next = (idx || []).filter((p) => p && p.id !== projectId);
    await this.saveProjectsIndex(next);

    const active = await this.getActiveProjectId();
    if (active === projectId) {
      const newActive = next[0]?.id || null;
      if (newActive) {
        await this.setActiveProjectId(newActive);

        try {
          const nextProject = await this.loadProjectById(newActive);
          if (nextProject) {
            try {
              await this.__saveJsonToBackend(
                preferred,
                this.__legacyCurrentProjectKey,
                nextProject
              );
            } catch (e) {
              console.warn("同步 legacy currentProject 失败:", e);
            }
          }
        } catch (e) {
          console.warn("读取新激活项目失败:", e);
        }
      } else {
        for (const backend of allBackends) {
          try {
            if (backend.backendId === "indexeddb") {
              const ok = await this.checkIndexedDbAvailability();
              if (!ok) continue;
            }
            await this.__removeFromBackend(
              backend,
              this.__metaActiveProjectIdKey
            );
          } catch (e) {
            console.warn("清理 activeProjectId 失败:", backend?.backendId, e);
          }
        }
      }

      for (const backend of allBackends) {
        try {
          if (backend.backendId === "indexeddb") {
            const ok = await this.checkIndexedDbAvailability();
            if (!ok) continue;
          }
          await this.__removeFromBackend(
            backend,
            this.__legacyCurrentProjectKey
          );
        } catch (e) {
          console.warn(
            "清理 legacy currentProject 失败:",
            backend?.backendId,
            e
          );
        }
      }
    }

    return true;
  }

  async renameProject(projectId, newName) {
    if (!projectId) return false;
    const name = String(newName || "").trim();
    if (!name) return false;
    const project = await this.loadProjectById(projectId);
    if (!project) return false;
    project.name = name;
    project.updatedAt = new Date().toISOString();
    await this.saveProject(project);
    return true;
  }

  async checkIndexedDbAvailability(timeoutMs = 2500) {
    if (this.__idbAvailabilityChecked) return this.indexedDbAvailable;
    this.__idbAvailabilityChecked = true;

    if (typeof indexedDB === "undefined") {
      this.indexedDbAvailable = false;
      return false;
    }

    try {
      await Promise.race([
        Promise.resolve(openFileContentDB()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("IndexedDB打开超时")), timeoutMs)
        ),
      ]);
      this.indexedDbAvailable = true;
      return true;
    } catch (e) {
      console.warn("IndexedDB不可用，将降级到 localStorage:", e);
      this.indexedDbAvailable = false;
      return false;
    }
  }

  async ensureBackendAvailable() {
    if (this.preferredBackendId === "filesystem") {
      this.preferredBackendId = "indexeddb";
      if (
        !this.__notifiedFsUnavailable &&
        typeof showNotification === "function"
      ) {
        this.__notifiedFsUnavailable = true;
        showNotification(
          "warning",
          "文件存储未启用",
          "File System Access 后端尚未实现，已自动回退到 IndexedDB/localStorage。"
        );
      }
    }

    const ok = await this.checkIndexedDbAvailability();
    if (!ok) {
      if (this.preferredBackendId === "indexeddb") {
        this.preferredBackendId = "localStorage";
      }

      if (
        !this.__notifiedIdbUnavailable &&
        typeof showNotification === "function"
      ) {
        this.__notifiedIdbUnavailable = true;
        showNotification(
          "warning",
          "IndexedDB不可用",
          "已自动降级为 localStorage 存储。部分功能（如原格式导出/大文件）可能受限。"
        );
      }
    }
    return this.getPreferredBackend();
  }

  loadPreferredBackendFromSettings() {
    // 预留：后续从设置中读取 preferredStorageBackend
    try {
      const settings = safeJsonParse(
        localStorage.getItem("translatorSettings"),
        null
      );
      const preferred = settings?.preferredStorageBackend;
      if (preferred && this.backends[preferred]) {
        if (preferred === "filesystem") {
          if (
            !this.__notifiedFsUnavailable &&
            typeof showNotification === "function"
          ) {
            this.__notifiedFsUnavailable = true;
            showNotification(
              "warning",
              "文件存储未启用",
              "File System Access 后端尚未实现，已忽略该设置。"
            );
          }
        } else {
          this.preferredBackendId = preferred;
        }
      }
    } catch (e) {
      console.error("读取存储后端设置失败:", e);
    }
  }

  getPreferredBackend() {
    if (this.preferredBackendId === "filesystem")
      return this.backends.indexeddb;
    return this.backends[this.preferredBackendId] || this.backends.indexeddb;
  }

  async loadCurrentProject() {
    const activeId = await this.getActiveProjectId();
    if (activeId) {
      const p = await this.loadProjectById(activeId);
      if (p) return p;
    }

    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();

    try {
      const legacy = await preferred.loadCurrentProject();
      if (legacy) {
        const normalized = this.__normalizeProjectId(legacy);
        await this.saveProject(normalized);
        return normalized;
      }
    } catch (e) {
      console.warn(
        "从首选存储后端恢复失败，将尝试回退:",
        preferred.backendId,
        e
      );
    }

    const fallbacks = ["indexeddb", "localStorage"].filter(
      (id) => id !== preferred.backendId
    );
    for (const id of fallbacks) {
      const backend = this.backends[id];
      if (!backend) continue;

      if (id === "indexeddb") {
        const ok = await this.checkIndexedDbAvailability();
        if (!ok) continue;
      }

      try {
        const legacy = await backend.loadCurrentProject();
        if (legacy) {
          const normalized = this.__normalizeProjectId(legacy);
          await this.saveProject(normalized);
          return normalized;
        }
      } catch (e) {
        console.warn("从存储后端恢复失败:", id, e);
      }
    }

    return null;
  }

  async saveCurrentProject(project) {
    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();

    try {
      return await this.saveProject(project);
    } catch (e) {
      console.warn("保存 currentProject 失败:", preferred.backendId, e);

      const errName = e && e.name ? String(e.name) : "";
      const errMsg = e && e.message ? String(e.message) : String(e);

      if (preferred.backendId === "indexeddb") {
        if (typeof showNotification === "function") {
          if (errName === "QuotaExceededError") {
            showNotification(
              "error",
              "存储空间不足",
              "IndexedDB 存储空间不足，已尝试降级到 localStorage 保存。建议：清理站点数据/减少导入/导出项目备份。"
            );
          } else if (errName === "AbortError") {
            showNotification(
              "warning",
              "IndexedDB写入中止",
              "IndexedDB 写入被中止（可能是权限/并发/浏览器策略变化）。已尝试降级到 localStorage 保存。"
            );
          } else if (errName === "InvalidStateError") {
            showNotification(
              "warning",
              "IndexedDB状态异常",
              "IndexedDB 状态异常（可能数据库连接被关闭或升级中）。已尝试降级到 localStorage 保存。"
            );
          } else if (/blocked/i.test(errMsg) || /version/i.test(errMsg)) {
            showNotification(
              "warning",
              "IndexedDB被阻塞",
              "IndexedDB 可能被其他标签页占用或正在升级。已尝试降级到 localStorage 保存。"
            );
          } else {
            showNotification(
              "warning",
              "IndexedDB保存失败",
              "已尝试降级到 localStorage 保存。若问题持续，请清理站点数据或关闭其他标签页。"
            );
          }
        }

        try {
          this.preferredBackendId = "localStorage";
          this.indexedDbAvailable = false;
          this.__idbAvailabilityChecked = true;

          const ok = await this.saveProject(project);

          if (
            !this.__notifiedSaveFallback &&
            typeof showNotification === "function"
          ) {
            this.__notifiedSaveFallback = true;
            showNotification(
              "warning",
              "已降级保存",
              "本次已将项目保存到 localStorage（IndexedDB 不可用或写入失败）。"
            );
          }

          return ok;
        } catch (fallbackError) {
          console.error("降级保存到 localStorage 也失败:", fallbackError);
          throw e;
        }
      }

      throw e;
    }
  }

  async clearCurrentProject() {
    const active = await this.getActiveProjectId();
    if (active) {
      try {
        await this.deleteProject(active);
      } catch (e) {
        console.warn("删除当前项目失败:", e);
      }
    }

    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();

    try {
      await preferred.clearCurrentProject();
    } catch (e) {
      console.warn(
        "清理首选存储后端 currentProject 失败:",
        preferred.backendId,
        e
      );
    }

    const fallbacks = ["indexeddb", "localStorage"].filter(
      (id) => id !== preferred.backendId
    );
    for (const id of fallbacks) {
      const backend = this.backends[id];
      if (!backend) continue;

      if (id === "indexeddb") {
        const ok = await this.checkIndexedDbAvailability();
        if (!ok) continue;
      }

      try {
        await backend.clearCurrentProject();
      } catch (e) {
        console.warn("清理存储后端 currentProject 失败:", id, e);
      }
    }

    return true;
  }

  async loadAllProjectsData() {
    const idx = await this.listProjects().catch(() => []);
    const ids = (idx || []).map((p) => p && p.id).filter(Boolean);
    const results = await Promise.allSettled(
      ids.map((id) => this.loadProjectById(id))
    );
    const projects = [];
    results.forEach((r) => {
      if (r.status === "fulfilled" && r.value) projects.push(r.value);
    });
    return projects;
  }

  async clearAllProjects() {
    const idx = await this.listProjects().catch(() => []);
    const ids = (idx || []).map((p) => p && p.id).filter(Boolean);

    for (const id of ids) {
      try {
        await this.deleteProject(id);
      } catch (e) {
        console.warn("删除项目失败:", id, e);
      }

      // 兜底：如果历史上切换过存储后端，确保两个后端都不残留 project:<id>
      try {
        const key = this.__buildProjectStorageKey(id);
        const backends = ["indexeddb", "localStorage"].map(
          (k) => this.backends[k]
        );
        for (const backend of backends) {
          if (!backend) continue;
          if (backend.backendId === "indexeddb") {
            const ok = await this.checkIndexedDbAvailability();
            if (!ok) continue;
          }
          try {
            await this.__removeFromBackend(backend, key);
          } catch (_) {}
        }
      } catch (_) {}
    }

    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();
    try {
      await preferred.clearCurrentProject();
    } catch (e) {
      console.warn(
        "清理首选存储后端 currentProject 失败:",
        preferred.backendId,
        e
      );
    }

    const fallbacks = ["indexeddb", "localStorage"].filter(
      (id) => id !== preferred.backendId
    );
    for (const id of fallbacks) {
      const backend = this.backends[id];
      if (!backend) continue;

      if (id === "indexeddb") {
        const ok = await this.checkIndexedDbAvailability();
        if (!ok) continue;
      }

      try {
        await backend.clearCurrentProject();
      } catch (e) {
        console.warn("清理存储后端 currentProject 失败:", id, e);
      }
    }

    // 清理多项目元数据（projectsIndex / activeProjectId）
    try {
      const backendsToClear = [preferred.backendId, ...fallbacks].filter(
        Boolean
      );
      for (const id of backendsToClear) {
        const backend = this.backends[id];
        if (!backend) continue;

        if (id === "indexeddb") {
          const ok = await this.checkIndexedDbAvailability();
          if (!ok) continue;
        }

        try {
          await this.__removeFromBackend(backend, this.__metaProjectsIndexKey);
        } catch (e) {
          console.warn("清理 projectsIndex 失败:", id, e);
        }
        try {
          await this.__removeFromBackend(
            backend,
            this.__metaActiveProjectIdKey
          );
        } catch (e) {
          console.warn("清理 activeProjectId 失败:", id, e);
        }
      }
    } catch (e) {
      console.warn("清理多项目元数据失败:", e);
    }

    return true;
  }
}

const storageManager = new StorageManager();

function idbClearAllFileContents() {
  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB清空失败"));
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
        const deleted = [];

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const key = cursor.key;
          if (typeof key === "string" && key.startsWith(prefix)) {
            deleted.push(key);
            cursor.delete();
          }
          cursor.continue();
        };
        cursorReq.onerror = () =>
          reject(cursorReq.error || new Error("IndexedDB遍历失败"));

        tx.oncomplete = () =>
          resolve({ deletedCount: deleted.length, deletedKeys: deleted });
        tx.onerror = () => reject(tx.error || new Error("IndexedDB清理失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB清理中止"));
      })
  );
}

function idbGarbageCollectFileContents() {
  const projectId = AppState.project?.id;
  const prefix = projectId ? `${projectId}::` : null;
  const referenced = new Set();
  const fileMetadata = AppState.fileMetadata || {};
  Object.keys(fileMetadata).forEach((fileName) => {
    const key = fileMetadata[fileName]?.contentKey;
    if (key) referenced.add(key);
  });

  return openFileContentDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("fileContents", "readwrite");
        const store = tx.objectStore("fileContents");
        const deleted = [];

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const key = cursor.key;
          if (prefix && typeof key === "string" && !key.startsWith(prefix)) {
            cursor.continue();
            return;
          }
          if (!referenced.has(key)) {
            deleted.push(key);
            cursor.delete();
          }
          cursor.continue();
        };
        cursorReq.onerror = () =>
          reject(cursorReq.error || new Error("IndexedDB遍历失败"));

        tx.oncomplete = () =>
          resolve({ deletedCount: deleted.length, deletedKeys: deleted });
        tx.onerror = () => reject(tx.error || new Error("IndexedDB清理失败"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB清理中止"));
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
      const fileMetadata = AppState.fileMetadata || {};
      const hasReferences = Object.keys(fileMetadata).some((fileName) => {
        const key = fileMetadata[fileName]?.contentKey;
        return !!key;
      });

      // 保护：只有项目已加载且存在引用时才运行 GC，避免误删
      if (!AppState.project || !hasReferences) return;

      Promise.resolve(storageManager.checkIndexedDbAvailability())
        .then((ok) => {
          if (!ok) return;
          return idbGarbageCollectFileContents();
        })
        .catch((e) => {
          console.error("IndexedDB垃圾回收失败:", e);
        });
    } catch (e) {
      console.error("IndexedDB垃圾回收调度失败:", e);
    }
  }, delayMs);
}

function getOrCreateProjectId() {
  if (AppState.project?.id) return AppState.project.id;
  const fallbackId = `project-${Date.now()}`;
  if (!AppState.project) AppState.project = { id: fallbackId };
  AppState.project.id = AppState.project.id || fallbackId;
  return AppState.project.id;
}

const CONTENT_KEY_VERSION = 1;

function buildFileContentKeyV1(projectId, fileName) {
  return `${projectId}::${fileName}`;
}

function buildFileContentKey(projectId, fileName) {
  // 预留：后续可升级到 V2（例如 hash(content) 或 uuid）
  if (CONTENT_KEY_VERSION === 1)
    return buildFileContentKeyV1(projectId, fileName);
  return buildFileContentKeyV1(projectId, fileName);
}

function hydrateFileMetadataContentKeys(projectId) {
  const pid = projectId || AppState.project?.id;
  if (!pid) return;

  const fileMetadata = AppState.fileMetadata || {};
  Object.keys(fileMetadata).forEach((fileName) => {
    const meta = fileMetadata[fileName];
    if (!meta) return;

    if (!meta.contentKey) {
      meta.contentKey = buildFileContentKey(pid, fileName);
    }

    if (meta.originalContent && typeof meta.originalContent === "string") {
      Promise.resolve(
        idbPutFileContent(meta.contentKey, meta.originalContent)
      ).catch((e) => {
        console.error("IndexedDB写入originalContent失败:", e);
        notifyIndexedDbFileContentErrorOnce(e, "保存原始内容");
      });
    }
  });
}

function ensureFileContentKey(meta, fileName) {
  if (meta && meta.contentKey) return meta.contentKey;
  const projectId = getOrCreateProjectId();
  const key = buildFileContentKey(projectId, fileName);
  if (meta) meta.contentKey = key;
  return key;
}

async function ensureOriginalContentLoadedForFile(fileName) {
  if (!fileName) return false;
  const meta = AppState.fileMetadata?.[fileName];
  if (!meta) return false;
  if (meta.originalContent && typeof meta.originalContent === "string")
    return true;
  const key = meta.contentKey;
  if (!key) return false;

  try {
    const content = await idbGetFileContent(key);
    if (content && typeof content === "string") {
      meta.originalContent = content;
      return true;
    }
  } catch (e) {
    console.error("IndexedDB读取originalContent失败:", e);
    notifyIndexedDbFileContentErrorOnce(e, "读取原始内容");
  }

  return false;
}
