// ==================== 核心类型定义 ====================
/**
 * 项目核心类型定义系统
 * 提供TypeScript风格的JSDoc类型注解和运行时类型检查
 */

/**
 * @typedef {Object} ProjectConfig
 * @property {string} name - 项目名称
 * @property {string} version - 项目版本
 * @property {string} description - 项目描述
 * @property {Object} settings - 项目设置
 * @property {string} created - 创建时间
 * @property {string} modified - 修改时间
 */

/**
 * @typedef {Object} TranslationItem
 * @property {string} id - 唯一标识符
 * @property {string} sourceText - 源文本
 * @property {string} targetText - 目标文本
 * @property {string} fileName - 文件名
 * @property {number} lineNumber - 行号
 * @property {string} status - 状态：'pending'|'translating'|'completed'|'error'
 * @property {Object} metadata - 元数据
 * @property {Date} created - 创建时间
 * @property {Date} modified - 修改时间
 */

/**
 * @typedef {Object} TranslationResult
 * @property {boolean} success - 是否成功
 * @property {string} translatedText - 翻译结果
 * @property {string} [error] - 错误信息
 * @property {Object} [metadata] - 元数据
 * @property {number} confidence - 置信度 0-1
 * @property {string} engine - 翻译引擎
 * @property {number} cost - 成本
 */

/**
 * @typedef {Object} ServiceConfig
 * @property {string} name - 服务名称
 * @property {Function|Object} implementation - 服务实现
 * @property {boolean} singleton - 是否单例
 * @property {boolean} factory - 是否为工厂模式
 * @property {Array<string|DependencyConfig>} dependencies - 依赖服务列表
 * @property {boolean} lazy - 是否延迟初始化
 * @property {Array<string>} tags - 服务标签
 * @property {string} registered - 注册时间
 */

/**
 * @typedef {Object} ServiceRegistrationOptions
 * @property {boolean} [singleton=true] - 是否单例
 * @property {boolean} [factory=false] - 是否为工厂模式
 * @property {Array<string|DependencyConfig>} [dependencies=[]] - 依赖服务列表
 * @property {boolean} [lazy=false] - 是否延迟初始化
 * @property {Array<string>} [tags=[]] - 服务标签
 */

/**
 * @typedef {Object} DependencyConfig
 * @property {string} name - 依赖服务名称
 * @property {string} [alias] - 别名
 * @property {boolean} [optional=false] - 是否可选
 */

/**
 * @typedef {Object} ServiceResolutionContext
 * @property {Object} [parameters] - 额外参数
 * @property {string} [scope] - 解析作用域
 * @property {Object} [metadata] - 元数据
 */

/**
 * @typedef {Object} ErrorInfo
 * @property {string} type - 错误类型
 * @property {string} code - 错误代码
 * @property {string} message - 错误消息
 * @property {string} userMessage - 用户友好消息
 * @property {Object} context - 错误上下文
 * @property {string} stack - 错误堆栈
 * @property {Date} timestamp - 发生时间
 * @property {string} traceId - 追踪ID
 */

/**
 * @typedef {Object} PerformanceMetric
 * @property {string} name - 指标名称
 * @property {number} value - 指标值
 * @property {string} unit - 单位
 * @property {Date} timestamp - 时间戳
 * @property {Object} [tags] - 标签
 * @property {Object} [metadata] - 元数据
 */

/**
 * @typedef {Object} ValidationRule
 * @property {string} name - 规则名称
 * @property {string} type - 验证类型
 * @property {Function} validator - 验证函数
 * @property {string} message - 错误消息
 * @property {boolean} required - 是否必需
 * @property {Object} [options] - 验证选项
 */

/**
 * @typedef {Object} StorageOptions
 * @property {string} backend - 存储后端：'indexeddb'|'localstorage'|'memory'
 * @property {string} database - 数据库名称
 * @property {number} version - 版本号
 * @property {boolean} enableCompression - 启用压缩
 * @property {number} maxSize - 最大大小（字节）
 * @property {number} ttl - 生存时间（毫秒）
 */

/**
 * @typedef {Object} NetworkRequest
 * @property {string} url - 请求URL
 * @property {string} method - HTTP方法
 * @property {Object} [headers] - 请求头
 * @property {Object|string} [body] - 请求体
 * @property {number} timeout - 超时时间
 * @property {number} retries - 重试次数
 * @property {Object} [options] - 其他选项
 */

/**
 * @typedef {Object} UIState
 * @property {boolean} isLoading - 是否加载中
 * @property {string} currentTab - 当前标签页
 * @property {Array<string>} selectedItems - 选中项目
 * @property {Object} filters - 过滤器状态
 * @property {Object} sort - 排序状态
 * @property {Object} pagination - 分页状态
 */

/**
 * @typedef {Object} QualityReport
 * @property {string} id - 报告ID
 * @property {Date} timestamp - 生成时间
 * @property {Object} summary - 摘要信息
 * @property {Array<Object>} issues - 问题列表
 * @property {number} score - 质量分数
 * @property {Object} metrics - 质量指标
 * @property {Object} recommendations - 改进建议
 */

// ==================== 类型检查工具 ====================

/**
 * 运行时类型检查器
 */
class TypeChecker {
  /**
   * 检查值是否符合指定类型
   * @param {*} value - 要检查的值
   * @param {string} type - 期望类型
   * @param {string} [paramName] - 参数名（用于错误消息）
   * @returns {boolean} 是否符合类型
   */
  static checkType(value, type, paramName = 'value') {
    try {
      switch (type) {
        case 'string':
          return typeof value === 'string';
        case 'number':
          return typeof value === 'number' && !isNaN(value);
        case 'boolean':
          return typeof value === 'boolean';
        case 'object':
          return value !== null && typeof value === 'object' && !Array.isArray(value);
        case 'array':
          return Array.isArray(value);
        case 'function':
          return typeof value === 'function';
        case 'date':
          return value instanceof Date && !isNaN(value.getTime());
        case 'null':
          return value === null;
        case 'undefined':
          return value === undefined;
        default:
          // 检查复杂类型
          if (type.startsWith('Array<')) {
            const elementType = type.slice(6, -1);
            return Array.isArray(value) && value.every(item => 
              TypeChecker.checkType(item, elementType));
          }
          return true; // 未知类型默认通过
      }
    } catch (error) {
      console.warn(`类型检查失败 (${paramName}):`, error);
      return false;
    }
  }

  /**
   * 验证对象是否符合指定结构
   * @param {Object} obj - 要验证的对象
   * @param {Object} schema - 类型模式
   * @param {string} [objName] - 对象名称
   * @returns {boolean} 是否符合模式
   */
  static validateSchema(obj, schema, objName = 'object') {
    if (!obj || typeof obj !== 'object') {
      console.warn(`${objName} 不是有效对象`);
      return false;
    }

    for (const [key, expectedType] of Object.entries(schema)) {
      const value = obj[key];
      const isOptional = expectedType.endsWith('?');
      const type = isOptional ? expectedType.slice(0, -1) : expectedType;

      if (!isOptional && value === undefined) {
        console.warn(`${objName}.${key} 是必需的但缺失`);
        return false;
      }

      if (value !== undefined && !TypeChecker.checkType(value, type, `${objName}.${key}`)) {
        console.warn(`${objName}.${key} 类型错误，期望 ${type}，实际 ${typeof value}`);
        return false;
      }
    }

    return true;
  }

  /**
   * 创建类型安全的函数装饰器
   * @param {Object} paramTypes - 参数类型定义
   * @param {string} [returnType] - 返回值类型
   * @returns {Function} 装饰器函数
   */
  static typed(paramTypes, returnType) {
    return function(target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = function(...args) {
        // 检查参数类型
        const paramNames = Object.keys(paramTypes);
        for (let i = 0; i < paramNames.length; i++) {
          const paramName = paramNames[i];
          const expectedType = paramTypes[paramName];
          const actualValue = args[i];

          if (!TypeChecker.checkType(actualValue, expectedType, paramName)) {
            throw new TypeError(
              `参数 ${paramName} 类型错误：期望 ${expectedType}，实际 ${typeof actualValue}`
            );
          }
        }

        // 执行原始方法
        const result = originalMethod.apply(this, args);

        // 检查返回值类型
        if (returnType && !TypeChecker.checkType(result, returnType, 'return')) {
          console.warn(`返回值类型错误：期望 ${returnType}，实际 ${typeof result}`);
        }

        return result;
      };

      return descriptor;
    };
  }
}

/**
 * 类型断言工具
 */
class TypeAssert {
  /**
   * 断言值为指定类型，否则抛出错误
   * @param {*} value - 要检查的值
   * @param {string} type - 期望类型
   * @param {string} [message] - 自定义错误消息
   * @throws {TypeError} 类型不匹配时抛出错误
   */
  static assertType(value, type, message) {
    if (!TypeChecker.checkType(value, type)) {
      throw new TypeError(
        message || `类型断言失败：期望 ${type}，实际 ${typeof value}`
      );
    }
  }

  /**
   * 断言对象符合指定模式
   * @param {Object} obj - 要验证的对象
   * @param {Object} schema - 类型模式
   * @param {string} [message] - 自定义错误消息
   * @throws {TypeError} 模式不匹配时抛出错误
   */
  static assertSchema(obj, schema, message) {
    if (!TypeChecker.validateSchema(obj, schema)) {
      throw new TypeError(message || '对象模式断言失败');
    }
  }
}

// ==================== 预定义类型模式 ====================

/**
 * 翻译项目类型模式
 */
const TranslationItemSchema = {
  id: 'string',
  sourceText: 'string',
  targetText: 'string?',
  fileName: 'string',
  lineNumber: 'number',
  status: 'string',
  metadata: 'object?',
  created: 'date?',
  modified: 'date?'
};

/**
 * 服务配置类型模式
 */
const ServiceConfigSchema = {
  name: 'string',
  type: 'string',
  factory: 'function',
  dependencies: 'Array<string>?',
  lazy: 'boolean?',
  config: 'object?'
};

/**
 * 错误信息类型模式
 */
const ErrorInfoSchema = {
  type: 'string',
  code: 'string',
  message: 'string',
  userMessage: 'string?',
  context: 'object?',
  stack: 'string?',
  timestamp: 'date',
  traceId: 'string?'
};

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TypeChecker,
    TypeAssert,
    TranslationItemSchema,
    ServiceConfigSchema,
    ErrorInfoSchema
  };
} else {
  // 浏览器环境，暴露到全局
  window.TypeChecker = TypeChecker;
  window.TypeAssert = TypeAssert;
  window.TranslationItemSchema = TranslationItemSchema;
  window.ServiceConfigSchema = ServiceConfigSchema;
  window.ErrorInfoSchema = ErrorInfoSchema;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.types', 'TypeChecker', TypeChecker);
      namespaceManager.addToNamespace('App.types', 'TypeAssert', TypeAssert);
    } catch (error) {
      console.warn('类型系统命名空间注册失败:', error.message);
    }
  }
}

// 提示信息
console.log('💡 类型安全系统已加载，可使用 TypeChecker 和 TypeAssert 进行类型检查');
