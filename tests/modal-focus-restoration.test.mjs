import {beforeEach, describe, expect, it} from "vitest";
import {readFileSync} from "node:fs";
import vm from "node:vm";

let ui;
beforeEach(() => {
  document.body.innerHTML = `
    <button id="preferences">偏好</button>
    <button id="sidebarEngine">自定义引擎</button>
    <div id="settingsModal" class="fixed inset-0 bg-black bg-opacity-50 hidden">
      <button id="settingsClose">关闭</button>
      <button id="settingsEngine">自定义引擎</button>
      <input id="draft" value="未保存的设置">
    </div>
    <div id="customEngineModal" class="fixed inset-0 bg-black bg-opacity-50 hidden">
      <button id="customClose">关闭</button>
    </div>`;
  ui = {document, requestAnimationFrame: (callback) => callback(),
    DOMCache: {get: (id) => document.getElementById(id),
      queryAll: (selector, root = document) => root.querySelectorAll(selector)},
    EventManager: {add: () => 1, removeById: () => {}},
    loggers: {app: {debug: () => {}}},
  };
  ui.window = ui;
  vm.createContext(ui);
  vm.runInContext(readFileSync("public/app/features/translations/export/ui.js", "utf8"), ui);
});

function openSettingsAndEngine() {
  document.getElementById("preferences").focus();
  ui.openModal("settingsModal");
  document.getElementById("settingsEngine").focus();
  ui.openModal("customEngineModal");
}

describe("嵌套设置弹窗的焦点恢复", () => {
  it("Esc 关闭顶层管理窗口后回到设置入口，关闭设置后回到偏好", () => {
    openSettingsAndEngine();
    ui.closeModal();
    expect(document.activeElement.id).toBe("settingsEngine");
    expect(document.getElementById("settingsModal").classList.contains("hidden")).toBe(false);
    ui.closeModal({target: document.getElementById("settingsClose")});
    expect(document.activeElement.id).toBe("preferences");
  });

  it("按 ID 关闭子窗口保留未保存的输入和父窗口的返回目标", () => {
    openSettingsAndEngine();
    document.getElementById("draft").value = "修改尚未保存";
    ui.closeModal("customEngineModal");
    expect(document.getElementById("draft").value).toBe("修改尚未保存");
    expect(document.activeElement.id).toBe("settingsEngine");
    ui.closeModal("settingsModal");
    expect(document.activeElement.id).toBe("preferences");
  });

  it("侧栏直接打开管理窗口仍恢复到侧栏入口", () => {
    document.getElementById("sidebarEngine").focus();
    ui.openModal("customEngineModal");
    ui.closeModal("customEngineModal");
    expect(document.activeElement.id).toBe("sidebarEngine");
  });
});
