/**
 * 占位符与术语库的 P1 修复回归测试
 *
 * 1. printf 百分数误判：`50%off` / `100%increase` 曾被当成 %o/%i 占位符 →
 *    送给模型的文本被改写（50«0»ff），且正确译文被 validate() 判为「缺失 %o」。
 * 2. ICU 校验与 protect 不一致：protect 用配对扫描、validate/extractAll 用非贪婪正则 →
 *    正确的复数译文被判为不匹配（而原样未翻译的英文反而通过）。
 * 3. 术语词边界把 CJK 当词字符 → 拉丁术语紧邻中文时（用户id不可见 / 请安装SDK后再试）永不替换。
 */
import { describe, it, expect, beforeAll } from "vitest";
import { loadSource, setupGlobals } from "./setup.mjs";

beforeAll(() => {
  setupGlobals();
  loadSource("public/app/services/translation/placeholder-guard.js");
  loadSource("public/app/services/translation/helpers.js");
  loadSource("public/app/services/translation/service-class.js");
  loadSource("public/app/services/translation/terminology.js");
});

describe("printf：百分数不再被当成占位符（P1 回归）", () => {
  const cases = ["50%off today only", "100%increase", "30%discount", "Save 50% off"];

  it.each(cases)("protect 不改写百分数文本：%s", (text) => {
    const r = PlaceholderGuard.protect(text);
    expect(r.text).toBe(text);
    expect(r.hasPlaceholders).toBe(false);
  });

  it.each(cases)("validate 不再因百分数判正确译文无效：%s", (text) => {
    const v = PlaceholderGuard.validate(text, "仅限今天五折");
    expect(v.valid).toBe(true);
  });

  it("真正的 printf 占位符仍被保护", () => {
    for (const [src, tag] of [["file%s.txt", "«0»"], ["%d items", "«0»"], ["%-10.2f%%", "«0»"]]) {
      const r = PlaceholderGuard.protect(src);
      expect(r.hasPlaceholders).toBe(true);
      expect(r.text).toContain(tag);
    }
  });

  it("extractAll 对百分数返回空、对真占位符返回命中", () => {
    expect(PlaceholderGuard.extractAll("50%off")).toEqual([]);
    expect(PlaceholderGuard.extractAll("a %s b %d")).toEqual(["%s", "%d"]);
  });
});

describe("ICU：validate 与 protect 判定一致（P1 回归）", () => {
  const SRC = "{count, plural, one{# item} other{# items}}";

  it("extractAll 返回完整的花括号配对片段（不再截到第一个 }）", () => {
    expect(PlaceholderGuard.extractAll(SRC)).toEqual([SRC]);
  });

  it("正确翻译了各分支的译文通过校验", () => {
    const translated = "{count, plural, one{# 项} other{# 项}}";
    expect(PlaceholderGuard.validate(SRC, translated).valid).toBe(true);
  });

  it("原样保留 ICU 的译文通过校验", () => {
    expect(PlaceholderGuard.validate(SRC, SRC).valid).toBe(true);
  });

  it("删掉整个 ICU 片段仍判为缺失", () => {
    const v = PlaceholderGuard.validate(SRC, "共 3 项");
    expect(v.valid).toBe(false);
    expect(v.missing.length).toBe(1);
  });

  it("protect + restore 往返无损", () => {
    const p = PlaceholderGuard.protect("共 " + SRC + " 条");
    expect(p.text).toBe("共 «0» 条");
    expect(PlaceholderGuard.restore(p.text, p.map)).toBe("共 " + SRC + " 条");
  });
});

describe("实体/标签差异不再判为占位符损坏（P1 回归）", () => {
  it("模型为 XML 转义把 & 写成 &amp; 时通过校验", () => {
    const v = PlaceholderGuard.validate("Terms & Conditions", "条款 &amp; 条件");
    expect(v.valid).toBe(true);
    expect(v.benignExtra).toContain("&amp;");
    expect(v.fatalExtra).toEqual([]);
  });

  it("模型把 &amp; 解码成 & 时同样通过（缺失实体不算损坏）", () => {
    const v = PlaceholderGuard.validate("Fish &amp; Chips", "Fish & Chips");
    expect(v.valid).toBe(true);
    expect(v.benignMissing).toContain("&amp;");
    expect(v.missingStructural).toEqual([]);
  });

  it("模型补内联标签时通过", () => {
    const v = PlaceholderGuard.validate("点击这里", "点击<b>这里</b>");
    expect(v.valid).toBe(true);
    expect(v.benignExtra.length).toBeGreaterThan(0);
  });

  it("结构性占位符仍严格：缺失 %s 判失败", () => {
    const v = PlaceholderGuard.validate("Hello %s", "你好");
    expect(v.valid).toBe(false);
    expect(v.missingStructural).toContain("%s");
  });

  it("结构性占位符仍严格：多出 {extra} 判失败", () => {
    const v = PlaceholderGuard.validate("Hello {name}", "你好 {name} {extra}");
    expect(v.valid).toBe(false);
    expect(v.fatalExtra).toContain("{extra}");
  });

  it("translationValidateResult 与上述分级一致", () => {
    expect(translationValidateResult("Terms & Conditions", "条款 &amp; 条件").ok).toBe(true);
    const bad = translationValidateResult("Hello %s", "你好");
    expect(bad.ok).toBe(false);
    expect(bad.reason).toContain("缺失");
    expect(bad.reason).toContain("%s");
  });
});

describe("术语库：拉丁术语紧邻中文仍能命中（P1 回归）", () => {
  const withTerm = (text, source, target) =>
    __terminologyReplaceIgnoreCase(text, source, target);

  it("拉丁术语被中文包围时替换（此前静默失效）", () => {
    expect(withTerm("请安装SDK后再试", "SDK", "软件开发工具包")).toBe("请安装软件开发工具包后再试");
    expect(withTerm("请使用file管理器", "file", "文件")).toBe("请使用文件管理器");
    expect(withTerm("解析XML文件", "XML", "可扩展标记语言")).toBe("解析可扩展标记语言文件");
    expect(withTerm("用户id不可见", "id", "标识")).toBe("用户标识不可见");
  });

  it("拉丁术语在词内部仍不替换（原有保护不回退）", () => {
    // 独立词 cat 应替换；只有 category 里的 cat 不能被误伤
    expect(withTerm("This category contains a cat.", "cat", "猫")).toBe("This category contains a 猫.");
    expect(withTerm("This category is long.", "cat", "猫")).toBe("This category is long.");
    expect(withTerm("Please open the node.", "no", "否")).toBe("Please open the node.");
    expect(withTerm("Set the width.", "id", "标识")).toBe("Set the width.");
    expect(withTerm("用户userid不可见", "id", "标识")).toBe("用户userid不可见");
  });

  it("空格分隔与 CJK 术语的行为保持不变", () => {
    expect(withTerm("用户 id 不可见", "id", "标识")).toBe("用户 标识 不可见");
    expect(withTerm("打开文件", "文件", "file")).toBe("打开file");
    expect(withTerm("点击取消按钮", "取消", "Cancel")).toBe("点击Cancel按钮");
  });
});
