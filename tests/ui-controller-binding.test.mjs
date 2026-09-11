/**
 * 复核：ui-controller.js 的按钮绑定——HEAD 与当前对照
 *
 * HEAD 查的是无后缀 id（translateSelected 等），真实 DOM 里这些按钮的 id 都带 Btn 后缀，
 * 因此这 4 个绑定在 HEAD 下永远取不到元素（静默失效）。
 * 本用例验证：当前版本能真正绑上这 4 个按钮。
 */
import { describe, it, expect, beforeAll } from "vitest";
import vm from "vm";
import fs from "fs";
import { execSync } from "child_process";

const FILE = "public/app/features/translations/ui-controller.js";
// 基线钉死到修复前提交：此前用 `git show HEAD:`，而修复已提交，
// 于是两个分支加载同一份源码，对照失去意义（详见 keyboard-editing-guard 的说明）。
const BASELINE_REF = "bde5937";
const IDS = ["translateSelectedBtn", "translateAllBtn", "cancelTranslationBtn", "pauseTranslationBtn"];

function loadController(version) {
  let src;
  if (version === "HEAD") {
    try {
      src = execSync(`git show ${BASELINE_REF}:${FILE}`, { encoding: "utf8", maxBuffer: 1 << 24 });
    } catch (e) {
      console.warn(`[ui-controller-binding] 基线 ${BASELINE_REF} 不可用，跳过对照：${e.message.split("\n")[0]}`);
      return null;
    }
  } else {
    src = fs.readFileSync(FILE, "utf8");
  }

  const added = [];
  const sandbox = {
    console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
  };
  sandbox.window = sandbox;
  sandbox.document = globalThis.document;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;

  vm.createContext(sandbox);
  vm.runInContext(
    `globalThis.loggers = new Proxy({}, { get: () => ({ log(){},warn(){},error(){},debug(){},info(){} }) });
     globalThis.AppState = { translations: {}, project: {} };
     globalThis.showNotification = function(){};
     globalThis.BatchProgressStore = { isBatchInProgress(){ return false; } };
     globalThis.DOMCache = {
       get(k){ return globalThis.document.getElementById(k) || null; },
       queryAll(){ return []; }, clear(){},
     };
     globalThis.__added = [];
     globalThis.EventManager = {
       add(target, ev, fn, meta){ globalThis.__added.push({ id: target && target.id, ev, meta }); return fn; },
       remove(){}, removeById(){}, removeAll(){},
     };
     globalThis.SettingsCache = { get(){ return {}; }, save(){}, invalidate(){} };`,
    sandbox
  );
  vm.runInContext(src, sandbox, { filename: `${version}:${FILE}` });

  // 建出真实 id 的按钮
  IDS.forEach((id) => {
    if (!document.getElementById(id)) {
      const b = document.createElement("button");
      b.id = id;
      document.body.appendChild(b);
    }
  });

  // 直接调 bindTranslationControls（构造函数还有别的依赖）
  const Ctor = vm.runInContext("TranslationUIController", sandbox);
  const inst = Object.create(Ctor.prototype);
  inst.eventManager = sandbox.EventManager;
  inst.dependencies = {};
  inst.bindTranslationControls();
  return vm.runInContext("globalThis.__added", sandbox);
}

describe("ui-controller 按钮绑定（复核后：有意不重复绑定）", () => {
  it("当前版本不绑定按钮——避免与 file-panels.js 双重触发", () => {
    const added = loadController("CUR");
    console.log("CUR bound:", JSON.stringify(added.map((a) => a.id)));
    expect(added).toHaveLength(0);
  });

  it("修复前基线也不绑定（因为 id 写错取不到元素）", () => {
    const added = loadController("HEAD");
    if (added === null) return; // 浅克隆等场景取不到基线：跳过对照
    console.log("BASELINE bound:", JSON.stringify(added.map((a) => a.id)));
    expect(added).toHaveLength(0);
  });

  it("file-panels.js 是这 4 个按钮的唯一绑定方", () => {
    const src = fs.readFileSync("public/app/ui/event-listeners/file-panels.js", "utf8");
    for (const id of IDS) expect(src).toContain(id);

    // ui-controller 中不应再出现对这 4 个按钮的 click 绑定。
    // 关键：先剥掉注释再匹配 —— 文件里为了说明原因，注释中正好引用了
    // `EventManager.add(translateSelectedBtn, "click", …)` 这一形式，
    // 直接在原文上 grep 会被注释命中（这正是我上一次断言失败的原因）。
    const ucRaw = fs.readFileSync(FILE, "utf8");
    const uc = ucRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(uc).not.toMatch(/\.add\(\s*(translateSelectedBtn|translateAllBtn|cancelBtn|pauseBtn)\s*,\s*["']click["']/);
    // 变量名本身仍用于状态更新（disabled/display），这是允许的
    expect(uc).toContain("translateSelectedBtn");
    expect(uc).toMatch(/bindTranslationControls\(\)\s*\{/);
  });

  it("updateTranslationControlState 仍会用正确的 id 更新按钮状态", () => {
    const sandbox = { console: { log() {}, warn() {}, error() {}, debug() {} } };
    sandbox.window = sandbox;
    sandbox.document = globalThis.document;
    vm.createContext(sandbox);
    vm.runInContext(
      `globalThis.loggers = new Proxy({}, { get: () => ({ log(){},warn(){},error(){},debug(){} }) });
       globalThis.AppState = { translations: {} };
       globalThis.showNotification = function(){};
       globalThis.DOMCache = { get(k){ return globalThis.document.getElementById(k) || null; }, queryAll(){ return []; } };
       globalThis.EventManager = { add(){}, remove(){}, removeById(){} };`,
      sandbox
    );
    vm.runInContext(fs.readFileSync(FILE, "utf8"), sandbox);
    IDS.forEach((id) => {
      if (!document.getElementById(id)) {
        const b = document.createElement("button");
        b.id = id;
        document.body.appendChild(b);
      }
    });
    const Ctor = vm.runInContext("TranslationUIController", sandbox);
    const inst = Object.create(Ctor.prototype);
    inst.eventManager = null;
    inst.updateTranslationControlState(true);
    expect(document.getElementById("translateSelectedBtn").disabled).toBe(true);
    expect(document.getElementById("translateAllBtn").disabled).toBe(true);
    expect(document.getElementById("cancelTranslationBtn").style.display).toBe("block");
    expect(document.getElementById("pauseTranslationBtn").style.display).toBe("block");
  });
});
