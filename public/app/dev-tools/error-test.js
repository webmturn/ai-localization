// ==================== 错误处理系统测试函数（开发工具） ====================
// 从 core/error-test.js 移动至 dev-tools 目录，仅在开发环境使用

/**
 * 简单的测试函数，用于验证错误处理系统的修复效果
 */

/**
 * 测试所有修复的功能
 */
async function testErrorHandlingFixes() {
  console.log('🧪 开始测试错误处理系统修复...');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // 测试1: 错误恢复方法
  try {
    console.log('  测试错误恢复方法...');
    const error = errorManager.createError(ERROR_CODES.TIMEOUT, '测试超时');
    const handledError = errorManager.handleError(error, { 
      operation: 'test',
      retryFunction: () => Promise.resolve('success')
    });
    
    results.tests.push({ name: '错误恢复方法', status: 'passed' });
    results.passed++;
    console.log('  ✅ 错误恢复方法测试通过');
  } catch (error) {
    results.tests.push({ name: '错误恢复方法', status: 'failed', error });
    results.failed++;
    console.error('  ❌ 错误恢复方法测试失败:', error.message);
  }
  
  // 测试2: 文件验证（使用真实File对象）
  try {
    console.log('  测试文件验证修复...');
    
    if (typeof File !== 'undefined') {
      const testFile = new File(['test content'], 'test.json', {
        type: 'application/json'
      });
      
      const validationError = ErrorUtils.validateFile(testFile, {
        maxSize: 10 * 1024 * 1024,
        allowedExtensions: ['json']
      });
      
      if (!validationError) {
        results.tests.push({ name: '文件验证修复', status: 'passed' });
        results.passed++;
        console.log('  ✅ 文件验证修复测试通过');
      } else {
        throw new Error('文件验证应该通过但失败了');
      }
    } else {
      console.log('  ⚠️ 浏览器不支持File构造函数，跳过测试');
      results.tests.push({ name: '文件验证修复', status: 'skipped' });
    }
  } catch (error) {
    results.tests.push({ name: '文件验证修复', status: 'failed', error });
    results.failed++;
    console.error('  ❌ 文件验证修复测试失败:', error.message);
  }
  
  // 测试3: 批量文件处理参数验证
  try {
    console.log('  测试批量文件处理参数验证...');
    
    // 测试空参数
    try {
      await ErrorHandlingExamples.processBatchFiles(null);
      throw new Error('应该抛出参数验证错误');
    } catch (error) {
      if (error.code === ERROR_CODES.INVALID_INPUT) {
        results.tests.push({ name: '批量文件处理参数验证', status: 'passed' });
        results.passed++;
        console.log('  ✅ 批量文件处理参数验证测试通过');
      } else {
        throw error;
      }
    }
  } catch (error) {
    results.tests.push({ name: '批量文件处理参数验证', status: 'failed', error });
    results.failed++;
    console.error('  ❌ 批量文件处理参数验证测试失败:', error.message);
  }
  
  // 测试4: 错误统计功能
  try {
    console.log('  测试错误统计功能...');
    
    const stats = errorManager.getErrorStats();
    
    if (typeof stats === 'object' && 
        typeof stats.total === 'number' &&
        typeof stats.byCategory === 'object' &&
        typeof stats.bySeverity === 'object') {
      results.tests.push({ name: '错误统计功能', status: 'passed' });
      results.passed++;
      console.log('  ✅ 错误统计功能测试通过');
    } else {
      throw new Error('错误统计返回格式不正确');
    }
  } catch (error) {
    results.tests.push({ name: '错误统计功能', status: 'failed', error });
    results.failed++;
    console.error('  ❌ 错误统计功能测试失败:', error.message);
  }
  
  // 测试5: 批量错误收集器
  try {
    console.log('  测试批量错误收集器...');
    
    const collector = new BatchErrorCollector();
    collector.addSuccess(0, 'result1', { id: 1 });
    collector.addError(1, errorManager.createError(ERROR_CODES.NETWORK_ERROR, '网络错误'), { id: 2 });
    
    const summary = collector.getSummary();
    
    if (summary.successCount === 1 && summary.errorCount === 1) {
      results.tests.push({ name: '批量错误收集器', status: 'passed' });
      results.passed++;
      console.log('  ✅ 批量错误收集器测试通过');
    } else {
      throw new Error('批量错误收集器统计不正确');
    }
  } catch (error) {
    results.tests.push({ name: '批量错误收集器', status: 'failed', error });
    results.failed++;
    console.error('  ❌ 批量错误收集器测试失败:', error.message);
  }
  
  // 显示测试结果
  console.log('\n📊 测试结果汇总:');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`⚠️ 跳过: ${results.tests.filter(t => t.status === 'skipped').length}`);
  
  if (results.failed > 0) {
    console.log('\n失败的测试:');
    results.tests
      .filter(t => t.status === 'failed')
      .forEach(t => console.log(`  - ${t.name}: ${t.error?.message || '未知错误'}`));
  }
  
  const successRate = results.passed / (results.passed + results.failed) * 100;
  console.log(`\n成功率: ${successRate.toFixed(1)}%`);
  
  return results;
}

/**
 * 快速验证核心功能
 */
function quickValidation() {
  console.log('⚡ 快速验证核心功能...');
  
  const checks = [
    {
      name: 'ErrorManager存在',
      test: () => typeof errorManager !== 'undefined' && errorManager !== null
    },
    {
      name: 'ERROR_CODES定义',
      test: () => typeof ERROR_CODES !== 'undefined' && ERROR_CODES.NETWORK_ERROR
    },
    {
      name: 'ErrorUtils存在',
      test: () => typeof ErrorUtils !== 'undefined' && typeof ErrorUtils.safeAsync === 'function'
    },
    {
      name: 'BatchErrorCollector存在',
      test: () => typeof BatchErrorCollector !== 'undefined'
    },
    {
      name: '错误创建功能',
      test: () => {
        const error = errorManager.createError(ERROR_CODES.NETWORK_ERROR, '测试');
        return error instanceof TranslationToolError;
      }
    },
    {
      name: '错误处理功能',
      test: () => {
        const error = new Error('测试错误');
        const handled = errorManager.handleError(error, { test: true });
        return handled instanceof TranslationToolError;
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  checks.forEach(check => {
    try {
      if (check.test()) {
        console.log(`  ✅ ${check.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${check.name} - 测试返回false`);
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ ${check.name} - ${error.message}`);
      failed++;
    }
  });
  
  console.log(`\n快速验证结果: ${passed}/${checks.length} 通过`);
  
  return { passed, failed, total: checks.length };
}

/**
 * 演示错误处理的实际使用
 */
async function demonstrateUsage() {
  console.log('🎭 演示错误处理的实际使用...');
  
  // 演示1: 安全执行异步操作
  console.log('  演示1: 安全执行异步操作');
  const result1 = await safeAsync(
    () => Promise.resolve('成功结果'),
    { context: { demo: 'safeAsync' } }
  );
  console.log('    结果:', result1.success ? '✅ 成功' : '❌ 失败');
  
  // 演示2: 错误分类和处理
  console.log('  演示2: 错误分类和处理');
  try {
    throw new Error('模拟网络错误');
  } catch (error) {
    const handled = errorManager.handleError(error, { 
      operation: 'demo',
      url: 'https://api.example.com' 
    });
    console.log(`    错误分类: ${handled.category}, 严重程度: ${handled.severity}`);
  }
  
  // 演示3: 批量操作错误收集
  console.log('  演示3: 批量操作错误收集');
  const collector = new BatchErrorCollector();
  
  // 模拟批量操作
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) {
      collector.addSuccess(i, `结果${i}`, { id: i });
    } else {
      collector.addError(i, errorManager.createError(ERROR_CODES.NETWORK_ERROR, `错误${i}`), { id: i });
    }
  }
  
  const summary = collector.getSummary();
  console.log(`    批量操作结果: 成功${summary.successCount}, 失败${summary.errorCount}`);
  
  console.log('  🎉 演示完成！');
}

// ==================== 导出函数 ====================
window.testErrorHandlingFixes = testErrorHandlingFixes;
window.quickValidation = quickValidation;
window.demonstrateUsage = demonstrateUsage;

// 自动运行快速验证（仅开发用）
if (typeof isDevelopment !== 'undefined' && isDevelopment) {
  setTimeout(() => {
    console.log('\n🔍 自动运行快速验证...');
    quickValidation();
    console.log('\n💡 运行 testErrorHandlingFixes() 进行完整测试');
    console.log('💡 运行 demonstrateUsage() 查看使用演示');
  }, 1000);
}

