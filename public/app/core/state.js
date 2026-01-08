// ==================== 全局状态管理 ====================
// 使用单例模式，避免全局变量污染
const AppState = {
  project: null,
  translations: {
    items: [],
    filtered: [],
    selected: -1,
    multiSelected: [],
    currentPage: 1,
    itemsPerPage: 20,
    searchQuery: "",
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
  },
  terminology: {
    list: [
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
    ],
    filtered: [
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
    ],
    currentPage: 1,
    perPage: 10,
  },
  fileMetadata: {},
  // 质量检查结果（唯一数据源：由 features/quality/run.js 写入，charts/export/ui 读取）
  qualityCheckResults: {
    overallScore: 0,
    translatedCount: 0,
    totalCount: 0,
    issues: [],
    termMatches: 0,
    lastCheckTime: null,
  },
};

// 兼容旧代码中直接使用全局名 qualityCheckResults 的引用（指向 AppState.qualityCheckResults）
if (typeof window !== "undefined") {
  window.qualityCheckResults = AppState.qualityCheckResults;
}

// ==================== 向后兼容层（已废弃） ====================
// 警告：以下全局变量已完全移除，请直接使用 AppState
// 例如：
//   ✗ currentProject.name  (错误)
//   ✓ AppState.project.name  (正确)
//
// 如果您看到这个错误：currentProject is not defined
// 请替换为：AppState.project
