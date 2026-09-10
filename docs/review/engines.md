# Translation Engine Layer — Functional Review

**Target:** `public/app/services/translation/**` (engine layer + cross-cutting translation logic)
**Date:** review performed against the working tree at `D:\laster\html`
**Scope:** `engines/base/ai-engine-base.js`, `engines/base/traditional-engine-base.js`, `engines/providers/*.js`,
`engines/engine-registry.js`, `batch.js`, `batch-resume.js`, `rate-limit.js`, `placeholder-guard.js`,
`tm-auto-apply.js`, `translation-memory.js`, `translation-diff.js`, `model-fetch.js`, `helpers.js`
(plus `translate.js` / `security-utils.js` / `network-utils.js` where the engine layer calls into them)
**No application source file was modified.** Only this report was created; all scratch probes were deleted.

---

## Method

1. **Load as the browser does.** Sources were loaded with `tests/setup.mjs` (`vm.runInThisContext`), in the
   same order as `public/app.js`, so the probes exercised the *real* `EngineRegistry`, the real provider
   configs (`deepseek/openai/gemini/claude/google`), the real `securityUtils`, the real
   `TranslationService` prototype chain (`service-class.js` → `rate-limit.js` → `translate.js` → `batch.js`)
   and the real `PlaceholderGuard` / `BatchProgressStore`. Only `networkUtils` was stubbed (it is the single
   transport seam: `fetchWithTimeout` / `fetchWithDedupe` / `cancelAll`), which lets the probes capture the
   exact request bodies, headers, count requests, and inject arbitrary model responses.
2. **Scratch probes** (Vitest files in temporary directories outside `tests/`, deleted afterwards — nothing was
   added to `tests/`) covering:
   response-shape matrices, a 200-run randomized fuzz of `translateBatch` plus a 96-run classified fuzz,
   request/slot traces of the adaptive split, pause/cancel timing, per-item retry behaviour, rate-limit timing,
   API-key leakage capture of every logger call and thrown error, and `PlaceholderGuard` round-trips.
3. **Existing suite re-run before and after:** `node node_modules/vitest/vitest.mjs run` → **24 files, 373 tests, all passing**
   (the defects below are all in gaps the current suite does not cover).
4. Every finding below was **reproduced**; nothing is reported from code reading alone. Where an impact
   statement is inferred from another module (e.g. the export path) rather than executed, it is marked
   *(read-level, not executed)*.

### Shared repro harness

Every reproduction below is a Vitest file that starts like this (this is the harness the probes actually used,
condensed to the essentials):

```js
// scratch harness h.mjs  (imported by every probe; deleted after the review)
import { loadSource, setupGlobals } from "../tests/setup.mjs";

export function loadStack() {
  setupGlobals();
  globalThis.window = globalThis;                       // sources assign window.X
  loadSource("public/app/core/batch-progress-store.js");
  loadSource("public/app/services/security-utils.js");
  loadSource("public/app/services/translation/helpers.js");
  loadSource("public/app/services/translation/placeholder-guard.js");
  loadSource("public/app/services/translation/engines/engine-registry.js");
  for (const p of ["deepseek", "openai", "gemini", "claude", "google-translate"])
    loadSource(`public/app/services/translation/engines/providers/${p}.js`);
  loadSource("public/app/services/translation/engines/base/ai-engine-base.js");
  loadSource("public/app/services/translation/engines/base/traditional-engine-base.js");
  loadSource("public/app/services/translation/service-class.js");
  loadSource("public/app/services/translation/rate-limit.js");
  loadSource("public/app/services/translation/translate.js");
  loadSource("public/app/services/translation/batch.js");
}

export function setAppState() {                       // "batch running" state the engine expects
  globalThis.AppState = {
    project: { id: "p1", translationItems: [], sourceLanguage: "en", targetLanguage: "zh" },
    translations: { isInProgress: true, isPaused: false, _batchStarted: true, _batchCancelled: false,
                    progress: { current: 0, total: 0, status: "" } },
    ui: {}, terminology: { entries: [] },
  };
}

export function makeItems(n, prefix = "source-") {
  return Array.from({ length: n }, (_, i) => ({ id: "id-" + i, sourceText: prefix + i, targetText: "",
    status: "pending", metadata: { key: "key-" + i, file: "test.json" } }));
}

// responder(items, callIndex, body) -> {content} | {raw,status,retryAfter} | throws
export function installTransport(responder, opts = {}) { /* records {url, body, headers, at}; returns calls[] */ }

export function makeService(over = {}) {              // real TranslationService + settings stub
  const svc = new TranslationService();
  svc.getSettings = async () => Object.assign({ model: "", deepseekApiKey: "sk-" + "a".repeat(30),
    openaiApiKey: "sk-" + "a".repeat(30), claudeApiKey: "sk-ant-" + "a".repeat(30),
    geminiApiKey: "AIza" + "a".repeat(30), googleApiKey: "g".repeat(39), apiTimeout: 30,
    aiBatchMaxItems: 40, aiBatchMaxChars: 20000, temperature: 0.3, retryCount: 3 }, over);
  svc.applyTerminologyToTranslation = (t) => t;       // identity, so findings are not terminology noise
  svc.findTerminologyMatches = () => [];
  svc.buildProjectSystemPrompt = () => "";
  return svc;
}
```

The model is simulated at the HTTP level, so every "model misbehaviour" below is a *plausible upstream
response*, and what is reported is what the application does with it — not what the stub did.

Finding 3 also uses a second transport that models a real `AbortController` (only requests already in flight are
aborted; the engine may still open *new* ones):

```js
function abortableTransport(slowMs) {           // returns { calls, t0 }; calls[].t = ms since start
  const calls = []; const controllers = new Map(); const t0 = Date.now(); let id = 0;
  globalThis.networkUtils = {
    fetchWithTimeout: async (url, o) => {
      const myId = ++id; const ctl = { aborted: false }; controllers.set(myId, ctl);
      calls.push({ t: Date.now() - t0, id: myId, body: o.body });
      for (let waited = 0; waited < slowMs; waited += 10) {
        await new Promise(r => setTimeout(r, 10));
        if (ctl.aborted) { const e = new Error("用户取消"); e.name = "AbortError"; e.code = "USER_CANCELLED"; throw e; }
      }
      controllers.delete(myId);
      const body = JSON.parse(o.body);
      const payload = { data: { translations: [{ translatedText: "ZH:" + body.q }] } };
      return { ok: true, status: 200, headers: { get: () => null },
               text: async () => JSON.stringify(payload), json: async () => payload };
    },
    fetchWithDedupe: async (url, o) => globalThis.networkUtils.fetchWithTimeout(url, o),
    cancelAll: () => { controllers.forEach(c => { c.aborted = true; }); controllers.clear(); },
  };
  return { calls, t0 };
}
```

---

## Summary

| # | Finding | Severity | Class |
|---|---|---|---|
| 1 | Batch responses are trusted **by array position only**: a same-length shifted/reordered `translations` array silently assigns translations to the **wrong items** (and pollutes the TM) | **critical** | mis-assignment |
| 2 | Placeholder guard: zero protection **and zero validation** on the batch path; a dropped/moved/invented placeholder is accepted silently on every path (`validate()` has no production caller) | **high** | corruption / silent data loss |
| 3 | Cancel does not stop queued or in-flight work: requests are still sent (and retried) after cancellation, in both the per-item and the AI batch path | medium | cancellation |
| 4 | Pause is dead code in the AI batch engine (`waitWhilePaused` defined, never called): chunk requests keep being dispatched while "paused" | medium | cancellation |
| 5 | Markdown-fenced / prose-wrapped / bare-array JSON aborts the whole batch (15–19 requests for 8–10 items) and silently degrades to per-item translation | medium | robustness / cost |
| 6 | `null`, `""` and **object** entries are accepted, written into `item.targetText`, and the item is marked `translated` with `success: true` | medium | silent data loss |
| 7 | Items > 10 000 chars are truncated before the request and the item is still marked `translated` with the partial result | medium | silent data loss |
| 8 | `PlaceholderGuard` false positives: ordinary percent text is mangled before being sent to the model (`"Save 50% off"` → `"Save 50«0»ff"`) and `validate()` rejects correct translations | medium | corruption |
| 9 | ICU MessageFormat placeholders are only partially protected (nested braces) — the model receives an unbalanced half-protected string | low | corruption |
| 10 | `BatchResumeManager` (断点续传) is dead code — no production caller — and its batch id collides across different batches | low | dead feature |
| 11 | `TranslationDiff` normalizes whitespace before hashing → a whitespace-only source change is "unchanged" and is never re-translated | low | stale data |
| 12 | `ModelFetcher.deriveModelsUrl` drops the query string → custom engines with query-authenticated endpoints (e.g. Azure OpenAI `?api-version=`) always fail to fetch models | low | minor functional gap |

---

## Findings

### 1. Batch responses are trusted by array position only — a same-length shifted array silently mis-assigns translations

**Severity: critical**

**Location:** `public/app/services/translation/engines/base/ai-engine-base.js:938-947` (the only validation:
`translations.length !== chunk.length`), `:959` (`slotResults[task.id] = translations` — no per-item check),
`public/app/services/translation/batch.js:107` (`let translated = translatedList[i]`), `:122-123`
(`item.targetText = translated; item.status = "translated"`), TM pollution at `batch.js:164-173`.

**Reproduction** (end-to-end, real `TranslationService.translateBatch` + real engine):

```js
loadStack(); setAppState();
// the model answers with the right NUMBER of translations, but in reverse order
installTransport(() => ({ content: JSON.stringify({ translations: ["T:source-3","T:source-2","T:source-1","T:source-0"] }) }));
const items = makeItems(4);
const res = await makeService({ aiBatchMaxItems: 5 }).translateBatch(items, "en", "zh", "deepseek", null);
console.log(JSON.stringify({ successes: res.results.length, errors: res.errors.length,
  mapping: items.map(i => ({ src: i.sourceText, tgt: i.targetText, status: i.status })) }));
```

**Observed** — every item is marked translated and every count says "success":

```json
{"successes":4,"errors":0,
 "mapping":[{"src":"source-0","tgt":"T:source-3","status":"translated"},
            {"src":"source-1","tgt":"T:source-2","status":"translated"},
            {"src":"source-2","tgt":"T:source-1","status":"translated"},
            {"src":"source-3","tgt":"T:source-0","status":"translated"}]}
```

The more realistic variant — the model omits one item and appends one extra, keeping the count constant —
was classified in a 96-run fuzz (`iter % 8 === 6`, "shifted-same-length"): **11 of 12 runs resolved with
mis-aligned output and 0 errors**. For contrast, the same fuzz with a well-behaved model resolved 12/12 with
`lenBad: 0, misaligned: 0`, i.e. the engine's own slot bookkeeping is correct — the hole is purely "the
payload was never checked".

```
PROBE fuzz by mode :: {"ok":{"runs":12,"resolved":12,"lenBad":0,"misaligned":0}, ...,
 "shifted-same-length":{"runs":12,"resolved":12,"rejected":0,"lenBad":0,"misaligned":11,...}}
```

**Expected:** a batch result should be tied to the item it belongs to. The engine already sends a per-item
`key` (`ai-engine-base.js:756`) and could ask for `{"translations":[{"key":…,"text":…}]}` (or send
`{"id":…}` and require it back) and verify the returned keys — or, at minimum, refuse to apply a chunk whose
entries cannot be matched to the request and mark it failed so the orchestration re-translates it per item.
Today the only protection is the array length.

**Impact:** the worst failure mode in a localization tool: correct-looking, silently wrong rows. `batch.js`
then feeds the same wrong pairs into the translation memory (`TMAutoApply.saveBatch(r.item.sourceText,
r.result)`, `batch.js:164-173`) and into auto-save, so a swapped translation is not only exported into the
wrong key of the shipped resource file, it is *reused for other projects* on later runs. Nothing in the UI
(status "translated", `results.length` successes, progress log "已翻译") allows the user to notice.

---

### 2. Placeholder protection does not exist on the batch path, and `validate()` is never called on any path

**Severity: high**

**Location:** `public/app/services/translation/batch.js:109-115` (restore of a map that was never applied),
`public/app/services/translation/engines/base/ai-engine-base.js:751-761` (batch request items —
`securityUtils.sanitizeForApi` only, no `PlaceholderGuard.protect`), `public/app/services/translation/translate.js:35-36,58-60`
(single path protects/restores), `public/app/services/translation/placeholder-guard.js:127-151`
(`validate()`, **no caller in `public/app/**`**).

**Reproduction A — batch path sends raw placeholders and accepts a translation that lost them:**

```js
loadStack(); setAppState();
const t = installTransport((its) => ({ content: JSON.stringify({ translations: its.map(() => "你好，你有 个项目") }) }));
const items = makeItems(2);
items[0].sourceText = "Hello %s, you have %d items";
items[1].sourceText = "Save 50% off";
const res = await makeService({ aiBatchMaxItems: 5 }).translateBatch(items, "en", "zh", "deepseek", null);
const sent = JSON.stringify(t.calls[0].body);
console.log(JSON.stringify({ sentHasRawPlaceholders: sent.includes("Hello %s, you have %d items"),
  sentHasGuardTag: sent.includes("\u00ab"),
  results: items.map(i => ({ src: i.sourceText, tgt: i.targetText, status: i.status })) }));
```

(the `validate()` caller check: `grep -rn "PlaceholderGuard" public/app` → `translate.js:35,59`, `batch.js:110-113`
and the definition itself; `grep -rn "PlaceholderGuard.validate"` → no match outside the module and `tests/`.)

**Observed:**

```json
{"sentHasRawPlaceholders":true,"sentHasGuardTag":false,
 "results":[{"src":"Hello %s, you have %d items","tgt":"你好，你有 个项目","status":"translated"},
            {"src":"Save 50% off","tgt":"你好，你有 个项目","status":"translated"}]}
```

`%s` and `%d` are gone from the target, the item is `translated`, and no warning/error is raised anywhere.
The `PlaceholderGuard.restore(translated, map)` call at `batch.js:110-115` cannot do anything: the map was
built from the *source*, but the source was never replaced by `«n»` tags in the request, so the model's
answer never contains a tag to restore (verified: `sentHasGuardTag:false`).

**Reproduction B — single path, model drops the tag (guard *is* applied here):**

```js
loadStack(); setAppState();
installTransport(() => ({ content: "你好，你有 个项目" }));
const out = await makeService().translate("Hello %s, you have %d items", "en", "zh", "deepseek");
console.log(JSON.stringify({ out, validate: PlaceholderGuard.validate("Hello %s, you have %d items", out) }));
```

**Observed:**

```json
{"out":"你好，你有 个项目","validate":{"valid":false,"missing":["%s","%d"],"extra":[]},"warnings":[]}
```

The guard *knows* the result is invalid (`missing: ["%s","%d"]`) — nothing calls `validate`, so the invalid
result is returned and stored. Two further silent-mangling variants on the same path:

| model answer | final `targetText` |
|---|---|
| `你好 «9» 世界` (invented index; `restore` leaves unmapped tags in place, `placeholder-guard.js:113-116`) | `你好 «9» 世界` — literal guillemet junk shipped |
| `«0»你好世界` (tag moved) | `%s你好世界` — placeholder silently relocated, no position check |

**Expected:** after `restore`, call `PlaceholderGuard.validate(sourceText, translated)`; on `missing`/`extra`
retry the item (single path) or mark the item as failed/needs-review (batch path) instead of storing it, and
never leave unresolved `«n»` tags in user-visible text. On the batch path, either protect the source the same
way the single path does, or drop the no-op `restore` call and validate instead.

**Impact:** `%s`, `%d`, `%1$s`, `{0}`, `{name}` are exactly what breaks an application at runtime — a lost
Android/iOS format argument, a Python `KeyError`/`IndexError`, a C `printf` crash. The user sees a green
"translated" row and ships it. This is silent corruption of the highest-consequence strings in a project.

---

### 3. Cancel does not stop queued or in-flight work: requests are still sent (and retried) after cancellation, in both the per-item path and the AI batch path

**Severity: medium**

**Location:**
per-item path — `public/app/services/translation/translate.js:40-154` (retry loop, no cancellation check at all),
`:143-152` (exponential backoff before retrying), `public/app/services/translation/batch.js:314-484`
(cancellation is only checked between items, in `processOne`/worker loop);
AI batch path — `public/app/services/translation/engines/base/ai-engine-base.js:749-877`: cancellation is checked
only *after* the response (`:877`, `:922`, `:961`), never between `await service.checkRateLimit(engineId)`
(`:749`) and the HTTP dispatch, and `_aiCreateCancelWatcher` (`:854`) cannot prevent a request from being sent
because `fetchWithTimeout` is called on the next line — an already-rejected cancel promise only makes the caller
ignore the answer.

**Reproduction A** (per-item path, Google engine, `cancelBatch()` + `networkUtils.cancelAll()`, exactly what
`business-logic.cancelTranslation()` / the Cancel button do):

```js
loadStack(); setAppState();
const t = abortableTransport(120);   // records dispatch times; cancelAll() aborts only requests already in flight
const svc = makeService({ googleApiKey: "g".repeat(39), retryCount: 3, concurrentLimit: 4 });
const items = makeItems(4);
BatchProgressStore.beginBatch({ scope: "all" });
const p = svc.translateBatch(items, "en", "zh", "google", null);
await new Promise(r => setTimeout(r, 60));
BatchProgressStore.cancelBatch();            // user pressed Cancel
globalThis.networkUtils.cancelAll();
const res = await p;
```

**Observed** (with a stricter stub that also refuses *new* requests after cancel, the count is even larger):

```json
{"cancelAtMs":76,"requestsBeforeCancel":1,"requestsAfterCancel":4,
 "allRequestTimes":[3,106,210,310,1077],"elapsedMs":1235,
 "successes":0,"errors":4,"errorSample":"用户取消","itemStatuses":["pending","pending","pending","pending"]}
```

and with the stricter stub:

```json
{"requestsBeforeCancel":1,"requestsAfterCancel":11,
 "requestStamps":[1,103,219,323,1107,1207,1307,1411,3108,3212,3324,3428],"elapsedMs":3429}
```

So after the user pressed Cancel the app (a) still dispatched the three items that were already past the
`isBatchInProgress()` gate and queued inside `checkRateLimit`, and (b) re-issued each aborted request once or
twice more through the `translate()` retry loop (visible at t≈1.1 s and t≈3.1 s — the 1 s/2 s backoff), then
discarded whatever came back (`processOne` checks `isBatchInProgress()` *after* the await, `batch.js:376-384`).
Cancellation is only honoured at the `waitWhilePaused`/item boundaries.

**Reproduction B** (AI batch path — 30 items, 6 chunks of 5, 10 ms responses, cancel 38 ms in):

```js
loadStack(); setAppState();
const t = installTransport(async (its) => { await new Promise(r => setTimeout(r, 10));
  return { content: JSON.stringify({ translations: its.map(i => "T:" + i.source) }) }; });
BatchProgressStore.beginBatch({ scope: "all" });
const p = AIEngineBase.translateBatch("deepseek", makeItems(30), "en", "zh", {},
  makeService({ aiBatchMaxItems: 5 })).catch(e => ({ err: e }));
await new Promise(r => setTimeout(r, 30));
BatchProgressStore.cancelBatch();
```

**Observed** — three further 5-item chunk requests were dispatched *after* the cancel, and cancelling *before*
the batch even starts still sends two requests:

```json
{"cancelAtMs":38,"dispatchesBeforeCancel":1,"dispatchTimesMs":[2,103,217,331],"totalDispatches":4,
 "requestedItems":[5,5,5,5],"code":"USER_CANCELLED",
 "partial":["T:source-0","T:source-1","T:source-2","T:source-3","T:source-4"]}

{"dispatches":2,"dispatchTimesMs":[0,111],"code":"USER_CANCELLED","partial":[]}   // cancel issued immediately
```

**Expected:** check `BatchProgressStore.isUserCancelled()` (a) immediately before creating the fetch in
`processChunkTask` — after the rate-limit wait, since that wait can last seconds — and (b) at the top of the
`translate()` retry loop, treating `USER_CANCELLED` as terminal instead of retrying it.

**Impact:** pressing Cancel costs money/quota on paid engines and leaves the user staring at a still-running
progress bar for 1–3.4 s (the per-item retry backoff; the mechanism is the same `checkRateLimit` wait that can
hold an abandoned retry for a full `Retry-After` cooldown). Observed waste: 4–11 extra requests in the per-item
path, up to 3 extra full chunk requests (15 extra items) in the AI batch path, plus 2 requests when the user
cancels before the first chunk is even sent. (No item loss or duplication was observed — see *Verified working*.)

---

### 4. Pause is dead code in the AI batch engine — chunk requests keep being dispatched while "paused"

**Severity: medium**

**Location:** `public/app/services/translation/engines/base/ai-engine-base.js:687-701` (`waitWhilePaused` is
defined, `pauseNotified` is defined) — **there is no call site anywhere in the function or file** (verified by
grep: only `689` and `690/694/697/700` inside the definition itself); the chunk worker loop
`:1047-1068` checks only `batchFailed` and `chunkQueue.length`.

**Reproduction** (20 items, 5 items/chunk → 4 chunks, 400 ms responses; pause 50 ms in):

```js
loadStack(); setAppState();
const t = installTransport(async (its) => { await new Promise(r => setTimeout(r, 400));
  return { content: JSON.stringify({ translations: its.map(i => "T:" + i.source) }) }; });
BatchProgressStore.beginBatch({ scope: "all" });
const p = makeService({ aiBatchMaxItems: 5 }).translateBatch(makeItems(20), "en", "zh", "deepseek", null);
await new Promise(r => setTimeout(r, 50));
BatchProgressStore.pauseBatch();                 // user pressed Pause
```

**Observed:**

```json
{"pauseAtMs":53,"dispatchesAtPause":1,"dispatchesAfterPause":4,
 "dispatchTimesMs":[2,104,204,412],"stillPausedWhenAllDispatched":true,
 "successesWhilePaused":20,"totalMs":1238}
```

Three of the four chunk requests were dispatched **after** the pause (at 104 ms, 204 ms, 412 ms) and the whole
batch finished while the store was still paused (`successesWhilePaused: 20`). The pause only takes effect in
`batch.js`'s post-processing loop (`batch.js:84`), i.e. after all API calls of the batch are done. The UI copy
promises something weaker but still wrong: "已发送暂停请求，将在当前请求完成后暂停"
(`actions.js:690-693`) — the AI path ignores that promise too.

**Expected:** await `waitWhilePaused()` at the top of `processChunkTask` (before the request is built) and/or in
the worker loop, so a paused batch stops dispatching new chunk requests, and `pauseNotified` is reported once.

**Impact:** the Pause button does not do what it says on the primary (AI batch) path: a user who pauses a long
expensive batch to stop spending still gets the entire rest of the batch sent, and cannot interrupt it except
by cancelling.

---

### 5. Markdown-fenced / prose-wrapped / bare-array JSON aborts the whole batch and degrades to per-item translation

**Severity: medium**

**Location:** `ai-engine-base.js:928-947` (`JSON.parse(content)` on the raw content, no fence/prose stripping),
`:1014-1042` (adaptive split, `_aiIsAdaptiveBatchError` treats parse failures as "chunk too big"),
`public/app/services/translation/batch.js:179-269` (whole-batch failure → fall through to the per-item path).

**Reproduction:**

```js
loadStack(); setAppState();
const t = installTransport((its) => ({ content: "```json\n" +
  JSON.stringify({ translations: its.map(i => "T:" + i.source) }) + "\n```" }));
const items = makeItems(4);
const res = await makeService({ aiBatchMaxItems: 5 }).translateBatch(items, "en", "zh", "deepseek", null);
console.log(JSON.stringify({ batchRequestSizes: t.calls.map((c, i) => t.translationsFor(i).length),
                             totalRequests: t.stats().requests,
                             successes: res.results.length, errors: res.errors.length }));
```

**Observed** (fenced response for every chunk; `fetch` count measured on the transport):

```json
{"batchRequestSizes":[4,2,1],"totalRequests":7,"successes":4,"errors":0,
 "items":[{"src":"source-0","tgt":"SINGLE:source-0","status":"translated"}, ...]}
```

The 4-item batch request failed (`BATCH_JSON_PARSE_FAILED: Unexpected token '`'`), the split retried 2 and then 1
item, then the whole batch gave up and `batch.js` re-translated the 4 items one-by-one: **7 requests for 4 items**.
The shape matrix over 8 items, one chunk:

| response shape | engine result | requests |
|---|---|---|
| plain `{"translations":[…]}` | resolved | 1 |
| ` ```json … ``` ` | rejected `BATCH_JSON_PARSE_FAILED` | 4 |
| `Sure! Here is the JSON: {…}` | rejected `BATCH_JSON_PARSE_FAILED` | 4 |
| `{…}\n\nHope this helps!` | rejected `BATCH_JSON_PARSE_FAILED` | 4 |
| bare array `["a","b",…]` | rejected `BATCH_OUTPUT_MISMATCH` | 4 |
| `{"translations":{"0":"…"}}` (keyed object) | rejected `BATCH_OUTPUT_MISMATCH` | 4 |

Request amplification is not bounded: with a model that only succeeds for ≤1-item chunks, the split cascade
takes **15 requests for 8 items** and **19 requests for 10 items** (per-item send counts 4–5; trace below).
An unbreakable single item aborts everything (sizes `[5,3,2,1,1]`, whole batch rejected even though items 0–4
had already been translated successfully).

```
PROBE mismatch trace :: requests [10],[0-4],[0-2],[0,1],[0],[1],[2],[3,4],[3],[4],[5-9],[5-7],[5,6],[5],[6],[7],[8,9],[8],[9]
                     :: perItemSendCount {"source-0":5,"source-1":5,"source-2":4,...,"source-9":4}
```

**Expected:** the response content is model prose; stripping an optional ```` ```json ```` fence and, if that
fails, extracting the outermost `{…}`/`[…]` (or accepting a top-level array as `translations`) is cheap
insurance before declaring the chunk unparseable. Note the current design also sends a *smaller* request as the
remedy for a *formatting* error, which cannot help and multiplies cost.

**Impact:** for models that reliably wrap JSON (or when `response_format` is unavailable — Claude has
`supportsJsonMode:false`, Gemini/DeepSeek variants may ignore it), the "batch" feature silently degrades into
one request per item: measured 7 requests for 4 items (1 healthy batch request + 3 wasted split attempts + 4
per-item requests) and 19 requests for 10 items in the split cascade, with a red error line in the progress log
and proportionally longer waits. No correctness loss (the fallback is correct), hence medium.

---

### 6. `null`, `""` and object entries are accepted, stored in `targetText`, and reported as successes

**Severity: medium**

**Location:** `ai-engine-base.js:938-947` (only the array length is checked), `batch.js:106-130`
(`translated = translatedList[i]` → `item.targetText = translated; item.status = "translated"`;
`results.push({success:true, result: translated})`).

**Reproduction:**

```js
loadStack(); setAppState();
installTransport((its) => ({ content: JSON.stringify({ translations: its.map((i, n) => n === 1 ? null : n === 2 ? "" : "T:" + i.source) }) }));
const items = makeItems(4);
const res = await makeService({ aiBatchMaxItems: 5 }).translateBatch(items, "en", "zh", "deepseek", null);
```

**Observed:**

```json
{"successes":4,"errors":0,
 "items":[{"src":"source-0","tgt":"T:source-0","status":"translated"},
          {"src":"source-1","tgt":null,"status":"translated"},
          {"src":"source-2","tgt":"","status":"translated"},
          {"src":"source-3","tgt":"T:source-3","status":"translated"}],
 "successFlags":[true,true,true,true]}
```

With objects instead of strings the object is written verbatim:

```json
{"items":[{"tgt":{"key":"","text":"T:source-0"},"type":"object","status":"translated"}, ...]}
```

The single-item path only rejects a *missing* content field (`EMPTY_RESPONSE`, `ai-engine-base.js:566-571`; an
empty string is returned as `""`), while the batch path rejects a wholly empty chunk response but accepts
`null`/`""`/objects *inside* the `translations` array — so nothing anywhere turns a per-item empty result into
an error. `TMAutoApply.saveBatch` filters falsy targets, and `applyTerminologyToTranslation` returns
non-strings unchanged, so nothing downstream repairs or rejects it either.

**Expected:** validate the entry types in the batch response (`typeof translations[i] === "string"` and
non-empty after trim) and mark the offending items as failed (or retry them individually) instead of stamping
them `translated`.

**Impact:** the item shows as translated in the UI/state and is counted as a success, but the shipped file has no
translation for it. *(read-level, not executed)* the Android/XML exporters treat an empty target as "no
translation" and write an empty `<string>` or the original text (`translation-formats.js:225-234`), and the
"export only translated items" filter drops the item entirely because it requires
`targetText.trim() !== ""` (`translation-entry.js:48-68`) — a silent hole in the delivered file. An object
`targetText` additionally breaks every consumer that assumes a string (`translation-entry.js:43`,
`translation-formats.js:17`, `quality/checks.js:196` all call `.trim()`/`.substring()` on it) — those would
throw, not degrade.

---

### 7. Items over 10 000 characters are truncated before the request and still marked `translated`

**Severity: medium**

**Location:** `public/app/services/security-utils.js:172-180` (`sanitizeForApi` → `.substring(0, 10000)`),
`ai-engine-base.js:751-761` (per-item sanitize in the batch path), `:133-143` + `:121-131` (the one-shot warning),
`ai-engine-base.js:425-431` (single path).

**Reproduction:**

```js
loadStack(); setAppState();
const t = installTransport((its) => ({ content: JSON.stringify({ translations: its.map(i => "SHORT:" + i.source.length) }) }));
const items = makeItems(2);
items[0].sourceText = "A".repeat(12000);
const res = await makeService({ aiBatchMaxItems: 5 }).translateBatch(items, "en", "zh", "deepseek", null);
```

**Observed:**

```json
{"sourceLength":12000,"sentLength":10000,"truncationWarned":true,
 "targetText":"SHORT:10000","status":"translated","successes":2}
```

(single path: `{"sentLength":10000}` as well). The engine warns via a toast/log, but the item is stored and
exported as a finished translation of a text that is 2 000 characters shorter than the source. The warning is
*once per session* (`_aiLongTextNotified`, `:121-131`), so the second oversized item produces no user-visible
signal at all.

**Expected:** an oversized item should be marked as failed/needs-review with the reason, or sent through a
chunked translation strategy, rather than silently stored as complete. At minimum the warning should be per item.

**Impact:** long help texts / descriptions silently lose their tail in the exported resource file while the UI
reports 100 % completion; the user must diff the exports to notice.

---

### 8. `PlaceholderGuard` false positives: ordinary percent text is mangled before being sent to the model

**Severity: medium**

**Location:** `public/app/services/translation/placeholder-guard.js:21` — the printf pattern's flag class
`[-+0 #]*` contains a literal **space**, so `%` + space + one of `diouxXeEfgGcspn%@` matches as a printf
specifier (`% o`, `% d`, `% n` are valid C, which is why the pattern matches percent-then-word text);
`:127-151` (`validate` inherits the same false positives).

**Reproduction:**

```js
loadStack();
for (const s of ["Save 50% off", "100% done", "Over 90% of users", "50% de réduction"])
  console.log(s, "->", JSON.stringify(PlaceholderGuard.protect(s)));
console.log(JSON.stringify(PlaceholderGuard.validate("Save 50% off", "节省 50%")));
```

**Observed:**

```json
"Save 50% off"        -> {"text":"Save 50«0»ff","map":[{"original":"% o"}]}
"100% done"           -> {"text":"100«0»one","map":[{"original":"% d"}]}
"Over 90% of users"   -> {"text":"Over 90«0»f users","map":[{"original":"% o"}]}
"50% de réduction"    -> {"text":"50«0»e réduction","map":[{"original":"% d"}]}
validate("Save 50% off","节省 50%") = {"valid":false,"missing":["% o"],"extra":[]}
```

and on the real single-item path the request body contains the mangled text:

```json
{"userMsgSent":"Save 50«0»ff", "returned":"节省 50% 优惠"}
```

The mangling swallows the first letter of the following word (`off` → `«0»ff`, `done` → `«0»one`,
`discount` → `«0»iscount`). If the model preserves the tag, `restore` happens to put the percent text back; if it
drops the tag, the repaired text is whatever the model produced for a corrupted source, and if it moves the tag
the tag is restored at the wrong place (the tag-movement table in finding 2). Any string containing a
percentage followed by a space is affected, which is common UI copy.

**Expected:** `% o` / `% d` / `% n` are legal C `printf` formats (the space is the sign flag, `o`/`d`/`n` are
conversions) — the pattern is not "wrong" as a C parser, it is wrong *for natural-language UI copy*, where
`NN% word` is overwhelmingly a percentage. Dropping the space from the flag class (keeping `%s`, `%d`, `%1$s`,
`%02d`, `%-10.2f`, `%.2f`) removes the false positives at negligible cost, and a guard that feeds its output
back into the *source* of an API request should prefer precision over completeness.

**Impact:** a large class of ordinary strings is sent to the model pre-corrupted, degrading translation quality
and creating an unnecessary restore dependency; if the guard's validator were wired up (finding 2), these
strings would be flagged as broken on every correct translation.

---

### 9. ICU MessageFormat placeholders are only partially protected (nested braces)

**Severity: low**

**Location:** `public/app/services/translation/placeholder-guard.js:9` — `/\{[a-zA-Z_]\w*\s*,\s*(?:plural|select|selectordinal)\s*,[\s\S]*?\}/g`
is lazy and stops at the **first** `}`, i.e. inside the plural body.

**Reproduction:**

```js
loadStack();
const r = PlaceholderGuard.protect("You have {count, plural, one {# item} other {# items}} left");
console.log(JSON.stringify(r.text), JSON.stringify(r.map.map(m => m.original)));
```

**Observed:**

```json
"You have «0» other {# items}} left"   ["{count, plural, one {# item}"]
```

Only the first branch is protected; the `other {# items}}` part (including the ICU keyword `other` and the
closing braces) is sent to the model unprotected and unbalanced. The identity round-trip still works
(`restore(protected) === source`), so this is not a regression versus no guard at all — but it means ICU
messages get no protection for the branches that matter, and the model sees a malformed string (unbalanced
braces) which invites further damage.

**Expected:** match the whole ICU construct, including nested braces (brace-depth-aware scan or a stricter
pattern), so the entire `{count, plural, …}` expression is replaced by one tag, or explicitly skip ICU
messages if they cannot be protected correctly.

**Impact:** plural/select messages — the ones most sensitive to structural corruption — are translated with the
ICU keywords (`one`/`other`) exposed; a translated keyword makes the message unparseable by ICU formatters
(i18next/FormatJS/Android plurals) at runtime, and the guard gives the user no warning.

---

### 10. `BatchResumeManager` (断点续传) is dead code, and its batch id collides between different batches

**Severity: low**

**Location:** `public/app/services/translation/batch-resume.js:125-130` (`generateBatchId`),
whole module: `saveProgress`/`markCompleted`/`getPendingIndices`/`hasResumableProgress`.

**Reproduction:**

```js
// grep for production callers of BatchResumeManager:
//   public/app.js:104  -> only loads the file
//   tests/batch-resume.test.mjs   -> the only callers in the repository
loadStack();
loadSource("public/app/services/translation/batch-resume.js");
const a = [{sourceText:"Same first"},{sourceText:"middle A"},{sourceText:"Same last"}];
const b = [{sourceText:"Same first"},{sourceText:"middle B"},{sourceText:"Same last"}];
console.log(BatchResumeManager.generateBatchId(a, "deepseek") === BatchResumeManager.generateBatchId(b, "deepseek"));
```

**Observed:**

```
true    // "deepseek:3:Same first|Same last" for both batches
```

and a repository-wide grep for `BatchResumeManager|markCompleted|saveProgress` finds no production caller —
`batch.js`, `business-logic.js`, `actions.js` and the AI engine never touch it.

**Expected:** either wire the manager into the batch lifecycle (save progress with a batch id derived from the
item set — e.g. a hash over all item ids/keys, not just count + first/last 50 chars) or delete the module. As
written, resuming an interrupted batch would skip items belonging to a *different* batch that happens to share
count and first/last source strings.

**Impact:** the advertised "resume after interruption" feature does not exist at runtime. Today the practical
damage is limited, because item statuses (`pending`, `batch.js:206/409`) already preserve per-item progress and
a re-run only picks up `pending` items — but this file's tests give a false impression that the feature is live.

---

### 11. `TranslationDiff` normalizes whitespace before hashing → whitespace-only source changes are invisible

**Severity: low**

**Location:** `public/app/services/translation/translation-diff.js:10-17` (`hashText` collapses `\s+` to `" "`
and trims before hashing), used by `createSnapshot` (`:24-47`) and `compare` (`:55-130`);
`markForRetranslation` (`:141-168`) then never marks the item.

**Reproduction:**

```js
loadStack();
loadSource("public/app/services/translation/translation-diff.js");
const items = [{ id:"k1", sourceText:"Save  50% off", targetText:"省 50%", metadata:{} },
               { id:"k2", sourceText:"Hello", targetText:"你好", metadata:{} }];
TranslationDiff.createSnapshot("f", items);
const updated = [{ id:"k1", sourceText:"Save 50%  off", targetText:"省 50%", metadata:{}, status:"translated" },
                 { id:"k2", sourceText:"Hello", targetText:"你好", metadata:{}, status:"translated" }];
const diff = TranslationDiff.compare("f", updated);
console.log(JSON.stringify({ changed: diff.changed.length, unchanged: diff.unchanged.length, summary: diff.summary,
                             marked: TranslationDiff.markForRetranslation(updated, diff) }));
```

**Observed:**

```json
{"changed":0,"added":0,"removed":0,"unchanged":2,"summary":"2 条未变化","marked":0,"statuses":["translated","translated"]}
```

The item's source changed (`"Save  50% off"` → `"Save 50%  off"` — note the app preserves such spacing when
exporting XML/JSON), but the diff reports "no change" and the existing translation is kept silently.

**Expected:** hash the raw source (or at least distinguish "leading/trailing/internal whitespace changed" from
"identical"), so the incremental-translation feature re-marks genuinely edited strings. Whitespace
normalization is right for TM *lookup* (fuzzy matching) but wrong for change detection.

**Impact:** after editing a source file (e.g. fixing spacing in a string), the "incremental translation" flow
leaves the old translation in place with no way for the user to see that the string changed — a stale
translation ships.

---

### 12. `ModelFetcher.deriveModelsUrl` drops the query string

**Severity: low**

**Location:** `public/app/services/translation/model-fetch.js:111-125` (uses `u.origin + path + "/models"` only),
consumed at `:92-102` (`_resolveEndpoint`, custom engines only) and `custom-engine.js:87-92`.

**Reproduction:**

```js
loadStack();
loadSource("public/app/services/translation/model-fetch.js");
console.log(ModelFetcher.deriveModelsUrl("https://host/openai/deployments/gpt4/chat/completions?api-version=2024-02-01"));
```

**Observed:**

```
https://host/openai/deployments/gpt4/models        // query string dropped
```

**Expected:** endpoints that authenticate/version through query parameters (Azure OpenAI style) cannot be
derived by dropping `/chat/completions`; either preserve the query string or skip derivation when the apiUrl has
an `api-version`-style query and let the user configure `modelsEndpoint` explicitly.

**Impact:** custom engines configured with an Azure-style URL always answer "模型列表获取失败 (HTTP 404)" for
"从 API 获取" — the model list can only be entered by hand. Everything else about the derivation is correct
(`/v1/chat/completions` → `/v1/models`, `/chat/completions` → `/models`, `/v1` → `/v1/models`, trailing slash,
`localhost:11434`), and `parseModelsResponse`/`defaultModelFilter` behave correctly on the samples tested
(strips a `models/` prefix, drops embedding/whisper/translate models, filters `null` entries).

---

## Verified working

These areas were tested and behaved correctly — no defect found:

* **Chunking has no off-by-one and drops nothing.** `_aiChunkItems` (`ai-engine-base.js:90-116`) honours
  `maxItems` exactly (`[5,5,2]` for 12 items at `maxItems=5`) and the per-chunk character budget
  (`maxChars=1000` → per-chunk cost `[290,290,118]`), and an item whose own cost exceeds `maxChars` simply gets
  its own chunk (`[1,1,1]` for a 5000-char item) rather than being dropped or looping. The settings clamps are
  applied (`maxItems` → 5..100, `maxChars` → 1000..20000); note a user value below 5 is silently raised to 5.
* **The engine's own result bookkeeping is sound.** Across 137 resolved runs of a 200-run randomized fuzz
  (random item counts, chunk limits, concurrency, malformed envelopes, flaky 503s) and 96 classified runs,
  `outputs.length === items.length` always held and `outputs[i]` was always the translation of `items[i]` when
  the model answered in the documented order — including through nested adaptive splits, retries, chunk
  re-splitting and out-of-order chunk completion (`buildOrderedOutputs`, `:727-735`).
* **Cancel keeps partial progress lossless and correctly aligned.** `partialOutputs` is a strict prefix in item
  order (chunk 0 = `source-0..source-4` → `["T:source-0",…,"T:source-4"]`; verified again in a 6-chunk /
  3-worker run), `batch.js:188-214` maps it back to `items[i]` exactly, remaining items are left `pending`
  (never mis-assigned, never duplicated). When a later chunk finishes before an earlier one, the prefix is empty
  and all items stay `pending` — conservative, no corruption (the completed chunk's work is discarded and
  re-requested on resume: cost, not data loss). The *requests* sent after a cancel are finding 3.
* **429 handling does not lose work.** Verified with 25 items / 5 chunks: a 429 on chunk 0 meant chunks 1–4 were
  never dispatched (one request total); a 429 with `Retry-After: 1` produced a retry after 1003 ms and a
  successful result; a 429 without the header reported a 30 s cooldown (`reportRateLimit`, `rate-limit.js:61-75`)
  and the batch's error path forwarded the parsed `retryAfter` to the shared cooldown (`batch.js:253-257`) before
  `batch.js` re-translated the items individually, so the user still gets translations.
* **Rate limiting works as configured.** Measured inter-request spacing: DeepSeek `rateLimitPerSecond: 10` →
  gaps `[102,108,104,104] ms`; Gemini `0.25` → `4005 ms`. Google Translate's `rateLimitPerSecond: 10` equals its
  documented default quota (600 requests/minute) and is enforced by the same limiter; the per-item path also caps
  workers at `min(concurrentLimit (default 5), ceil(rps))` (`batch.js:303-309`), so the engine's RPS is not
  exceeded by concurrency. `_ensureRateLimitEntry` correctly back-fills engines registered at runtime.
* **Retry semantics are sane in the single path.** `retryCount` = number of attempts (2 failures + success =
  3 requests), exponential backoff 1 s/2 s, auth/quota/context-length errors stop retrying immediately
  (`translate.js:68-121`), and the final error keeps `status`.
* **Truncation detection.** `finish_reason: "length"`, Claude's top-level `stop_reason: "max_tokens"` and Gemini's
  `candidates[].finishReason` are all detected before parsing (`_aiTruncatedBatchResponse`, `:167-181`),
  triggering the adaptive split instead of storing a truncated JSON.
* **API keys are not leaked in the engine layer.** With a distinctive key, a full capture of every `loggers.*`
  call, the thrown error message/stack and every request URL contained no key material; keys travel in headers
  (`Authorization: Bearer …`, `x-api-key` + `anthropic-version`, `X-Goog-Api-Key`) and never in query strings for
  the built-in providers, and a 401 is converted to a friendly message
  (`DeepSeek API 密钥无效或未配置，请在设置中检查`) while keeping the provider's text out of user-facing state.
* **Placeholder round-trip works when the model cooperates** (`Hello %s and %d items` → tags preserved in place →
  restored exactly), including `${user}`, `{0}`/`{name}`, `%1$s`, `%02d`, `<b>`, `&amp;`, `\n`. One cosmetic
  oddity: the tag numbering is assigned in pattern order, so `Use {0} and {name}` becomes `Use «1» and «0»`.
* **Neighbour context (`aiContextAwareEnabled`) and priming** build the expected prompt fragments from the
  project/view items (verified against the produced system message).
* **Existing suite:** 24 files / 373 tests pass before and after this review (all probes lived outside `tests/`).

## Not verified / limitations

* `TranslationMemory` (IndexedDB) could not be exercised: jsdom has no IndexedDB and no polyfill is installed,
  so `save`/`lookupExact`/`fuzzyMatch`/`saveBatch` were not run. Code inspection suggests a duplicate-entry race
  in `save()` (`lookupExact()` resolves *before* the `readwrite` transaction, and `saveBatch` runs 50 saves
  concurrently — two saves of the same source can both see "not found" and both `add`), which would make
  `lookupExact` return the first (possibly stale) entry. **This was not reproduced and is therefore not filed as
  a finding** — it needs a browser or `fake-indexeddb`.
* The export/quality modules downstream of the engine (`features/translations/export/**`, `features/quality/**`)
  were read for impact statements only; no export was executed end-to-end (findings 2/6/7 mark those statements
  as read-level).
* No live provider was contacted; all model behaviour is simulated at the `fetch` boundary. Every finding is a
  statement about how the code handles a *given* response, not a claim about how often a provider produces it.
