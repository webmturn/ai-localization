/**
 * Android 导出：资源 id 形态覆盖（复核补充，跑完即删）
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

const XML = `<resources>
<string name="a">Hello</string>
<string-array name="arr"><item>x</item><item>y</item></string-array>
<string-array name="with:colon"><item>c0</item><item>c1</item></string-array>
<plurals name="p"><item quantity="one">1 item</item><item quantity="other">n items</item></plurals>
</resources>`;

function run(items) {
  return generateAndroidStringsXML(items, XML);
}
const it_ = (resourceId, target, extra = {}) => ({
  sourceText: "s",
  targetText: target,
  metadata: Object.assign({ resourceId }, extra),
});

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/features/translations/export/shared.js");
  loadSource("public/app/features/translations/export/translation-formats.js");
});

describe("Android 导出 id 形态", () => {
  it("数组 新形态 arr:0", () => {
    expect(run([it_("arr:0", "新0")])).toContain("新0");
  });

  it("数组 旧形态 arr[1]（向后兼容）", () => {
    expect(run([it_("arr[1]", "旧1")])).toContain("旧1");
  });

  it("数组 arrayName/arrayIndex 元数据", () => {
    expect(run([it_("arr:0", "元数据0", { arrayName: "arr", arrayIndex: 0 })])).toContain("元数据0");
  });

  it("名称含冒号的数组不被误判", () => {
    const out = run([it_("with:colon:1", "冒号1", { arrayName: "with:colon", arrayIndex: 1 })]);
    expect(out).toContain("冒号1");
  });

  it("复数 p[one] / p[other] 各自独立，不被当成数组", () => {
    const out = run([it_("p[one]", "复数一"), it_("p[other]", "复数多")]);
    expect(out).toMatch(/quantity="one"[^>]*>复数一</);
    expect(out).toMatch(/quantity="other"[^>]*>复数多</);
  });

  it("普通字符串仍可写回", () => {
    expect(run([it_("a", "普通")])).toContain("普通");
  });

  it("数组与复数混用互不干扰", () => {
    const out = run([
      it_("p[one]", "一"),
      it_("p[other]", "多"),
      it_("arr:0", "数组0"),
      it_("a", "普通"),
    ]);
    expect(out).toMatch(/quantity="one"[^>]*>一</);
    expect(out).toMatch(/quantity="other"[^>]*>多</);
    expect(out).toMatch(/<item>数组0<\/item>/);
    expect(out).toMatch(/name="a"[^>]*>普通</);
    // 文档仍可解析
    const doc = new DOMParser().parseFromString(out, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });
});
