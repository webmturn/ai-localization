#!/usr/bin/env node
/**
 * Font Awesome v4.7 → v6 图标类名迁移脚本
 * 将 "fa fa-xxx" 替换为 "fa-solid fa-xxx" 或 "fa-regular fa-xxx"
 * 
 * 用法: node scripts/migrate-fa-v6.mjs [--dry-run]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const dryRun = process.argv.includes("--dry-run");

// v4 → v6 图标映射（v4 icon-name → { style, name }）
// -o 后缀图标 → fa-regular；其余 → fa-solid
// 名称变更参考 https://fontawesome.com/docs/web/setup/upgrade/whats-changed#icons-renamed-in-version-6
const ICON_MAP = {
  // 无更名（fa-solid）
  "ban":                  { style: "fa-solid", name: "fa-ban" },
  "bolt":                 { style: "fa-solid", name: "fa-bolt" },
  "book":                 { style: "fa-solid", name: "fa-book" },
  "code":                 { style: "fa-solid", name: "fa-code" },
  "database":             { style: "fa-solid", name: "fa-database" },
  "download":             { style: "fa-solid", name: "fa-download" },
  "eraser":               { style: "fa-solid", name: "fa-eraser" },
  "eye":                  { style: "fa-solid", name: "fa-eye" },
  "filter":               { style: "fa-solid", name: "fa-filter" },
  "hashtag":              { style: "fa-solid", name: "fa-hashtag" },
  "key":                  { style: "fa-solid", name: "fa-key" },
  "language":             { style: "fa-solid", name: "fa-language" },
  "pause":                { style: "fa-solid", name: "fa-pause" },
  "pencil":               { style: "fa-solid", name: "fa-pencil" },
  "play":                 { style: "fa-solid", name: "fa-play" },
  "plus":                 { style: "fa-solid", name: "fa-plus" },
  "repeat":               { style: "fa-solid", name: "fa-repeat" },
  "rocket":               { style: "fa-solid", name: "fa-rocket" },
  "sliders":              { style: "fa-solid", name: "fa-sliders" },
  "spinner":              { style: "fa-solid", name: "fa-spinner" },
  "star":                 { style: "fa-solid", name: "fa-star" },
  "text-width":           { style: "fa-solid", name: "fa-text-width" },
  "trash":                { style: "fa-solid", name: "fa-trash" },
  "upload":               { style: "fa-solid", name: "fa-upload" },
  "user":                 { style: "fa-solid", name: "fa-user" },
  "folder-open":          { style: "fa-solid", name: "fa-folder-open" },
  "chevron-left":         { style: "fa-solid", name: "fa-chevron-left" },
  "chevron-right":        { style: "fa-solid", name: "fa-chevron-right" },

  // 已更名（fa-solid）
  "check-circle":         { style: "fa-solid", name: "fa-circle-check" },
  "cloud-upload":         { style: "fa-solid", name: "fa-cloud-arrow-up" },
  "cog":                  { style: "fa-solid", name: "fa-gear" },
  "ellipsis-v":           { style: "fa-solid", name: "fa-ellipsis-vertical" },
  "exchange":             { style: "fa-solid", name: "fa-arrow-right-arrow-left" },
  "exclamation-triangle": { style: "fa-solid", name: "fa-triangle-exclamation" },
  "file-text":            { style: "fa-solid", name: "fa-file-lines" },
  "info-circle":          { style: "fa-solid", name: "fa-circle-info" },
  "paint-brush":          { style: "fa-solid", name: "fa-paintbrush" },
  "question-circle":      { style: "fa-solid", name: "fa-circle-question" },
  "refresh":              { style: "fa-solid", name: "fa-arrows-rotate" },
  "save":                 { style: "fa-solid", name: "fa-floppy-disk" },
  "search":               { style: "fa-solid", name: "fa-magnifying-glass" },
  "th-large":             { style: "fa-solid", name: "fa-table-cells-large" },
  "times":                { style: "fa-solid", name: "fa-xmark" },
  "times-circle":         { style: "fa-solid", name: "fa-circle-xmark" },

  // -o 后缀 → fa-regular（已更名）
  "check-square-o":       { style: "fa-regular", name: "fa-square-check" },
  "commenting-o":         { style: "fa-regular", name: "fa-comment-dots" },
  "file-pdf-o":           { style: "fa-regular", name: "fa-file-pdf" },
  "keyboard-o":           { style: "fa-regular", name: "fa-keyboard" },
  "pencil-square-o":      { style: "fa-regular", name: "fa-pen-to-square" },
  "trash-o":              { style: "fa-regular", name: "fa-trash-can" },
  "folder-open-o":        { style: "fa-regular", name: "fa-folder-open" },
};

// 需要处理的文件
const TARGET_FILES = [
  "public/index.html",
  "public/app/features/quality/ui.js",
  "public/app/features/quality/run.js",
  "public/app/features/translations/export/terminology-import.js",
  "public/app/features/translations/export/terminology-list.js",
  "public/app/ui/file-tree.js",
];

let totalReplacements = 0;

for (const relPath of TARGET_FILES) {
  const filePath = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  跳过（不存在）: ${relPath}`);
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  let fileReplacements = 0;

  // 替换所有 "fa fa-xxx" 模式
  // 需要处理 class="... fa fa-xxx ..." 中的情况
  content = content.replace(/\bfa fa-([\w-]+)/g, (match, iconName) => {
    const mapping = ICON_MAP[iconName];
    if (!mapping) {
      console.log(`⚠️  未知图标: fa fa-${iconName} (${relPath})`);
      return match; // 保持不变
    }
    fileReplacements++;
    return `${mapping.style} ${mapping.name}`;
  });

  totalReplacements += fileReplacements;

  if (fileReplacements > 0) {
    if (dryRun) {
      console.log(`📝 [DRY-RUN] ${relPath}: ${fileReplacements} 处替换`);
    } else {
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`✅ ${relPath}: ${fileReplacements} 处已替换`);
    }
  } else {
    console.log(`⏭️  无变更: ${relPath}`);
  }
}

console.log(`\n📊 总计: ${totalReplacements} 处替换${dryRun ? "（DRY-RUN，未实际写入）" : ""}`);

if (!dryRun) {
  console.log("\n💡 下一步:");
  console.log("  1. 更新 cdn-versions.json 和下载 FA v6 文件");
  console.log("  2. 更新 index.html 中的 CSS 引用路径");
  console.log("  3. 运行 node scripts/build-bundle.js 重建 bundle");
}
