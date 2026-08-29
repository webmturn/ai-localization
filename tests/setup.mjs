/**
 * 测试环境设置
 * 为全局命名空间的源文件提供必要的模拟环境
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import vm from "vm";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

/**
 * 在当前上下文中加载源文件（模拟浏览器全局作用域）
 * @param {string} relativePath - 相对于项目根目录的路径
 */
export function loadSource(relativePath) {
  const filePath = resolve(PROJECT_ROOT, relativePath);
  const code = readFileSync(filePath, "utf-8");
  vm.runInThisContext(code, { filename: filePath });
}

/**
 * 设置最小全局环境（模拟项目中常用的全局变量）
 */
export function setupGlobals() {
  // loggers 对象（静默模式，不输出日志）
  const silentLogger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    verbose: () => {},
    log: () => {},
  };

  globalThis.loggers = {
    app: silentLogger,
    translation: silentLogger,
    network: silentLogger,
    storage: silentLogger,
    quality: silentLogger,
    ui: silentLogger,
  };

  // App 命名空间
  globalThis.App = globalThis.App || {
    services: {},
    features: {},
    core: {},
    parsers: {},
    ui: {},
    utils: {},
  };

  // SettingsCache
  globalThis.SettingsCache = globalThis.SettingsCache || {
    get: () => null,
    set: () => {},
  };

  // AppState（translations 不含 items——阶段 3b 已删除该兼容别名）
  globalThis.AppState = globalThis.AppState || {
    project: null,
    translations: {},
    terminology: { entries: [] },
    ui: {},
  };
}
