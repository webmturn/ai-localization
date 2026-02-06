// ==================== 运行时类型检查器 ====================
/**
 * 运行时类型检查和验证系统
 * 提供强类型检查、参数验证和类型断言功能
 */

/**
 * 运行时类型验证器
 * @class
 */
class RuntimeTypeChecker {
  constructor() {
    /** @type {Map<string, Function>} */
    this.customValidators = new Map();
    /** @type {boolean} */
    this.strictMode = false;
    /** @type {boolean} */
    this.enabled = true;
    /** @type {Array<string>} */
    this.warnings = [];
  }

  /**
   * 启用/禁用类型检查
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.enabled) {
      console.log('🔍 运行时类型检查已启用');
    } else {
      console.log('🔍 运行时类型检查已禁用');
    }
  }

  /**
   * 设置严格模式
   * @param {boolean} strict - 是否启用严格模式
   */
  setStrictMode(strict) {
    this.strictMode = strict;
    console.log(`🔍 类型检查${strict ? '严格' : '宽松'}模式`);
  }

  /**
   * 添加自定义验证器
   * @param {string} typeName - 类型名称
   * @param {Function} validator - 验证函数
   */
  addValidator(typeName, validator) {
    this.customValidators.set(typeName, validator);
  }

  /**
   * 检查值是否符合类型
   * @param {*} value - 要检查的值
   * @param {string} expectedType - 期望类型
   * @param {string} [context=''] - 上下文信息
   * @returns {TypeCheckResult} 检查结果
   */
  checkType(value, expectedType, context = '') {
    if (!this.enabled) {
      return { valid: true, message: '类型检查已禁用' };
    }

    try {
      const result = this._performTypeCheck(value, expectedType);
      
      if (!result.valid) {
        const message = `类型检查失败${context ? ` (${context})` : ''}: 期望 ${expectedType}, 实际 ${this._getActualType(value)}`;
        result.message = message;
        
        if (this.strictMode) {
          throw new TypeError(message);
        } else {
          console.warn(message);
          this.warnings.push(message);
        }
      }
      
      return result;
    } catch (error) {
      const message = `类型检查异常${context ? ` (${context})` : ''}: ${error.message}`;
      
      if (this.strictMode) {
        throw error;
      } else {
        console.error(message);
        return { valid: false, message };
      }
    }
  }

  /**
   * 执行具体的类型检查
   * @private
   * @param {*} value - 值
   * @param {string} expectedType - 期望类型
   * @returns {TypeCheckResult} 检查结果
   */
  _performTypeCheck(value, expectedType) {
    // 处理联合类型
    if (expectedType.includes('|')) {
      const types = expectedType.split('|').map(t => t.trim());
      for (const type of types) {
        const result = this._performTypeCheck(value, type);
        if (result.valid) {
          return result;
        }
      }
      return { valid: false };
    }

    // 处理可选类型
    if (expectedType.endsWith('?')) {
      if (value === undefined || value === null) {
        return { valid: true };
      }
      return this._performTypeCheck(value, expectedType.slice(0, -1));
    }

    // 处理数组类型
    if (expectedType.startsWith('Array<') && expectedType.endsWith('>')) {
      if (!Array.isArray(value)) {
        return { valid: false };
      }
      
      const elementType = expectedType.slice(6, -1);
      for (let i = 0; i < value.length; i++) {
        const elementResult = this._performTypeCheck(value[i], elementType);
        if (!elementResult.valid) {
          return { valid: false, message: `数组元素[${i}]类型错误` };
        }
      }
      return { valid: true };
    }

    // 处理泛型类型
    if (expectedType.includes('<')) {
      const baseType = expectedType.split('<')[0];
      return this._performTypeCheck(value, baseType);
    }

    // 自定义验证器
    if (this.customValidators.has(expectedType)) {
      const validator = this.customValidators.get(expectedType);
      return { valid: validator(value) };
    }

    // 基本类型检查
    return this._checkBasicType(value, expectedType);
  }

  /**
   * 检查基本类型
   * @private
   * @param {*} value - 值
   * @param {string} expectedType - 期望类型
   * @returns {TypeCheckResult} 检查结果
   */
  _checkBasicType(value, expectedType) {
    switch (expectedType.toLowerCase()) {
      case 'string':
        return { valid: typeof value === 'string' };
      case 'number':
        return { valid: typeof value === 'number' && !isNaN(value) };
      case 'boolean':
        return { valid: typeof value === 'boolean' };
      case 'object':
        return { valid: value !== null && typeof value === 'object' && !Array.isArray(value) };
      case 'array':
        return { valid: Array.isArray(value) };
      case 'function':
        return { valid: typeof value === 'function' };
      case 'date':
        return { valid: value instanceof Date && !isNaN(value.getTime()) };
      case 'null':
        return { valid: value === null };
      case 'undefined':
        return { valid: value === undefined };
      case 'any':
      case '*':
        return { valid: true };
      default:
        // 检查是否为构造函数类型
        if (typeof window[expectedType] === 'function') {
          return { valid: value instanceof window[expectedType] };
        }
        return { valid: true }; // 未知类型默认通过
    }
  }

  /**
   * 获取值的实际类型
   * @private
   * @param {*} value - 值
   * @returns {string} 类型字符串
   */
  _getActualType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  /**
   * 验证对象结构
   * @param {Object} obj - 要验证的对象
   * @param {Object} schema - 类型模式
   * @param {string} [context=''] - 上下文
   * @returns {SchemaValidationResult} 验证结果
   */
  validateSchema(obj, schema, context = '') {
    if (!this.enabled) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    if (!obj || typeof obj !== 'object') {
      const message = `${context || 'object'} 不是有效对象`;
      errors.push(message);
      
      if (this.strictMode) {
        throw new TypeError(message);
      }
      
      return { valid: false, errors };
    }

    // 检查必需字段
    for (const [key, expectedType] of Object.entries(schema)) {
      const isOptional = expectedType.endsWith('?');
      const type = isOptional ? expectedType.slice(0, -1) : expectedType;
      const value = obj[key];
      
      if (!isOptional && (value === undefined || value === null)) {
        const message = `${context}.${key} 是必需的但缺失`;
        errors.push(message);
        continue;
      }

      if (value !== undefined && value !== null) {
        const result = this.checkType(value, type, `${context}.${key}`);
        if (!result.valid) {
          errors.push(result.message);
        }
      }
    }

    const valid = errors.length === 0;
    
    if (!valid && this.strictMode) {
      throw new TypeError(`对象模式验证失败: ${errors.join(', ')}`);
    }

    return { valid, errors };
  }

  /**
   * 函数参数类型检查装饰器
   * @param {Object} paramTypes - 参数类型定义
   * @param {string} [returnType] - 返回值类型
   * @returns {Function} 装饰器函数
   */
  typed(paramTypes, returnType) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = function(...args) {
        if (runtimeTypeChecker.enabled) {
          // 检查参数类型
          const paramNames = Object.keys(paramTypes);
          for (let i = 0; i < paramNames.length; i++) {
            const paramName = paramNames[i];
            const expectedType = paramTypes[paramName];
            const actualValue = args[i];

            const result = runtimeTypeChecker.checkType(
              actualValue, 
              expectedType, 
              `${target.constructor.name}.${propertyKey}(${paramName})`
            );

            if (!result.valid) {
              if (runtimeTypeChecker.strictMode) {
                throw new TypeError(result.message);
              }
            }
          }
        }

        // 执行原始方法
        const result = originalMethod.apply(this, args);

        // 检查返回值类型
        if (runtimeTypeChecker.enabled && returnType) {
          const checkResult = runtimeTypeChecker.checkType(
            result, 
            returnType, 
            `${target.constructor.name}.${propertyKey} return`
          );

          if (!checkResult.valid && runtimeTypeChecker.strictMode) {
            throw new TypeError(checkResult.message);
          }
        }

        return result;
      };

      return descriptor;
    };
  }

  /**
   * 创建类型安全的函数
   * @param {Function} fn - 原始函数
   * @param {Object} paramTypes - 参数类型
   * @param {string} [returnType] - 返回值类型
   * @returns {Function} 类型安全的函数
   */
  createTypedFunction(fn, paramTypes, returnType) {
    return (...args) => {
      if (this.enabled) {
        const paramNames = Object.keys(paramTypes);
        for (let i = 0; i < paramNames.length; i++) {
          const paramName = paramNames[i];
          const expectedType = paramTypes[paramName];
          const actualValue = args[i];

          const result = this.checkType(actualValue, expectedType, `${fn.name}(${paramName})`);
          if (!result.valid && this.strictMode) {
            throw new TypeError(result.message);
          }
        }
      }

      const result = fn.apply(this, args);

      if (this.enabled && returnType) {
        const checkResult = this.checkType(result, returnType, `${fn.name} return`);
        if (!checkResult.valid && this.strictMode) {
          throw new TypeError(checkResult.message);
        }
      }

      return result;
    };
  }

  /**
   * 获取警告信息
   * @returns {Array<string>} 警告列表
   */
  getWarnings() {
    return [...this.warnings];
  }

  /**
   * 清除警告信息
   */
  clearWarnings() {
    this.warnings.length = 0;
  }

  /**
   * 获取统计信息
   * @returns {TypeCheckStats} 统计信息
   */
  getStats() {
    return {
      enabled: this.enabled,
      strictMode: this.strictMode,
      customValidators: this.customValidators.size,
      warningCount: this.warnings.length,
      lastWarnings: this.warnings.slice(-10) // 最近10个警告
    };
  }
}

// ==================== 类型定义 ====================

/**
 * @typedef {Object} TypeCheckResult
 * @property {boolean} valid - 是否有效
 * @property {string} [message] - 错误消息
 */

/**
 * @typedef {Object} SchemaValidationResult  
 * @property {boolean} valid - 是否有效
 * @property {Array<string>} errors - 错误列表
 */

/**
 * @typedef {Object} TypeCheckStats
 * @property {boolean} enabled - 是否启用
 * @property {boolean} strictMode - 是否严格模式
 * @property {number} customValidators - 自定义验证器数量
 * @property {number} warningCount - 警告数量
 * @property {Array<string>} lastWarnings - 最近警告
 */

// ==================== 全局实例 ====================
const runtimeTypeChecker = new RuntimeTypeChecker();

// 开发模式下启用
if (typeof isDevelopment !== 'undefined' && isDevelopment) {
  runtimeTypeChecker.setEnabled(true);
  runtimeTypeChecker.setStrictMode(false);
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RuntimeTypeChecker, runtimeTypeChecker };
} else {
  // 浏览器环境
  window.RuntimeTypeChecker = RuntimeTypeChecker;
  window.runtimeTypeChecker = runtimeTypeChecker;
  
  // 添加到命名空间
  if (typeof namespaceManager !== 'undefined') {
    try {
      namespaceManager.addToNamespace('App.types', 'RuntimeTypeChecker', RuntimeTypeChecker);
      namespaceManager.addToNamespace('App.types', 'runtimeTypeChecker', runtimeTypeChecker);
    } catch (error) {
      console.warn('运行时类型检查器命名空间注册失败:', error.message);
    }
  }
}

// 提示信息
console.log('🔍 运行时类型检查器已加载，可使用 runtimeTypeChecker 进行类型验证');
