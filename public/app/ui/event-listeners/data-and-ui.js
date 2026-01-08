function registerEventListenersDataAndUi(ctx) {
  // 数据管理功能
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

  // 密码显示/隐藏切换
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    EventManager.add(
      btn,
      "click",
      function () {
        const targetId = this.getAttribute("data-target");
        const input = document.getElementById(targetId);
        const icon = this.querySelector("i");

        if (input && icon) {
          if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
          } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
          }
        }
      },
      { tag: "ui", scope: "settings", label: "togglePassword:click" }
    );
  });

  // 主题和字体大小实时预览
  const themeMode = document.getElementById("themeMode");
  const fontSize = document.getElementById("fontSize");

  if (themeMode) {
    EventManager.add(
      themeMode,
      "change",
      function () {
        applySettings({ themeMode: this.value });
      },
      { tag: "settings", scope: "appearance", label: "themeMode:change" }
    );
  }

  if (fontSize) {
    EventManager.add(
      fontSize,
      "change",
      function () {
        applySettings({ fontSize: this.value });
      },
      { tag: "settings", scope: "appearance", label: "fontSize:change" }
    );
  }

  const sourceSelectionIndicatorEnabled = document.getElementById(
    "sourceSelectionIndicatorEnabled"
  );
  const sourceSelectionIndicatorUnselectedStyle = document.getElementById(
    "sourceSelectionIndicatorUnselectedStyle"
  );

  if (sourceSelectionIndicatorEnabled) {
    EventManager.add(
      sourceSelectionIndicatorEnabled,
      "change",
      function () {
        applySettings({ sourceSelectionIndicatorEnabled: this.checked });
      },
      {
        tag: "settings",
        scope: "appearance",
        label: "sourceSelectionIndicatorEnabled:change",
      }
    );
  }

  if (sourceSelectionIndicatorUnselectedStyle) {
    EventManager.add(
      sourceSelectionIndicatorUnselectedStyle,
      "change",
      function () {
        applySettings({ sourceSelectionIndicatorUnselectedStyle: this.value });
      },
      {
        tag: "settings",
        scope: "appearance",
        label: "sourceSelectionIndicatorUnselectedStyle:change",
      }
    );
  }

  // 关闭模态框
  document.querySelectorAll(".close-modal").forEach((btn) => {
    EventManager.add(btn, "click", closeModal, {
      tag: "ui",
      scope: "modal",
      label: "closeModalBtn:click",
    });
  });

  // 关闭通知
  const closeNotificationBtn = document.getElementById("closeNotification");
  if (closeNotificationBtn)
    EventManager.add(closeNotificationBtn, "click", closeNotification, {
      tag: "ui",
      scope: "notification",
      label: "closeNotificationBtn:click",
    });

  // 标签页切换（仅右侧面板的 .sidebar-tab，避免影响“浏览文件”“导出翻译”等按钮）
  const tabs = document.querySelectorAll(".sidebar-tab");
  tabs.forEach((tab) => {
    EventManager.add(
      tab,
      "click",
      () => {
        // 移除所有标签页的活动状态
        tabs.forEach((t) => {
          t.classList.remove("border-b-2", "border-primary", "text-primary");
          t.classList.add(
            "text-gray-500",
            "hover:text-gray-700",
            "dark:text-gray-400",
            "dark:hover:text-gray-200"
          );
        });

        // 添加当前标签页的活动状态
        tab.classList.add("border-b-2", "border-primary", "text-primary");
        tab.classList.remove(
          "text-gray-500",
          "hover:text-gray-700",
          "dark:text-gray-400",
          "dark:hover:text-gray-200"
        );

        // 根据标签页切换内容
        if (tab.textContent.trim() === "术语库") {
          document
            .getElementById("terminologyModal")
            .classList.remove("hidden");
        } else if (tab.textContent.trim() === "质量检查") {
          document
            .getElementById("qualityReportModal")
            .classList.remove("hidden");
          if (typeof window.syncQualityRuleCards === "function") window.syncQualityRuleCards();
        }
      },
      { tag: "ui", scope: "tabs", label: "asideTab:click" }
    );
  });

  // 移动端侧边栏切换
  const toggleLeftSidebar = document.getElementById("toggleLeftSidebar");
  const toggleRightSidebar = document.getElementById("toggleRightSidebar");
  const leftSidebar = document.getElementById("leftSidebar");
  const rightSidebar = document.getElementById("rightSidebar");

  const isDesktopLayout = () =>
    window.matchMedia && window.matchMedia("(min-width: 768px)").matches;

  const applySidebarWidthsForLayout = () => {
    const desktop = isDesktopLayout();
    const viewportWidth = window.innerWidth || 0;

    if (leftSidebar) {
      if (desktop) {
        leftSidebar.style.removeProperty("max-width");
        const savedLeftWidth = localStorage.getItem("leftSidebarWidth");
        if (savedLeftWidth) {
          const maxLeft = Math.min(500, Math.floor(viewportWidth * 0.45));
          const width = Math.max(200, Math.min(maxLeft, Number(savedLeftWidth)));
          leftSidebar.style.width = width + "px";
          leftSidebar.style.setProperty("--sidebar-width", width + "px");
        } else {
          leftSidebar.style.removeProperty("width");
          leftSidebar.style.removeProperty("--sidebar-width");
        }
      } else {
        leftSidebar.style.width = "100%";
        leftSidebar.style.maxWidth = "100%";
        leftSidebar.style.setProperty("--sidebar-width", "100%");
      }
    }

    if (rightSidebar) {
      if (desktop) {
        rightSidebar.style.removeProperty("max-width");
        const savedRightWidth = localStorage.getItem("rightSidebarWidth");
        if (savedRightWidth) {
          const maxRight = Math.min(600, Math.floor(viewportWidth * 0.45));
          const width = Math.max(280, Math.min(maxRight, Number(savedRightWidth)));
          rightSidebar.style.width = width + "px";
          rightSidebar.style.setProperty("--sidebar-width", width + "px");
        } else {
          rightSidebar.style.removeProperty("width");
          rightSidebar.style.removeProperty("--sidebar-width");
        }
      } else {
        rightSidebar.style.width = "100%";
        rightSidebar.style.maxWidth = "100%";
        rightSidebar.style.setProperty("--sidebar-width", "100%");
      }
    }
  };

  applySidebarWidthsForLayout();

  EventManager.add(
    window,
    "resize",
    () => {
      applySidebarWidthsForLayout();
    },
    { tag: "ui", scope: "sidebar", label: "sidebar:resizeApplyWidths" }
  );

  if (toggleLeftSidebar && leftSidebar) {
    EventManager.add(
      toggleLeftSidebar,
      "click",
      () => {
        leftSidebar.classList.toggle("show-sidebar");
        // 关闭右侧边栏
        if (rightSidebar && rightSidebar.classList.contains("show-sidebar")) {
          rightSidebar.classList.remove("show-sidebar");
        }
        applySidebarWidthsForLayout();
      },
      { tag: "ui", scope: "sidebar", label: "toggleLeftSidebar:click" }
    );
  }

  if (toggleRightSidebar && rightSidebar) {
    EventManager.add(
      toggleRightSidebar,
      "click",
      () => {
        rightSidebar.classList.toggle("show-sidebar");
        // 关闭左侧边栏
        if (leftSidebar && leftSidebar.classList.contains("show-sidebar")) {
          leftSidebar.classList.remove("show-sidebar");
        }
        applySidebarWidthsForLayout();
      },
      { tag: "ui", scope: "sidebar", label: "toggleRightSidebar:click" }
    );
  }

  // ==================== 按钮点击旋转效果（可复用） ====================
  document.body.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".btn-click-spin-trigger");
      if (!btn) return;
      const spinClass = btn.dataset.spin === "180" ? "btn-click-spin-180" : "btn-click-spin";
      const target = btn.dataset.spinTarget === "icon" ? btn.querySelector("i") : btn;
      if (!target) return;
      target.classList.add(spinClass);
      const onAnimationEnd = () => {
        target.classList.remove(spinClass);
        target.removeEventListener("animationend", onAnimationEnd);
      };
      target.addEventListener("animationend", onAnimationEnd, { once: true });
    },
    true
  );

  // ==================== 语言交换按钮 ====================
  const swapLanguagesBtn = document.getElementById("swapLanguagesBtn");
  const sourceLanguage = document.getElementById("sourceLanguage");
  const targetLanguage = document.getElementById("targetLanguage");

  if (swapLanguagesBtn && sourceLanguage && targetLanguage) {
    EventManager.add(
      swapLanguagesBtn,
      "click",
      () => {
        const tempValue = sourceLanguage.value;
        sourceLanguage.value = targetLanguage.value;
        targetLanguage.value = tempValue;

        // 触发 change 事件以同步其他组件
        sourceLanguage.dispatchEvent(new Event("change", { bubbles: true }));
        targetLanguage.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { tag: "ui", scope: "toolbar", label: "swapLanguages:click" }
    );
  }

  // ==================== 侧边栏拖拽调整宽度 ====================
  const sidebarResizers = document.querySelectorAll(".sidebar-resizer");
  
  sidebarResizers.forEach((resizer) => {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let sidebar = null;
    
    const onMouseDown = (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      
      const sidebarType = resizer.dataset.sidebar;
      sidebar = sidebarType === "left" ? leftSidebar : rightSidebar;
      
      if (sidebar) {
        startWidth = sidebar.offsetWidth;
        document.body.classList.add("sidebar-resizing");
        resizer.classList.add("resizing");
      }
    };
    
    const onMouseMove = (e) => {
      if (!isResizing || !sidebar) return;
      
      const sidebarType = resizer.dataset.sidebar;
      let newWidth;
      
      if (sidebarType === "left") {
        newWidth = startWidth + (e.clientX - startX);
      } else {
        newWidth = startWidth - (e.clientX - startX);
      }
      
      // 应用最小/最大宽度限制
      const minWidth = sidebarType === "left" ? 200 : 280;
      const maxWidth = sidebarType === "left" ? 500 : 600;
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      
      sidebar.style.width = newWidth + "px";
      sidebar.style.setProperty("--sidebar-width", newWidth + "px");
    };
    
    const onMouseUp = () => {
      if (isResizing && sidebar) {
        // 保存宽度到 localStorage
        const sidebarType = resizer.dataset.sidebar;
        const key = sidebarType === "left" ? "leftSidebarWidth" : "rightSidebarWidth";
        localStorage.setItem(key, sidebar.offsetWidth);
      }
      
      isResizing = false;
      sidebar = null;
      document.body.classList.remove("sidebar-resizing");
      resizer.classList.remove("resizing");
    };
    
    EventManager.add(resizer, "mousedown", onMouseDown, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mousedown",
    });
    
    EventManager.add(document, "mousemove", onMouseMove, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mousemove",
    });
    
    EventManager.add(document, "mouseup", onMouseUp, {
      tag: "ui",
      scope: "sidebar",
      label: "sidebarResizer:mouseup",
    });
  });

  // ==================== 右侧面板标签页增强 ====================
  const sidebarTabs = document.querySelectorAll(".sidebar-tab");
  
  sidebarTabs.forEach((tab) => {
    EventManager.add(
      tab,
      "click",
      () => {
        const tabName = tab.dataset.tab;
        
        // 更新标签页状态
        sidebarTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        
        // 根据标签页打开相应的模态框或面板
        if (tabName === "terminology") {
          const terminologyModal = document.getElementById("terminologyModal");
          if (terminologyModal) terminologyModal.classList.remove("hidden");
        } else if (tabName === "quality") {
          const qualityReportModal = document.getElementById("qualityReportModal");
          if (qualityReportModal) qualityReportModal.classList.remove("hidden");
          if (typeof window.syncQualityRuleCards === "function") window.syncQualityRuleCards();
        }
        // settings 标签页不需要打开模态框，显示当前面板内容
      },
      { tag: "ui", scope: "tabs", label: "sidebarTab:click" }
    );
  });
}
