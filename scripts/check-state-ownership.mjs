#!/usr/bin/env node
/**
 * 状态所有权静态检查（check-state-ownership）
 *
 * 守护第二阶段确立的所有权边界：
 *   AppState.project / AppState.fileMetadata 两个切片的唯一写入方是
 *   public/app/core/project-store.js（ProjectStore）。
 *
 * 本脚本扫描 public/app 下所有业务源码，查找绕过 ProjectStore 的
 * 直接"写入"（赋值 / delete），命中即报错并以非零码退出（供 CI 拦截）。
 * 读取（含可选链 `?.`）与 `==`/`===` 比较不算写入，不报错。
 *
 * 用法：node scripts/check-state-ownership.mjs
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "public", "app");

// 唯一允许写入的 Owner 文件（相对 public/app，统一正斜杠）
const OWNER_FILE = "core/project-store.js";

/**
 * 受守护的写入模式。
 * 每条 = [正则, 说明]。正则只匹配"写入"语义（赋值 / delete），
 * 通过排除 `==`/`===` 与可选链读取来避免误报。
 */
const GUARDED_PATTERNS = [
  // AppState.project = ...（顶层赋值；排除 == / ===）
  [
    /AppState\.project\s*=(?!=)/,
    "AppState.project 顶层赋值",
  ],
  // AppState.project.translationItems = ...
  [
    /AppState\.project\.translationItems\s*=(?!=)/,
    "AppState.project.translationItems 赋值",
  ],
  // AppState.project.fileMetadata = ...
  [
    /AppState\.project\.fileMetadata\s*=(?!=)/,
    "AppState.project.fileMetadata 赋值",
  ],
  // AppState.fileMetadata = ...（顶层赋值）
  [
    /AppState\.fileMetadata\s*=(?!=)/,
    "AppState.fileMetadata 顶层赋值",
  ],
  // AppState.fileMetadata[key] = ...
  [
    /AppState\.fileMetadata\[[^\]]*\]\s*=(?!=)/,
    "AppState.fileMetadata[key] 赋值",
  ],
  // delete AppState.fileMetadata[key]
  [
    /delete\s+AppState\.fileMetadata\[/,
    "delete AppState.fileMetadata[key]",
  ],
  // delete AppState.project.fileMetadata[key]
  [
    /delete\s+AppState\.project\.fileMetadata\[/,
    "delete AppState.project.fileMetadata[key]",
  ],
];

/** 递归收集 .js 源文件（跳过 lib/ 第三方库） */
function collectJsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "lib") continue; // 第三方库不参与检查
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

const files = collectJsFiles(APP_DIR);
const violations = [];

for (const file of files) {
  const rel = relToApp(file);
  // Owner 文件本身允许写入
  if (rel === OWNER_FILE) continue;

  const lines = readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    // 跳过注释行（简化：以 // 或 * 开头的行）
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    for (const [re, desc] of GUARDED_PATTERNS) {
      if (re.test(line)) {
        violations.push({ file: rel, line: idx + 1, desc, text: trimmed });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("❌ 状态所有权检查失败：检测到绕过 ProjectStore 的直接写入\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.desc}]`);
    console.error(`      ${v.text}\n`);
  }
  console.error(
    "请改用 ProjectStore 的意图式 API（loadProject / createProject / clearProject /\n" +
      "setFileMetadata / patchFileMetadata / removeFileMetadata / replaceFileItems 等）。\n" +
      "唯一写入方：public/app/core/project-store.js"
  );
  process.exit(1);
}

console.log("✅ 状态所有权检查通过：无绕过 ProjectStore 的直接写入");
