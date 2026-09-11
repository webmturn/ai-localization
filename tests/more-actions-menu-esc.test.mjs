/**
 * 「更多」下拉菜单的键盘可达性（jsdom 行为 / 集成测试）
 *
 * 背景：工具栏改版后，翻译引擎下拉被移入「更多」菜单——菜单从「两个清除操作」
 * 升级为主控制面。原实现只支持「点外部关闭」，键盘用户按 Esc 无法退出。
 *
 * 关键集成事实：全局快捷键监听注册在 **window 捕获阶段**（keyboard.js 的
 * listenerOptions: true），命中快捷键后 stopImmediatePropagation——因此任何
 * document 级 keydown 监听在默认快捷键生效时都收不到 Esc，Esc 必须走
 * escape 动作。本测试同时覆盖两条路径：
 *   A. 默认快捷键生效 → 走 keyboard.js 的 escape 动作（真实用户路径）
 *   B. 快捷键被解绑 / 键盘模块未加载 → 走 document 级监听（回退路径）
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

const MODAL = `<div id="fakeModal" class="fixed inset-0 bg-black bg-opacity-50">模态框</div>`;

const MARKUP = `
  <div class="relative">
    <button id="moreActionsBtn" type="button" aria-haspopup="true" aria-expanded="false">更多</button>
    <div id="moreActionsMenu" class="hidden">
      <select id="toolbarEngineCategoryFilter"><option>AI</option><option>传统</option></select>
      <select id="translationEngine"><option>DeepSeek</option><option>OpenAI</option></select>
      <button id="clearSelectedTargetBtn" type="button">清除译文</button>
      <button id="clearAllSampleData" type="button">清除示例</button>
    </div>
  </div>
  <button id="outsideBtn" type="button">外部</button>
  ${MODAL}
`;

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

// event-manager/keyboard 以顶层 const/IIFE 形式加载，同一 vm 上下文只能加载一次
setupGlobals();
loadSource("public/app/core/event-manager.js");
loadSource("public/app/ui/event-listeners/keyboard.js");
loadSource("public/app/ui/event-listeners/data-management.js");

function bootMenu({ withKeyboard }) {
  window.EventManager.removeAll(); // 每个用例从干净的监听器表开始
  document.body.innerHTML = MARKUP;
  document.getElementById("fakeModal").classList.add("hidden");
  window.__closeModalCalls = 0;
  window.closeModal = () => {
    window.__closeModalCalls++;
    document.getElementById("fakeModal").classList.add("hidden");
  };
  globalThis.DOMCache = {
    get: (id) => document.getElementById(id),
    queryAll: (sel) => Array.from(document.querySelectorAll(sel)),
  };
  window.App = window.App || {};
  window.registerEventListenersDataManagement({});
  if (withKeyboard) window.registerEventListenersKeyboard({});
  return {
    btn: document.getElementById("moreActionsBtn"),
    menu: document.getElementById("moreActionsMenu"),
  };
}

const isOpen = (menu) => !menu.classList.contains("hidden");

/** 模拟真实按键：事件从 body 冒泡到 window（全局快捷键在 window 捕获阶段） */
const pressEscape = () =>
  document.body.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
  );

describe("「更多」菜单：Esc 关闭（默认快捷键路径，window 捕获）", () => {
  let btn, menu;

  beforeEach(async () => {
    ({ btn, menu } = bootMenu({ withKeyboard: true }));
    btn.click();
    await tick();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("点击按钮后菜单打开且 aria-expanded=true", () => {
    expect(isOpen(menu)).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("Esc 关闭菜单并把 aria-expanded 复位（全局快捷键 stopImmediatePropagation 后仍生效）", () => {
    pressEscape();
    expect(isOpen(menu)).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(btn); // 键盘关闭后焦点回到触发按钮
  });

  it("Esc 事件被全局快捷键消费（不入 document），说明测试走的是真实路径", () => {
    let seen = 0;
    document.addEventListener("keydown", () => { seen++; });
    pressEscape();
    expect(seen).toBe(0);
  });

  it("关闭后再次打开，Esc 仍然有效（动作每次都能拿到最新菜单状态）", async () => {
    pressEscape();
    btn.click();
    await tick();
    expect(isOpen(menu)).toBe(true);
    pressEscape();
    expect(isOpen(menu)).toBe(false);
  });

  it("有可见模态框时，Esc 仍然优先关模态框、不动菜单", () => {
    document.getElementById("fakeModal").classList.remove("hidden");
    pressEscape();
    expect(window.__closeModalCalls).toBe(1);
    expect(isOpen(menu)).toBe(true);
  });

  it("菜单未打开时按 Esc 不会误改状态", () => {
    pressEscape();
    pressEscape();
    expect(isOpen(menu)).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(window.__closeModalCalls).toBe(0);
  });

  it("菜单内点击下拉（引擎选择）不会关闭菜单", () => {
    document.getElementById("translationEngine").click();
    expect(isOpen(menu)).toBe(true);
  });

  it("菜单项按钮点击后自动收起（原有行为保留）", () => {
    document.getElementById("clearSelectedTargetBtn").click();
    expect(isOpen(menu)).toBe(false);
  });

  it("点击菜单外部仍然关闭", () => {
    document.getElementById("outsideBtn").click();
    expect(isOpen(menu)).toBe(false);
  });

  it("监听器不泄漏：反复开关后 moreActions 作用域的监听器归零", async () => {
    for (let i = 0; i < 5; i++) {
      pressEscape();
      await tick();
      btn.click();
      await tick();
    }
    pressEscape();
    await tick();
    expect(isOpen(menu)).toBe(false);
    const keydownCount = window.EventManager.listeners.filter(
      (l) => l.event === "keydown" && l.scope === "moreActions"
    ).length;
    expect(keydownCount).toBe(0);
    const clickCount = window.EventManager.listeners.filter(
      (l) => l.event === "click" && l.scope === "moreActions" && l.target === document
    ).length;
    expect(clickCount).toBe(0);
  });
});

describe("「更多」菜单：Esc 关闭（回退路径，快捷键未注册）", () => {
  let btn, menu;

  beforeEach(async () => {
    ({ btn, menu } = bootMenu({ withKeyboard: false }));
    btn.click();
    await tick();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("没有全局快捷键时，document 级监听仍然能关掉菜单", () => {
    let seen = 0;
    document.addEventListener("keydown", () => { seen++; });
    pressEscape();
    expect(seen).toBe(1);
    expect(isOpen(menu)).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});
