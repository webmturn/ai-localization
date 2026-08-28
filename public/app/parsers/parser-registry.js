// ==================== 格式解析器注册表 ====================
// 管理所有文件格式解析器的注册、查找与 XML 结构探测（对标 EngineRegistry 的注册表模式）。
// 约定：
// - 每个解析器文件在末尾自注册（带 typeof 守卫，兼容单文件加载与单元测试）
// - detectXml 按注册顺序探测；注册顺序 = app.js parserScripts 加载顺序
//   （android → xliff → ts → resx，与历史 parse.js detectXmlFormat 判定优先级一致）
// - 新增格式 = 新增 parser 文件（末尾自注册）+ app.js parserScripts 加一行，parse.js 零改动
const ParserRegistry = {
  /** @type {Array<Object>} 解析器配置数组 */
  _parsers: [],

  /**
   * 注册解析器
   * @param {Object} config
   * @param {string} config.id - 格式标识（如 'xliff'），用于扩展名提示日志（大写形式）
   * @param {string} config.label - 展示名（如 'XLIFF'），用于结构识别/回退提示日志
   * @param {string[]} [config.extensions] - 认领的扩展名（小写、不含点）
   * @param {Function} [config.detectXml] - (doc) => boolean，XML 结构识别；XML 系格式必填
   * @param {Function} [config.validateSchema] - (doc) => {ok: boolean, reason?: string}
   * @param {Function} config.parse - (content, fileName) => items | Promise<items>
   */
  register(config) {
    if (!config || !config.id || typeof config.parse !== "function") {
      ((typeof loggers !== "undefined" && loggers.app) || console).warn(
        "ParserRegistry.register: 配置缺少 id 或 parse 函数",
        config
      );
      return;
    }
    if (!Array.isArray(config.extensions)) config.extensions = [];
    this._parsers.push(config);
  },

  /** 按 id 查找解析器配置 */
  getById(id) {
    return this._parsers.find((p) => p.id === id) || null;
  },

  /** 按扩展名精确命中（小写、不含点） */
  getByExtension(ext) {
    return this._parsers.find((p) => p.extensions.indexOf(ext) !== -1) || null;
  },

  /** XML 结构探测：按注册顺序返回首个 detectXml 命中的解析器 */
  detectXml(doc) {
    for (let i = 0; i < this._parsers.length; i++) {
      const p = this._parsers[i];
      if (typeof p.detectXml === "function" && p.detectXml(doc)) return p;
    }
    return null;
  },

  /**
   * 声明了结构探测的解析器所认领的全部扩展名（去重）。
   * parse.js 据此派生"XML 系扩展名"集合：这些扩展名优先走结构探测而非扩展名直配。
   */
  getDetectableExtensions() {
    const exts = [];
    for (let i = 0; i < this._parsers.length; i++) {
      const p = this._parsers[i];
      if (typeof p.detectXml === "function") exts.push(...p.extensions);
    }
    return Array.from(new Set(exts));
  },

  /** 调试：已注册的格式 id 列表 */
  list() {
    return this._parsers.map((p) => p.id);
  },
};

// —— XML 文档判定助手（供各 XML 解析器的 detectXml/validateSchema 使用，
//    判定逻辑与原 parse.js 内联实现逐字对应）——

/** 根元素名（小写） */
ParserRegistry.rootName = function (doc) {
  const root = doc && doc.documentElement;
  return ((root && (root.localName || root.nodeName)) || "").toLowerCase();
};

/** 根命名空间 URI（小写） */
ParserRegistry.rootNamespace = function (doc) {
  const root = doc && doc.documentElement;
  return ((root && root.namespaceURI) || "").toLowerCase();
};

/** 是否存在指定标签（含大写变体兜底，与原实现一致） */
ParserRegistry.hasTag = function (doc, tagName) {
  return (
    doc.getElementsByTagName(tagName).length > 0 ||
    doc.getElementsByTagName(tagName.toUpperCase()).length > 0
  );
};

/** 任一标签存在即命中 */
ParserRegistry.hasAnyTag = function (doc, ...tags) {
  return tags.some((tag) => ParserRegistry.hasTag(doc, tag));
};

// 暴露到全局（调试/测试可直达）
window.ParserRegistry = ParserRegistry;
