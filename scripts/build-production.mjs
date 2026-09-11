#!/usr/bin/env node
/**
 * 生产环境构建脚本（跨平台 Node.js 版本）
 * 替代 build-production.ps1
 *
 * 用法：node scripts/build-production.mjs [--output-dir dist] [--skip-tests]
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
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

  // 注入生产环境标识脚本。
  //
  // ⚠️ 旧实现在这里替换字面量 `<script src="app.js"></script>`，而 index.html 现在是通过
  // 内联加载器加载 app.bundle.js（带 app.js 回退），该字面量早已不存在 ——
  // 结果是 production.js 被写进了 dist，却没有任何页面引用它，window.isProduction 永远 undefined。
  // 现改为：先兼容旧形态，否则注入到 </head> 之前（早于任何 defer 脚本执行），并校验注入结果。
  const htmlPath = path.join(OUTPUT_PATH, "public", "index.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`找不到 ${htmlPath}，无法注入生产标识`);
  }
  {
    const TAG = '<script src="production.js"></script>';
    let html = fs.readFileSync(htmlPath, "utf-8");
    let injected = false;

    if (html.includes('<script src="app.js"></script>')) {
      html = html.replace(
        '<script src="app.js"></script>',
        `${TAG}<script src="app.js"></script>`
      );
      injected = true;
    } else if (!html.includes(TAG) && html.includes("</head>")) {
      html = html.replace("</head>", `    ${TAG}\n</head>`);
      injected = true;
    }

    if (!injected || !html.includes(TAG)) {
      throw new Error(
        "无法把 production.js 注入 index.html（未找到 </head> 或旧式 app.js 标签）：" +
          "生产包会缺少 window.isProduction 标识"
      );
    }
    fs.writeFileSync(htmlPath, html, "utf-8");
    log("white", "  ✔ 已注入 production.js");
  }

  // 构建 CSS（走独立脚本，不依赖 npm 可执行文件 —— 本机 npm.ps1 被执行策略禁用，
  // 容器/CI 也可能没有 npm 的 PATH；旧实现的 execSync("npm run build-css") 会直接失败并被静默降级）
  log("yellow", "🎨 构建CSS...");
  try {
    execFileSync(
      process.execPath,
      [path.join(PROJECT_ROOT, "scripts", "build-css.mjs")],
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    const cssSource = path.join(PROJECT_ROOT, "public", "styles.css");
    if (!fs.existsSync(cssSource)) {
      throw new Error("构建后仍找不到 public/styles.css");
    }
    fs.copyFileSync(cssSource, path.join(OUTPUT_PATH, "public", "styles.css"));
  } catch (e) {
    log("red", `  ❌ CSS 构建失败（dist 内保留的是复制过来的旧 styles.css）: ${e.message || e}`);
    if (e.stdout) log("white", String(e.stdout).trim().split("\n").slice(-3).join("\n"));
    if (e.stderr) log("white", String(e.stderr).trim().split("\n").slice(-3).join("\n"));
  }

  // 构建 JS Bundle
  log("yellow", "📦 构建JS Bundle...");
  try {
    execFileSync(
      process.execPath,
      [path.join(PROJECT_ROOT, "scripts", "build-bundle.js")],
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    const bundleSource = path.join(PROJECT_ROOT, "public", "app.bundle.js");
    if (!fs.existsSync(bundleSource)) {
      throw new Error("构建后仍找不到 public/app.bundle.js");
    }
    fs.copyFileSync(bundleSource, path.join(OUTPUT_PATH, "public", "app.bundle.js"));
  } catch (e) {
    log("red", `  ❌ JS Bundle 构建失败（dist 内保留的是复制过来的旧 app.bundle.js）: ${e.message || e}`);
    if (e.stdout) log("white", String(e.stdout).trim().split("\n").slice(-3).join("\n"));
    if (e.stderr) log("white", String(e.stderr).trim().split("\n").slice(-3).join("\n"));
  }

  // 运行测试（此前这里只打印「暂无自动化测试」，而仓库已有 581 个用例 —— 属失效的占位实现）
  if (!skipTests) {
    log("yellow", "🧪 运行测试...");
    const vitestEntry = path.join(PROJECT_ROOT, "node_modules", "vitest", "vitest.mjs");
    if (fs.existsSync(vitestEntry)) {
      try {
        execFileSync(process.execPath, [vitestEntry, "run"], {
          cwd: PROJECT_ROOT,
          stdio: "inherit",
        });
        log("green", "  ✔ 测试全部通过");
      } catch (e) {
        throw new Error("测试未通过，已中止生产构建（如需强制继续，加 --skip-tests）");
      }
    } else {
      log("yellow", "  ⏭️ 未安装 vitest，跳过测试（先运行 npm ci）");
    }
  } else {
    log("yellow", "🧪 已按 --skip-tests 跳过测试");
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
