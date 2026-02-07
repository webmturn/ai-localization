// ==================== 增强版翻译质量检查 ====================
/**
 * 增强版翻译质量检查器
 * 提供更全面的质量检查功能
 */

/**
 * 增强版质量检查器
 */
class EnhancedQualityChecker {
  constructor() {
    this.rules = new Map();
    this.customRules = [];
    this._registerDefaultRules();
  }
  
  /**
   * 注册默认规则
   * @private
   */
  _registerDefaultRules() {
    // 空译文检查
    this.registerRule('empty', {
      name: '空译文',
      severity: 'high',
      check: (item) => {
        if (!item.targetText?.trim() && item.sourceText?.trim()) {
          return { passed: false, message: '该项尚未翻译' };
        }
        return { passed: true };
      }
    });
    
    // 长度比例检查
    this.registerRule('length', {
      name: '长度异常',
      severity: 'medium',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        const sourceLen = item.sourceText.length;
        const targetLen = item.targetText.length;
        const ratio = sourceLen > 0 ? targetLen / sourceLen : 0;
        
        if (ratio < 0.3 || ratio > 3) {
          return {
            passed: false,
            message: `译文长度比例异常（${ratio.toFixed(2)}x）`,
            severity: ratio < 0.2 || ratio > 4 ? 'high' : 'medium'
          };
        }
        return { passed: true };
      }
    });
    
    // 占位符检查
    this.registerRule('placeholder', {
      name: '占位符缺失',
      severity: 'high',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        // 检测各种占位符格式
        const patterns = [
          /\{[^}]+\}/g,      // {name}
          /%[sdif@]/g,       // %s, %d, %i, %f, %@
          /%\d+\$[sdif@]/g,  // %1$s
          /\$\{[^}]+\}/g,    // ${name}
          /\[\[[^\]]+\]\]/g, // [[name]]
          /<<[^>]+>>/g       // <<name>>
        ];
        
        const missing = [];
        for (const pattern of patterns) {
          const sourceMatches = item.sourceText.match(pattern) || [];
          const targetMatches = item.targetText.match(pattern) || [];
          
          for (const match of sourceMatches) {
            if (!targetMatches.includes(match)) {
              missing.push(match);
            }
          }
        }
        
        if (missing.length > 0) {
          return {
            passed: false,
            message: `缺少占位符: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '...' : ''}`
          };
        }
        return { passed: true };
      }
    });
    
    // 数字检查
    this.registerRule('number', {
      name: '数字不一致',
      severity: 'medium',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        const sourceNumbers = item.sourceText.match(/\d+(?:\.\d+)?/g) || [];
        const targetNumbers = item.targetText.match(/\d+(?:\.\d+)?/g) || [];
        
        const missingNumbers = sourceNumbers.filter(n => !targetNumbers.includes(n));
        
        if (missingNumbers.length > 0) {
          return {
            passed: false,
            message: `缺少数字: ${missingNumbers.slice(0, 3).join(', ')}`
          };
        }
        return { passed: true };
      }
    });
    
    // 标点符号检查
    this.registerRule('punctuation', {
      name: '标点符号异常',
      severity: 'low',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        // 检查结尾标点
        const sourceEnd = item.sourceText.trim().slice(-1);
        const targetEnd = item.targetText.trim().slice(-1);
        
        const punctuation = '.!?。！？';
        const sourceHasPunct = punctuation.includes(sourceEnd);
        const targetHasPunct = punctuation.includes(targetEnd);
        
        if (sourceHasPunct && !targetHasPunct) {
          return {
            passed: false,
            message: `译文缺少结尾标点（源文本以 "${sourceEnd}" 结尾）`
          };
        }
        return { passed: true };
      }
    });
    
    // 重复词检查
    this.registerRule('repetition', {
      name: '重复词',
      severity: 'low',
      check: (item) => {
        if (!item.targetText) return { passed: true };
        
        const words = item.targetText.split(/\s+/);
        const repeated = [];
        
        for (let i = 0; i < words.length - 1; i++) {
          if (words[i] === words[i + 1] && words[i].length > 2) {
            repeated.push(words[i]);
          }
        }
        
        if (repeated.length > 0) {
          return {
            passed: false,
            message: `存在重复词: ${[...new Set(repeated)].join(', ')}`
          };
        }
        return { passed: true };
      }
    });
    
    // HTML标签检查
    this.registerRule('html', {
      name: 'HTML标签不匹配',
      severity: 'high',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        const tagPattern = /<\/?[a-z][a-z0-9]*[^>]*>/gi;
        const sourceTags = (item.sourceText.match(tagPattern) || []).sort();
        const targetTags = (item.targetText.match(tagPattern) || []).sort();
        
        if (JSON.stringify(sourceTags) !== JSON.stringify(targetTags)) {
          return {
            passed: false,
            message: 'HTML标签不匹配'
          };
        }
        return { passed: true };
      }
    });
    
    // 未翻译文本检查
    this.registerRule('untranslated', {
      name: '未翻译',
      severity: 'medium',
      check: (item) => {
        if (!item.sourceText || !item.targetText) return { passed: true };
        
        // 如果源文本和目标文本完全相同（且不是纯数字/符号）
        if (item.sourceText === item.targetText) {
          const hasLetters = /[a-zA-Z\u4e00-\u9fff]/.test(item.sourceText);
          if (hasLetters && item.sourceText.length > 3) {
            return {
              passed: false,
              message: '译文与源文本相同，可能未翻译'
            };
          }
        }
        return { passed: true };
      }
    });
  }
  
  /**
   * 注册自定义规则
   * @param {string} id - 规则ID
   * @param {Object} rule - 规则配置
   */
  registerRule(id, rule) {
    this.rules.set(id, {
      id,
      name: rule.name || id,
      severity: rule.severity || 'medium',
      check: rule.check,
      enabled: rule.enabled !== false
    });
  }
  
  /**
   * 启用/禁用规则
   * @param {string} id - 规则ID
   * @param {boolean} enabled - 是否启用
   */
  setRuleEnabled(id, enabled) {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
    }
  }
  
  /**
   * 检查单个翻译项
   * @param {Object} item - 翻译项
   * @param {Object} options - 检查选项
   * @returns {Object} 检查结果
   */
  checkItem(item, options = {}) {
    const issues = [];
    const enabledRules = options.rules || Array.from(this.rules.keys());
    
    for (const ruleId of enabledRules) {
      const rule = this.rules.get(ruleId);
      if (!rule || !rule.enabled) continue;
      
      try {
        const result = rule.check(item);
        if (!result.passed) {
          issues.push({
            itemId: item.id,
            sourceText: item.sourceText,
            targetText: item.targetText,
            type: ruleId,
            typeName: rule.name,
            severity: result.severity || rule.severity,
            description: result.message || rule.name
          });
        }
      } catch (error) {
        (loggers.app || console).warn(`规则 ${ruleId} 检查失败:`, error);
      }
    }
    
    return {
      isTranslated: !!item.targetText?.trim(),
      issues,
      score: this._calculateScore(issues)
    };
  }
  
  /**
   * 批量检查翻译项
   * @param {Array} items - 翻译项数组
   * @param {Object} options - 检查选项
   * @returns {Object} 检查结果
   */
  checkItems(items, options = {}) {
    const results = [];
    const allIssues = [];
    let translated = 0;
    let totalScore = 0;
    
    for (const item of items) {
      const result = this.checkItem(item, options);
      results.push(result);
      allIssues.push(...result.issues);
      
      if (result.isTranslated) {
        translated++;
        totalScore += result.score;
      }
    }
    
    // 按严重程度分组
    const issuesBySeverity = {
      high: allIssues.filter(i => i.severity === 'high'),
      medium: allIssues.filter(i => i.severity === 'medium'),
      low: allIssues.filter(i => i.severity === 'low')
    };
    
    // 按类型分组
    const issuesByType = {};
    for (const issue of allIssues) {
      if (!issuesByType[issue.type]) {
        issuesByType[issue.type] = [];
      }
      issuesByType[issue.type].push(issue);
    }
    
    return {
      total: items.length,
      translated,
      pending: items.length - translated,
      progress: items.length > 0 ? Math.round((translated / items.length) * 100) : 0,
      averageScore: translated > 0 ? Math.round(totalScore / translated) : 0,
      issues: allIssues,
      issuesBySeverity,
      issuesByType,
      results
    };
  }
  
  /**
   * 计算质量分数
   * @private
   */
  _calculateScore(issues) {
    let score = 100;
    
    for (const issue of issues) {
      switch (issue.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }
    
    return Math.max(0, score);
  }
  
  /**
   * 获取所有规则
   * @returns {Array} 规则列表
   */
  getRules() {
    return Array.from(this.rules.values());
  }
  
  /**
   * 生成质量报告
   * @param {Object} checkResult - 检查结果
   * @returns {string} 报告文本
   */
  generateReport(checkResult) {
    const lines = [
      '# 翻译质量报告',
      '',
      `**总数**: ${checkResult.total}`,
      `**已翻译**: ${checkResult.translated} (${checkResult.progress}%)`,
      `**待翻译**: ${checkResult.pending}`,
      `**平均分数**: ${checkResult.averageScore}`,
      '',
      '## 问题统计',
      '',
      `- 高严重性: ${checkResult.issuesBySeverity.high.length}`,
      `- 中严重性: ${checkResult.issuesBySeverity.medium.length}`,
      `- 低严重性: ${checkResult.issuesBySeverity.low.length}`,
      ''
    ];
    
    if (Object.keys(checkResult.issuesByType).length > 0) {
      lines.push('## 问题类型分布', '');
      for (const [type, issues] of Object.entries(checkResult.issuesByType)) {
        lines.push(`- ${type}: ${issues.length}`);
      }
    }
    
    return lines.join('\n');
  }
}

// 创建全局实例
const enhancedQualityChecker = new EnhancedQualityChecker();

// 暴露到全局
window.EnhancedQualityChecker = EnhancedQualityChecker;
window.enhancedQualityChecker = enhancedQualityChecker;
