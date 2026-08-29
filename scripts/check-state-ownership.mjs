#!/usr/bin/env node
/**
 * 状态所有权静态检查（check-state-ownership）
 *
 * 守护第二阶段确立的所有权边界：
 *   AppState.project / AppState.fileMetadata 两个切片的唯一写入方是
 *   public/app/core/project-store.js（ProjectStore）。
 *
 * 第三阶段扩展：属性级确权——不仅守护切片顶层赋值，还守护
 *   AppState.project.<任意属性> 的属性级赋值（name / terminologyList /
 *   updatedAt / sourceLanguage 等），杜绝绕过意图式 API 的裸写。
 *
 * 阶段 1 扩展：多 Owner 映射表——OWNER_FILE 单文件升级为"模式→Owner"
 *   映射表，新增 AppState.terminology 切片守护（唯一写入方为
 *   public/app/core/terminology-store.js / TerminologyStore）。
 *   守护范围含赋值、索引赋值、数组变异方法（push/splice 等）与 delete，
 *   杜绝一切绕过 Store 的写入形式。
 *
 * 本脚本扫描 public/app 下所有业务源码，查找绕过 Owner Store 的
 * 直接"写入"（赋值 / 变异 / delete），命中即报错并以非零码退出（供 CI 拦截）。
 * 读取（含可选链 `?.`）与 `==`/`===` 比较不算写入，不报错。
 *
 * 用法：node scripts/check-state-ownership.mjs
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { dirname, join, resolve, sep } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(ROOT, "public", "app");

/**
 * 受守护的写入模式 → Owner 映射表。
 * 每条 = [正则, 说明, Owner 文件]。Owner 为唯一允许写入的文件
 * （相对 public/app，统一正斜杠）。正则只匹配"写入"语义
 * （赋值 / 变异 / delete），通过排除 `==`/`===` 与可选链读取来避免误报。
 */
const GUARDED_PATTERNS = [
  // ── Owner: ProjectStore（core/project-store.js）──
  // AppState.project = ...（顶层赋值；排除 == / ===）
  [
    /AppState\.project\s*=(?!=)/,
    "AppState.project 顶层赋值",
    "core/project-store.js",
  ],
  // AppState.project.<任意属性> = ...（属性级确权：name / terminologyList /
  // updatedAt / translationItems / fileMetadata 等一律经 ProjectStore 意图式 API）
  [
    /AppState\.project\.[a-zA-Z_$][\w$]*\s*[+\-*/]?=(?!=)/,
    "AppState.project.<属性> 赋值",
    "core/project-store.js",
  ],
  // AppState.fileMetadata = ...（顶层赋值）
  [
    /AppState\.fileMetadata\s*=(?!=)/,
    "AppState.fileMetadata 顶层赋值",
    "core/project-store.js",
  ],
  // AppState.fileMetadata[key] = ...
  [
    /AppState\.fileMetadata\[[^\]]*\]\s*=(?!=)/,
    "AppState.fileMetadata[key] 赋值",
    "core/project-store.js",
  ],
  // AppState.translations.items = ...（别名同步依赖此字段与 project.translationItems 同引用，
  // 直写会静默断裂别名，导致 saveProject 持久化旧条目）
  [
    /AppState\.translations\.items\s*=(?!=)/,
    "AppState.translations.items 赋值",
    "core/project-store.js",
  ],
  // delete AppState.fileMetadata[key]
  [
    /delete\s+AppState\.fileMetadata\[/,
    "delete AppState.fileMetadata[key]",
    "core/project-store.js",
  ],
  // delete AppState.project.fileMetadata[key]
  [
    /delete\s+AppState\.project\.fileMetadata\[/,
    "delete AppState.project.fileMetadata[key]",
    "core/project-store.js",
  ],

  // ── Owner: TerminologyStore（core/terminology-store.js）──
  // AppState.terminology = ...（顶层赋值）
  [
    /AppState\.terminology\s*=(?!=)/,
    "AppState.terminology 顶层赋值",
    "core/terminology-store.js",
  ],
  // AppState.terminology.<字段> = ...（list / filtered / currentPage / perPage
  // 一律经 TerminologyStore 意图式 API；含 += 等复合赋值）
  [
    /AppState\.terminology\.(list|filtered|currentPage|perPage)\s*[+\-*/]?=(?!=)/,
    "AppState.terminology.<字段> 赋值",
    "core/terminology-store.js",
  ],
  // AppState.terminology.(list|filtered)[i] = ...（索引赋值）
  [
    /AppState\.terminology\.(list|filtered)\[[^\]]*\]\s*=(?!=)/,
    "AppState.terminology.<字段>[i] 索引赋值",
    "core/terminology-store.js",
  ],
  // AppState.terminology.(list|filtered).push/splice/...（数组变异方法）
  [
    /AppState\.terminology\.(list|filtered)\.(push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\(/,
    "AppState.terminology.<字段> 变异方法写入",
    "core/terminology-store.js",
  ],
  // delete AppState.terminology.(list|filtered)[i]
  [
    /delete\s+AppState\.terminology\.(list|filtered)\[/,
    "delete AppState.terminology.<字段>[i]",
    "core/terminology-store.js",
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

  const lines = readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    // 跳过注释行（简化：以 // 或 * 开头的行）
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

    for (const [re, desc, owner] of GUARDED_PATTERNS) {
      // Owner 文件本身允许写入其守护的模式
      if (rel === owner) continue;
      if (re.test(line)) {
        violations.push({ file: rel, line: idx + 1, desc, owner, text: trimmed });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("❌ 状态所有权检查失败：检测到绕过 Owner Store 的直接写入\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.desc}]`);
    console.error(`      ${v.text}`);
    console.error(`      Owner: public/app/${v.owner}\n`);
  }
  console.error(
    "请改用对应 Owner Store 的意图式 API：\n" +
      "  - project / fileMetadata / translations.items → ProjectStore\n" +
      "    （loadProject / createProject / clearProject / setFileMetadata /\n" +
      "     patchFileMetadata / removeFileMetadata / replaceFileItems 等）\n" +
      "  - terminology 切片 → TerminologyStore\n" +
      "    （loadTerminology / mergeTerms / addTerm / updateTerm / removeTerm /\n" +
      "     clearTerminology / setPage / applyFilter / resetFilter 等）"
  );
  process.exit(1);
}

console.log("✅ 状态所有权检查通过：无绕过 Owner Store 的直接写入");
