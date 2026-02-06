// ==================== 数据管理事件监听器 ====================
// 从 data-and-ui.js 拆分出来的独立模块
// 包含：存储后端状态、缓存清理、导出/导入数据

function registerEventListenersDataManagement(ctx) {
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  const exportAllBtn = document.getElementById("exportAllBtn");
  const exportSettingsBtn = document.getElementById("exportSettingsBtn");
  const exportTermsBtn = document.getElementById("exportTermsBtn");
  const exportProjectBtn = document.getElementById("exportProjectBtn");
  const importSettingsBtn = document.getElementById("importSettingsBtn");
  const importSettingsFile = document.getElementById("importSettingsFile");
  const clearProjectOnlyBtn = document.getElementById("clearProjectOnlyBtn");
  const clearAllCacheBtn = document.getElementById("clearAllCacheBtn");
  const cancelClearCacheBtn = document.getElementById("cancelClearCacheBtn");
  const requestFileSystemAccessBtn = document.getElementById(
    "requestFileSystemAccessBtn"
  );
  const storageBackendStatus = document.getElementById("storageBackendStatus");

  async function updateStorageBackendStatus() {
    if (!storageBackendStatus) return;
    const backend =
      storageManager && typeof storageManager.getPreferredBackend === "function"
        ? storageManager.getPreferredBackend()
        : null;
    const backendId = backend?.backendId || "unknown";
    const labels = {
      filesystem: "文件夹存储（File System Access）",
      indexeddb: "浏览器本地（IndexedDB）",
      localStorage: "浏览器本地（localStorage）",
    };

    if (backendId === "filesystem") {
      let statusText = labels.filesystem || backendId;
      const fsBackend = storageManager?.backends?.filesystem;
      if (!fsBackend || typeof fsBackend.isSupported !== "function" || !fsBackend.isSupported()) {
        statusText = "文件夹存储（不可用）";
      } else {
        let handle = fsBackend.directoryHandle;
        if (!handle && typeof fsBackend.loadHandleFromIdb === "function") {
          try {
            handle = await fsBackend.loadHandleFromIdb();
          } catch (_) {}
        }

        if (!handle) {
          statusText = "文件夹存储（未授权）";
        } else if (typeof handle.queryPermission === "function") {
          try {
            const permission = await handle.queryPermission({ mode: "readwrite" });
            if (permission === "prompt") {
              statusText = "文件夹存储（待授权）";
            } else if (permission === "denied") {
              statusText = "文件夹存储（未授权）";
            }
          } catch (_) {}
        }
      }

      storageBackendStatus.textContent = `当前存储：${statusText}`;
      return;
    }

    storageBackendStatus.textContent = `当前存储：${
      labels[backendId] || backendId
    }`;
  }

  if (typeof window !== "undefined") {
    window.updateStorageBackendStatus = updateStorageBackendStatus;
  }

  updateStorageBackendStatus();

  // 清除缓存
  if (clearCacheBtn) {
    EventManager.add(
      clearCacheBtn,
      "click",
      () => {
        openModal("clearCacheModal");
      },
      {
        tag: "data",
        scope: "dataManagement",
        label: "clearCacheBtn:clickOpenModal",
      }
    );
  }

  if (requestFileSystemAccessBtn) {
    EventManager.add(
      requestFileSystemAccessBtn,
      "click",
      async () => {
        if (!storageManager || typeof storageManager.requestFileSystemBackend !== "function") {
          showNotification(
            "warning",
            "存储不可用",
            "当前环境不支持 File System Access。"
          );
          return;
        }

        try {
          const ok = await storageManager.requestFileSystemBackend();
          if (ok) {
            if (typeof storageManager.__persistPreferredBackend === "function") {
              storageManager.__persistPreferredBackend("filesystem");
            } else {
              try {
                const settings =
                  typeof safeJsonParse === "function"
                    ? safeJsonParse(localStorage.getItem("translatorSettings"), {})
                    : JSON.parse(localStorage.getItem("translatorSettings") || "{}");
                settings.preferredStorageBackend = "filesystem";
                localStorage.setItem("translatorSettings", JSON.stringify(settings));
              } catch (e) {
                console.warn("保存存储后端设置失败:", e);
              }
            }

            let migrateMsg = "";
            if (typeof storageManager.migrateToBackend === "function") {
              try {
                const result = await storageManager.migrateToBackend("filesystem");
                if (result.migrated > 0) {
                  migrateMsg = `已迁移 ${result.migrated} 个历史项目。`;
                }
              } catch (e) {
                console.warn("迁移数据到文件存储失败:", e);
              }
            }

            if (
              typeof autoSaveManager !== "undefined" &&
              autoSaveManager?.saveProject &&
              AppState?.project
            ) {
              try {
                await autoSaveManager.saveProject();
              } catch (e) {
                console.warn("切换文件存储后保存当前项目失败:", e);
              }
            }

            updateStorageBackendStatus();
            showNotification(
              "success",
              "文件夹存储已启用",
              "已切换为文件夹存储，后续保存将写入本地文件夹。" + (migrateMsg ? " " + migrateMsg : "")
            );
          } else {
            showNotification(
              "warning",
              "未授权",
              "未获取文件夹权限，继续使用浏览器本地存储。"
            );
          }
        } catch (error) {
          console.error("文件夹存储授权失败:", error);
          showNotification(
            "error",
            "授权失败",
            error?.message || "无法启用文件夹存储"
          );
        }
      },
      {
        tag: "data",
        scope: "dataManagement",
        label: "requestFileSystemAccessBtn:click",
      }
    );
  }

  if (cancelClearCacheBtn) {
    EventManager.add(
      cancelClearCacheBtn,
      "click",
      () => {
        closeModal("clearCacheModal");
      },
      {
        tag: "data",
        scope: "dataManagement",
        label: "cancelClearCacheBtn:click",
      }
    );
  }

  if (clearProjectOnlyBtn) {
    EventManager.add(
      clearProjectOnlyBtn,
      "click",
      async () => {
        closeModal("clearCacheModal");

        const deletingProjectId = AppState?.project?.id;

        try {
          await storageManager.clearCurrentProject();
        } catch (e) {
          console.error("清理 currentProject 失败:", e);
        }

        const idbClearPromise = deletingProjectId
          ? Promise.resolve(idbDeleteFileContentsForProject(deletingProjectId))
          : Promise.resolve();

        idbClearPromise
          .catch((e) => console.error("清理IndexedDB失败:", e))
          .finally(() => {
            showNotification("success", "清除成功", "当前项目数据已清除");
            setTimeout(() => {
              location.reload();
            }, 1000);
          });
      },
      {
        tag: "data",
        scope: "dataManagement",
        label: "clearProjectOnlyBtn:click",
      }
    );
  }

  if (clearAllCacheBtn) {
    EventManager.add(
      clearAllCacheBtn,
      "click",
      async () => {
        closeModal("clearCacheModal");

        try {
          const fsBackend = storageManager?.backends?.filesystem;
          if (fsBackend && typeof fsBackend.clearPersistedHandle === "function") {
            await fsBackend.clearPersistedHandle();
          }
          if (storageManager) {
            storageManager.preferredBackendId = "indexeddb";
          }
        } catch (e) {
          console.warn("清理文件系统句柄失败:", e);
        }

        try {
          if (
            storageManager &&
            typeof storageManager.clearAllProjects === "function"
          ) {
            await storageManager.clearAllProjects();
          } else {
            await storageManager.clearCurrentProject();
          }
        } catch (e) {
          console.error("清理 currentProject 失败:", e);
        }

        try {
          try {
            const raw = localStorage.getItem("translatorSettings");
            const settings = raw
              ? typeof safeJsonParse === "function"
                ? safeJsonParse(raw, {})
                : JSON.parse(raw)
              : {};
            if (settings && typeof settings === "object") {
              settings.preferredStorageBackend = "indexeddb";
              localStorage.setItem(
                "translatorSettings",
                JSON.stringify(settings)
              );
            }
          } catch (e) {
            console.warn("重置 preferredStorageBackend 失败:", e);
          }

          localStorage.clear();
        } catch (e) {
          console.error("清理 localStorage 失败:", e);
        }

        Promise.resolve(idbClearAllFileContents())
          .catch((e) => console.error("清空IndexedDB失败:", e))
          .finally(() => {
            showNotification("success", "清除成功", "所有缓存数据已清除");
            setTimeout(() => {
              location.reload();
            }, 1000);
          });
      },
      { tag: "data", scope: "dataManagement", label: "clearAllCacheBtn:click" }
    );
  }

  // 导出所有数据
  if (exportAllBtn) {
    EventManager.add(
      exportAllBtn,
      "click",
      async () => {
        const currentProject = await storageManager
          .loadCurrentProject()
          .catch(() => null);
        const projectsIndex = await storageManager
          .listProjects()
          .catch(() => []);
        const activeProjectId = await storageManager
          .getActiveProjectId()
          .catch(() => null);
        const projectsData = await storageManager
          .loadAllProjectsData()
          .catch(() => []);
        const allData = {
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          settings: safeJsonParse(
            localStorage.getItem("translatorSettings"),
            {}
          ),
          projectsIndex,
          activeProjectId,
          projectsData,
          currentProject,
        };

        const blob = new Blob([JSON.stringify(allData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translator-all-data-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification("success", "导出成功", "所有数据已导出为JSON文件");
      },
      { tag: "data", scope: "dataManagement", label: "exportAllBtn:click" }
    );
  }

  // 导出当前项目
  if (exportProjectBtn) {
    EventManager.add(
      exportProjectBtn,
      "click",
      async () => {
        const project = await storageManager
          .loadCurrentProject()
          .catch(() => null);
        if (project) {
          const data = {
            version: "1.0.0",
            exportDate: new Date().toISOString(),
            project,
          };
          const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `project-${
            project.name || "untitled"
          }-${new Date().getTime()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showNotification("success", "导出成功", "项目数据已导出");
        } else {
          showNotification("warning", "无数据", "当前没有打开的项目");
        }
      },
      { tag: "data", scope: "dataManagement", label: "exportProjectBtn:click" }
    );
  }

  // 导出设置
  if (exportSettingsBtn) {
    EventManager.add(
      exportSettingsBtn,
      "click",
      () => {
        const settings = safeJsonParse(
          localStorage.getItem("translatorSettings"),
          {}
        );
        const data = {
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          settings,
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translator-settings-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification("success", "导出成功", "设置已导出为JSON文件");
      },
      { tag: "data", scope: "dataManagement", label: "exportSettingsBtn:click" }
    );
  }

  // 导出术语库
  if (exportTermsBtn) {
    EventManager.add(
      exportTermsBtn,
      "click",
      () => {
        const terminologyList =
          (AppState &&
          AppState.project &&
          Array.isArray(AppState.project.terminologyList)
            ? AppState.project.terminologyList
            : null) ||
          (AppState &&
          AppState.terminology &&
          Array.isArray(AppState.terminology.list)
            ? AppState.terminology.list
            : []);
        const data = {
          version: "1.0.0",
          exportDate: new Date().toISOString(),
          terminologyList,
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translator-terminology-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification("success", "导出成功", "术语库已导出为JSON文件");
      },
      { tag: "data", scope: "dataManagement", label: "exportTermsBtn:click" }
    );
  }

  // 导入设置
  if (importSettingsBtn && importSettingsFile) {
    EventManager.add(
      importSettingsBtn,
      "click",
      () => {
        importSettingsFile.click();
      },
      { tag: "data", scope: "dataManagement", label: "importSettingsBtn:click" }
    );

    EventManager.add(
      importSettingsFile,
      "change",
      (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              const data = JSON.parse(event.target.result);

              // 获取导入选项
              const includeSettings = document.getElementById(
                "importIncludeSettings"
              )?.checked;
              const includeTerms =
                document.getElementById("importIncludeTerms")?.checked;
              const includeProjects = document.getElementById(
                "importIncludeProjects"
              )?.checked;

              let importCount = 0;

              // 导入设置
              if (includeSettings && data.settings) {
                localStorage.setItem(
                  "translatorSettings",
                  JSON.stringify(data.settings)
                );
                loadSettings();
                applySettings(data.settings);
                importCount++;
              }

              // 导入术语库（合并模式）
              const importedTerms = data.terminologyList || data.terminology;
              if (includeTerms && importedTerms) {
                const existingTerms =
                  (AppState &&
                  AppState.project &&
                  Array.isArray(AppState.project.terminologyList)
                    ? AppState.project.terminologyList
                    : null) ||
                  (AppState &&
                  AppState.terminology &&
                  Array.isArray(AppState.terminology.list)
                    ? AppState.terminology.list
                    : []);
                const mergedTerms = [...(existingTerms || [])];

                // 合并术语，根据设置的duplicateHandling处理重复
                importedTerms.forEach((newTerm) => {
                  const existingIndex = mergedTerms.findIndex(
                    (t) =>
                      t.source.toLowerCase() === newTerm.source.toLowerCase()
                  );

                  if (existingIndex === -1) {
                    mergedTerms.push(newTerm);
                  } else {
                    // 覆盖模式：更新现有术语
                    mergedTerms[existingIndex] = newTerm;
                  }
                });

                try {
                  AppState.terminology.list = mergedTerms;
                  AppState.terminology.filtered = [...mergedTerms];
                  AppState.terminology.currentPage = 1;
                  if (AppState && AppState.project) {
                    AppState.project.terminologyList = mergedTerms;
                  }
                  if (typeof updateTerminologyList === "function") {
                    updateTerminologyList();
                  }
                } catch (e) {
                  console.error("同步术语库到界面失败:", e);
                }

                try {
                  if (
                    typeof autoSaveManager !== "undefined" &&
                    autoSaveManager
                  ) {
                    autoSaveManager.markDirty();
                    Promise.resolve(autoSaveManager.saveProject()).catch(
                      (e) => {
                        console.error("保存术语到项目存储失败:", e);
                      }
                    );
                  } else if (typeof storageManager !== "undefined") {
                    const payload = {
                      ...(AppState.project || {}),
                      translationItems:
                        AppState.project?.translationItems ||
                        AppState.translations?.items ||
                        [],
                      terminologyList: mergedTerms,
                      fileMetadata: AppState.fileMetadata || {},
                    };
                    Promise.resolve(
                      storageManager.saveCurrentProject(payload)
                    ).catch((e) => {
                      console.error("保存术语到项目存储失败:", e);
                    });
                  }
                } catch (e) {
                  console.error("触发项目保存失败:", e);
                }
                importCount++;
              }

              // 导入项目数据
              if (includeProjects) {
                const projectsToSave = [];

                if (
                  Array.isArray(data.projectsData) &&
                  data.projectsData.length > 0
                ) {
                  projectsToSave.push(
                    ...data.projectsData.filter((p) => p && p.id)
                  );
                }

                const importedSingle = data.currentProject || data.project;
                if (importedSingle && importedSingle.id) {
                  projectsToSave.push(importedSingle);
                }

                if (Array.isArray(data.projects) && data.projects.length > 0) {
                  projectsToSave.push(
                    ...data.projects.filter((p) => p && p.id)
                  );
                }

                const byId = new Map();
                projectsToSave.forEach((p) => byId.set(p.id, p));
                const uniqueProjects = Array.from(byId.values());

                uniqueProjects.forEach((p) => {
                  Promise.resolve(storageManager.saveProject(p)).catch((e) => {
                    console.error("导入项目失败:", e);
                  });
                });

                const indexFromProjects = uniqueProjects.map((p) => ({
                  id: p.id,
                  name: p.name || "未命名",
                  sourceLanguage: p.sourceLanguage,
                  targetLanguage: p.targetLanguage,
                  createdAt: p.createdAt,
                  updatedAt: p.updatedAt,
                }));

                if (indexFromProjects.length > 0) {
                  const idx =
                    Array.isArray(data.projectsIndex) &&
                    data.projectsIndex.length > 0
                      ? data.projectsIndex
                      : indexFromProjects;

                  Promise.resolve(storageManager.saveProjectsIndex(idx)).catch(
                    (e) => {
                      console.error("导入 projectsIndex 失败:", e);
                    }
                  );

                  const nextActive =
                    data.activeProjectId ||
                    importedSingle?.id ||
                    data.currentProject?.id ||
                    idx[0]?.id ||
                    indexFromProjects[0]?.id ||
                    null;
                  if (nextActive) {
                    Promise.resolve(
                      storageManager.setActiveProjectId(nextActive)
                    ).catch(() => {});
                  }

                  importCount++;
                } else if (
                  Array.isArray(data.projectsIndex) &&
                  data.projectsIndex.length > 0
                ) {
                  Promise.resolve(
                    storageManager.saveProjectsIndex(data.projectsIndex)
                  ).catch((e) => {
                    console.error("导入 projectsIndex 失败:", e);
                  });

                  if (data.activeProjectId) {
                    Promise.resolve(
                      storageManager.setActiveProjectId(data.activeProjectId)
                    ).catch(() => {});
                  }
                  importCount++;
                }
              }

              if (importCount > 0) {
                showNotification(
                  "success",
                  "导入成功",
                  `已导入 ${importCount} 个数据类型`
                );
                if (includeProjects) {
                  setTimeout(() => {
                    location.reload();
                  }, 1500);
                }
              } else {
                showNotification("warning", "未导入", "请至少选择一个导入选项");
              }
            } catch (error) {
              console.error("Import error:", error);
              showNotification("error", "导入失败", "无效的JSON文件格式");
            }
          };
          reader.readAsText(file);
        }
        // 清空文件输入，允许重复导入同一文件
        e.target.value = "";
      },
      {
        tag: "data",
        scope: "dataManagement",
        label: "importSettingsFile:change",
      }
    );
  }

  // 清除所有示例数据
  const translationSearchInput = ctx?.translationSearchInput;
  const translationSearchInputMobile = ctx?.translationSearchInputMobile;

  const clearAllSampleDataBtn = document.getElementById("clearAllSampleData");
  if (clearAllSampleDataBtn) {
    if (
      !(clearAllSampleDataBtn.dataset && clearAllSampleDataBtn.dataset.bound)
    ) {
      if (clearAllSampleDataBtn.dataset)
        clearAllSampleDataBtn.dataset.bound = "1";

      EventManager.add(
        clearAllSampleDataBtn,
        "click",
        async () => {
          if (
            confirm(
              "确定要清除所有示例数据吗？包括：\n- 示例项目\n- 翻译项\n- 术语库\n\n此操作不可恢复！"
            )
          ) {
            const activeWasSample =
              !!AppState?.project?.__isSampleProject ||
              AppState?.project?.id === "sample-project-1";

            try {
              const projects = await storageManager
                .listProjects()
                .catch(() => []);
              const ids = (projects || [])
                .map((p) => p && p.id)
                .filter(Boolean);

              const deleteIds = new Set();
              deleteIds.add("sample-project-1");

              for (const id of ids) {
                try {
                  const p = await storageManager.loadProjectById(id);
                  if (p && (p.__isSampleProject || id === "sample-project-1")) {
                    deleteIds.add(id);
                  }
                } catch (_) {}
              }

              for (const id of deleteIds) {
                try {
                  await storageManager.deleteProject(id);
                } catch (e) {
                  console.warn("删除示例项目失败:", id, e);
                }
              }
            } catch (e) {
              console.error("清除示例数据失败:", e);
            }

            if (activeWasSample) {
              try {
                AppState.translations.items = [];
                AppState.translations.filtered = [];
              } catch (_) {}

              try {
                AppState.terminology.list = [];
                AppState.terminology.filtered = [];
              } catch (_) {}

              try {
                AppState.project = null;
                AppState.fileMetadata = {};
              } catch (_) {}

              try {
                if (translationSearchInput) translationSearchInput.value = "";
                if (translationSearchInputMobile)
                  translationSearchInputMobile.value = "";
              } catch (_) {}

              showNotification("success", "清除成功", "示例数据已清除");
              setTimeout(() => location.reload(), 600);
            } else {
              showNotification("success", "清除成功", "示例数据已清除");
            }
          }
        },
        {
          tag: "data",
          scope: "sampleData",
          label: "clearAllSampleData:click",
        }
      );
    }
  }
}
