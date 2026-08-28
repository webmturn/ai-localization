#!/usr/bin/env node
/**
 * 全局函数冻结检查（check-global-functions）
 *
 * 第三阶段"全局函数治理"的增量拦截机制。
 *
 * 背景：public/app 下约 248 处 `window.X = ...` 挂载（71 个文件），
 * 模块间依赖靠 window 全局名互调，无边界、无加载顺序保障，还存在
 * 同名重复挂载（后加载者静默覆盖前者）的隐患。
 *
 * 治理策略与第二阶段一致：先冻结存量、阻断新增，再渐进迁移到
 * 命名空间（App.impl）/ DI 容器。本脚本负责"阻断新增"：
 *
 *   - 扫描 public/app 下所有 `window.<name> =` 顶层挂载；
 *   - 与基线 config/global-functions-baseline.json 对比；
 *   - 出现基线外的新挂载 → 报错并非零码退出（供 CI 拦截）；
 *   - 基线内挂载被移除 → 提示收敛（好事，建议 --update 收缩基线）；
 *   - 同一名字被多个文件挂载 → 报告重复（覆盖冲突隐患）。
 *
 * 用法：
 *   node scripts/check-global-functions.mjs           # 检查（新增即失败）
 *   node scripts/check-global-functions.mjs --update  # 重新生成基线
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "public", "app");
const BASELINE_FILE = join(ROOT, "config", "global-functions-baseline.json");

// 顶层挂载：`window.<name> =`（排除 == / ===；`window.App.impl.x =` 这类
// 命名空间内部写入不算顶层全局，不参与冻结）
const MOUNT_RE = /^\s*window\.([A-Za-z_$][\w$]*)\s*=(?!=)/;

/** 递归收集 .js 源文件（跳过 lib/ 第三方库） */
function collectJsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "lib") continue;
      collectJsFiles(full, out);
    } else if (entry.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

function relToApp(file) {
  return file.slice(APP_DIR.length + 1).split(sep).join("/");
}

/** 扫描当前代码，返回 { name: [相对文件路径...] } */
function scanMounts() {
  const mounts = new Map();
  for (const file of collectJsFiles(APP_DIR)) {
    const rel = relToApp(file);
    const lines = readFileSync(file, "utf-8").split(/\r?\n/);
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      const m = MOUNT_RE.exec(line);
      if (!m) return;
      const name = m[1];
      if (!mounts.has(name)) mounts.set(name, new Set());
      mounts.get(name).add(rel);
    });
  }
  // 转为可序列化结构（文件列表排序，保证稳定对比）
  const result = {};
  for (const [name, files] of [...mounts.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    result[name] = [...files].sort();
  }
  return result;
}

const UPDATE_MODE = process.argv.includes("--update");
const current = scanMounts();

if (UPDATE_MODE) {
  writeFileSync(
    BASELINE_FILE,
    JSON.stringify(
      {
        _comment:
          "全局函数冻结基线：window.<name> 顶层挂载清单（自动生成，勿手改）。新增挂载会被 CI 拦截；迁移移除后请运行 node scripts/check-global-functions.mjs --update 收缩基线。",
        generatedAt: new Date().toISOString(),
        mounts: current,
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
  console.log(
    `✅ 基线已更新：${Object.keys(current).length} 个全局挂载 → config/global-functions-baseline.json`
  );
  process.exit(0);
}

// ---- 检查模式 ----
let baseline = { mounts: {} };
try {
  baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));
} catch (e) {
  console.error(
    "❌ 无法读取基线文件 config/global-functions-baseline.json\n" +
      "   首次使用请先运行：node scripts/check-global-functions.mjs --update"
  );
  process.exit(1);
}
const baselineMounts = baseline.mounts || {};

const added = Object.keys(current).filter((n) => !(n in baselineMounts));
const removed = Object.keys(baselineMounts).filter((n) => !(n in current));
const duplicates = Object.entries(current)
  .filter(([, files]) => files.length > 1)
  .sort(([a], [b]) => a.localeCompare(b));

let failed = false;

if (added.length > 0) {
  failed = true;
  console.error("❌ 全局函数冻结检查失败：检测到基线外的新增 window 挂载\n");
  for (const name of added) {
    console.error(`  window.${name}  ← ${current[name].join(", ")}`);
  }
  console.error(
    "\n请勿新增 window 顶层挂载。跨模块能力请挂到命名空间（App.impl）\n" +
      "或经 DI 容器注册；确有必要时，经评审后运行\n" +
      "node scripts/check-global-functions.mjs --update 更新基线。"
  );
}

if (duplicates.length > 0) {
  // 重复挂载：基线内已存在的视为历史遗留（提示），基线外新产生的随新增一起报错
  console.error("\n⚠️ 同名重复挂载（后加载者静默覆盖前者）：");
  for (const [name, files] of duplicates) {
    const isLegacy = name in baselineMounts;
    console.error(
      `  window.${name}  ← ${files.join(" + ")}${isLegacy ? "（历史遗留）" : ""}`
    );
  }
}

if (removed.length > 0) {
  console.log(
    `\n📉 基线内已有 ${removed.length} 个挂载被移除（治理收敛）：`
  );
  for (const name of removed) console.log(`  window.${name}`);
  console.log(
    "   建议运行 node scripts/check-global-functions.mjs --update 收缩基线。"
  );
}

if (failed) process.exit(1);

console.log(
  `✅ 全局函数冻结检查通过：${Object.keys(current).length} 个挂载均在基线内，无新增`
);
