/**
 * 查找条（按需展开的搜索）行为测试
 *
 * 背景：工具栏改版为「搜索按需展开」——搜索框不常驻，点工具栏「搜索」或按 Ctrl+F
 * 才展开成一条查找条，Esc / ✕ 收起。关键集成事实：全局快捷键注册在 window 捕获阶段
 * 并对命中项 stopImmediatePropagation，因此 Ctrl+F / Esc 必须走 keyboard.js 的动作表
 * （App.ui.openTranslationFindBar / closeTranslationFindBar），而不是自己加 document 监听。
 *
 * 覆盖：开合与 aria、焦点、筛选生效与清空、Ctrl+F 展开、Esc 收起、移动端守卫、监听器不泄漏
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";
import fs from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const MARKUP = `
  <div id="toolbarHost">
    <button id="toggleTranslationSearchBtn" type="button" aria-expanded="false" aria-controls="translationFindBar">搜索</button>
    <button id="openFindReplaceBtn" type="button">查找替换</button>
    <div id="moreActionsMenu" class="hidden"></div>
    <button id="moreActionsBtn" type="button" aria-expanded="false">更多</button>
  </div>
  <div id="translationFindBar" class="hidden max-md:hidden flex-shrink-0 items-center gap-3">
    <div class="relative flex-1 min-w-48 max-w-md">
      <input type="text" id="translationSearchInput" aria-label="搜索翻译项">
      <button id="clearTranslationSearch" class="hidden" aria-label="清除搜索"></button>
    </div>
    <span id="translationSearchStats" class="hidden">找到 <span id="translationSearchCount">0</span> 个结果</span>
    <button id="closeTranslationSearchBtn" type="button" aria-label="关闭搜索"></button>
  </div>
  <div class="md:hidden">
    <input type="text" id="translationSearchInputMobile" aria-label="搜索翻译项">
    <button id="clearTranslationSearchMobile" class="hidden" aria-label="清除搜索"></button>
  </div>
`;

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/* ---- 环境（模块级加载一次，避免重复声明顶层 const） ---- */
setupGlobals();
window.App = window.App || {};
globalThis.debounce = (fn) => fn; // 测试里同步执行，去掉 300ms 抖动
globalThis.isMobileViewport = () => false;
globalThis.__searchLog = [];
globalThis.TranslationViewStore = {
  setSearchQuery: (q) => globalThis.__searchLog.push("query:" + q),
  setPage: (p) => globalThis.__searchLog.push("page:" + p),
};
globalThis.applySearchFilter = () => {
  const q = (globalThis.TranslationViewStore.__lastQuery || "").trim();
  globalThis.AppState.translations.filtered = globalThis.__allItems.filter(
    (it) => !q || it.includes(q)
  );
};
// 让 applySearchFilter 能读到查询词
const _origSet = globalThis.TranslationViewStore.setSearchQuery;
globalThis.TranslationViewStore.setSearchQuery = (q) => {
  globalThis.TranslationViewStore.__lastQuery = q;
  return _origSet(q);
};
globalThis.updateTranslationLists = () => globalThis.__searchLog.push("lists");
globalThis.updateCounters = () => globalThis.__searchLog.push("counters");

loadSource("public/app/core/event-manager.js");
loadSource("public/app/ui/event-listeners/keyboard.js");
loadSource("public/app/ui/event-listeners/translations-search.js");

function boot({ mobile = false } = {}) {
  window.EventManager.removeAll();
  document.body.innerHTML = MARKUP;
  globalThis.__searchLog = [];
  globalThis.__allItems = ["login page", "welcome message", "login failed"];
  globalThis.AppState = {
    translations: { filtered: [...globalThis.__allItems], multiSelected: [] },
  };
  globalThis.isMobileViewport = () => mobile;
  globalThis.TranslationViewStore.__lastQuery = "";
  globalThis.DOMCache = {
    get: (id) => document.getElementById(id),
    queryAll: (sel) => Array.from(document.querySelectorAll(sel)),
  };
  window.closeModal = () => {};
  window.clearMultiSelection = () => {};

  const ctx = [
    "translationSearchInput", "translationSearchInputMobile",
    "clearTranslationSearch", "clearTranslationSearchMobile",
    "translationSearchStats", "translationSearchCount",
    "translationFindBar", "toggleTranslationSearchBtn", "closeTranslationSearchBtn",
  ].reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});

  window.registerEventListenersTranslationSearch(ctx);
  window.registerEventListenersKeyboard({});
  return {
    bar: document.getElementById("translationFindBar"),
    toggle: document.getElementById("toggleTranslationSearchBtn"),
    input: document.getElementById("translationSearchInput"),
    inputMobile: document.getElementById("translationSearchInputMobile"),
    stats: document.getElementById("translationSearchStats"),
    closeBtn: document.getElementById("closeTranslationSearchBtn"),
  };
}

const isOpen = (bar) => !bar.classList.contains("hidden");
const press = (init) =>
  document.body.dispatchEvent(
    new window.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })
  );
const pressCtrlF = () => press({ key: "f", ctrlKey: true });
const pressEscape = () => press({ key: "Escape" });

describe("查找条：默认收起与开合", () => {
  let ui;
  beforeEach(() => { ui = boot(); });
  afterEach(() => { document.body.innerHTML = ""; });

  it("默认收起：bar 带 hidden、切换按钮 aria-expanded=false", () => {
    expect(isOpen(ui.bar)).toBe(false);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("点「搜索」展开并聚焦输入框（aria-expanded=true）", () => {
    ui.toggle.click();
    expect(isOpen(ui.bar)).toBe(true);
    expect(ui.bar.classList.contains("flex")).toBe(true);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(ui.input);
  });

  it("再点一次收起，并把焦点还给切换按钮", () => {
    ui.toggle.click();
    ui.toggle.click();
    expect(isOpen(ui.bar)).toBe(false);
    expect(ui.bar.classList.contains("flex")).toBe(false);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ui.toggle);
  });

  it("✕ 关闭同样回收焦点", () => {
    ui.toggle.click();
    ui.closeBtn.click();
    expect(isOpen(ui.bar)).toBe(false);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ui.toggle);
  });
});

describe("查找条：筛选生效与关闭即清空", () => {
  let ui;
  beforeEach(() => { ui = boot(); });
  afterEach(() => { document.body.innerHTML = ""; });

  it("输入关键词会过滤列表、显示结果数", () => {
    ui.toggle.click();
    ui.input.value = "login";
    ui.input.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(globalThis.TranslationViewStore.__lastQuery).toBe("login");
    expect(globalThis.AppState.translations.filtered.length).toBe(2);
    expect(ui.stats.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("translationSearchCount").textContent).toBe("2");
    expect(ui.inputMobile.value).toBe("login"); // 同步到移动端输入框
  });

  it("关闭查找条会清空筛选并隐藏统计（不留下看不见的过滤）", () => {
    ui.toggle.click();
    ui.input.value = "login";
    ui.input.dispatchEvent(new window.Event("input", { bubbles: true }));
    ui.closeBtn.click();
    expect(globalThis.TranslationViewStore.__lastQuery).toBe("");
    expect(globalThis.AppState.translations.filtered.length).toBe(3);
    expect(ui.input.value).toBe("");
    expect(ui.inputMobile.value).toBe("");
    expect(ui.stats.classList.contains("hidden")).toBe(true);
  });
});

describe("查找条：键盘路径（window 捕获的全局快捷键）", () => {
  let ui;
  beforeEach(() => { ui = boot(); });
  afterEach(() => { document.body.innerHTML = ""; });

  it("Ctrl+F 展开查找条并聚焦（不需要先点按钮）", () => {
    expect(isOpen(ui.bar)).toBe(false);
    pressCtrlF();
    expect(isOpen(ui.bar)).toBe(true);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(ui.input);
  });

  it("Esc 收起查找条、清空筛选并把焦点还给切换按钮", () => {
    pressCtrlF();
    ui.input.value = "login";
    ui.input.dispatchEvent(new window.Event("input", { bubbles: true }));
    pressEscape();
    expect(isOpen(ui.bar)).toBe(false);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("false");
    expect(globalThis.TranslationViewStore.__lastQuery).toBe("");
    expect(document.activeElement).toBe(ui.toggle);
  });

  it("查找条未展开时按 Esc 不会误改状态", () => {
    pressEscape();
    expect(isOpen(ui.bar)).toBe(false);
    expect(ui.toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("Esc 事件确实被全局快捷键在 window 捕获阶段消费（证明走的是真实路径）", () => {
    pressCtrlF();
    let seen = 0;
    document.addEventListener("keydown", () => { seen++; });
    pressEscape();
    expect(seen).toBe(0);
    expect(isOpen(ui.bar)).toBe(false);
  });

  it("反复开关不会让监听器数量增长", async () => {
    const count = () =>
      window.EventManager.listeners.filter((l) => l.scope === "translationSearch").length;
    pressCtrlF();
    await tick();
    const baseline = count();
    for (let i = 0; i < 5; i++) {
      pressEscape();
      pressCtrlF();
    }
    expect(count()).toBe(baseline);
  });
});

describe("查找条：移动端守卫", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("移动端 Ctrl+F 不展开桌面查找条，只聚焦移动端输入框", () => {
    const ui = boot({ mobile: true });
    pressCtrlF();
    expect(isOpen(ui.bar)).toBe(false);
    expect(document.activeElement).toBe(ui.inputMobile);
  });
});

describe("查找条：真实标记的合约（防止样式/属性回退）", () => {
  const html = fs.readFileSync(resolve(ROOT, "public/index.html"), "utf8");

  it("查找条默认 hidden 且在 <md 永远不显示、可被 JS 切成 flex", () => {
    const bar = html.match(/<div id="translationFindBar"[^>]*class="([^"]+)"/);
    expect(bar).toBeTruthy();
    expect(bar[1]).toContain("hidden");
    expect(bar[1]).toContain("max-md:hidden");
  });

  it("切换按钮带 aria-expanded / aria-controls，并在展开时被 JS 同步", () => {
    const btn = html.match(/<button id="toggleTranslationSearchBtn"[^>]*>/);
    expect(btn).toBeTruthy();
    expect(btn[0]).toContain('aria-expanded="false"');
    expect(btn[0]).toContain('aria-controls="translationFindBar"');
  });

  it("搜索输入仍在工具栏之外（不常驻），移动端搜索输入保留", () => {
    expect(html).toContain('id="translationSearchInputMobile"');
    const barIdx = html.indexOf('id="translationFindBar"');
    const inputIdx = html.indexOf('id="translationSearchInput"');
    expect(barIdx).toBeGreaterThan(0);
    expect(inputIdx).toBeGreaterThan(barIdx); // 输入框在查找条内，紧随其后
  });
});
