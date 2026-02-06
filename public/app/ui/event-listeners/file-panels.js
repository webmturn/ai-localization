function registerEventListenersFilePanels(ctx) {
  const fileTree = ctx?.fileTree;
  const searchResultsList = ctx?.searchResultsList;
  const searchResultsPanel = ctx?.searchResultsPanel;

  const __devLog = (...args) => {
    const isDev = typeof isDevelopment !== "undefined" && isDevelopment;
    let enabled = false;
    try {
      var debugLogsFlag =
        typeof window !== "undefined"
          ? window.ArchDebug
            ? window.ArchDebug.getFlag('DEBUG_LOGS')
            : window.__DEBUG_LOGS
          : undefined;

      enabled =
        debugLogsFlag === true ||
        (typeof localStorage !== "undefined" &&
          localStorage.getItem("debugLogs") === "1");
    } catch (_) {}

    if (isDev && enabled) {
      try {
        console.log(...args);
      } catch (_) {}
    }
  };

  if (fileTree) {
    EventManager.add(
      fileTree,
      "click",
      function (e) {
        const row = e.target.closest("li > div");
        if (!row || !fileTree.contains(row)) return;

        fileTree.querySelectorAll("li > div").forEach((el) => {
          el.classList.remove("bg-gray-100", "dark:bg-gray-800");
        });
        row.classList.add("bg-gray-100", "dark:bg-gray-800");

        const filename =
          row.dataset.filename || row.querySelector("span")?.textContent;
        if (filename) {
          filterTranslationItemsByFile(filename);
        }
      },
      {
        tag: "fileTree",
        scope: "panel:fileTree",
        label: "fileTree:clickDelegate",
      }
    );
  }

  if (searchResultsList && searchResultsPanel) {
    EventManager.add(
      searchResultsList,
      "click",
      function (e) {
        const item = e.target.closest(".file-search-result-item");
        if (!item || !searchResultsList.contains(item)) return;
        const filename = item.dataset.filename;
        __devLog("点击文件:", filename);
        searchResultsPanel.classList.add("hidden");
      },
      {
        tag: "search",
        scope: "panel:searchResults",
        label: "searchResultsList:clickDelegate",
      }
    );
  }

  // 检查关键元素是否存在
  const elementsToCheck = [
    "fileDropArea",
    "fileInput",
    "browseFilesBtn",
    "searchInput",
    "sourcePrevBtn",
    "sourceNextBtn",
    "translateSelectedBtn",
    "translateAllBtn",
    "openFindReplaceBtn",
    "clearSelectedTargetBtn",
    "cancelTranslationBtn",
    "findReplaceModal",
    "findReplaceFind",
    "findReplaceReplace",
    "findReplaceScope",
    "findReplaceUseRegex",
    "findReplaceCaseSensitive",
    "findReplacePreviewCount",
    "findReplacePreviewList",
    "findReplacePreviewListLimit",
    "findReplacePreviewListBody",
    "findReplacePreviewBtn",
    "findReplaceApplyBtn",
    "exportBtn",
    "confirmExportBtn",
    "newProjectBtn",
    "createProjectBtn",
    "openProjectBtn",
    "saveProjectBtn",
    "addTermBtn",
    "saveTermBtn",
    "userMenuBtn",
    "closeNotification",
  ];

  elementsToCheck.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`[file-panels] 缺少关键元素: #${id}`);
    }
  });

  // 文件上传相关
  const fileDropArea = document.getElementById("fileDropArea");
  const fileInput = document.getElementById("fileInput");
  const browseFilesBtn = document.getElementById("browseFilesBtn");

  if (fileDropArea && fileInput) {
    EventManager.add(fileDropArea, "dragover", handleDragOver, {
      tag: "project",
      scope: "fileImport",
      label: "fileDropArea:dragover",
    });
    EventManager.add(fileDropArea, "dragleave", handleDragLeave, {
      tag: "project",
      scope: "fileImport",
      label: "fileDropArea:dragleave",
    });
    EventManager.add(fileDropArea, "drop", handleDrop, {
      tag: "project",
      scope: "fileImport",
      label: "fileDropArea:drop",
    });
    EventManager.add(fileDropArea, "click", () => fileInput.click(), {
      tag: "project",
      scope: "fileImport",
      label: "fileDropArea:click",
    });
  }
  if (browseFilesBtn && fileInput)
    EventManager.add(
      browseFilesBtn,
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
      },
      { tag: "project", scope: "fileImport", label: "browseFilesBtn:click" }
    );
  if (fileInput)
    EventManager.add(fileInput, "change", handleFileSelect, {
      tag: "project",
      scope: "fileImport",
      label: "fileInput:change",
    });

  // 搜索功能
  const searchInput = document.getElementById("searchInput");
  __devLog("初始化搜索功能，searchInput元素:", searchInput);

  if (searchInput) {
    // 添加输入事件监听
    const debouncedSearchInput = debounce(handleSearchInput, 300);
    EventManager.add(searchInput, "input", debouncedSearchInput, {
      tag: "search",
      scope: "panel:fileSearch",
      label: "searchInput:input",
    });
    __devLog("已添加input事件监听器");

    // 添加回车键事件监听
    EventManager.add(
      searchInput,
      "keypress",
      function (e) {
        __devLog("检测到按键:", e.key, "keyCode:", e.keyCode);
        if (e.key === "Enter" || e.keyCode === 13) {
          e.preventDefault();
          __devLog("执行搜索回车处理");
          handleSearchEnter();
        }
      },
      {
        tag: "search",
        scope: "panel:fileSearch",
        label: "searchInput:keypress",
      }
    );
    __devLog("已添加keypress事件监听器");
  } else {
    console.error("未找到searchInput元素");
  }

  // 分页功能
  const sourcePrevBtn = document.getElementById("sourcePrevBtn");
  const sourceNextBtn = document.getElementById("sourceNextBtn");

  if (sourcePrevBtn)
    EventManager.add(sourcePrevBtn, "click", () => handlePagination("prev"), {
      tag: "translations",
      scope: "pagination",
      label: "sourcePrevBtn:click",
    });
  if (sourceNextBtn)
    EventManager.add(sourceNextBtn, "click", () => handlePagination("next"), {
      tag: "translations",
      scope: "pagination",
      label: "sourceNextBtn:click",
    });

  // 翻译相关按钮
  const translateSelectedBtn = document.getElementById("translateSelectedBtn");
  const translateAllBtn = document.getElementById("translateAllBtn");
  const openFindReplaceBtn = document.getElementById("openFindReplaceBtn");
  const clearSelectedTargetBtn = document.getElementById(
    "clearSelectedTargetBtn"
  );
  const cancelTranslationBtn = document.getElementById("cancelTranslationBtn");
  const pauseTranslationBtn = document.getElementById("pauseTranslationBtn");
  const resumeTranslationBtn = document.getElementById("resumeTranslationBtn");
  const retryFailedTranslationBtn = document.getElementById(
    "retryFailedTranslationBtn"
  );

  if (translateSelectedBtn)
    EventManager.add(translateSelectedBtn, "click", translateSelected, {
      tag: "translations",
      scope: "actions",
      label: "translateSelectedBtn:click",
    });
  if (translateAllBtn)
    EventManager.add(translateAllBtn, "click", translateAll, {
      tag: "translations",
      scope: "actions",
      label: "translateAllBtn:click",
    });

  if (openFindReplaceBtn)
    EventManager.add(
      openFindReplaceBtn,
      "click",
      () => {
        openModal("findReplaceModal");
        const findEl = document.getElementById("findReplaceFind");
        const replaceEl = document.getElementById("findReplaceReplace");
        const scopeEl = document.getElementById("findReplaceScope");
        const regexEl = document.getElementById("findReplaceUseRegex");
        const caseEl = document.getElementById("findReplaceCaseSensitive");
        const previewEl = document.getElementById("findReplacePreviewCount");
        if (findEl) findEl.value = "";
        if (replaceEl) replaceEl.value = "";
        if (regexEl) regexEl.checked = false;
        if (caseEl) caseEl.checked = false;
        if (previewEl) previewEl.textContent = "0";
        if (scopeEl) {
          const selectedFile = AppState?.translations?.selectedFile;
          scopeEl.value = selectedFile ? "file" : "project";
        }
        try {
          findEl?.focus();
        } catch (_) {}
      },
      {
        tag: "translations",
        scope: "findReplace",
        label: "openFindReplaceBtn:clickOpenModal",
      }
    );

  const findReplacePreviewBtn = document.getElementById("findReplacePreviewBtn");
  const findReplaceApplyBtn = document.getElementById("findReplaceApplyBtn");
  const findReplaceFind = document.getElementById("findReplaceFind");
  const findReplaceReplace = document.getElementById("findReplaceReplace");
  const findReplaceScope = document.getElementById("findReplaceScope");
  const findReplaceUseRegex = document.getElementById("findReplaceUseRegex");
  const findReplaceCaseSensitive = document.getElementById(
    "findReplaceCaseSensitive"
  );

  if (findReplacePreviewBtn)
    EventManager.add(
      findReplacePreviewBtn,
      "click",
      () => {
        if (typeof previewFindReplace === "function") {
          previewFindReplace({ silent: false });
        }
      },
      {
        tag: "translations",
        scope: "findReplace",
        label: "findReplacePreviewBtn:click",
      }
    );

  if (findReplaceApplyBtn)
    EventManager.add(
      findReplaceApplyBtn,
      "click",
      () => {
        if (typeof applyFindReplace === "function") {
          applyFindReplace();
        }
      },
      {
        tag: "translations",
        scope: "findReplace",
        label: "findReplaceApplyBtn:click",
      }
    );

  const debouncedFindReplacePreview = debounce(() => {
    if (typeof previewFindReplace === "function") {
      previewFindReplace({ silent: true });
    }
  }, 200);

  if (findReplaceFind)
    EventManager.add(findReplaceFind, "input", debouncedFindReplacePreview, {
      tag: "translations",
      scope: "findReplace",
      label: "findReplaceFind:input",
    });
  if (findReplaceReplace)
    EventManager.add(findReplaceReplace, "input", debouncedFindReplacePreview, {
      tag: "translations",
      scope: "findReplace",
      label: "findReplaceReplace:input",
    });
  if (findReplaceScope)
    EventManager.add(findReplaceScope, "change", debouncedFindReplacePreview, {
      tag: "translations",
      scope: "findReplace",
      label: "findReplaceScope:change",
    });
  if (findReplaceUseRegex)
    EventManager.add(
      findReplaceUseRegex,
      "change",
      debouncedFindReplacePreview,
      {
        tag: "translations",
        scope: "findReplace",
        label: "findReplaceUseRegex:change",
      }
    );
  if (findReplaceCaseSensitive)
    EventManager.add(
      findReplaceCaseSensitive,
      "change",
      debouncedFindReplacePreview,
      {
        tag: "translations",
        scope: "findReplace",
        label: "findReplaceCaseSensitive:change",
      }
    );

  if (clearSelectedTargetBtn)
    EventManager.add(clearSelectedTargetBtn, "click", clearSelectedTargets, {
      tag: "translations",
      scope: "actions",
      label: "clearSelectedTargetBtn:click",
    });
  if (cancelTranslationBtn)
    EventManager.add(cancelTranslationBtn, "click", cancelTranslation, {
      tag: "translations",
      scope: "actions",
      label: "cancelTranslationBtn:click",
    });
  if (pauseTranslationBtn)
    EventManager.add(pauseTranslationBtn, "click", pauseTranslation, {
      tag: "translations",
      scope: "actions",
      label: "pauseTranslationBtn:click",
    });
  if (resumeTranslationBtn)
    EventManager.add(resumeTranslationBtn, "click", resumeTranslation, {
      tag: "translations",
      scope: "actions",
      label: "resumeTranslationBtn:click",
    });
  if (retryFailedTranslationBtn)
    EventManager.add(retryFailedTranslationBtn, "click", retryFailedTranslations, {
      tag: "translations",
      scope: "actions",
      label: "retryFailedTranslationBtn:click",
    });

  // 导出相关
  const exportBtn = document.getElementById("exportBtn");
  const confirmExportBtn = document.getElementById("confirmExportBtn");

  if (exportBtn) {
    EventManager.add(
      exportBtn,
      "click",
      () => {
        const exportModal = document.getElementById("exportModal");
        if (exportModal) exportModal.classList.remove("hidden");
      },
      { tag: "export", scope: "exportModal", label: "exportBtn:clickOpenModal" }
    );
  }
  if (confirmExportBtn)
    EventManager.add(
      confirmExportBtn,
      "click",
      function () {
        const App = window.App;
        const ensure = App?.services?.ensureTranslationsExportModule;

        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              try {
                if (typeof exportTranslation === "function") {
                  exportTranslation();
                } else {
                  throw new Error("exportTranslation is not available after load");
                }
              } catch (e) {
                console.error("exportTranslation failed:", e);
                showNotification(
                  "error",
                  "导出失败",
                  e?.message || "导出过程中出现错误"
                );
              }
            })
            .catch(function (e) {
              console.error("Failed to lazy-load export module:", e);
              showNotification(
                "error",
                "导出失败",
                e?.message || "导出组件加载失败"
              );
            });
          return;
        }

        try {
          exportTranslation();
        } catch (e) {
          console.error("exportTranslation failed:", e);
          showNotification(
            "error",
            "导出失败",
            e?.message || "导出过程中出现错误"
          );
        }
      },
      {
        tag: "export",
        scope: "exportModal",
        label: "confirmExportBtn:click",
      }
    );

  // 项目相关
  const newProjectBtn = document.getElementById("newProjectBtn");
  const createProjectBtn = document.getElementById("createProjectBtn");
  const openProjectBtn = document.getElementById("openProjectBtn");
  const saveProjectBtn = document.getElementById("saveProjectBtn");

  if (newProjectBtn) {
    EventManager.add(
      newProjectBtn,
      "click",
      () => {
        const newProjectModal = document.getElementById("newProjectModal");
        if (newProjectModal) newProjectModal.classList.remove("hidden");
      },
      {
        tag: "project",
        scope: "project",
        label: "newProjectBtn:clickOpenModal",
      }
    );
  }
  if (createProjectBtn)
    EventManager.add(createProjectBtn, "click", createNewProject, {
      tag: "project",
      scope: "project",
      label: "createProjectBtn:click",
    });
  if (openProjectBtn)
    EventManager.add(openProjectBtn, "click", openProject, {
      tag: "project",
      scope: "project",
      label: "openProjectBtn:click",
    });
  if (saveProjectBtn)
    EventManager.add(saveProjectBtn, "click", saveProject, {
      tag: "project",
      scope: "project",
      label: "saveProjectBtn:click",
    });

  // 术语库相关

  // 用户菜单
  const userMenuBtn = document.getElementById("userMenuBtn");
  if (userMenuBtn)
    EventManager.add(userMenuBtn, "click", toggleUserMenu, {
      tag: "user",
      scope: "userMenu",
      label: "userMenuBtn:click",
    });

  // 用户菜单项点击事件
  const openSettingsMenu = document.getElementById("openSettingsMenu");
  const openHelpMenu = document.getElementById("openHelpMenu");
  const openAboutMenu = document.getElementById("openAboutMenu");

  if (openSettingsMenu) {
    EventManager.add(
      openSettingsMenu,
      "click",
      (e) => {
        e.preventDefault();
        document.getElementById("userMenu")?.classList.add("hidden");
        openModal("settingsModal");
      },
      { tag: "settings", scope: "userMenu", label: "openSettingsMenu:click" }
    );
  }

  if (openHelpMenu) {
    EventManager.add(
      openHelpMenu,
      "click",
      (e) => {
        e.preventDefault();
        document.getElementById("userMenu")?.classList.add("hidden");
        openModal("helpModal");
      },
      { tag: "help", scope: "userMenu", label: "openHelpMenu:click" }
    );
  }

  if (openAboutMenu) {
    EventManager.add(
      openAboutMenu,
      "click",
      (e) => {
        e.preventDefault();
        document.getElementById("userMenu")?.classList.add("hidden");
        openModal("aboutModal");
      },
      { tag: "about", scope: "userMenu", label: "openAboutMenu:click" }
    );
  }
}
