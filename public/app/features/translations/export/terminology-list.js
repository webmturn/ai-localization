// 保存术语（更新现有函数）
function saveTerm() {
  const sourceTerm = DOMCache.get("sourceTerm").value.trim();
  const targetTerm = DOMCache.get("targetTerm").value.trim();
  const partOfSpeech = DOMCache.get("partOfSpeech").value;
  const termDefinition = DOMCache.get("termDefinition").value.trim();

  if (!sourceTerm || !targetTerm) {
    showNotification("warning", "缺少术语", "请输入源术语和目标术语");
    return;
  }

  const saveBtn = DOMCache.get("saveTermBtn");
  const isEditing = saveBtn.dataset.editingId;

  if (isEditing) {
    // 更新现有术语（经 TerminologyStore 意图式 API；内部同步项目与 localStorage 快照）
    const termId = parseInt(isEditing);
    const updated = TerminologyStore.updateTerm(termId, {
      source: sourceTerm,
      target: targetTerm,
      partOfSpeech: partOfSpeech,
      definition: termDefinition,
    });

    if (updated) {
      showNotification("success", "更新成功", `术语 "${sourceTerm}" 已更新`);
    }

    // 清除编辑状态
    delete saveBtn.dataset.editingId;
    saveBtn.textContent = "保存";
  } else {
    // 添加新术语（防重复：同源术语已存在时提示，避免术语库混乱）
    const dup = TerminologyStore.getList().find(
      (t) => t.source.toLowerCase() === String(sourceTerm).toLowerCase()
    );
    if (dup) {
      const sameTarget =
        dup.target.toLowerCase() === String(targetTerm).toLowerCase();
      showNotification(
        "warning",
        "术语已存在",
        sameTarget
          ? `术语 "${sourceTerm}" 已存在，无需重复添加`
          : `术语 "${sourceTerm}" 已存在（当前译名："${dup.target}"）。如需修改请使用编辑功能`
      );
      return;
    }

    // 添加新术语（id 由 Store 自动分配；内部同步项目与 localStorage 快照）
    TerminologyStore.addTerm({
      source: sourceTerm,
      target: targetTerm,
      partOfSpeech: partOfSpeech,
      definition: termDefinition,
    });
    showNotification("success", "添加成功", `术语 "${sourceTerm}" 已成功添加`);
  }

  try {
    if (
      typeof autoSaveManager !== "undefined" &&
      autoSaveManager &&
      typeof autoSaveManager.saveProject === "function"
    ) {
      Promise.resolve(autoSaveManager.saveProject()).catch((e) => {
        (loggers.storage || console).error("保存术语到项目存储失败:", e);
      });
    }
  } catch (e) {
    (loggers.storage || console).error("触发项目保存失败:", e);
  }

  // 重置表单
  DOMCache.get("sourceTerm").value = "";
  DOMCache.get("targetTerm").value = "";
  DOMCache.get("partOfSpeech").value = "noun";
  DOMCache.get("termDefinition").value = "";

  // 更新列表
  filterTerminology();

  // 关闭添加术语模态框（不关闭术语库管理模态框）
  closeModal("addTermModal");
}

// 切换术语库标签页
function switchTerminologyTab(tabName) {
  const panelId = `terminology${tabName === "list" ? "List" : "ImportExport"}Panel`;
  switchTabState(".terminology-tab", ".tab-panel", tabName, {
    activePanelId: panelId,
  });

  // 如果是列表标签页，刷新列表
  if (tabName === "list") {
    updateTerminologyList();
  }
}

// 更新术语列表
function updateTerminologyList() {
  const terminologyListElement = DOMCache.get("terminologyList");
  if (!terminologyListElement) return;

  // 使用 TerminologyStore getter 获取数据
  const terminologyList = TerminologyStore.getList() || [];
  const currentTerminologyPage = TerminologyStore.getCurrentPage() || 1;
  const terminologyPerPage = TerminologyStore.getPerPage() || 10;
  const filteredTerminology = TerminologyStore.getFiltered() || terminologyList;

  // 计算分页
  const startIndex = (currentTerminologyPage - 1) * terminologyPerPage;
  const endIndex = Math.min(
    startIndex + terminologyPerPage,
    filteredTerminology.length
  );
  const itemsToShow = filteredTerminology.slice(startIndex, endIndex);

  if (itemsToShow.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "px-4 py-8 text-center text-gray-500 dark:text-gray-400";

    const icon = document.createElement("i");
    icon.className =
      "fa-solid fa-magnifying-glass text-3xl text-gray-300 dark:text-gray-600 mb-2 block";

    const p1 = document.createElement("p");
    p1.textContent = "没有找到匹配的术语";

    const p2 = document.createElement("p");
    p2.className = "text-sm mt-1";
    p2.textContent = "尝试使用不同的搜索词或筛选条件";

    td.appendChild(icon);
    td.appendChild(p1);
    td.appendChild(p2);
    tr.appendChild(td);
    terminologyListElement.replaceChildren(tr);
  } else {
    const fragment = document.createDocumentFragment();
    itemsToShow.forEach((term) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50 dark:hover:bg-gray-600";

      const td1 = document.createElement("td");
      td1.className =
        "px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium";
      td1.textContent = term.source;

      const td2 = document.createElement("td");
      td2.className = "px-4 py-3 text-sm text-gray-900 dark:text-gray-100";
      td2.textContent = term.target;

      const td3 = document.createElement("td");
      td3.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400";
      td3.textContent = getPartOfSpeechText(term.partOfSpeech);

      const td4 = document.createElement("td");
      td4.className = "px-4 py-3 text-sm text-gray-500 dark:text-gray-400";

      const editBtn = document.createElement("button");
      editBtn.className =
        "edit-term-btn text-primary hover:text-primary/80 mr-2 px-2 py-1 rounded-md hover:bg-primary/10 dark:hover:bg-blue-400/10 transition-colors";
      editBtn.dataset.id = String(term.id);
      editBtn.textContent = "编辑";

      const delBtn = document.createElement("button");
      delBtn.className = "delete-term-btn text-danger hover:text-danger/80";
      delBtn.dataset.id = String(term.id);
      delBtn.title = "删除术语";
      delBtn.setAttribute("aria-label", "删除术语");
      delBtn.innerHTML = '<i class="fa-regular fa-trash-can" aria-hidden="true"></i>';

      td4.appendChild(editBtn);
      td4.appendChild(delBtn);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      fragment.appendChild(tr);
    });
    terminologyListElement.replaceChildren(fragment);
  }

  // 更新分页信息
  updateTerminologyPagination();
}

// 获取词性文本
function getPartOfSpeechText(pos) {
  const posMap = {
    noun: "名词",
    verb: "动词",
    adjective: "形容词",
    adverb: "副词",
    other: "其他",
  };
  return posMap[pos] || pos;
}

// 更新术语分页信息
function updateTerminologyPagination() {
  // 使用 TerminologyStore getter 获取数据
  const filteredTerminology = TerminologyStore.getFiltered();
  const terminologyPerPage = TerminologyStore.getPerPage();
  const currentTerminologyPage = TerminologyStore.getCurrentPage();

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTerminology.length / terminologyPerPage)
  );

  // 更新计数
  const totalItems = filteredTerminology.length;
  const startIndex =
    totalItems === 0
      ? 0
      : (currentTerminologyPage - 1) * terminologyPerPage + 1;
  const endIndex =
    totalItems === 0
      ? 0
      : Math.min(startIndex + terminologyPerPage - 1, totalItems);

  const terminologyCount = DOMCache.get("terminologyCount");
  if (terminologyCount) {
    terminologyCount.textContent = `显示 ${startIndex}-${endIndex} 条，共 ${totalItems} 条`;
  }

  // 更新页码
  const currentPageElement = DOMCache.get("terminologyCurrentPage");
  if (currentPageElement) {
    currentPageElement.textContent = currentTerminologyPage;
  }

  // 更新按钮状态
  const prevBtn = DOMCache.get("terminologyPrevBtn");
  const nextBtn = DOMCache.get("terminologyNextBtn");

  if (prevBtn) {
    prevBtn.disabled = totalItems === 0 || currentTerminologyPage <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = totalItems === 0 || currentTerminologyPage >= totalPages;
  }
}

// 处理术语分页
function handleTerminologyPagination(direction) {
  const filteredTerminology = TerminologyStore.getFiltered();
  const terminologyPerPage = TerminologyStore.getPerPage();
  const totalPages = Math.max(
    1,
    Math.ceil(filteredTerminology.length / terminologyPerPage)
  );
  const currentTerminologyPage = TerminologyStore.getCurrentPage();

  if (direction === "prev" && currentTerminologyPage > 1) {
    TerminologyStore.setPage(currentTerminologyPage - 1);
  } else if (direction === "next" && currentTerminologyPage < totalPages) {
    TerminologyStore.setPage(currentTerminologyPage + 1);
  }

  updateTerminologyList();
}

// 过滤术语
function filterTerminology() {
  const searchInput = DOMCache.get("terminologySearch");
  const filterSelect = DOMCache.get("terminologyFilter");

  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
  const filterValue = filterSelect ? filterSelect.value : "all";

  // 经 TerminologyStore 意图式 API 应用过滤（内部重置页码）
  TerminologyStore.applyFilter((term) => {
    // 搜索过滤
    const matchesSearch =
      !searchTerm ||
      term.source.toLowerCase().includes(searchTerm) ||
      term.target.toLowerCase().includes(searchTerm) ||
      (term.definition && term.definition.toLowerCase().includes(searchTerm));

    // 词性过滤
    const matchesFilter =
      filterValue === "all" || term.partOfSpeech === filterValue;

    return matchesSearch && matchesFilter;
  });

  updateTerminologyList();
}

// 编辑术语
function editTerm(termId) {
  const term = TerminologyStore.getList().find((t) => t.id === termId);
  if (!term) return;

  // 填充编辑模态框
  DOMCache.get("sourceTerm").value = term.source;
  DOMCache.get("targetTerm").value = term.target;
  DOMCache.get("partOfSpeech").value = term.partOfSpeech;
  DOMCache.get("termDefinition").value = term.definition || "";

  // 显示编辑模态框
  DOMCache.get("addTermModal").classList.remove("hidden");

  // 暂时保存正在编辑的术语ID
  const saveBtn = DOMCache.get("saveTermBtn");
  saveBtn.dataset.editingId = termId;
  saveBtn.textContent = "更新术语";
}

// 删除术语
async function deleteTerm(termId) {
  const ok = await showConfirmDialog({
    title: "删除术语",
    message: "确定要删除这个术语吗？",
    confirmText: "删除",
    danger: true,
  });
  if (ok) {
    // 经 TerminologyStore 意图式 API 删除（内部同步项目与 localStorage 快照）
    const removed = TerminologyStore.removeTerm(termId);
    if (removed) {
      try {
        if (
          typeof autoSaveManager !== "undefined" &&
          autoSaveManager &&
          typeof autoSaveManager.saveProject === "function"
        ) {
          Promise.resolve(autoSaveManager.saveProject()).catch((e) => {
            (loggers.storage || console).error("保存术语到项目存储失败:", e);
          });
        }
      } catch (e) {
        (loggers.storage || console).error("触发项目保存失败:", e);
      }

      filterTerminology(); // 重新过滤并更新列表
      showNotification("success", "删除成功", "术语已成功删除");
    }
  }
}

// 暴露函数到全局作用域
window.updateTerminologyList = updateTerminologyList;
window.updateTerminologyPagination = updateTerminologyPagination;
window.filterTerminology = filterTerminology;
window.switchTerminologyTab = switchTerminologyTab;
