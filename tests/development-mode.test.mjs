import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/app/core/dev-tools.js', 'utf8');

function environment(url, { production = false, debugMode = null } = {}) {
  const context = {
    URLSearchParams,
    location: new URL(url),
    isProduction: production,
    localStorage: { getItem: key => key === 'debugMode' ? debugMode : null },
    console: { log: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    AppState: { project: { id: 'project' } },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source + '\nthis.development = isDevelopment;', context);
  return context;
}

describe('发布包与显式开发模式', () => {
  it('file:// 生产包保持生产模式，不安装状态写入审计', () => {
    const context = environment('file:///D:/release/public/index.html', { production: true });
    expect(context.development).toBe(false);
    context.installSliceOwnershipAudit('ProjectStore', { load() {} }, ['project']);
    expect(Object.getOwnPropertyDescriptor(context.AppState, 'project').set).toBeUndefined();
    expect(context.debugMemory()).toBeNull();
  });

  it('生产包在 localhost 上也不被本地地址检测覆盖', () => {
    expect(environment('http://localhost/index.html', { production: true }).development).toBe(false);
  });

  it('发布包显式 ?debug=true 仍可启用开发模式和审计', () => {
    const context = environment('file:///D:/release/public/index.html?debug=true', { production: true });
    expect(context.development).toBe(true);
    context.installSliceOwnershipAudit('ProjectStore', { load() {} }, ['project']);
    expect(Object.getOwnPropertyDescriptor(context.AppState, 'project').set).toEqual(expect.any(Function));
  });

  it('生产包显式保存 debugMode=true 仍保留调试入口', () => {
    expect(environment('file:///D:/release/public/index.html', { production: true, debugMode: 'true' }).development).toBe(true);
  });

  it('debug=false 不启用发布包的开发模式', () => {
    expect(environment('file:///D:/release/public/index.html?debug=false', { production: true }).development).toBe(false);
  });

  it('源码通过 file:// 打开仍使用既有的本地开发模式', () => {
    expect(environment('file:///D:/source/public/index.html').development).toBe(true);
  });

  it.each(['localhost', '127.0.0.1'])('源码在 %s 仍使用本地开发模式', hostname => {
    expect(environment(`http://${hostname}/index.html`).development).toBe(true);
  });

  it('远程源码地址默认使用生产模式', () => {
    expect(environment('https://example.test/index.html').development).toBe(false);
  });
});
