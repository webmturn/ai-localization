/**
 * animateScrollTo 契约测试：rAF 自绘动画滚动
 * 背景：浏览器原生 behavior:"smooth" 在 prefers-reduced-motion: reduce 环境
 * （如 Windows 关闭"显示动画效果"）会被忽略退化为瞬跳。本函数用 rAF 插值
 * 自绘动画，任何环境表现一致，且新请求到来时取消进行中的动画。
 *
 * 覆盖：目标钳制、短距离直跳、动画渐进插值（easing）、可打断、降级安全
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

/** 可控 rAF 模拟：手动推进帧时间 */
function installFakeRaf() {
  let now = 0;
  let frameCb = null;
  let rafId = 0;
  const cancelled = new Set();

  globalThis.requestAnimationFrame = (cb) => {
    rafId += 1;
    frameCb = { cb, id: rafId };
    return rafId;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.add(id);
  };

  return {
    /** 推进一帧（dt 毫秒后触发回调） */
    tick(dt = 16) {
      now += dt;
      if (frameCb && !cancelled.has(frameCb.id)) {
        const { cb } = frameCb;
        frameCb = null;
        cb(now);
      }
    },
  };
}

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/selection.js");
});

beforeEach(() => {
  // 重置动画状态
  globalThis.__scrollAnim = globalThis.__scrollAnim || { raf: 0 };
  if (typeof __scrollAnim !== "undefined") __scrollAnim.raf = 0;
});

/** 构造带 scrollTop 的桩容器（offset 化） */
function makeContainer(clientH, scrollH) {
  return {
    clientHeight: clientH,
    scrollHeight: scrollH,
    _scrollTop: 0,
    get scrollTop() {
      return this._scrollTop;
    },
    set scrollTop(v) {
      this._scrollTop = v;
    },
  };
}

describe("animateScrollTo", () => {
  it("目标超出可滚动范围时钳制到 maxScroll", () => {
    const raf = installFakeRaf();
    const c = makeContainer(400, 1000);
    animateScrollTo(c, 99999);
    raf.tick(16);
    raf.tick(1000);
    expect(c.scrollTop).toBe(600); // 1000 - 400
  });

  it("目标为负时钳制到 0", () => {
    const raf = installFakeRaf();
    const c = makeContainer(400, 1000);
    c.scrollTop = 300;
    animateScrollTo(c, -50);
    raf.tick(16);
    raf.tick(1000);
    expect(c.scrollTop).toBe(0);
  });

  it("短距离（<2px）直接跳转，不排队动画", () => {
    const raf = installFakeRaf();
    const c = makeContainer(400, 1000);
    c.scrollTop = 100;
    animateScrollTo(c, 101);
    expect(c.scrollTop).toBe(101);
    expect(__scrollAnim.raf).toBe(0); // 未启动 rAF
  });

  it("长距离动画渐进插值（easeOutCubic：先快后缓）", () => {
    const raf = installFakeRaf();
    const c = makeContainer(400, 2000);
    c.scrollTop = 0;
    animateScrollTo(c, 600);
    // duration = 600px * 0.55 = 330ms
    const samples = [];
    for (let i = 0; i < 22; i++) {
      raf.tick(16);
      samples.push(c.scrollTop);
    }
    // 最终到位
    expect(c.scrollTop).toBe(600);
    // 中途有渐进（非一步到位）：第 2 帧应小于终值且已离开起点
    expect(samples[1]).toBeGreaterThan(0);
    expect(samples[1]).toBeLessThan(600);
    // easeOutCubic：前 1/3 帧内完成超过一半行程
    const oneThird = samples[Math.floor(samples.length / 3)];
    expect(oneThird).toBeGreaterThan(300);
  });

  it("新滚动请求取消进行中的动画（快速键盘导航不排队）", () => {
    const raf = installFakeRaf();
    const c = makeContainer(400, 2000);
    c.scrollTop = 0;
    animateScrollTo(c, 600);
    raf.tick(16); // 首帧 t0 初始化（p=0 无位移）
    raf.tick(16);
    raf.tick(16);
    expect(c.scrollTop).toBeGreaterThan(0);
    expect(c.scrollTop).toBeLessThan(600); // 动画进行中

    const firstRaf = __scrollAnim.raf;
    // 导航打断：滚回 0
    animateScrollTo(c, 0);
    expect(__scrollAnim.raf).not.toBe(firstRaf);
    raf.tick(16);
    raf.tick(1000);
    expect(c.scrollTop).toBe(0);
  });

  it("容器为空时安全无操作", () => {
    expect(() => animateScrollTo(null, 100)).not.toThrow();
    expect(() => animateScrollTo(undefined, 0)).not.toThrow();
  });
});
