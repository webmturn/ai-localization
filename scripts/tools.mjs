#!/usr/bin/env node
/**
 * 项目工具脚本（跨平台 Node.js 版本）
 * 替代 tools.ps1，在 Windows/macOS/Linux 上均可运行
 *
 * 用法：node scripts/tools.mjs <action> [--check-only]
 *   check-node      检查 Node/npm 是否已安装
 *   check-versions  检查依赖最新版本
 *   update-config   将 cdn-versions.json 更新为最新
 *   update-cdn      下载 CDN 资源（--check-only 仅列出版本）
 *   all             依次执行全部
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config", "cdn-versions.json");

// ======================== 辅助函数 ========================

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
};

function log(color, msg) {
  const c = colors[color] || colors.reset;
  console.log(`${c}${msg}${colors.reset}`);
}

/** 从 npm registry 获取最新版本号 */
function getLatestNpmVersion(packageName) {
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    https
      .get(url, { headers: { Accept: "application/json" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).version || null);
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

/** 下载文件到本地 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const proto = url.startsWith("https") ? https : http;
    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("重定向次数过多"));
        return;
      }
      proto
        .get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            request(res.headers.location, redirectCount + 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const file = fs.createWriteStream(destPath);
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve();
          });
        })
        .on("error", reject);
    };
    request(url);
  });
}

/** 简单版本比较（semver 大版本.小版本.补丁） */
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    log("red", `错误：未找到 cdn-versions.json，路径：${CONFIG_PATH}`);
    process.exit(1);
  }
  let raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  // 去除 UTF-8 BOM（PowerShell 写入的文件可能包含 BOM）
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), "utf-8");
}

// ======================== 动作实现 ========================

async function checkNode() {
  log("cyan", "========================================");
  log("cyan", "Node.js 安装检查工具");
  log("cyan", "========================================");
  console.log();

  let nodeOk = false;
  let npmOk = false;

  try {
    const nodeVersion = execSync("node --version", { encoding: "utf-8" }).trim();
    log("green", `Node.js 已安装: ${nodeVersion}`);
    nodeOk = true;
  } catch {
    log("red", "Node.js 未安装或不在 PATH 中");
  }

  try {
    const npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim();
    log("green", `npm 已安装: ${npmVersion}`);
    npmOk = true;
  } catch {
    log("red", "npm 未安装或不在 PATH 中");
  }

  console.log();
  if (nodeOk && npmOk) {
    log("green", "Node.js 与 npm 已就绪。");
    log("yellow", "下一步：执行 npm install，然后 npm run build");
  } else {
    log("yellow", "请从 https://nodejs.org/ 安装 Node.js（建议 LTS）");
    log("gray", "安装时请勾选【添加到 PATH】，安装后重启终端。");
  }
}

async function checkVersions() {
  const config = readConfig();

  log("cyan", "=== 正在检查最新版本 ===");
  console.log();

  // Font Awesome
  log("yellow", "[1/3] Font Awesome");
  const currentFA = config["font-awesome"].version;
  log("gray", `  当前: v${currentFA}`);
  const latestFA = await getLatestNpmVersion("@fortawesome/fontawesome-free");
  if (latestFA) {
    log("cyan", `  最新 (v5/v6): v${latestFA}`);
    log("yellow", "  说明：Font Awesome v4.7.0 为最后 v4 版本");
    log("yellow", "        升级 v5/v6 需修改代码（类名不同）");
  } else {
    log("green", "  最新：v4.7.0（最后 v4 版本）");
  }

  // Chart.js
  console.log();
  log("yellow", "[2/3] Chart.js");
  const currentChart = config["chart.js"].version;
  log("gray", `  当前: v${currentChart}`);
  const latestChart = await getLatestNpmVersion("chart.js");
  if (latestChart) {
    log("cyan", `  最新: v${latestChart}`);
    log(latestChart !== currentChart ? "green" : "green", latestChart !== currentChart ? "  有可用更新！" : "  已是最新");
  } else {
    log("yellow", "  无法获取最新版本");
  }

  // SheetJS
  console.log();
  log("yellow", "[3/3] SheetJS (xlsx)");
  const currentSheetJS = config["sheetjs"].version;
  log("gray", `  当前: v${currentSheetJS}`);
  const latestSheetJS = await getLatestNpmVersion("xlsx");
  if (latestSheetJS) {
    log("cyan", `  最新: v${latestSheetJS}`);
    try {
      const cmp = compareVersions(latestSheetJS, currentSheetJS);
      log(cmp > 0 ? "green" : "green", cmp > 0 ? "  有可用更新！" : "  已是最新");
    } catch {
      log("yellow", "  版本格式可能不同");
    }
  } else {
    log("yellow", "  无法获取最新版本");
  }

  // 汇总
  console.log();
  log("cyan", "=== 汇总 ===");
  const updates = [];
  if (latestChart && latestChart !== currentChart) {
    updates.push({ name: "Chart.js", current: currentChart, latest: latestChart });
  }
  if (latestSheetJS && compareVersions(latestSheetJS, currentSheetJS) > 0) {
    updates.push({ name: "SheetJS", current: currentSheetJS, latest: latestSheetJS });
  }

  if (updates.length === 0) {
    log("green", "所有依赖已是最新！");
  } else {
    log("yellow", "可用更新：");
    for (const u of updates) {
      log("cyan", `  - ${u.name}: v${u.current} -> v${u.latest}`);
    }
    console.log();
    log("cyan", "一键更新配置并下载请运行：node scripts/tools.mjs all");
  }
}

async function updateConfig() {
  const config = readConfig();
  let updated = false;

  log("cyan", "=== 自动更新到最新版本 ===");
  console.log();

  // Chart.js
  log("yellow", "[1/2] 正在检查 Chart.js...");
  const currentChart = config["chart.js"].version;
  const latestChart = await getLatestNpmVersion("chart.js");
  if (latestChart && latestChart !== currentChart) {
    log("cyan", `  正在从 v${currentChart} 更新到 v${latestChart}`);
    config["chart.js"].version = latestChart;
    config["chart.js"].url = `https://cdn.jsdelivr.net/npm/chart.js@${latestChart}/dist/chart.umd.min.js`;
    updated = true;
    log("green", "  配置已更新");
  } else {
    log("gray", `  已是最新 (v${currentChart})`);
  }

  // SheetJS
  console.log();
  log("yellow", "[2/2] 正在检查 SheetJS...");
  const currentSheetJS = config["sheetjs"].version;
  const latestSheetJS = await getLatestNpmVersion("xlsx");
  if (latestSheetJS && compareVersions(latestSheetJS, currentSheetJS) > 0) {
    log("cyan", `  正在从 v${currentSheetJS} 更新到 v${latestSheetJS}`);
    config["sheetjs"].version = latestSheetJS;
    config["sheetjs"].url = `https://cdn.sheetjs.com/xlsx-${latestSheetJS}/package/dist/xlsx.full.min.js`;
    updated = true;
    log("green", "  配置已更新");
  } else {
    log("gray", `  已是最新 (v${currentSheetJS})`);
  }

  if (updated) {
    console.log();
    log("yellow", "正在保存配置...");
    saveConfig(config);
    log("green", "配置已保存！");
    console.log();
    log("cyan", "请执行：node scripts/tools.mjs update-cdn（或 npm run update-cdn）");
  } else {
    console.log();
    log("green", "无可用更新，所有依赖已是最新！");
  }
}

async function updateCdn(checkOnly = false) {
  const config = readConfig();

  // 解析本地路径
  const localPaths = {
    faCss: path.join(PROJECT_ROOT, config["font-awesome"].localPath.css),
    faFont: path.join(PROJECT_ROOT, config["font-awesome"].localPath.font),
    chart: path.join(PROJECT_ROOT, config["chart.js"].localPath),
    sheetjs: path.join(PROJECT_ROOT, config["sheetjs"].localPath),
  };

  // 确保目录存在
  for (const p of Object.values(localPaths)) {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log("green", `已创建目录：${dir}`);
    }
  }

  log("cyan", "=== CDN 资源更新工具 ===");
  console.log();

  // Font Awesome
  log("yellow", `[1/3] Font Awesome v${config["font-awesome"].version}`);
  if (checkOnly) {
    log("gray", `  当前版本: ${config["font-awesome"].version}`);
    log("gray", `  CSS: ${config["font-awesome"].css}`);
    log("gray", `  Font: ${config["font-awesome"].font}`);
  } else {
    try {
      log("gray", "  正在下载 CSS...");
      await downloadFile(config["font-awesome"].css, localPaths.faCss);
      log("gray", "  正在下载字体...");
      await downloadFile(config["font-awesome"].font, localPaths.faFont);

      // 修复字体路径
      log("gray", "  正在修复字体路径...");
      let cssContent = fs.readFileSync(localPaths.faCss, "utf-8");
      cssContent = cssContent.replace(/\.\.\/fonts\//g, "./fonts/");
      // 简化 @font-face：仅保留 woff2
      const fontFaceRegex = /@font-face\s*\{[^}]*font-family:\s*['"]FontAwesome['"][^}]*\}/;
      if (fontFaceRegex.test(cssContent)) {
        const newFontFace =
          "@font-face {\n" +
          "    font-family: 'FontAwesome';\n" +
          "    src: url('./fonts/fontawesome-webfont.woff2') format('woff2');\n" +
          "    font-weight: normal; font-style: normal; font-display: swap;\n" +
          "}";
        cssContent = cssContent.replace(fontFaceRegex, newFontFace);
      }
      fs.writeFileSync(localPaths.faCss, cssContent, "utf-8");
      log("green", "  Font Awesome 更新成功");
    } catch (e) {
      log("red", `  Font Awesome 更新失败：${e.message}`);
    }
  }

  // Chart.js
  console.log();
  log("yellow", `[2/3] Chart.js v${config["chart.js"].version}`);
  if (checkOnly) {
    log("gray", `  当前版本: ${config["chart.js"].version}`);
    log("gray", `  URL: ${config["chart.js"].url}`);
  } else {
    try {
      log("gray", "  正在下载 Chart.js...");
      await downloadFile(config["chart.js"].url, localPaths.chart);
      log("green", "  Chart.js 更新成功");
    } catch (e) {
      log("red", `  Chart.js 更新失败：${e.message}`);
    }
  }

  // SheetJS
  console.log();
  log("yellow", `[3/3] SheetJS v${config["sheetjs"].version}`);
  if (checkOnly) {
    log("gray", `  当前版本: ${config["sheetjs"].version}`);
    log("gray", `  URL: ${config["sheetjs"].url}`);
  } else {
    try {
      log("gray", "  正在下载 SheetJS...");
      await downloadFile(config["sheetjs"].url, localPaths.sheetjs);
      log("green", "  SheetJS 更新成功");
    } catch (e) {
      log("red", `  SheetJS 更新失败：${e.message}`);
    }
  }

  console.log();
  if (checkOnly) {
    log("cyan", "=== 版本检查完成 ===");
  } else {
    log("cyan", "=== 更新完成 ===");
    console.log();
    log("yellow", "提示：若遇问题可查看各库更新说明");
    log("gray", "  - Font Awesome: https://fontawesome.com/v4.7.0/");
    log("gray", "  - Chart.js: https://www.chartjs.org/docs/latest/getting-started/installation.html");
    log("gray", "  - SheetJS: https://docs.sheetjs.com/");
    console.log();
    log("cyan", "仅查看版本请运行：node scripts/tools.mjs update-cdn --check-only");
  }
}

// ======================== 入口 ========================

const args = process.argv.slice(2);
const action = (args[0] || "").toLowerCase();
const checkOnly = args.includes("--check-only");

const USAGE = `用法：node scripts/tools.mjs <action> [--check-only]
  check-node      检查 Node/npm 是否已安装
  check-versions  检查依赖最新版本
  update-config   将 cdn-versions.json 更新为最新
  update-cdn      下载 CDN 资源（--check-only 仅列出版本）
  all             依次执行全部`;

async function main() {
  switch (action) {
    case "check-node":
      await checkNode();
      break;
    case "check-versions":
      await checkVersions();
      break;
    case "update-config":
      await updateConfig();
      break;
    case "update-cdn":
      await updateCdn(checkOnly);
      break;
    case "all":
      await checkNode();
      console.log();
      await checkVersions();
      console.log();
      await updateConfig();
      console.log();
      await updateCdn(false);
      break;
    default:
      log("yellow", USAGE);
      process.exit(action ? 1 : 0);
  }
}

main().catch((err) => {
  log("red", `错误：${err.message}`);
  process.exit(1);
});
