// ==================== 自动保存模块 ====================

class AutoSaveManager {
  constructor() {
    this.saveInterval = 10000; // 10秒自动保存
    this.lastSaveTime = Date.now();
    this.isDirty = false; // 是否有未保存的更改
    this.timerId = null;
    this.quickSaveDebounceMs = this.saveInterval;
    this.quickSaveTimerId = null;
    
    // 增强功能
    this.saveCount = 0;           // 保存次数统计
    this.errorCount = 0;          // 错误次数统计
    this.lastError = null;        // 最后一次错误
    this.isPaused = false;        // 是否暂停自动保存
    this.saveQueue = [];          // 保存队列
    this.isSaving = false;        // 是否正在保存
    this.maxRetries = 3;          // 最大重试次数
    this.retryDelay = 1000;       // 重试延迟(ms)
    this.minSaveInterval = 2000;  // 最小保存间隔(ms)
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
    if (this.quickSaveTimerId) {
      clearTimeout(this.quickSaveTimerId);
      this.quickSaveTimerId = null;
    }
  }

  // 暂停自动保存（不清除定时器，只是暂停保存行为）
  pause() {
    this.isPaused = true;
    console.log("自动保存已暂停");
  }

  // 恢复自动保存
  resume() {
    this.isPaused = false;
    console.log("自动保存已恢复");
    // 如果有未保存的更改，立即请求保存
    if (this.isDirty && AppState.project) {
      this.requestQuickSave();
    }
  }

  // 标记为已修改
  markDirty() {
    this.isDirty = true;
    if (!this.isPaused) {
      this.requestQuickSave();
    }
  }

  // 检查是否可以保存（防抖）
  canSave() {
    const now = Date.now();
    return now - this.lastSaveTime >= this.minSaveInterval;
  }

  requestQuickSave() {
    if (this.isPaused || this.isSaving) return;
    
    if (this.quickSaveTimerId) {
      clearTimeout(this.quickSaveTimerId);
      this.quickSaveTimerId = null;
    }

    // 检查最小保存间隔
    const timeSinceLastSave = Date.now() - this.lastSaveTime;
    const delay = Math.max(0, this.minSaveInterval - timeSinceLastSave);

    this.quickSaveTimerId = setTimeout(() => {
      if (this.isDirty && AppState.project && !this.isPaused) {
        this.saveProject();
      }
    }, this.quickSaveDebounceMs);
  }

  // 保存项目（带重试机制）
  async saveProject(retryCount = 0) {
    if (!AppState.project || this.isPaused) return;
    
    // 防止并发保存
    if (this.isSaving) {
      console.log("正在保存中，跳过本次保存请求");
      return;
    }

    this.isSaving = true;

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
      this.saveCount++;
      this.isSaving = false;

      console.log("自动保存成功:", new Date().toLocaleTimeString(), `(第${this.saveCount}次)`);

      scheduleIdbGarbageCollection();

      // 显示保存指示器（可选）
      this.showSaveIndicator();
    } catch (error) {
      this.isSaving = false;
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

  // 强制立即保存（跳过防抖）
  async forceSave() {
    if (!AppState.project) return false;
    
    // 清除待处理的快速保存
    if (this.quickSaveTimerId) {
      clearTimeout(this.quickSaveTimerId);
      this.quickSaveTimerId = null;
    }
    
    this.isDirty = true;
    await this.saveProject();
    return !this.isDirty; // 返回是否保存成功
  }

  // 获取保存状态统计
  getStats() {
    return {
      saveCount: this.saveCount,
      errorCount: this.errorCount,
      lastSaveTime: this.lastSaveTime,
      lastError: this.lastError,
      isDirty: this.isDirty,
      isPaused: this.isPaused,
      isSaving: this.isSaving,
      saveInterval: this.saveInterval,
      isRunning: !!this.timerId
    };
  }

  // 重置统计
  resetStats() {
    this.saveCount = 0;
    this.errorCount = 0;
    this.lastError = null;
  }

  // 获取状态描述
  getStatusText() {
    if (this.isSaving) return "正在保存...";
    if (this.isPaused) return "已暂停";
    if (this.isDirty) return "有未保存的更改";
    if (!this.timerId) return "已停止";
    return "已保存";
  }
}

// 创建全局自动保存管理器
// 创建实例并优化全局暴露
const autoSaveManager = new AutoSaveManager();

// 优先注册到DI系统，再暴露到全局
window.autoSaveManager = autoSaveManager;

// 尝试注册到DI系统
if (typeof window.diContainer !== 'undefined') {
  try {
    window.diContainer.registerFactory('autoSaveManager', () => autoSaveManager);
  } catch (error) {
    console.warn('AutoSaveManager DI注册失败:', error.message);
  }
}
