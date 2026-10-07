import { beforeAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { loadSource, setupGlobals } from './setup.mjs';

beforeAll(() => {
  setupGlobals();
  for (const source of [
    'core/batch-progress-store.js', 'services/security-utils.js',
    'services/translation/engines/engine-registry.js',
    'services/translation/engines/providers/gemini.js',
    'services/translation/engines/providers/deepseek.js',
    'services/translation/engines/providers/openai.js',
    'services/translation/engines/providers/claude.js',
    'services/translation/placeholder-guard.js', 'services/translation/helpers.js',
    'services/translation/service-class.js', 'services/translation/rate-limit.js',
    'services/translation/translate.js', 'services/translation/batch.js',
    'services/translation/engines/base/ai-engine-base.js',
  ]) loadSource('public/app/' + source);
  globalThis.securityUtils = new SecurityUtils();
});
beforeEach(() => {
  AppState.project = { id: 'audit', translationItems: [] };
  BatchProgressStore.clearBatch();
  delete globalThis.TMAutoApply;
  EngineRegistry.register({ id: 'custom-audit', name: 'Audit', category: 'ai', isCustom: true,
    apiUrl: 'https://local.test/v1/chat/completions', apiKeyValidationType: 'none',
    defaultModel: 'test', supportsBatch: true, rateLimitPerSecond: 100 });
});
afterEach(() => vi.useRealTimers());
function service(settings = {}) {
  const svc = new TranslationService();
  svc.getSettings = async () => ({ model: 'test', temperature: .3, retryCount: 0,
    aiBatchMaxItems: 5, aiBatchMaxChars: 20000, concurrentLimit: 1, ...settings });
  svc.findTerminologyMatches = () => [];
  svc.applyTerminologyToTranslation = text => text;
  svc.checkRateLimit = async () => {};
  return svc;
}
function items(count = 3) {
  return Array.from({ length: count }, (_, n) => ({ id: 'duplicate-id', sourceText: 'source-' + n,
    targetText: '', status: 'pending', metadata: { key: 'duplicate-key', file: 'test.json' } }));
}
function response(content, finish_reason = 'stop') {
  return { ok: true, json: async () => ({ choices: [{ message: { content }, finish_reason }] }) };
}
function mockBatch(responder) {
  const calls = [];
  networkUtils = globalThis.networkUtils = {
    fetchWithTimeout: async (url, options) => {
      const body = JSON.parse(options.body), content = body.messages.at(-1).content;
      const input = JSON.parse(content.slice(content.indexOf('{"items"'))).items;
      calls.push(input);
      const translated = responder ? await responder(input) : input.map(it => ({ id: it.id, text: '译-' + it.source }));
      const resultContent = JSON.stringify({ translations: translated });
      return url.includes('anthropic') ? { ok: true, json: async () => ({ content: [{ type: 'text', text: resultContent }], stop_reason: 'end_turn' }) } : response(resultContent);
    },
  };
  return calls;
}

describe('批量响应身份核对', () => {
  it.each(['deepseek', 'openai', 'claude', 'gemini', 'custom-audit'])('%s 批量协议保留占位符且正确解析响应', async id => {
    const cfg = EngineRegistry.get(id), list = items(2);
    list[0].sourceText = 'Hello %s';
    const key = id === 'gemini' ? 'AIza' + 'a'.repeat(35) : id === 'claude' ? 'sk-ant-' + 'a'.repeat(35) : 'sk-' + 'a'.repeat(35);
    const calls = mockBatch(); BatchProgressStore.beginBatch();
    const result = await service({ model: cfg.defaultModel, [cfg.apiKeyField]: key }).translateBatch(list, 'en', 'zh', id);
    expect(result.errors).toEqual([]); expect(result.results).toHaveLength(2);
    expect(list[0].targetText).toBe('译-Hello %s'); expect(calls).toHaveLength(1);
  });
  it('响应倒序、资源 id 和 key 重复时仍然对应原文，且只发一次请求', async () => {
    const list = items(), calls = mockBatch(input => input.map(it => ({ id: it.id, text: '译-' + it.source })).reverse());
    BatchProgressStore.beginBatch();
    const result = await service().translateBatch(list, 'en', 'zh', 'custom-audit');
    expect(result.errors).toEqual([]);
    expect(list.map(it => it.targetText)).toEqual(['译-source-0', '译-source-1', '译-source-2']);
    expect(calls).toHaveLength(1);
  });
  it.each(['重复', '未知', '遗漏', '无标识'])('%s标识不能按位置写入', kind => {
    const request = [{ id: 'a' }, { id: 'b' }];
    const rows = kind === '重复' ? [{ id: 'a', text: '甲' }, { id: 'a', text: '乙' }] :
      kind === '未知' ? [{ id: 'a', text: '甲' }, { id: 'x', text: '乙' }] :
      kind === '遗漏' ? [{ id: 'a', text: '甲' }] : ['乙', '甲'];
    expect(() => AIEngineBase.mapBatchTranslations({ translations: rows }, request)).toThrow();
  });
});

describe('完整原文与响应', () => {
  it('单条超过一万字符仍发送完整结尾', async () => {
    const text = 'A'.repeat(10020) + 'END';
    let sent;
    globalThis.networkUtils = { fetchWithDedupe: async (url, o) => { sent = JSON.parse(o.body).messages.at(-1).content; return response('完整译文'); } };
    await service().translate(text, 'en', 'zh', 'custom-audit');
    expect(sent).toBe(text);
  });
  it('批量超过一万字符仍发送完整结尾', async () => {
    const list = items(1); list[0].sourceText = 'A'.repeat(10020) + 'END';
    const calls = mockBatch(); BatchProgressStore.beginBatch();
    const result = await service().translateBatch(list, 'en', 'zh', 'custom-audit');
    expect(calls[0][0].source).toBe(list[0].sourceText);
    expect(result.results).toHaveLength(1);
  });
  it.each(['length', 'max_tokens'])('单条 %s 截断响应不作为成功译文', async reason => {
    globalThis.networkUtils = { fetchWithDedupe: async () => response('不完整译文', reason) };
    await expect(service().translate('long', 'en', 'zh', 'custom-audit')).rejects.toMatchObject({ code: 'OUTPUT_TRUNCATED' });
  });
  it('Claude 原生截断信号也被拒绝', async () => {
    globalThis.networkUtils = { fetchWithDedupe: async () => ({ ok: true, json: async () => ({ stop_reason: 'max_tokens', choices: [{ message: { content: '半截' } }] }) }) };
    await expect(service().translate('long', 'en', 'zh', 'custom-audit')).rejects.toMatchObject({ code: 'OUTPUT_TRUNCATED' });
  });
  it('Gemini 默认模型和已停用的保存值均迁移', () => {
    const cfg = EngineRegistry.get('gemini');
    expect(cfg.defaultModel).toBe('gemini-3.6-flash');
    expect(_aiResolveModel({ model: 'gemini-2.0-flash' }, cfg)).toBe(cfg.defaultModel);
  });
});

describe('取消、重试、并发', () => {
  it.each(['single', 'batch'])('限速排队时取消并重启批量，旧 %s 请求不再发出', async mode => {
    const svc = service(); let release, entered;
    const ready = new Promise(resolve => entered = resolve);
    svc.checkRateLimit = () => { entered(); return new Promise(resolve => release = resolve); };
    const send = vi.fn(async () => response('译文'));
    globalThis.networkUtils = { fetchWithDedupe: send, fetchWithTimeout: send };
    BatchProgressStore.beginBatch();
    const pending = mode === 'single' ? svc.translate('source', 'en', 'zh', 'custom-audit') : AIEngineBase.translateBatch('custom-audit', items(), 'en', 'zh', {}, svc);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    await ready; BatchProgressStore.cancelBatch(); BatchProgressStore.beginBatch(); release();
    await assertion; expect(send).not.toHaveBeenCalled();
  });
  it('共享冷却可及时取消，且不会让后续队列永久失败', async () => {
    vi.useFakeTimers();
    const svc = new TranslationService(); let cancelled = false;
    svc.reportRateLimit('custom-audit', 30);
    const pending = svc.checkRateLimit('custom-audit', () => cancelled);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'USER_CANCELLED' });
    await vi.advanceTimersByTimeAsync(100); cancelled = true;
    await vi.advanceTimersByTimeAsync(100); await assertion;
    svc.rateLimits['custom-audit']._cooldownUntil = 0;
    await expect(svc.checkRateLimit('custom-audit', () => false)).resolves.toBeUndefined();
  });
  it('重试为 0 时执行一次首次请求', async () => {
    const send = vi.fn(async () => response('译文')); globalThis.networkUtils = { fetchWithDedupe: send };
    expect(await service({ retryCount: 0 }).translate('source', 'en', 'zh', 'custom-audit')).toBe('译文');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('重试为 2 时最多执行首次请求加两次重试', async () => {
    vi.useFakeTimers(); let count = 0;
    globalThis.networkUtils = { fetchWithDedupe: async () => {
      count++; if (count < 3) throw Object.assign(new Error('temporary'), { status: 503 }); return response('译文');
    } };
    const pending = service({ retryCount: 2 }).translate('source', 'en', 'zh', 'custom-audit');
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toBe('译文'); expect(count).toBe(3);
  });
  it('用户设置并发为 1 时 AI 的多个分块按串行执行', async () => {
    let running = 0, peak = 0;
    mockBatch(async input => {
      running++; peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 5)); running--;
      return input.map(it => ({ id: it.id, text: '译-' + it.source }));
    });
    BatchProgressStore.beginBatch();
    const result = await service({ concurrentLimit: 1 }).translateBatch(items(15), 'en', 'zh', 'custom-audit');
    expect(result.results).toHaveLength(15); expect(peak).toBe(1);
  });
});

describe('AI 批量翻译记忆复用', () => {
  it('命中条目跳过 API，未命中条目仍按原索引返回', async () => {
    globalThis.TMAutoApply = { lookup: async source => ({ hit: source === 'source-1', exact: true, translation: '记忆译文' }), saveBatch: vi.fn() };
    const calls = mockBatch(), list = items(); BatchProgressStore.beginBatch();
    const result = await service().translateBatch(list, 'en', 'zh', 'custom-audit');
    expect(calls[0].map(it => it.source)).toEqual(['source-0', 'source-2']);
    expect(result.results.map(it => it.index)).toEqual([0, 1, 2]);
    expect(list[1].targetText).toBe('记忆译文');
  });
  it('全部命中时无需 API，损坏占位符的记忆不会被复用', async () => {
    globalThis.TMAutoApply = { lookup: async () => ({ hit: true, exact: true, translation: '记忆译文' }), saveBatch: vi.fn() };
    const calls = mockBatch(), list = items(); BatchProgressStore.beginBatch();
    expect((await service().translateBatch(list, 'en', 'zh', 'custom-audit')).results).toHaveLength(3);
    expect(calls).toHaveLength(0);
    const bad = items(1); bad[0].sourceText = 'Hello %s';
    await service().translateBatch(bad, 'en', 'zh', 'custom-audit');
    expect(calls).toHaveLength(1); expect(bad[0].targetText).toContain('%s');
  });
});
