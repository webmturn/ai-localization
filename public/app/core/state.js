// ==================== 全局状态管理 ====================
// 使用单例模式，避免全局变量污染

/**
 * @typedef {Object} TranslationItem
 * @property {string} sourceText - 源文本
 * @property {string} targetText - 目标文本
 * @property {string} status - 状态 ('pending' | 'translated' | 'edited' | 'error')
 * @property {number} qualityScore - 质量分数 (0-100)
 * @property {string} [context] - 上下文信息
 * @property {Object} [metadata] - 元数据
 * @property {string} [metadata.file] - 文件名
 * @property {string} [metadata.resourceId] - 资源ID
 */

/**
 * @typedef {Object} Project
 * @property {string} id - 项目ID
 * @property {string} name - 项目名称
 * @property {string} sourceLanguage - 源语言代码
 * @property {string} targetLanguage - 目标语言代码
 * @property {TranslationItem[]} translationItems - 翻译项列表
 * @property {string} createdAt - 创建时间 (ISO)
 * @property {string} updatedAt - 更新时间 (ISO)
 */

/**
 * @typedef {Object} TerminologyEntry
 * @property {number} id - 术语ID
 * @property {string} source - 源术语
 * @property {string} target - 目标术语
 * @property {string} [partOfSpeech] - 词性
 * @property {string} [definition] - 定义
 */

/**
 * @typedef {Object} QualityCheckResults
 * @property {number} overallScore - 总体分数
 * @property {number} translatedCount - 已翻译数量
 * @property {number} totalCount - 总数量
 * @property {Array} issues - 问题列表
 * @property {number} termMatches - 术语匹配数
 * @property {string|null} lastCheckTime - 最后检查时间
 * @property {"project"|"file"|null} scope - 最近一次检查范围
 * @property {string|null} fileName - 最近一次检查的文件名（scope 为 file 时）
 */

// 默认术语库数据（定义一次，避免 list/filtered 重复硬编码导致不一致）
const __defaultTerminologyList = [
  {
    id: 1,
    source: "API",
    target: "应用程序接口",
    partOfSpeech: "noun",
    definition: "应用程序编程接口",
  },
  {
    id: 2,
    source: "XML",
    target: "可扩展标记语言",
    partOfSpeech: "noun",
    definition: "用于存储和传输数据的标记语言",
  },
  {
    id: 3,
    source: "localization",
    target: "本地化",
    partOfSpeech: "noun",
    definition: "使产品适应特定地区或市场的过程",
  },
];

/**
 * 全局应用状态对象
 * @type {Object}
 * @property {Project|null} project - 当前项目
 * @property {Object} translations - 翻译状态
 * @property {Object} ui - UI状态
 * @property {Object} terminology - 术语库状态
 * @property {Object} fileMetadata - 文件元数据
 * @property {QualityCheckResults} qualityCheckResults - 质量检查结果
 * @property {Object} quality - 质量检查运行参数（检查范围/并发度）
 */
const AppState = {
  /** @type {Project|null} */
  project: null,
  // 翻译视图态（视图条目引用由 TranslationViewStore._viewItems 承载，
  // 阶段 3b 已删除 items 兼容别名——渲染/持久化一律经 TranslationViewStore.getViewItems()）
  translations: {
    filtered: [],
    selected: -1,
    multiSelected: [],
    currentPage: 1,
    itemsPerPage: 20,
    searchQuery: "",
    // 当前选中的文件（文件树过滤视图；null = 全项目）
    selectedFile: null,
    isInProgress: false,
    isPaused: false,
    progress: {
      current: 0,
      total: 0,
      status: "",
    },
    lastFailedItems: [],
    lastBatchContext: null,
  },
  ui: {
    sourceSelectionIndicatorEnabled: true,
    sourceSelectionIndicatorUnselectedStyle: "gray",
    // 翻译进行时自动滚动到当前条目（设置页可改）
    autoScrollEnabled: true,
  },
  terminology: {
    list: __defaultTerminologyList,
    filtered: [...__defaultTerminologyList],
    currentPage: 1,
    perPage: 10,
  },
  fileMetadata: {},
  // 质量检查运行参数（检查范围 / 并发度）。
  // 由 ui/settings.js 的 applySettings 写入，features/quality/run.js 读取。
  quality: {
    checkScope: "project",
    checkConcurrency: 8,
  },
  // 质量检查结果（唯一数据源：由 quality feature 写入——
  // run.js 负责初始化与逐批累计，scoring.js 负责计算 overallScore；
  // charts/export/ui 只读）
  qualityCheckResults: {
    overallScore: 0,
    translatedCount: 0,
    totalCount: 0,
    issues: [],
    termMatches: 0,
    lastCheckTime: null,
    scope: null,
    fileName: null,
  },
};

// 兼容旧代码和架构系统对全局状态的访问
if (typeof window !== "undefined") {
  // 确保架构验证和DI可以通过 window.AppState 访问到状态单例
  if (!window.AppState) {
    window.AppState = AppState;
  }
}

// ==================== 向后兼容层（已废弃） ====================
// 警告：以下全局变量已完全移除，请直接使用 AppState
// 例如：
//   ✗ currentProject.name  (错误)
//   ✓ AppState.project.name  (正确)
//
// 如果您看到这个错误：currentProject is not defined
// 请替换为：AppState.project
