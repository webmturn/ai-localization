function registerEventListenersTerminology(ctx) {
  const terminologyListElement = ctx?.terminologyListElement;

  if (terminologyListElement) {
    EventManager.add(
      terminologyListElement,
      "click",
      function (e) {
        const editBtn = e.target.closest(".edit-term-btn");
        if (editBtn && terminologyListElement.contains(editBtn)) {
          const termId = parseInt(editBtn.dataset.id);
          editTerm(termId);
          return;
        }

        const deleteBtn = e.target.closest(".delete-term-btn");
        if (deleteBtn && terminologyListElement.contains(deleteBtn)) {
          const termId = parseInt(deleteBtn.dataset.id);
          deleteTerm(termId);
        }
      },
      {
        tag: "terminology",
        scope: "terminology:list",
        label: "terminologyList:clickDelegate",
      }
    );
  }

  // 术语库标签页切换
  const terminologyListTab = document.getElementById("terminologyListTab");
  if (terminologyListTab)
    EventManager.add(
      terminologyListTab,
      "click",
      () => switchTerminologyTab("list"),
      {
        tag: "terminology",
        scope: "terminology:tabs",
        label: "terminologyListTab:click",
      }
    );
  const terminologyImportExportTab = document.getElementById(
    "terminologyImportExportTab"
  );
  if (terminologyImportExportTab)
    EventManager.add(
      terminologyImportExportTab,
      "click",
      () => switchTerminologyTab("import-export"),
      {
        tag: "terminology",
        scope: "terminology:tabs",
        label: "terminologyImportExportTab:click",
      }
    );

  // 术语库导入相关事件
  const importDropArea = document.getElementById("importDropArea");
  const importTerminologyBtn = document.getElementById("importTerminologyBtn");

  if (importDropArea) {
    EventManager.add(
      importDropArea,
      "dragover",
      function (e) {
        try {
          e.preventDefault();
        } catch (_) {}

        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              const fn = window.handleImportDragOver;
              if (typeof fn === "function") fn(e);
            })
            .catch(function (err) {
              console.error("Failed to lazy-load terminology import module:", err);
            });
          return;
        }

        const fn = window.handleImportDragOver;
        if (typeof fn === "function") fn(e);
      },
      {
        tag: "terminology",
        scope: "terminology:import",
        label: "importDropArea:dragover",
      }
    );
    EventManager.add(
      importDropArea,
      "dragleave",
      function (e) {
        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              const fn = window.handleImportDragLeave;
              if (typeof fn === "function") fn(e);
            })
            .catch(function (err) {
              console.error("Failed to lazy-load terminology import module:", err);
            });
          return;
        }

        const fn = window.handleImportDragLeave;
        if (typeof fn === "function") fn(e);
      },
      {
        tag: "terminology",
        scope: "terminology:import",
        label: "importDropArea:dragleave",
      }
    );
    EventManager.add(
      importDropArea,
      "drop",
      function (e) {
        try {
          e.preventDefault();
        } catch (_) {}

        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              const fn = window.handleImportDrop;
              if (typeof fn === "function") fn(e);
            })
            .catch(function (err) {
              console.error("Failed to lazy-load terminology import module:", err);
              showNotification(
                "error",
                "导入失败",
                err?.message || "导入组件加载失败"
              );
            });
          return;
        }

        const fn = window.handleImportDrop;
        if (typeof fn === "function") fn(e);
      },
      {
        tag: "terminology",
        scope: "terminology:import",
        label: "importDropArea:drop",
      }
    );
    EventManager.add(
      importDropArea,
      "click",
      () => document.getElementById("importFileInput")?.click(),
      {
        tag: "terminology",
        scope: "terminology:import",
        label: "importDropArea:clickChooseFile",
      }
    );
  }

  EventManager.add(
    document,
    "change",
    function (e) {
      const target = e.target;
      if (target && target.id === "importFileInput") {
        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              const fn = window.handleImportFileSelect;
              if (typeof fn === "function") fn({ target });
            })
            .catch(function (err) {
              console.error(
                "Failed to lazy-load terminology import module:",
                err
              );
              showNotification(
                "error",
                "导入失败",
                err?.message || "导入组件加载失败"
              );
            });
          return;
        }

        const fn = window.handleImportFileSelect;
        if (typeof fn === "function") fn({ target });
      }
    },
    {
      tag: "terminology",
      scope: "terminology:import",
      label: "document:changeImportFileInput",
    }
  );

  if (importTerminologyBtn) {
    // 确保按钮在页面加载时是禁用的
    importTerminologyBtn.disabled = true;
    EventManager.add(
      importTerminologyBtn,
      "click",
      function () {
        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              try {
                importTerminology();
              } catch (e) {
                console.error("importTerminology failed:", e);
              }
            })
            .catch(function (e) {
              console.error("Failed to lazy-load terminology import module:", e);
              showNotification(
                "error",
                "导入失败",
                e?.message || "导入组件加载失败"
              );
            });
          return;
        }

        importTerminology();
      },
      {
        tag: "terminology",
        scope: "terminology:import",
        label: "importTerminologyBtn:click",
      }
    );
  }

  // 术语库导出事件
  const exportTerminologyBtn = document.getElementById("exportTerminologyBtn");
  if (exportTerminologyBtn)
    EventManager.add(
      exportTerminologyBtn,
      "click",
      function () {
        const App = window.App;
        const ensure = App?.services?.ensureTerminologyImportExportModule;
        if (typeof ensure === "function") {
          ensure()
            .then(function () {
              try {
                exportTerminology();
              } catch (e) {
                console.error("exportTerminology failed:", e);
              }
            })
            .catch(function (e) {
              console.error("Failed to lazy-load terminology export module:", e);
              showNotification(
                "error",
                "导出失败",
                e?.message || "导出组件加载失败"
              );
            });
          return;
        }

        exportTerminology();
      },
      {
        tag: "terminology",
        scope: "terminology:export",
        label: "exportTerminologyBtn:click",
      }
    );

  // 术语库搜索和筛选
  const terminologySearch = document.getElementById("terminologySearch");
  if (terminologySearch) {
    const debouncedTerminologySearch = debounce(filterTerminology, 300);
    EventManager.add(terminologySearch, "input", debouncedTerminologySearch, {
      tag: "terminology",
      scope: "terminology:filter",
      label: "terminologySearch:input",
    });
  }
  const terminologyFilter = document.getElementById("terminologyFilter");
  if (terminologyFilter)
    EventManager.add(terminologyFilter, "change", filterTerminology, {
      tag: "terminology",
      scope: "terminology:filter",
      label: "terminologyFilter:change",
    });

  // 术语库分页
  const terminologyPrevBtn = document.getElementById("terminologyPrevBtn");
  if (terminologyPrevBtn)
    EventManager.add(
      terminologyPrevBtn,
      "click",
      () => handleTerminologyPagination("prev"),
      {
        tag: "terminology",
        scope: "terminology:pagination",
        label: "terminologyPrevBtn:click",
      }
    );
  const terminologyNextBtn = document.getElementById("terminologyNextBtn");
  if (terminologyNextBtn)
    EventManager.add(
      terminologyNextBtn,
      "click",
      () => handleTerminologyPagination("next"),
      {
        tag: "terminology",
        scope: "terminology:pagination",
        label: "terminologyNextBtn:click",
      }
    );

  // 添加术语按钮（已存在的）
  const addTermBtn = document.getElementById("addTermBtn");
  if (addTermBtn) {
    EventManager.add(
      addTermBtn,
      "click",
      () => {
        document.getElementById("addTermModal").classList.remove("hidden");
      },
      {
        tag: "terminology",
        scope: "terminology:edit",
        label: "addTermBtn:click",
      }
    );
  }

  // 保存术语按钮（已存在的）
  const saveTermBtn = document.getElementById("saveTermBtn");
  if (saveTermBtn)
    EventManager.add(saveTermBtn, "click", saveTerm, {
      tag: "terminology",
      scope: "terminology:edit",
      label: "saveTermBtn:click",
    });
}
