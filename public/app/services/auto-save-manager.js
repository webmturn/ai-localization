// ==================== 自动保存模块 ====================

class AutoSaveManager {
  constructor() {
    this.saveInterval = 10000; // 10秒自动保存
    this.lastSaveTime = Date.now();
    this.isDirty = false; // 是否有未保存的更改
    this.timerId = null;
    this.quickSaveDebounceMs = this.saveInterval;
    this.quickSaveTimerId = null;
  }

  // 启动自动保存
  start() {
    if (this.timerId) return;

    this.timerId = setInterval(() => {
      if (this.isDirty && AppState.project) {
        this.saveProject();
      }
    }, this.saveInterval);

    console.log("自动保存已启动，间隔:", this.saveInterval / 1000, "秒");
  }

  setSaveInterval(saveIntervalMs) {
    const parsed = parseInt(saveIntervalMs);
    if (!Number.isFinite(parsed)) return;

    const clamped = Math.max(5000, Math.min(600000, parsed));
    if (clamped === this.saveInterval) return;

    this.saveInterval = clamped;
    this.quickSaveDebounceMs = clamped;

    if (this.quickSaveTimerId) {
      clearTimeout(this.quickSaveTimerId);
      this.quickSaveTimerId = null;
      if (this.isDirty && AppState.project) {
        this.requestQuickSave();
      }
    }

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      this.start();
    }
  }

  // 停止自动保存
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log("自动保存已停止");
    }
  }

  // 标记为已修改
  markDirty() {
    this.isDirty = true;
    this.requestQuickSave();
  }

  requestQuickSave() {
    if (this.quickSaveTimerId) {
      clearTimeout(this.quickSaveTimerId);
      this.quickSaveTimerId = null;
    }

    this.quickSaveTimerId = setTimeout(() => {
      if (this.isDirty && AppState.project) {
        this.saveProject();
      }
    }, this.quickSaveDebounceMs);
  }

  // 保存项目
  async saveProject() {
    if (!AppState.project) return;

    try {
      const safeFileMetadata = {};
      const fileMetadata = AppState.fileMetadata || {};
      for (const fileName of Object.keys(fileMetadata)) {
        const meta = fileMetadata[fileName] || {};
        const cloned = { ...meta };

        let shouldKeepOriginalContent = false;

        if (!cloned.contentKey && cloned.originalContent) {
          const key = ensureFileContentKey(cloned, fileName);
          try {
            await idbPutFileContent(key, cloned.originalContent);
          } catch (e) {
            console.error("IndexedDB写入originalContent失败:", e);
            try {
              notifyIndexedDbFileContentErrorOnce(e, "保存原始内容");
            } catch (_) {}
            shouldKeepOriginalContent = true;
          }
        }

        if (!shouldKeepOriginalContent) {
          delete cloned.originalContent;
        }
        safeFileMetadata[fileName] = cloned;
      }

      const payload = {
        ...AppState.project,
        translationItems:
          AppState.translations.items ||
          AppState.project.translationItems ||
          [],
        terminologyList:
          AppState.terminology?.list || AppState.project.terminologyList || [],
        fileMetadata: safeFileMetadata,
      };
      await storageManager.saveCurrentProject(payload);

      this.isDirty = false;
      this.lastSaveTime = Date.now();

      console.log("自动保存成功:", new Date().toLocaleTimeString());

      scheduleIdbGarbageCollection();

      // 显示保存指示器（可选）
      this.showSaveIndicator();
    } catch (error) {
      const isQuotaExceeded =
        error?.name === "QuotaExceededError" ||
        error?.code === 22 ||
        error?.code === 1014;

      if (isQuotaExceeded) {
        try {
          const slimFileMetadata = {};
          const fileMetadata = AppState.fileMetadata || {};
          Object.keys(fileMetadata).forEach((fileName) => {
            const meta = fileMetadata[fileName] || {};
            const cloned = { ...meta };
            delete cloned.originalContent;
            slimFileMetadata[fileName] = cloned;
          });

          const slimPayload = {
            ...AppState.project,
            translationItems:
              AppState.translations.items ||
              AppState.project.translationItems ||
              [],
            terminologyList:
              AppState.terminology?.list ||
              AppState.project.terminologyList ||
              [],
            fileMetadata: slimFileMetadata,
          };
          await storageManager.saveCurrentProject(slimPayload);

          this.isDirty = false;
          this.lastSaveTime = Date.now();
          console.warn(
            "自动保存降级：由于 localStorage 空间不足，已跳过保存原始文件内容"
          );
        } catch (fallbackError) {
          console.error("自动保存失败（降级后仍失败）:", fallbackError);
          if (typeof showNotification === "function") {
            showNotification(
              "error",
              "自动保存失败",
              "本地存储空间不足，已无法继续自动保存。建议：清理浏览器缓存 / 导出项目 / 后续切换到 IndexedDB 或文件存储。"
            );
          }
        }
        return;
      }

      console.error("自动保存失败:", error);
      if (typeof showNotification === "function") {
        showNotification(
          "error",
          "自动保存失败",
          error?.message || "自动保存失败，请打开控制台查看详细错误"
        );
      }
    }
  }

  // 显示保存指示器
  showSaveIndicator() {
    // 在页面右上角显示短暂提示
    const indicator = document.createElement("div");
    indicator.className =
      "fixed top-16 right-4 bg-green-600 text-white px-3 py-1 rounded shadow-lg dark:shadow-dark-elevated text-sm z-50";
    indicator.textContent = "✓ 已保存";
    document.body.appendChild(indicator);

    setTimeout(() => {
      indicator.style.opacity = "0";
      indicator.style.transition = "opacity 0.3s";
      setTimeout(() => indicator.remove(), 300);
    }, 1500);
  }

  // 恢复项目
  async restoreProject() {
    try {
      const project = await storageManager.loadCurrentProject();
      if (project) {
        console.log("从自动保存恢复项目:", project.name);
        return project;
      }
    } catch (error) {
      console.error("恢复项目失败:", error);
    }
    return null;
  }
}

// 创建全局自动保存管理器
const autoSaveManager = new AutoSaveManager();
