// IndexedDB 底层操作已拆分到 idb-operations.js
// 包含: openFileContentDB, idbPut/Get/Delete*, notifyIndexedDbFileContentErrorOnce, supportsFileSystemAccess 等

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
    this.currentProjectKey = "currentProject";
    this.directoryHandle = null;
    this.storageFileName = "translator-storage.json";
    this.__writeQueue = Promise.resolve();
    this.__handleLoaded = false;
  }

  isSupported() {
    return supportsFileSystemAccess();
  }

  hasHandle() {
    return !!this.directoryHandle;
  }

  async loadHandleFromIdb() {
    if (this.__handleLoaded) return this.directoryHandle;
    this.__handleLoaded = true;

    if (!this.isSupported()) return null;
    if (__fsAccessState.loading) {
      return __fsAccessState.loading;
    }

    __fsAccessState.loading = idbGetFsHandle()
      .then((handle) => {
        __fsAccessState.handle = handle || null;
        this.directoryHandle = __fsAccessState.handle;
        return this.directoryHandle;
      })
      .catch((error) => {
        (loggers.storage || console).warn("读取文件系统句柄失败:", error);
        return null;
      })
      .finally(() => {
        __fsAccessState.loading = null;
      });

    return __fsAccessState.loading;
  }

  async persistHandle(handle) {
    this.directoryHandle = handle;
    __fsAccessState.handle = handle;

    try {
      await idbPutFsHandle(handle);
    } catch (error) {
      (loggers.storage || console).warn("保存文件系统句柄失败:", error);
    }
  }

  async clearPersistedHandle() {
    this.directoryHandle = null;
    __fsAccessState.handle = null;
    try {
      await idbDeleteFsHandle();
    } catch (error) {
      (loggers.storage || console).warn("清理文件系统句柄失败:", error);
    }
  }

  async ensurePermission(handle, allowPrompt) {
    if (!handle || typeof handle.queryPermission !== "function") return true;
    try {
      const status = await handle.queryPermission({ mode: "readwrite" });
      if (status === "granted") return true;
      if (!allowPrompt || typeof handle.requestPermission !== "function") {
        return false;
      }
      const requested = await handle.requestPermission({ mode: "readwrite" });
      return requested === "granted";
    } catch (error) {
      (loggers.storage || console).warn("文件系统权限检查失败:", error);
      return false;
    }
  }

  async ensureDirectoryHandle({ allowPrompt = false } = {}) {
    if (!this.isSupported()) {
      throw new Error("FileSystemAccessNotSupported");
    }

    if (!this.directoryHandle) {
      await this.loadHandleFromIdb();
    }

    if (!this.directoryHandle) {
      if (!allowPrompt) {
        throw new Error("FileSystemAccessNeedsUserActivation");
      }

      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      await this.persistHandle(handle);
    }

    const hasPermission = await this.ensurePermission(
      this.directoryHandle,
      allowPrompt
    );
    if (!hasPermission) {
      throw new Error("FileSystemAccessDenied");
    }

    return this.directoryHandle;
  }

  async requestDirectoryHandle() {
    return this.ensureDirectoryHandle({ allowPrompt: true });
  }

  async ensureReady({ allowPrompt = false } = {}) {
    return this.ensureDirectoryHandle({ allowPrompt });
  }

  async __getStorageFileHandle({ allowPrompt = false, create = true } = {}) {
    const handle = await this.ensureDirectoryHandle({ allowPrompt });
    return handle.getFileHandle(this.storageFileName, { create });
  }

  async __readStorageObject({ allowPrompt = false } = {}) {
    let fileHandle;
    try {
      fileHandle = await this.__getStorageFileHandle({
        allowPrompt,
        create: false,
      });
    } catch (error) {
      if (error && error.name === "NotFoundError") {
        return {};
      }
      throw error;
    }

    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text) return {};
    const parsed =
      typeof safeJsonParse === "function"
        ? safeJsonParse(text, {})
        : JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  async __writeStorageObject(data, { allowPrompt = false } = {}) {
    const fileHandle = await this.__getStorageFileHandle({
      allowPrompt,
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data || {}));
    await writable.close();
    return true;
  }

  async __queueWrite(task) {
    const run = this.__writeQueue.then(task, task);
    this.__writeQueue = run.catch((e) => { (loggers.storage || console).debug('__queueWrite 队列任务失败:', e); });
    return run;
  }

  __shouldPromptForAccess() {
    return (
      typeof navigator !== "undefined" && navigator.userActivation?.isActive
    );
  }

  async loadJson(key) {
    const allowPrompt = this.__shouldPromptForAccess();
    const data = await this.__readStorageObject({ allowPrompt });
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
  }

  async saveJson(key, value) {
    const allowPrompt = this.__shouldPromptForAccess();
    return this.__queueWrite(async () => {
      const data = await this.__readStorageObject({ allowPrompt });
      data[key] = value;
      return this.__writeStorageObject(data, { allowPrompt });
    });
  }

  async remove(key) {
    const allowPrompt = this.__shouldPromptForAccess();
    return this.__queueWrite(async () => {
      const data = await this.__readStorageObject({ allowPrompt });
      delete data[key];
      return this.__writeStorageObject(data, { allowPrompt });
    });
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
    this.__fsFallbackPending = false;
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
      } catch (_) {
        (loggers.storage || console).debug("getActiveProjectId fallback:", backend?.backendId, _);
      }
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
      (loggers.storage || console).error("保存 activeProjectId 失败:", e);
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
      } catch (_) {
        (loggers.storage || console).debug("loadProjectsIndex fallback:", backend?.backendId, _);
      }
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

    try {
      const project = await this.__loadJsonFromBackend(preferred, key);
      if (project) return project;
    } catch (_) {
      (loggers.storage || console).debug("loadProjectById preferred failed:", preferred?.backendId, _);
    }

    for (const backend of fallbacks) {
      try {
        const project = await this.__loadJsonFromBackend(backend, key);
        if (project) {
          try {
            await this.__saveJsonToBackend(preferred, key, project);
          } catch (_) {
            (loggers.storage || console).debug("loadProjectById cross-save failed:", _);
          }
          return project;
        }
      } catch (_) {
        (loggers.storage || console).debug("loadProjectById fallback:", backend?.backendId, _);
      }
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

    if (preferred.backendId === "filesystem") {
      const durableFallback = this.backends.indexeddb || this.backends.localStorage;
      if (durableFallback) {
        try {
          await this.__saveJsonToBackend(durableFallback, key, normalized);
          await this.__saveJsonToBackend(durableFallback, this.__legacyCurrentProjectKey, normalized);
          await this.__saveJsonToBackend(durableFallback, this.__metaActiveProjectIdKey, normalized.id);
          await this.__saveJsonToBackend(durableFallback, this.__metaProjectsIndexKey, next);
        } catch (_) {
          (loggers.storage || console).debug("saveProject durable fallback sync failed:", _);
        }
      }
    }

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
        (loggers.storage || console).warn("删除项目记录失败:", backend?.backendId, projectId, e);
      }
    }

    try {
      const ok = await this.checkIndexedDbAvailability();
      if (ok) {
        await idbDeleteFileContentsForProject(projectId);
      }
    } catch (e) {
      (loggers.storage || console).warn("清理项目文件内容失败:", e);
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
              (loggers.storage || console).warn("同步 legacy currentProject 失败:", e);
            }
          }
        } catch (e) {
          (loggers.storage || console).warn("读取新激活项目失败:", e);
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
            (loggers.storage || console).warn("清理 activeProjectId 失败:", backend?.backendId, e);
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
          (loggers.storage || console).warn(
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
      (loggers.storage || console).warn("IndexedDB不可用，将降级到 localStorage:", e);
      this.indexedDbAvailable = false;
      return false;
    }
  }

  async retryIndexedDbAvailability() {
    if (this.indexedDbAvailable) return true;
    const wasUnavailable = this.__idbAvailabilityChecked && !this.indexedDbAvailable;
    this.__idbAvailabilityChecked = false;
    const ok = await this.checkIndexedDbAvailability();
    if (ok && wasUnavailable && this.preferredBackendId === "localStorage") {
      this.preferredBackendId = "indexeddb";
      this.__persistPreferredBackend("indexeddb");
      (loggers.storage || console).info("IndexedDB 已恢复可用，已自动切回 indexeddb");
    }
    return ok;
  }

  async ensureBackendAvailable(options = {}) {
    if (this.preferredBackendId === "filesystem") {
      const fsBackend = this.backends.filesystem;
      if (!fsBackend || !fsBackend.isSupported()) {
        this.preferredBackendId = "indexeddb";
        if (
          !this.__notifiedFsUnavailable &&
          typeof showNotification === "function"
        ) {
          this.__notifiedFsUnavailable = true;
          showNotification(
            "warning",
            "文件存储不可用",
            "当前环境不支持 File System Access，已自动回退到 IndexedDB/localStorage。"
          );
        }
      } else {
        const allowPrompt =
          typeof options.allowPrompt === "boolean"
            ? options.allowPrompt
            : typeof navigator !== "undefined" && navigator.userActivation?.isActive;
        try {
          await fsBackend.ensureReady({ allowPrompt });
          this.__fsFallbackPending = false;
        } catch (error) {
          this.preferredBackendId = "indexeddb";
          if (!allowPrompt) {
            this.__fsFallbackPending = true;
          } else if (
            !this.__notifiedFsUnavailable &&
            typeof showNotification === "function"
          ) {
            this.__notifiedFsUnavailable = true;
            showNotification(
              "warning",
              "文件存储未授权",
              "File System Access 尚未授权或无法弹出选择器，已自动回退到 IndexedDB/localStorage。"
            );
          }
        }
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
      const settings = SettingsCache.get();
      const preferred = settings?.preferredStorageBackend;
      if (preferred && this.backends[preferred]) {
        if (preferred === "filesystem") {
          const fsBackend = this.backends.filesystem;
          if (fsBackend && fsBackend.isSupported()) {
            this.preferredBackendId = preferred;
          } else if (
            !this.__notifiedFsUnavailable &&
            typeof showNotification === "function"
          ) {
            this.__notifiedFsUnavailable = true;
            showNotification(
              "warning",
              "文件存储不可用",
              "当前环境不支持 File System Access，已忽略该设置。"
            );
          }
        } else {
          this.preferredBackendId = preferred;
        }
      }
    } catch (e) {
      (loggers.storage || console).error("读取存储后端设置失败:", e);
    }
  }

  getPreferredBackend() {
    if (this.preferredBackendId === "filesystem") {
      return this.backends.filesystem || this.backends.indexeddb;
    }
    return this.backends[this.preferredBackendId] || this.backends.indexeddb;
  }

  isBackendAvailable(backendType) {
    const type = String(backendType || "").toLowerCase();
    if (type === "filesystem") {
      const fsBackend = this.backends.filesystem;
      return !!(fsBackend && fsBackend.isSupported());
    }
    if (type === "indexeddb") {
      return typeof indexedDB !== "undefined" && this.indexedDbAvailable;
    }
    if (type === "localstorage") {
      return typeof localStorage !== "undefined";
    }
    return false;
  }

  __persistPreferredBackend(backendId) {
    try {
      SettingsCache.update(function (s) {
        s.preferredStorageBackend = backendId;
      });
    } catch (e) {
      (loggers.storage || console).warn("持久化 preferredStorageBackend 失败:", e);
    }
  }

  async migrateToBackend(targetBackendId) {
    const targetBackend = this.backends[targetBackendId];
    if (!targetBackend) return { ok: false, error: "目标后端不存在" };

    const sourceIds = ["indexeddb", "localStorage", "filesystem"].filter(
      (id) => id !== targetBackendId
    );

    let projectsIndex = [];
    let activeProjectId = null;
    const migratedProjects = [];
    const errors = [];

    for (const srcId of sourceIds) {
      const src = this.backends[srcId];
      if (!src) continue;
      if (srcId === "indexeddb") {
        const ok = await this.checkIndexedDbAvailability();
        if (!ok) continue;
      }

      try {
        const idx = await this.__loadJsonFromBackend(src, this.__metaProjectsIndexKey);
        if (Array.isArray(idx) && idx.length > projectsIndex.length) {
          projectsIndex = idx;
        }
      } catch (_) {
        (loggers.storage || console).debug("migrateToBackend loadIndex:", srcId, _);
      }

      if (!activeProjectId) {
        try {
          const aid = await this.__loadJsonFromBackend(src, this.__metaActiveProjectIdKey);
          if (typeof aid === "string" && aid) activeProjectId = aid;
        } catch (_) {
          (loggers.storage || console).debug("migrateToBackend loadActiveId:", srcId, _);
        }
      }
    }

    const allProjectIds = new Set(
      projectsIndex.map((p) => p && p.id).filter(Boolean)
    );
    if (activeProjectId) allProjectIds.add(activeProjectId);

    for (const projectId of allProjectIds) {
      const key = this.__buildProjectStorageKey(projectId);
      let projectData = null;

      for (const srcId of sourceIds) {
        const src = this.backends[srcId];
        if (!src) continue;
        if (srcId === "indexeddb") {
          const ok = await this.checkIndexedDbAvailability();
          if (!ok) continue;
        }
        try {
          const data = await this.__loadJsonFromBackend(src, key);
          if (data) { projectData = data; break; }
        } catch (_) {
          (loggers.storage || console).debug("migrateToBackend loadProject:", srcId, projectId, _);
        }
      }

      if (!projectData) continue;

      try {
        await this.__saveJsonToBackend(targetBackend, key, projectData);
        migratedProjects.push(projectId);
      } catch (e) {
        errors.push({ projectId, error: e });
      }
    }

    try {
      if (projectsIndex.length > 0) {
        await this.__saveJsonToBackend(targetBackend, this.__metaProjectsIndexKey, projectsIndex);
      }
      if (activeProjectId) {
        await this.__saveJsonToBackend(targetBackend, this.__metaActiveProjectIdKey, activeProjectId);
      }
    } catch (e) {
      errors.push({ meta: true, error: e });
    }

    try {
      for (const srcId of sourceIds) {
        const src = this.backends[srcId];
        if (!src) continue;
        if (srcId === "indexeddb") {
          const ok = await this.checkIndexedDbAvailability();
          if (!ok) continue;
        }
        try {
          const legacy = await this.__loadJsonFromBackend(src, this.__legacyCurrentProjectKey);
          if (legacy) {
            await this.__saveJsonToBackend(targetBackend, this.__legacyCurrentProjectKey, legacy);
            break;
          }
        } catch (_) {
          (loggers.storage || console).debug("migrateToBackend legacy read:", srcId, _);
        }
      }
    } catch (_) {
      (loggers.storage || console).debug("migrateToBackend legacy outer:", _);
    }

    (loggers.storage || console).info(
      `存储迁移完成: ${migratedProjects.length}个项目迁移到${targetBackendId}` +
      (errors.length > 0 ? `，${errors.length}个错误` : "")
    );

    return { ok: errors.length === 0, migrated: migratedProjects.length, errors };
  }

  async tryReconnectFilesystem() {
    if (!this.__fsFallbackPending) return false;
    const fsBackend = this.backends.filesystem;
    if (!fsBackend || !fsBackend.isSupported()) return false;
    if (!(typeof navigator !== "undefined" && navigator.userActivation?.isActive)) return false;

    try {
      await fsBackend.ensureReady({ allowPrompt: false });
      this.preferredBackendId = "filesystem";
      this.__fsFallbackPending = false;
      this.__persistPreferredBackend("filesystem");
      (loggers.storage || console).info("File System Access 权限已恢复，已切回 filesystem 后端");

      if (typeof window.updateStorageBackendStatus === "function") {
        window.updateStorageBackendStatus();
      }
      return true;
    } catch (_) {
      (loggers.storage || console).debug("tryReconnectFilesystem failed:", _);
      return false;
    }
  }

  async disconnectFilesystem() {
    const fsBackend = this.backends.filesystem;

    try {
      await this.migrateToBackend("indexeddb");
    } catch (e) {
      (loggers.storage || console).warn("从 filesystem 迁移到 indexeddb 失败:", e);
    }

    this.preferredBackendId = "indexeddb";
    this.__fsFallbackPending = false;
    this.__persistPreferredBackend("indexeddb");

    if (fsBackend && typeof fsBackend.clearPersistedHandle === "function") {
      try {
        await fsBackend.clearPersistedHandle();
      } catch (e) {
        (loggers.storage || console).warn("清理文件系统句柄失败:", e);
      }
    }

    if (typeof window.updateStorageBackendStatus === "function") {
      window.updateStorageBackendStatus();
    }

    (loggers.storage || console).info("已停用文件夹存储，切回 IndexedDB");
    return true;
  }

  async requestFileSystemBackend() {
    const fsBackend = this.backends.filesystem;
    if (!fsBackend || !fsBackend.isSupported()) {
      return false;
    }

    try {
      await fsBackend.requestDirectoryHandle();
      this.preferredBackendId = "filesystem";
      return true;
    } catch (error) {
      (loggers.storage || console).warn("文件存储授权失败:", error);
      return false;
    }
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
      (loggers.storage || console).warn(
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
        (loggers.storage || console).warn("从存储后端恢复失败:", id, e);
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
      (loggers.storage || console).warn("保存 currentProject 失败:", preferred.backendId, e);

      if (preferred.backendId === "indexeddb") {
        // 委托给统一的存储错误处理器（去重通知 + 智能分类）
        if (typeof storageErrorHandler !== "undefined" && storageErrorHandler) {
          storageErrorHandler.handleError(e, { context: "保存项目", operation: "saveCurrentProject" });
        }

        try {
          this.preferredBackendId = "localStorage";
          this.indexedDbAvailable = false;
          this.__idbAvailabilityChecked = true;
          this.__persistPreferredBackend("localStorage");

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
          (loggers.storage || console).error("降级保存到 localStorage 也失败:", fallbackError);
          throw e;
        }
      }

      throw e;
    }
  }

  async clearCurrentProject() {
    const allowPrompt =
      typeof navigator !== "undefined" && navigator.userActivation?.isActive;
    await this.ensureBackendAvailable({ allowPrompt });
    const active = await this.getActiveProjectId();
    if (active) {
      try {
        await this.deleteProject(active);
      } catch (e) {
        (loggers.storage || console).warn("删除当前项目失败:", e);
      }
    }

    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();

    try {
      await preferred.clearCurrentProject();
    } catch (e) {
      (loggers.storage || console).warn(
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
        (loggers.storage || console).warn("清理存储后端 currentProject 失败:", id, e);
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
    const allowPrompt =
      typeof navigator !== "undefined" && navigator.userActivation?.isActive;
    await this.ensureBackendAvailable({ allowPrompt });
    const idx = await this.listProjects().catch(() => []);
    const ids = (idx || []).map((p) => p && p.id).filter(Boolean);

    for (const id of ids) {
      try {
        await this.deleteProject(id);
      } catch (e) {
        (loggers.storage || console).warn("删除项目失败:", id, e);
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
          } catch (_) {
            (loggers.storage || console).debug("clearAllData removeProject:", backend?.backendId, _);
          }
        }
      } catch (_) {
        (loggers.storage || console).debug("clearAllData cleanup:", id, _);
      }
    }

    await this.ensureBackendAvailable();
    const preferred = this.getPreferredBackend();
    try {
      await preferred.clearCurrentProject();
    } catch (e) {
      (loggers.storage || console).warn(
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
        (loggers.storage || console).warn("清理存储后端 currentProject 失败:", id, e);
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
          (loggers.storage || console).warn("清理 projectsIndex 失败:", id, e);
        }
        try {
          await this.__removeFromBackend(
            backend,
            this.__metaActiveProjectIdKey
          );
        } catch (e) {
          (loggers.storage || console).warn("清理 activeProjectId 失败:", id, e);
        }
      }
    } catch (e) {
      (loggers.storage || console).warn("清理多项目元数据失败:", e);
    }

    return true;
  }
}

const storageManager = new StorageManager();

if (typeof document !== "undefined" && typeof EventManager !== "undefined") {
  EventManager.add(document, "visibilitychange", () => {
    if (document.visibilityState === "visible" && !storageManager.indexedDbAvailable) {
      storageManager.retryIndexedDbAvailability().catch((e) => { (loggers.storage || console).debug('IndexedDB 重试失败:', e); });
    }
  }, { tag: "storage", label: "document:visibilitychange:storageRetry" });

  var __fsReconnectId = EventManager.add(document, "click", function () {
    if (!storageManager.__fsFallbackPending) return;
    storageManager.tryReconnectFilesystem()
      .then(function (ok) {
        if (ok && __fsReconnectId) {
          EventManager.removeById(__fsReconnectId);
          __fsReconnectId = null;
        }
      })
      .catch((e) => { (loggers.storage || console).debug('文件系统重连失败:', e); });
  }, { tag: "storage", label: "document:click:fsReconnect" });
}

// IDB GC/清理函数已拆分到 idb-operations.js
// 文件内容键管理函数已拆分到 file-content-keys.js
