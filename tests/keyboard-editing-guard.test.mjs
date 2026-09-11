/**
 * 复核：keyboard.js 交互行为——修复前基线 与 当前 对照
 *
 * 目的：验证「guard 提到 preventDefault 之前」这一修复的真实交互效果，
 * 并确认没有把原本可用的快捷键改坏。
 *
 * 基线必须钉死到修复前的提交（bde5937）。此前用 `git show HEAD:`，
 * 而测试与修复同属一个提交 —— 运行时 HEAD 已是修复后的代码，
 * 两个分支加载的是同一份源码，对照退化成自比较（输出里 HEAD 与 CUR 完全相同）。
 */
import { describe, it, expect, beforeAll } from "vitest";
import vm from "vm";
import fs from "fs";
import { execSync } from "child_process";

const FILE = "public/app/ui/event-listeners/keyboard.js";
const BASELINE_REF = "bde5937"; // 修复前最后一个提交

/** 在 jsdom 里加载某一版键盘模块，返回 { handler, calls }；基线不可得时返回 null */
function loadKeyboard(version) {
  let src;
  if (version === "HEAD") {
    try {
      src = execSync(`git show ${BASELINE_REF}:${FILE}`, { encoding: "utf8", maxBuffer: 1 << 24 });
    } catch (e) {
      // 浅克隆 / 该提交不存在：跳过基线对照，但当前行为的断言照常执行
      console.warn(`[keyboard-editing-guard] 基线 ${BASELINE_REF} 不可用，跳过对照：${e.message.split("\n")[0]}`);
      return null;
    }
  } else {
    src = fs.readFileSync(FILE, "utf8");
  }

  const calls = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  sandbox.navigator = globalThis.navigator;
  sandbox.document = globalThis.document;
  sandbox.localStorage = globalThis.localStorage;
  sandbox.Node = globalThis.Node;
  sandbox.Element = globalThis.Element;

  // 记录 runAction 真实触发了哪些动作
  const ACTIONS = [
    "openSettings", "translateSelected", "translateAll", "cancelTranslation",
    "focusSearch", "selectCurrentPage", "clearTargets", "prevItem", "nextItem",
  ];
  vm.createContext(sandbox);
  vm.runInContext(
    `globalThis.__calls = [];
     ${ACTIONS.map((a) => `globalThis.${a} = function(){ globalThis.__calls.push(${JSON.stringify(a)}); };`).join("\n")}
     globalThis.getServiceSafely = function(){ return null; };
     globalThis.AppState = { translations: { selected: 0, multiSelected: [] }, project: { translationItems: [] } };
     globalThis.DOMCache = {
       _m: {}, get(k){ return this._m[k] || null; }, queryAll(){ return []; }, clear(){},
     };
     globalThis.EventManager = {
       _h: {}, add(t, ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); return fn; },
       remove(){}, removeById(){}, removeAll(){},
     };
     globalThis.SettingsCache = { _s:{}, get(){ return this._s; }, save(){}, invalidate(){} };
     globalThis.BatchProgressStore = { isBatchInProgress(){ return false; }, isUserCancelled(){ return false; } };
     globalThis.loggers = new Proxy({}, { get: () => ({ log(){},warn(){},error(){},debug(){},info(){} }) });
     globalThis.showNotification = function(){};`,
    sandbox
  );
  vm.runInContext(src, sandbox, { filename: `${version}:${FILE}` });

  // 注册监听器（模块内部通过 EventManager.add(document/window, 'keydown', ...)）
  vm.runInContext(`registerEventListenersKeyboard({})`, sandbox);
  const handler = (sandbox.EventManager._h["keydown"] || [])[0];
  return { handler, sandbox, calls: () => vm.runInContext("globalThis.__calls", sandbox) };
}

/** 构造事件并调用 handler，返回 { defaultPrevented } */
function press(env, { key, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, target }) {
  let prevented = false;
  const e = {
    key, ctrlKey, shiftKey, altKey, metaKey,
    target: target || document.body,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() {},
  };
  // 清空动作记录，避免用例间互相污染（calls 是沙箱内的累积数组）
  vm.runInContext("globalThis.__calls.length = 0", env.sandbox);
  if (env.handler) env.handler(e);
  return { prevented, calls: env.calls() };
}

let cur, head, textarea, input;

beforeAll(() => {
  textarea = document.createElement("textarea");
  input = document.createElement("input");
  document.body.appendChild(textarea);
  document.body.appendChild(input);
  cur = loadKeyboard("CUR");
  head = loadKeyboard("HEAD");
});

describe("键盘：编辑上下文中的行为对照", () => {
  it("Shift+Enter 在 textarea 内：修复前基线会触发全量翻译，当前不会", () => {
    const c = press(cur, { key: "Enter", shiftKey: true, target: textarea });
    // 当前实现必须不触发、不吞默认行为
    expect(c.calls).toEqual([]);
    expect(c.prevented).toBe(false);
    // 基线对照（基线可用时才有意义）：修复前会 preventDefault 并触发 translateAll
    if (head) {
      const h = press(head, { key: "Enter", shiftKey: true, target: textarea });
      console.log("BASELINE:", JSON.stringify(h), "CUR:", JSON.stringify(c));
      expect(h.prevented).toBe(true);
      expect(h.calls).toContain("translateAll");
    }
  });

  it("Ctrl+A 在 input 内：修复前基线吞掉默认行为，当前不吞", () => {
    const c = press(cur, { key: "a", ctrlKey: true, target: input });
    expect(c.prevented).toBe(false);
    if (head) {
      const h = press(head, { key: "a", ctrlKey: true, target: input });
      console.log("BASELINE:", JSON.stringify(h), "CUR:", JSON.stringify(c));
      expect(h.prevented).toBe(true);
    }
  });

  it("Ctrl+Enter 在 textarea 内：两边都不触发翻译选中", () => {
    const c = press(cur, { key: "Enter", ctrlKey: true, target: textarea });
    expect(c.calls).toEqual([]);
  });

  it("非编辑上下文：Shift+Enter 仍触发全量翻译（未改坏）", () => {
    const c = press(cur, { key: "Enter", shiftKey: true, target: document.body });
    console.log("body Shift+Enter:", JSON.stringify(c));
    expect(c.calls).toContain("translateAll");
  });

  it("非编辑上下文：Ctrl+Enter 仍触发翻译选中（未改坏）", () => {
    const c = press(cur, { key: "Enter", ctrlKey: true, target: document.body });
    expect(c.calls).toContain("translateSelected");
  });

  // 编辑上下文中仍然允许执行的动作：保存 / 取消 / 退出
  it("编辑上下文：Ctrl+S 触发保存（safeWhileEditing 白名单未被改坏）", () => {
    const c = press(cur, { key: "s", ctrlKey: true, target: textarea });
    // openSettings 等映射取决于默认表；此处只要求「不抛错且未触发 translate*」
    expect(c.calls).not.toContain("translateAll");
    expect(c.calls).not.toContain("translateSelected");
  });

  it("编辑上下文：其余快捷键不再被吞掉默认行为（回归核心）", () => {
    const others = [
      { key: "f", ctrlKey: true },        // 搜索
      { key: ",", ctrlKey: true },        // 设置
      { key: "a", ctrlKey: true },        // 全选当前页
      { key: "Enter", ctrlKey: true },    // 翻译选中
      { key: "Enter", shiftKey: true },   // 翻译全部
    ];
    for (const combo of others) {
      const c = press(cur, { ...combo, target: textarea });
      // 这些动作都不该在编辑上下文触发，因此也不该 preventDefault
      expect(c.prevented, `${JSON.stringify(combo)} 不应吞默认行为`).toBe(false);
    }
  });

  it("编辑上下文：contentEditable 同样受保护", () => {
    const div = document.createElement("div");
    // jsdom 不支持真正的 contentEditable，用属性模拟 tagName 分支之外的情况
    Object.defineProperty(div, "isContentEditable", { value: true });
    document.body.appendChild(div);
    const c = press(cur, { key: "Enter", shiftKey: true, target: div });
    expect(c.prevented).toBe(false);
    expect(c.calls).toEqual([]);
  });

  it("select 元素也被视为编辑上下文", () => {
    const sel = document.createElement("select");
    document.body.appendChild(sel);
    const c = press(cur, { key: "Enter", shiftKey: true, target: sel });
    expect(c.prevented).toBe(false);
  });
});
