#!/usr/bin/env node
/**
 * 生产环境构建脚本（跨平台 Node.js 版本）
 * 替代 build-production.ps1
 *
 * 用法：node scripts/build-production.mjs [--output-dir dist] [--skip-tests]
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
let outputDir = "dist";
let skipTests = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir" && args[i + 1]) {
    outputDir = args[++i];
  } else if (args[i] === "--skip-tests") {
    skipTests = true;
  }
}

const OUTPUT_PATH = path.resolve(PROJECT_ROOT, outputDir);

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function log(color, msg) {
  console.log(`${colors[color] || ""}${msg}${colors.reset}`);
}

/** 递归复制目录，支持排除规则 */
function copyDirSync(src, dest, excludeFiles = [], excludeDirs = []) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.some((pattern) => entry.name === pattern)) continue;
      copyDirSync(srcPath, destPath, excludeFiles, excludeDirs);
    } else {
      if (excludeFiles.some((pattern) => entry.name.includes(pattern))) continue;
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** 递归计算目录总大小 */
function getDirSize(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

function build() {
  log("green", "🚀 开始构建生产环境版本...");

  // 创建输出目录
  if (fs.existsSync(OUTPUT_PATH)) {
    fs.rmSync(OUTPUT_PATH, { recursive: true, force: true });
  }
  fs.mkdirSync(OUTPUT_PATH, { recursive: true });

  // 复制核心文件
  log("yellow", "📁 复制核心文件...");

  const excludeFiles = [
    "error-demo.js",
    "error-test.js",
    "error-handling-examples.js",
  ];
  const excludeDirs = ["examples", "dev-tools"];

  copyDirSync(
    path.join(PROJECT_ROOT, "public"),
    path.join(OUTPUT_PATH, "public"),
    excludeFiles,
    excludeDirs
  );

  // 复制其他必要文件
  for (const file of ["package.json", "README.md", "LICENSE"]) {
    const src = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUTPUT_PATH, file));
    }
  }

  // 复制配置文件
  copyDirSync(
    path.join(PROJECT_ROOT, "config"),
    path.join(OUTPUT_PATH, "config")
  );

  // 复制文档（仅用户文档）
  const docsDir = path.join(OUTPUT_PATH, "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  const srcDocs = path.join(PROJECT_ROOT, "docs");
  if (fs.existsSync(srcDocs)) {
    const docFiles = fs.readdirSync(srcDocs);
    for (const f of docFiles) {
      if (
        f.startsWith("README-") ||
        f.startsWith("PROJECT-") ||
        f === "QUICK-START.md"
      ) {
        const srcPath = path.join(srcDocs, f);
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, path.join(docsDir, f));
        }
      }
    }
  }

  // 创建生产环境标识文件
  fs.writeFileSync(
    path.join(OUTPUT_PATH, "public", "production.js"),
    "// 生产环境标识\nwindow.isProduction = true;\nwindow.isDevelopment = false;\n",
    "utf-8"
  );

  // 更新 HTML 文件
  const htmlPath = path.join(OUTPUT_PATH, "public", "index.html");
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, "utf-8");
    html = html.replace(
      '<script src="app.js"></script>',
      '<script src="production.js"></script><script src="app.js"></script>'
    );
    fs.writeFileSync(htmlPath, html, "utf-8");
  }

  // 构建 CSS
  log("yellow", "🎨 构建CSS...");
  try {
    execSync("npm run build-css", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
    });
    // 复制构建后的 CSS 到输出目录
    const cssSource = path.join(PROJECT_ROOT, "public", "styles.css");
    if (fs.existsSync(cssSource)) {
      fs.copyFileSync(
        cssSource,
        path.join(OUTPUT_PATH, "public", "styles.css")
      );
    }
  } catch (e) {
    log("yellow", "  CSS 构建跳过（tailwindcss 未安装或构建失败）");
  }

  // 构建 JS Bundle
  log("yellow", "📦 构建JS Bundle...");
  try {
    execSync("node scripts/build-bundle.js", {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
    });
    const bundleSource = path.join(PROJECT_ROOT, "public", "app.bundle.js");
    if (fs.existsSync(bundleSource)) {
      fs.copyFileSync(
        bundleSource,
        path.join(OUTPUT_PATH, "public", "app.bundle.js")
      );
    }
  } catch (e) {
    log("yellow", "  JS Bundle 构建失败: " + e.message);
  }

  // 运行测试
  if (!skipTests) {
    log("yellow", "🧪 运行测试...");
    // 预留测试命令接入点
    // 当测试框架就绪后，在此处添加：execSync("npm test", ...)
    log("gray", "  ⏭️ 暂无自动化测试（待引入测试框架）");
  }

  // 生成构建信息
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8")
  );
  const buildInfo = {
    version: pkg.version,
    buildTime: new Date().toISOString(),
    environment: "production",
    platform: process.platform,
    nodeVersion: process.version,
  };
  fs.writeFileSync(
    path.join(OUTPUT_PATH, "build-info.json"),
    JSON.stringify(buildInfo, null, 2),
    "utf-8"
  );

  // 计算文件大小
  const totalSize = getDirSize(OUTPUT_PATH);
  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

  log("green", "✅ 生产环境构建完成!");
  log("cyan", "📊 构建统计:");
  log("white", `  输出目录: ${outputDir}`);
  log("white", `  总大小: ${sizeMB} MB`);
  log("white", `  构建时间: ${buildInfo.buildTime}`);
  log("white", `  版本: ${buildInfo.version}`);

  console.log();
  log("cyan", "🎯 下一步操作:");
  log("white", `  1. 测试生产版本: 打开 ${outputDir}/public/index.html`);
  log("white", `  2. 部署到服务器: 上传 ${outputDir}/public/ 目录`);
  log("white", "  3. 配置Web服务器: 设置适当的MIME类型和缓存策略");
}

build();
