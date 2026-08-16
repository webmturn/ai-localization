// CDP 截图与 DOM 验证脚本（无头 Chrome）
// 用法: node tools/capture.mjs [输出目录]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP_URL = "http://127.0.0.1:8123/public/index.html";
const OUT_DIR = path.resolve(process.argv[2] || "tools/shots");
const PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, method) {
  const res = await fetch(url, { method: method || "GET" });
  return res.json();
}

let msgId = 0;
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Map();
    ws.onopen = () =>
      resolve({
        send(method, params) {
          return new Promise((res, rej) => {
            const id = ++msgId;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params: params || {} }));
          });
        },
        on(event, fn) { listeners.set(event, fn); },
        close() { try { ws.close(); } catch {} },
      });
    ws.onerror = (e) => reject(new Error("WS error: " + e.message));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message));
        else p.res(msg.result);
      } else if (msg.method && listeners.has(msg.method)) {
        listeners.get(msg.method)(msg.params);
      }
    };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userData = path.join(OUT_DIR, "chrome-profile");
  fs.mkdirSync(userData, { recursive: true });

  console.log("启动无头 Chrome...");
  const chrome = spawn(CHROME, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + userData,
    "--window-size=1600,1000",
    "--force-device-scale-factor=1",
    "about:blank",
  ], { stdio: "ignore" });

  let version;
  for (let i = 0; i < 40; i++) {
    try {
      version = await getJson("http://127.0.0.1:" + PORT + "/json/version");
      break;
    } catch {
      await sleep(250);
    }
  }
  if (!version) throw new Error("Chrome 调试端口未就绪");
  console.log("Chrome 已就绪");

  let tab;
  const newUrl = "http://127.0.0.1:" + PORT + "/json/new?" + encodeURIComponent(APP_URL);
  try {
    tab = await getJson(newUrl, "PUT");
  } catch {
    tab = await getJson(newUrl);
  }
  console.log("标签页已创建:", tab.url);

  const cdp = await connect(tab.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  console.log("等待应用初始化...");
  await sleep(5500);

  async function evalJs(expression) {
    const r = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) {
      throw new Error("evaluate 异常: " + JSON.stringify((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
    }
    return r.result.value;
  }

  await evalJs("loadSampleProject(); true");
  await sleep(900);

  const checksExpr =
    "(() => {" +
    "const t = document.body ? document.body.innerText : '';" +
    "const m = document.getElementById('settingsModal');" +
    "return {" +
    "  appTitle: document.title," +
    "  sampleLoaded: t.includes('欢迎使用我们的应用') && t.includes('Welcome to our application')," +
    "  itemCount: (window.AppState && AppState.translations && AppState.translations.items) ? AppState.translations.items.length : -1," +
    "  translationService: typeof window.translationService !== 'undefined'," +
    "  errorManager: typeof window.errorManager !== 'undefined'," +
    "  bundleLoaded: !!document.querySelector('script[src=\"app.bundle.js\"]')," +
    "  engineCount: window.EngineRegistry && EngineRegistry._engines ? EngineRegistry._engines.size : -1," +
    "  settingsModalExists: !!m," +
    "  innerTextPreview: t.slice(0, 800)," +
    "};" +
    "})()";
  const checks = await evalJs(checksExpr);
  console.log("功能验证:", JSON.stringify(checks, null, 2));
  const taValues = await evalJs("(() => { const tas = document.querySelectorAll('textarea'); return Array.from(tas).slice(0, 8).map(t => t.value.slice(0, 60)); })()");
  console.log("文本域值:", JSON.stringify(taValues));

  const shot1 = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, "verify-main.png"), Buffer.from(shot1.data, "base64"));
  console.log("已保存:", path.join(OUT_DIR, "verify-main.png"));

  await evalJs("(() => { const um = document.getElementById('userMenuBtn'); if (um) um.click(); return true; })()");
  await sleep(500);
  await evalJs("(() => { const s = document.getElementById('openSettingsMenu'); if (s) s.click(); return true; })()");
  await sleep(900);

  const settingsExpr =
    "(() => {" +
    "const m = document.getElementById('settingsModal');" +
    "if (!m) return 'modal-missing';" +
    "return { hidden: m.classList.contains('hidden'), visible: !m.classList.contains('hidden') };" +
    "})()";
  const settingsOpen = await evalJs(settingsExpr);
  console.log("设置面板状态:", JSON.stringify(settingsOpen));

  const shot2 = await cdp.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT_DIR, "verify-settings.png"), Buffer.from(shot2.data, "base64"));
  console.log("已保存:", path.join(OUT_DIR, "verify-settings.png"));

  cdp.close();
  chrome.kill();
  console.log("完成");
  process.exit(0);
}

main().catch((e) => {
  console.error("失败:", e.message);
  process.exit(1);
});