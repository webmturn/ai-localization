// ==================== 项目状态存储（ProjectStore） ====================
// AppState.project / AppState.fileMetadata 两个切片的唯一写入方（Owner）。
//
// 背景：此前 9 个文件、27 处直接裸写 AppState.project / AppState.fileMetadata，
// 无所有权边界，任何模块都能改任何领域的数据（上帝对象耦合）。
// 本 Store 以"意图式 API"收编全部写入：调用方表达意图（加载/创建/清空/换文件条目），
// 由 Store 统一维护 project、fileMetadata 及 translations 视图的同步与别名一致。
//
// 约定：
// - canonical 数据：翻译条目以 AppState.project.translationItems 为准；
//   视图稳定引用由 TranslationViewStore.setViewItems / getViewItems 维护
//   （阶段 3b 已删除 AppState.translations.items 兼容别名）。
// - fileMetadata 以 AppState.fileMetadata 为准；
//   AppState.project.fileMetadata 为指向同一对象的派生引用（由 Store 维护）。
// - 业务代码禁止再直接写 AppState.project / AppState.fileMetadata，
//   一律经由本 Store（CI 静态检查 scripts/check-state-ownership.mjs 守护）。
// - translations 视图态字段（filtered / selected / multiSelected / currentPage /
//   searchQuery / itemsPerPage / selectedFile）的唯一 Owner 是
//   TranslationViewStore（core/translation-view-store.js）；本 Store 经其
//   意图式 API 写入，不直写。

const ProjectStore = {
  /**
   * 加载/切换一个完整项目（项目恢复、打开项目、加载示例等场景）。
   * 统一完成：写 project → 同步 translations 视图 → 写 fileMetadata → 水合 contentKey。
   * 术语库与 UI 刷新属于各自领域，仍由调用方在返回后处理。
   *
   * @param {Object|null} projectData - 项目数据（含 translationItems / fileMetadata 等）
   * @returns {Object|null} 写入后的 AppState.project
   */
  loadProject(projectData) {
    AppState.project = projectData || null;

    const items = (projectData && projectData.translationItems) || [];
    // canonical：project.translationItems；视图稳定引用 + 兼容别名经 TranslationViewStore 设置
    if (AppState.project) AppState.project.translationItems = items;
    TranslationViewStore.setViewItems(items);

    // fileMetadata：canonical 为 AppState.fileMetadata
    AppState.fileMetadata = (projectData && projectData.fileMetadata) || {};
    if (AppState.project) AppState.project.fileMetadata = AppState.fileMetadata;

    // 重置翻译视图状态（项目切换的原子组成部分，经 TranslationViewStore）
    TranslationViewStore.resetView();

    // 水合文件元数据的 contentKey（storage 层能力，运行期可用时调用）
    if (
      AppState.project &&
      typeof hydrateFileMetadataContentKeys === "function"
    ) {
      hydrateFileMetadataContentKeys(AppState.project.id);
    }

    return AppState.project;
  },

  /**
   * 创建并载入一个新项目（空项目/导入自动建项目）。
   *
   * @param {Object} config
   * @param {string} [config.id] - 项目 ID（缺省自动生成）
   * @param {string} [config.name] - 项目名称
   * @param {string} [config.sourceLanguage] - 源语言
   * @param {string} [config.targetLanguage] - 目标语言
   * @param {string} [config.fileFormat] - 文件格式
   * @param {Array} [config.translationItems] - 初始翻译条目
   * @param {Array} [config.terminologyList] - 初始术语库
   * @param {Object} [config.fileMetadata] - 初始文件元数据
   * @param {Object} [config.extra] - 其余透传字段（如 __isSampleProject）
   * @returns {Object} 创建并载入的项目对象
   */
  createProject(config) {
    const cfg = config || {};
    const now = new Date().toISOString();
    const project = Object.assign(
      {
        id: cfg.id || `project-${Date.now()}`,
        name: cfg.name || "未命名项目",
        sourceLanguage: cfg.sourceLanguage || "en",
        targetLanguage: cfg.targetLanguage || "zh",
        fileFormat: cfg.fileFormat || "mixed",
        translationItems: cfg.translationItems || [],
        terminologyList: cfg.terminologyList || [],
        fileMetadata: cfg.fileMetadata || {},
        createdAt: now,
        updatedAt: now,
      },
      cfg.extra || {}
    );
    return this.loadProject(project);
  },

  /**
   * 清空当前项目（删除项目、清除数据、示例切换等场景）。
   * 重置 project、fileMetadata 与 translations 视图。
   */
  clearProject() {
    AppState.project = null;
    AppState.fileMetadata = {};
    // 视图态全清空（含稳定引用与兼容别名），经 TranslationViewStore
    TranslationViewStore.clearView();
  },

  /**
   * 确保存在项目（无项目时以 fallbackId 兜底创建），返回项目 ID。
   * 供 storage 层生成文件内容键使用。
   *
   * @param {string} [fallbackId] - 兜底项目 ID
   * @returns {string} 项目 ID
   */
  ensureProject(fallbackId) {
    if (AppState.project && AppState.project.id) return AppState.project.id;
    const id = fallbackId || `project-${Date.now()}`;
    if (!AppState.project) AppState.project = { id };
    AppState.project.id = AppState.project.id || id;
    return AppState.project.id;
  },

  /**
   * 写入单个文件的元数据（解析、文件树、源文件编辑器等场景）。
   * 同时维护 AppState.project.fileMetadata 派生引用。
   *
   * @param {string} fileName - 文件名
   * @param {Object} meta - 元数据对象
   * @returns {Object} 写入后的元数据对象
   */
  setFileMetadata(fileName, meta) {
    if (!AppState.fileMetadata) AppState.fileMetadata = {};
    AppState.fileMetadata[fileName] = meta;
    if (AppState.project) {
      if (!AppState.project.fileMetadata) {
        AppState.project.fileMetadata = AppState.fileMetadata;
      } else {
        AppState.project.fileMetadata[fileName] = meta;
      }
    }
    return meta;
  },

  /**
   * 整体重置文件元数据映射。
   *
   * @param {Object} map - 新的元数据映射
   */
  resetFileMetadata(map) {
    AppState.fileMetadata = map || {};
    if (AppState.project) AppState.project.fileMetadata = AppState.fileMetadata;
  },

  /**
   * 确保 fileMetadata 映射已初始化（供读取路径前置守卫），返回该映射。
   * 同时对齐 project.fileMetadata 派生引用。
   *
   * @returns {Object} AppState.fileMetadata
   */
  ensureFileMetadata() {
    if (!AppState.fileMetadata) AppState.fileMetadata = {};
    if (AppState.project) AppState.project.fileMetadata = AppState.fileMetadata;
    return AppState.fileMetadata;
  },

  /**
   * 局部更新单个文件元数据的字段（如仅更新 size），合并到现有 meta。
   * meta 不存在时创建。同时维护 project.fileMetadata 派生引用。
   *
   * @param {string} fileName - 文件名
   * @param {Object} patch - 要合并的字段
   * @returns {Object} 更新后的元数据对象
   */
  patchFileMetadata(fileName, patch) {
    if (!AppState.fileMetadata) AppState.fileMetadata = {};
    const meta = AppState.fileMetadata[fileName] || {};
    Object.assign(meta, patch || {});
    return this.setFileMetadata(fileName, meta);
  },

  /**
   * 删除单个文件的元数据（文件树删除文件、清理占位文件等场景）。
   * 同时维护 project.fileMetadata 派生引用。
   *
   * @param {string} fileName - 文件名
   */
  removeFileMetadata(fileName) {
    if (AppState.fileMetadata && AppState.fileMetadata[fileName]) {
      delete AppState.fileMetadata[fileName];
    }
    if (AppState.project?.fileMetadata && AppState.project.fileMetadata[fileName]) {
      delete AppState.project.fileMetadata[fileName];
    }
  },

  /**
   * 读取 canonical 翻译条目（持久化/导出/导入合并等场景）。
   * 注意：质量检查 swapTranslationItems 窗口期间返回临时换入的数组；
   * 渲染/交互场景应读 TranslationViewStore.getViewItems()（swap 期间仍为全量）。
   *
   * @returns {Array} AppState.project.translationItems（无项目时空数组）
   */
  getTranslationItems() {
    return (AppState.project && AppState.project.translationItems) || [];
  },

  /**
   * 整体替换翻译条目（导入合并、质量检查临时替换/恢复等场景）。
   * canonical 写入 project.translationItems，视图稳定引用经
   * TranslationViewStore.setViewItems 同步。
   *
   * @param {Array} items - 新的完整条目数组
   * @returns {Array} 写入后的条目数组
   */
  setTranslationItems(items) {
    const list = items || [];
    if (AppState.project) AppState.project.translationItems = list;
    TranslationViewStore.setViewItems(list);
    return list;
  },

  /**
   * 临时换出 canonical 条目数组（质量检查按文件范围限定检查的场景）。
   * 仅替换 project.translationItems，不触碰视图稳定引用
   * （TranslationViewStore.getViewItems 仍指向全量列表，渲染与持久化不受
   * 影响——显式设计，见 translation-view-store.js 头部说明）；
   * 调用方结束后必须用本方法传回原数组恢复。
   *
   * @param {Array} items - 临时使用的条目数组
   * @returns {Array|null} 原条目数组（供恢复）
   */
  swapTranslationItems(items) {
    const prev = AppState.project ? AppState.project.translationItems : null;
    if (AppState.project) AppState.project.translationItems = items || [];
    return prev;
  },

  /**
   * 将 translations 视图重置为初始分页状态（导入合并后等场景）。
   * 经 TranslationViewStore.resetView 完成。
   */
  resetTranslationView() {
    TranslationViewStore.resetView();
  },

  /**
   * 标记项目更新时间（保存/编辑后调用）。
   */
  touchProject() {
    if (AppState.project) AppState.project.updatedAt = new Date().toISOString();
  },

  /**
   * 重命名项目（项目管理器重命名场景）。
   * 仅当目标 id 命中当前加载的项目时才写入 name（持久化由调用方经
   * storageManager 完成，本方法只负责内存态同步）。
   *
   * @param {string} projectId - 目标项目 ID
   * @param {string} name - 新名称
   * @returns {boolean} 是否命中并更新了当前项目
   */
  renameProject(projectId, name) {
    if (AppState.project && AppState.project.id === projectId) {
      AppState.project.name = name;
      return true;
    }
    return false;
  },

  /**
   * 同步术语库到当前项目（术语增删改、导入、保存前快照等场景）。
   * 无项目时不写入（术语库自身状态由 terminology 切片维护，不受影响）。
   *
   * @param {Array} list - 术语列表
   * @returns {Array|null} 写入后的 project.terminologyList；无项目时返回 null
   */
  setTerminologyList(list) {
    if (!AppState.project) return null;
    AppState.project.terminologyList = list || [];
    return AppState.project.terminologyList;
  },

  /**
   * 替换指定文件的翻译条目（源文件编辑器重解析后合并）。
   * 移除该文件旧条目并追加新条目；视图稳定引用 + 兼容别名与过滤视图
   * 经 TranslationViewStore 同步。
   *
   * @param {string} fileName - 文件名
   * @param {Array} newItems - 该文件的新翻译条目
   * @returns {Array} 合并后的完整条目数组
   */
  replaceFileItems(fileName, newItems) {
    if (!AppState.project) throw new Error("当前没有打开的项目");
    const kept = (AppState.project.translationItems || []).filter(
      (it) => !(it && it.metadata && it.metadata.file === fileName)
    );
    const merged = kept.concat(newItems || []);
    AppState.project.translationItems = merged;
    TranslationViewStore.setViewItems(merged);
    TranslationViewStore.setFilter([...merged]);
    return merged;
  },
};

// 暴露到全局（供各模块与单元测试直达）
if (typeof window !== "undefined") {
  window.ProjectStore = ProjectStore;
}

// ==================== 开发模式写审计 ====================
// 仅在开发模式生效：复用 dev-tools.js 的 installSliceOwnershipAudit，
// 将 AppState.project / AppState.fileMetadata 重定义为 accessor，
// 任何未经 ProjectStore 的顶层赋值都会打印带调用栈的告警，用于暴露绕过所有权边界
// 的越权写入。生产环境不安装，零开销、零行为影响。
if (typeof installSliceOwnershipAudit === "function") {
  installSliceOwnershipAudit("ProjectStore", ProjectStore, [
    "project",
    "fileMetadata",
  ]);
}
