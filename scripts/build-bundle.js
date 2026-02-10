#!/usr/bin/env node
/**
 * JS 打包脚本 — 将 app.js 中定义的 106+ 个脚本合并为单个 app.bundle.js
 *
 * 用法: node scripts/build-bundle.js
 *
 * 输出: public/app.bundle.js（包含所有脚本 + 架构初始化 + 引导逻辑）
 * index.html 中将 <script src="app.js"> 替换为 <script src="app.bundle.js"> 即可
 * 或保持 app.js 不变，app.js 会自动检测 bundle 是否存在
 */

const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const APP_JS = path.join(PUBLIC_DIR, "app.js");
const OUTPUT = path.join(PUBLIC_DIR, "app.bundle.js");

// 从 app.js 源码中提取脚本列表
function extractScriptPaths() {
  const src = fs.readFileSync(APP_JS, "utf-8");

  // 匹配所有 "app/..." 字符串（脚本路径）
  const re = /"(app\/[^"]+\.js)"/g;
  const paths = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      paths.push(m[1]);
    }
  }

  // 排除开发模式脚本
  const devScripts = new Set([
    "app/dev-tools/error-demo.js",
    "app/dev-tools/error-test.js",
    "app/dev-tools/error-system-test.js",
    "app/dev-tools/error-handling-examples.js",
  ]);

  return paths.filter((p) => !devScripts.has(p));
}

// 从 app.js 中提取架构初始化和引导代码（script loader 之后的部分）
function extractBootstrapCode() {
  const src = fs.readFileSync(APP_JS, "utf-8");

  // 提取 initializeArchitectureSystem 和 bootstrapApplication 函数
  // 以及 App 命名空间初始化
  const appInit = `
// ==================== App 命名空间 ====================
(function () {
  var App = (window.App = window.App || {});
  App.impl = App.impl || {};
  App.services = App.services || {};
  App.parsers = App.parsers || {};
  App.features = App.features || {};
  App.ui = App.ui || {};
})();
`;

  // 提取 initializeArchitectureSystem 函数体
  const archStart = src.indexOf("function initializeArchitectureSystem()");
  const bootstrapStart = src.indexOf("function bootstrapApplication(");
  const bootstrapEnd = src.indexOf("// ==================== 启动脚本加载 ====================");

  if (archStart === -1 || bootstrapStart === -1 || bootstrapEnd === -1) {
    console.error("❌ 无法从 app.js 中提取架构初始化代码");
    process.exit(1);
  }

  const archAndBootstrap = src.substring(archStart, bootstrapEnd).trim();

  return { appInit, archAndBootstrap };
}

function build() {
  console.log("📦 开始打包...");

  const scriptPaths = extractScriptPaths();
  console.log(`📋 找到 ${scriptPaths.length} 个脚本`);

  const { appInit, archAndBootstrap } = extractBootstrapCode();

  const parts = [];

  // 文件头
  parts.push(`// app.bundle.js — 自动生成，请勿手动编辑`);
  parts.push(`// 生成时间: ${new Date().toISOString()}`);
  parts.push(`// 脚本数量: ${scriptPaths.length}`);
  // 注意：不能用 IIFE 包裹，因为脚本依赖全局作用域 + const/let 在单一 IIFE 中会产生 TDZ
  parts.push(``);

  // App 命名空间
  parts.push(appInit);

  // 逐个合并脚本
  let totalSize = 0;
  let missing = [];

  for (const sp of scriptPaths) {
    const filePath = path.join(PUBLIC_DIR, sp);
    if (!fs.existsSync(filePath)) {
      missing.push(sp);
      console.warn(`⚠️ 缺失: ${sp}`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    totalSize += content.length;

    parts.push(`// ── ${sp} ──`);
    // 顶层 const/let → var，避免合并后 TDZ（独立 <script> 标签中顶层 const/let 共享全局词法环境，合并后需转换为 var 保持提升行为）
    var patched = content.replace(/^(const |let )/gm, function (match, p1, offset) {
      // 只转换真正的顶层声明（行首无缩进）
      // 有缩进的 const/let 是函数/类/块内部的，不要动
      var lineStart = content.lastIndexOf("\n", offset - 1) + 1;
      var indent = content.substring(lineStart, offset);
      if (indent.trim() === "") {
        return "var ";
      }
      return match;
    });
    parts.push(patched);
    parts.push(``);
  }

  // 生产模式错误监控（仅在未被脚本列表包含时追加）
  const errorProdPath = "app/core/errors/error-production.js";
  if (!scriptPaths.includes(errorProdPath)) {
    const fullPath = path.join(PUBLIC_DIR, errorProdPath);
    if (fs.existsSync(fullPath)) {
      parts.push(`// ── ${errorProdPath} ──`);
      parts.push(fs.readFileSync(fullPath, "utf-8"));
      parts.push(``);
    }
  }

  // safeLog 辅助函数（从 app.js IIFE 中提取，架构初始化代码依赖它）
  parts.push(`// ── safeLog 辅助函数 ──`);
  parts.push(`function safeLog(level, message, data) {
  var logger = window.loggers && window.loggers.scripts;
  if (logger && logger[level]) {
    if (data !== undefined) { logger[level](message, data); } else { logger[level](message); }
  } else {
    var prefix = level === 'info' ? '📦' : level === 'warn' ? '⚠️' : level === 'error' ? '❌' : '🔍';
    if (data !== undefined) { console[level](prefix + ' ' + message, data); } else { console[level](prefix + ' ' + message); }
  }
}`);
  parts.push(``);

  // 架构初始化 + 引导代码
  parts.push(`// ── 架构初始化 + 应用引导 ──`);
  parts.push(archAndBootstrap);
  parts.push(``);

  // 直接启动（无需等待脚本加载）
  parts.push(`// 所有脚本已内联，直接启动架构初始化`);
  parts.push(`initializeArchitectureSystem();`);

  const bundle = parts.join("\n");
  fs.writeFileSync(OUTPUT, bundle, "utf-8");

  const bundleSize = (bundle.length / 1024).toFixed(1);
  const sourceSize = (totalSize / 1024).toFixed(1);

  console.log(`✅ 打包完成: app.bundle.js`);
  console.log(`   源文件: ${scriptPaths.length} 个, ${sourceSize} KB`);
  console.log(`   Bundle: ${bundleSize} KB`);
  if (missing.length > 0) {
    console.log(`   ⚠️ 缺失 ${missing.length} 个文件: ${missing.join(", ")}`);
  }
  console.log(`\n💡 使用方法:`);
  console.log(`   在 index.html 中将 <script src="app.js"> 替换为 <script src="app.bundle.js">`);
}

build();
