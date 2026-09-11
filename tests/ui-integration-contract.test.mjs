/**
 * UI 整合/可访问性修复的「合约测试」
 *
 * 这些是标记与接线层面的约定（无法用纯逻辑单测覆盖），因此像
 * ui-controller-binding.test.mjs 一样做源码级断言，防止后续改动悄悄回退。
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(resolve(ROOT, p), "utf8");

let html, dataAndUI, qualityUI, settingsJS, chartsJS, progressJS, notificationJS, filePanels;

beforeAll(() => {
  html = read("public/index.html");
  dataAndUI = read("public/app/ui/event-listeners/data-and-ui.js");
  qualityUI = read("public/app/features/quality/ui.js");
  settingsJS = read("public/app/ui/settings.js");
  chartsJS = read("public/app/features/quality/charts.js");
  progressJS = read("public/app/features/translations/progress.js");
  notificationJS = read("public/app/ui/notification.js");
  filePanels = read("public/app/ui/event-listeners/file-panels.js");
});

describe("进度模态框：关闭与取消分离", () => {
  it("右上角 × 是通用关闭按钮（.close-modal），不再是取消翻译", () => {
    const xBtn = html.match(/<button[^>]*title="关闭"[^>]*>\s*<i class="fa-solid fa-xmark">/);
    expect(xBtn).toBeTruthy();
    expect(xBtn[0]).toContain("close-modal");
    expect(xBtn[0]).not.toContain("cancelTranslationBtn");
  });

  it("模态框内提供显式的「取消翻译」按钮（沿用原 id，绑定与状态逻辑不变）", () => {
    const cancelBtn = html.match(/<button id="cancelTranslationBtn"[^>]*>([\s\S]*?)<\/button>/);
    expect(cancelBtn).toBeTruthy();
    expect(cancelBtn[1]).toContain("取消");
    expect(cancelBtn[0]).toContain('type="button"');
    // 仍由 file-panels 绑定到 cancelTranslation
    expect(filePanels).toContain('EventManager.add(cancelTranslationBtn, "click", cancelTranslation');
  });
});

describe("手机端：全部翻译有入口", () => {
  it("更多操作菜单里存在 mobileTranslateAllBtn 并接到 translateAll", () => {
    expect(html).toContain('id="mobileTranslateAllBtn"');
    expect(dataAndUI).toMatch(/mobileTranslateAllBtn:\s*\(\)\s*=>\s*\{[\s\S]{0,120}translateAll/);
  });
});

describe("不再存在无功能的筛选按钮", () => {
  it("filterSourceBtn / filterTargetBtn 已移除", () => {
    expect(html).not.toContain("filterSourceBtn");
    expect(html).not.toContain("filterTargetBtn");
  });
});

describe("质量报告标签页徽章与面板同源", () => {
  it("qualityIssueBadge 会被更新并随有无问题切换 hidden", () => {
    expect(qualityUI).toContain('DOMCache.get("qualityIssueBadge")');
    expect(qualityUI).toMatch(/tabBadge\.classList\.toggle\("hidden"/);
  });
});

describe("深色模式载体在 <html> 上", () => {
  it("settings.js 同时写 documentElement 与 body", () => {
    expect(settingsJS).toMatch(/document\.documentElement/);
    expect(settingsJS).toMatch(/classList\.toggle\("dark-mode"/);
  });
  it("charts.js 的深色判断不再只看 body", () => {
    expect(chartsJS).toMatch(/documentElement\.classList\.contains\("dark-mode"\)/);
  });
});

describe("进度条具备可访问性语义", () => {
  it("两处进度条都有 role=progressbar 与 aria-valuenow", () => {
    const bars = html.match(/id="(?:inline)?[pP]rogressBar"[^>]*>/g) || [];
    expect(bars.length).toBeGreaterThanOrEqual(2);
    for (const b of bars) {
      expect(b).toContain('role="progressbar"');
      expect(b).toContain("aria-valuenow");
    }
  });
  it("progress.js 在更新宽度时同步 aria-valuenow", () => {
    expect(progressJS).toMatch(/setAttribute\("aria-valuenow"/);
  });
});

describe("不可见但可聚焦的两处已修", () => {
  it("侧栏抽屉在窄屏隐藏时加 inert/aria-hidden", () => {
    expect(dataAndUI).toContain("syncSidebarA11y");
    expect(dataAndUI).toMatch(/setAttribute\("inert"/);
    expect(dataAndUI).toMatch(/setAttribute\("aria-hidden", "true"\)/);
  });
  it("通知滑出后设为 visibility:hidden", () => {
    expect(notificationJS).toMatch(/notification\.style\.visibility\s*=\s*"hidden"/);
  });
  it("用户触发的对话框改用 openModal（焦点陷阱）", () => {
    expect(filePanels).toContain('openModal("newProjectModal")');
    expect(filePanels).toContain('openModal("exportModal")');
  });
});

describe("嵌套对话框与状态播报（a11y 收尾）", () => {
  it("关闭子对话框后把焦点陷阱交还父级（三条关闭路径都覆盖）", () => {
    const ui = read("public/app/features/translations/export/ui.js");
    expect(ui).toContain("function __restoreTrapToTopmostModal");
    const wired = ui.match(/__restoreTrapToTopmostModal\(\)\) __restoreModalFocus\(\)/g) || [];
    expect(wired.length).toBe(3);
  });

  it("进度状态文本是可播报的 live region", () => {
    for (const id of ["progressStatus", "inlineProgressStatus"]) {
      const el = html.match(new RegExp(`<[a-z]+ id="${id}"[^>]*>`));
      expect(el).toBeTruthy();
      expect(el[0]).toContain('aria-live="polite"');
      expect(el[0]).toContain('role="status"');
    }
  });

  it("四个 Prompt 模板 textarea 都有可访问名", () => {
    for (const id of [
      "projectPromptTemplateGeneral",
      "projectPromptTemplateOpenAI",
      "projectPromptTemplateDeepSeek",
      "projectPromptTemplateAiBatch",
    ]) {
      const el = html.match(new RegExp(`<textarea id="${id}"[^>]*>`));
      expect(el).toBeTruthy();
      expect(el[0]).toContain("aria-label=");
    }
  });

  it("range 滑块补回了键盘焦点环", () => {
    const css = read("src/input.css");
    expect(css).toMatch(/input\[type="range"\]:focus-visible/);
  });

  it("index.html 中不再有未加 dark 变体的独立 text-gray-400", () => {
    const offenders = (html.match(/class="([^"]*)"/g) || []).filter((attr) =>
      attr
        .slice(7, -1)
        .split(/\s+/)
        .includes("text-gray-400")
    );
    expect(offenders).toEqual([]);
  });
});

describe("布局优化（右栏标签 / 列表行 / 模态宽度）", () => {
  it("右栏三个标签都有 aria-label（窄侧栏切纯图标后仍有可访问名）", () => {
    const tabs = html.match(/<button class="sidebar-tab[^"]*"[^>]*>/g) || [];
    expect(tabs.length).toBe(3);
    for (const t of tabs) {
      expect(t).toContain("data-tab=");
      expect(t).toMatch(/aria-label="[^"]+"/);
      expect(t).toMatch(/title="[^"]+"/);
    }
  });

  it("窄侧栏（<300px）切换纯图标模式的接线与样式都在", () => {
    expect(dataAndUI).toContain('classList.toggle("sidebar-narrow"');
    const css = read("src/input.css");
    expect(css).toMatch(/\.sidebar-narrow \.sidebar-tab span:not\(\.tab-badge\)\s*\{\s*display:\s*none/);
    expect(css).toMatch(/\.sidebar-tab span\s*\{[^}]*text-wrap:\s*balance/);
  });

  it("列表行的次要信息合并为一行（语境 · ID）且可截断", () => {
    const render = read("public/app/features/translations/render.js");
    expect(render).toContain('metaParts.join(" · ")');
    expect(render).toMatch(/truncate/);
    // 旧实现里 ID 是独立段落，用的是浅灰 text-gray-400
    expect(render).not.toMatch(/text-xs text-gray-400 dark:text-gray-500 mt-1 break-words/);
  });

  it("模态宽度收敛：列表类统一 3xl、报告类统一 5xl", () => {
    const widthOf = (id) => {
      const lines = html.split("\n");
      const i = lines.findIndex((l) => l.includes(`id="${id}"`) && /role="dialog"/.test(l));
      for (let j = i; j <= i + 4 && j < lines.length; j++) {
        const m = lines[j].match(/max-w-[a-z0-9[\]().,%-]+/);
        if (m) return m[0];
      }
      return null;
    };
    expect(widthOf("projectManagerModal")).toBe("max-w-3xl");
    expect(widthOf("terminologyModal")).toBe("max-w-3xl");
    expect(widthOf("qualityReportModal")).toBe("max-w-5xl");
    expect(widthOf("aiConversationViewerModal")).toBe("max-w-5xl");
  });

  it("设置页数字输入不再通栏（定宽 + 单位写在标签里）", () => {
    const el = html.match(/<input type="number" id="autosaveIntervalSeconds"[^>]*>/);
    expect(el).toBeTruthy();
    expect(el[0]).toContain("w-28");
    expect(el[0]).not.toContain("w-full");
  });
});

describe("样式一致性/对比度修复", () => {
  it("术语导出按钮使用品牌主按钮样式（不再是非标 green-600）", () => {
    const btn = html.match(/<button id="exportTerminologyBtn"[^>]*>/);
    expect(btn).toBeTruthy();
    expect(btn[0]).toContain("btn-brand");
    expect(btn[0]).not.toContain("bg-green-600");
  });
  it("清理缓存按钮在深色下有红色边框语义", () => {
    const btn = html.match(/<button id="clearCacheBtn"[^>]*>/);
    expect(btn).toBeTruthy();
    expect(btn[0]).toContain("dark:border-red-800");
  });
  it("空状态引导文案不再使用 gray-400 小字", () => {
    expect(html).not.toContain("text-xs text-gray-400 dark:text-gray-500 text-center");
  });
});
