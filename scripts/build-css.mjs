#!/usr/bin/env node
/**
 * CSS 构建脚本（跨平台、不依赖 npm 可执行文件）
 *
 * 为什么单独抽出来：
 *  - `build-production.mjs` 需要在不依赖 `npm` 的环境里构建 CSS（本机 npm.ps1 被执行策略禁用，
 *    容器/CI 里也可能没有 npm 的 PATH），原来的 `execSync("npm run build-css")` 会直接失败并被静默降级。
 *  - 原来的 `postbuild-css` 补丁逻辑分散在 package.json 的一行 `node -e` 里，这里合并成单一实现。
 *
 * 用法：node scripts/build-css.mjs
 *      （`npm run build-css` 仍然可用，只是转调本脚本；`postbuild-css` 保留为幂等的重复补丁）
 */

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const TAILWIND_CLI = path.join(PROJECT_ROOT, "node_modules", "tailwindcss", "lib", "cli.js");
const INPUT = path.join(PROJECT_ROOT, "src", "input.css");
const OUTPUT = path.join(PROJECT_ROOT, "public", "styles.css");
const CONFIG = path.join(PROJECT_ROOT, "config", "tailwind.config.js");

/** 追加 text-size-adjust 标准属性（原本由 package.json 的 postbuild-css 完成，幂等） */
function applyTextSizeAdjust(cssPath) {
  let css = fs.readFileSync(cssPath, "utf-8");
  const before = css;
  css = css.replace(
    /-webkit-text-size-adjust\s*:\s*100%;(?!text-size-adjust)/g,
    "-webkit-text-size-adjust:100%;text-size-adjust:100%;"
  );
  if (css !== before) fs.writeFileSync(cssPath, css, "utf-8");
  return css !== before;
}

function buildCss() {
  if (!fs.existsSync(TAILWIND_CLI)) {
    throw new Error(
      "tailwindcss 未安装（缺少 node_modules/tailwindcss/lib/cli.js）；请先运行 npm ci"
    );
  }
  if (!fs.existsSync(INPUT)) {
    throw new Error(`找不到输入文件：${INPUT}`);
  }

  execFileSync(
    process.execPath,
    [TAILWIND_CLI, "-i", INPUT, "-o", OUTPUT, "--minify", "--config", CONFIG],
    { cwd: PROJECT_ROOT, stdio: "inherit" }
  );

  const patched = applyTextSizeAdjust(OUTPUT);
  const size = fs.statSync(OUTPUT).size;
  console.log(`✅ CSS 构建完成: public/styles.css (${(size / 1024).toFixed(1)} KB)${patched ? " [text-size-adjust 已补]" : ""}`);
  return size;
}

try {
  buildCss();
} catch (e) {
  console.error("❌ CSS 构建失败: " + (e && e.message ? e.message : e));
  process.exit(1);
}
