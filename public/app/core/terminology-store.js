// ==================== 术语库状态存储（TerminologyStore） ====================
// AppState.terminology 切片的唯一写入方（Owner）。
//
// 背景：此前 6 个文件、27 处直接裸写 AppState.terminology（list / filtered /
// currentPage），且存在三数据源（terminology.list / project.terminologyList /
// localStorage）与双源兜底读，漂移风险高。本 Store 以"意图式 API"收编全部写入。
//
// canonical 规则（杜绝双源）：
// - 运行时 AppState.terminology.list 为唯一数据源；
// - project.terminologyList 仅为持久化快照，由本 Store 经
//   ProjectStore.setTerminologyList() 在每次内容变更后同步；
// - localStorage 仅引导（首次加载，见 features/terminology/init.js），
//   加载后即并入运行时源；内容变更时由本 Store 回写快照，供无项目时恢复。
//
// 约定：业务代码禁止再直接写 AppState.terminology，一律经由本 Store
// （CI 静态检查 scripts/check-state-ownership.mjs 守护）。

const TerminologyStore = {
  // ──────────────── getters（读取一律走这里） ────────────────

  /** @returns {Array} 术语列表（运行时唯一数据源） */
  getList() {
    return AppState.terminology.list;
  },

  /** @returns {Array} 过滤后的视图列表 */
  getFiltered() {
    return AppState.terminology.filtered;
  },

  /** @returns {number} 当前页码 */
  getCurrentPage() {
    return AppState.terminology.currentPage;
  },

  /** @returns {number} 每页条数 */
  getPerPage() {
    return AppState.terminology.perPage;
  },

  // ──────────────── 意图式 API（写入一律走这里） ────────────────

  /**
   * 整体载入/替换术语列表（项目载入、导入覆盖、localStorage 引导等场景）。
   * 重置过滤视图与页码；默认同步持久化快照到项目。
   *
   * @param {Array} list - 术语列表（保持原引用，不复制）
   * @param {Object} [options]
   * @param {boolean} [options.persistLocal=false] - 是否同时回写 localStorage 快照
   * @returns {Array} 载入后的列表
   */
  loadTerminology(list, options) {
    AppState.terminology.list = Array.isArray(list) ? list : [];
    this.resetFilter();
    this.__syncProject();
    if (options && options.persistLocal) this.__persistLocal();
    return AppState.terminology.list;
  },

  /**
   * 合并新术语到现有列表（按 source 小写判重）。
   * 重置过滤视图与页码；同步项目快照与 localStorage 快照。
   *
   * @param {Array} newTerms - 待合并的术语
   * @param {Object} [options]
   * @param {boolean} [options.overwriteDuplicates=true] - 重复时是否覆盖现有条目
   *        （false = 跳过重复，仅追加新源术语）
   * @returns {Array} 合并后的列表
   */
  mergeTerms(newTerms, options) {
    const overwriteDuplicates =
      !options || options.overwriteDuplicates !== false;
    const incoming = Array.isArray(newTerms) ? newTerms : [];
    const merged = [...AppState.terminology.list];

    for (const term of incoming) {
      if (!term) continue;
      const sourceKey = String(term.source || "").toLowerCase();
      const idx = merged.findIndex(
        (t) => String((t && t.source) || "").toLowerCase() === sourceKey
      );
      if (idx === -1) {
        merged.push(term);
      } else if (overwriteDuplicates) {
        merged[idx] = term;
      }
    }

    AppState.terminology.list = merged;
    this.resetFilter();
    this.__syncProject();
    this.__persistLocal();
    return merged;
  },

  /**
   * 添加单个术语（缺省 id 时自动取 max+1）。
   * 不触碰过滤视图（调用方负责随后重新过滤）。
   *
   * @param {Object} term - 术语对象（source / target / partOfSpeech / definition）
   * @returns {Object} 写入后的术语（含 id）
   */
  addTerm(term) {
    const list = AppState.terminology.list;
    const id =
      term && term.id != null
        ? term.id
        : list.length > 0
          ? Math.max(...list.map((t) => t.id)) + 1
          : 1;
    const newTerm = Object.assign({}, term, { id });
    list.push(newTerm);
    this.__syncProject();
    this.__persistLocal();
    return newTerm;
  },

  /**
   * 按 id 更新术语字段（合并 patch）。
   *
   * @param {number} id - 术语 ID
   * @param {Object} patch - 要合并的字段
   * @returns {boolean} 是否命中并更新
   */
  updateTerm(id, patch) {
    const list = AppState.terminology.list;
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    list[idx] = Object.assign({}, list[idx], patch || {});
    this.__syncProject();
    this.__persistLocal();
    return true;
  },

  /**
   * 按 id 删除术语。
   *
   * @param {number} id - 术语 ID
   * @returns {boolean} 是否命中并删除
   */
  removeTerm(id) {
    const list = AppState.terminology.list;
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    this.__syncProject();
    this.__persistLocal();
    return true;
  },

  /**
   * 清空术语列表（清除示例数据等场景）。
   * 不同步项目快照与 localStorage（调用方通常随后清空项目；
   * localStorage 保留既有快照，避免误删用户自有术语）。
   */
  clearTerminology() {
    AppState.terminology.list = [];
    AppState.terminology.filtered = [];
    AppState.terminology.currentPage = 1;
    return AppState.terminology.list;
  },

  /**
   * 设置当前页码（边界判断由调用方结合 getFiltered/getPerPage 完成）。
   *
   * @param {number} page - 页码
   */
  setPage(page) {
    AppState.terminology.currentPage = page;
    return AppState.terminology.currentPage;
  },

  /**
   * 应用过滤谓词：filtered = list.filter(predicate)，并重置页码。
   *
   * @param {Function} predicate - 过滤函数
   * @returns {Array} 过滤后的列表
   */
  applyFilter(predicate) {
    const fn = typeof predicate === "function" ? predicate : () => true;
    AppState.terminology.filtered = AppState.terminology.list.filter(fn);
    AppState.terminology.currentPage = 1;
    return AppState.terminology.filtered;
  },

  /**
   * 重置过滤：filtered = [...list]，并重置页码。
   *
   * @returns {Array} 重置后的过滤列表
   */
  resetFilter() {
    AppState.terminology.filtered = [...AppState.terminology.list];
    AppState.terminology.currentPage = 1;
    return AppState.terminology.filtered;
  },

  // ──────────────── 内部同步（非意图 API，勿外部调用） ────────────────

  /** 持久化快照同步：经 ProjectStore 写入 project.terminologyList（无项目时跳过） */
  __syncProject() {
    if (
      typeof ProjectStore !== "undefined" &&
      ProjectStore &&
      typeof ProjectStore.setTerminologyList === "function"
    ) {
      ProjectStore.setTerminologyList(AppState.terminology.list);
    }
  },

  /** localStorage 快照回写：仅供首次加载引导（无项目时可恢复） */
  __persistLocal() {
    try {
      localStorage.setItem(
        "terminologyList",
        JSON.stringify(AppState.terminology.list)
      );
    } catch (e) {
      (
        (typeof window !== "undefined" && window.loggers?.storage) ||
        console
      ).error("保存术语库到 localStorage 失败:", e);
    }
  },
};

// 暴露到全局（供各模块与单元测试直达）
if (typeof window !== "undefined") {
  window.TerminologyStore = TerminologyStore;
}

// ==================== 开发模式写审计 ====================
// 复用 dev-tools.js 的 installSliceOwnershipAudit：任何绕过 TerminologyStore
// 的 AppState.terminology 顶层赋值都会打印带调用栈的告警（仅开发模式）。
if (typeof installSliceOwnershipAudit === "function") {
  installSliceOwnershipAudit("TerminologyStore", TerminologyStore, [
    "terminology",
  ]);
}
