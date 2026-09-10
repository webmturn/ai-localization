# UI Wiring Integrity Review

**Target:** `public/index.html` (2631 lines) + `public/app/**` (141 JS files) + `public/app.bundle.js`
**Date:** review performed against the working tree at `D:\laster\html`
**Scope:** Does every interactive element in the HTML actually connect to working code?
**No application source file was modified.** Only this report was created.

---

## Method

Cross-referencing was done **mechanically**, never by eye:

1. **Scratch cross-reference script** (Node, temp file, since removed) extracted:
   - every `id="…"` attribute from `index.html` with tag name and line number,
     using an **attribute-boundary-aware** regex `(?<![-\w])id\s*=\s*"([^"]*)"`
     (the naive `\bid=` regex also matches the tail of `data-check-id="…"` /
     `data-shortcut-id="…"` and inflated the id count from 396 → 422 — this bug was
     found and fixed during the audit);
   - every `data-*` attribute, inline `on*=` handler, `<link>`/`<script src>` reference, and `<button>`;
   - from JS: `DOMCache.get(…)`, `getElementById(…)`, `querySelector/All('…#id')`,
     `closest/matches('#id')`, `DOMCache.query('#id')`, and any quoted `'#id'` CSS-id string,
     plus JS-side id creation (`setAttribute('id',…)`, `.id = '…'`, `id="…"` in templates).
2. **Precision checks** — targeted greps per candidate id across `index.html`, `styles.css`
   and the whole JS tree, so that ids wired through object-literal delegation maps
   (`const menuActions = { mobileOpenProjectBtn: … }`), id-building template strings
   (`` `terminology${tabName…}Panel` ``), or helper wrappers (`openModal("x")`, `__el("x")`)
   were **not** falsely reported as dead.
3. **Empirical verification in jsdom** — the real `index.html` + `public/app.bundle.js`
   were booted in jsdom (`jsdom@28`, already a devDependency). The app booted successfully
   and **224 `addEventListener` registrations** were observed. `EventTarget.prototype.addEventListener`
   was instrumented beforehand so per-element listener coverage could be measured, and synthetic
   `KeyboardEvent`s were dispatched to measure guard behaviour.

### Sanity checks performed on the tooling (before trusting output)

| Check | Result |
|---|---|
| Duplicate-id detection re-run with a second, independently written regex | identical: **0 duplicates** (396 vs 396 unique) |
| Known-good ids verified as both present **and** looked up | `sourceLanguage`, `targetLanguage`, `translationSearchInput`, `translationScrollWrapper`, `qualityRuleCards`, `shortcutsList`, `exportBtn`, `inlineProgressBar` — all resolve |
| Known-good id verified as present but *not* looked up (control for orphan logic) | `filterSourceBtn` correctly reported orphaned |
| False-positive hunt on every orphan candidate | 25 of 38 candidates proved to be wired via delegation maps / helpers / built ids — removed from the findings |
| Load-order detector negative control | 344 depth-0 call candidates scanned, 297 resolved to a global definition → detector proven to see real calls; forward-ref count 0 |
| Duplicate-id / keyword-as-id false positive | avoided by the attribute-boundary regex (see above) |

---

## Summary counts

| Category | Count | Severity mix |
|---|---|---|
| **Dangling DOM lookups** (unique ids / call sites in `public/app/**`) | **4 ids / 8 call sites** | 1 high, 3 medium (same root cause) |
| **Orphaned element ids** (never referenced anywhere in JS/CSS) — *dead interactive UI* | **2** | 2 medium |
| **Orphaned element ids** — *stale, never-updated display element* | **1** | low |
| **Orphaned element ids** — *benign: layout/CSS hooks & pure wrappers* | **7** | info |
| **Orphaned element ids** — *`aria-labelledby` targets (correct, not a defect)* | **18** | none |
| **Duplicate `id` attributes in `index.html`** | **0** | — |
| **Missing assets referenced by `index.html`** | **0 / 4 top-level** | — |
| **Missing Font Awesome webfont binaries** | **6 files** (1 relevant, **0 brand icons used**) | low |
| **Buttons missing `type`** (no `<form>` exists → no submit risk) | 109 / 139 | low |
| **Buttons with no accessible label in static HTML** | 1 / 139 | low |
| **`<script>`/`<link>` refs in `index.html`** | 4 links, 0 `src=` scripts (loader is inline) | — |
| **Loader script refs (`public/app.js`)** | 127 refs, **0 missing on disk** | — |
| **Parse-time dependency inversions in the load order** | **0** | — |
| **Unreferenced source files** (not loaded, not lazily loaded) | 2 | low |

---

## Findings

### 1. Global `keydown` swallows `Shift+Enter` inside text fields and launches "translate all"

**Severity: high**

**Location:** `public/app/ui/event-listeners/keyboard.js:355-363` (dispatch block), `:196-199` (`translateAll` action, **no editability guard**), `:305-311` (the `isEditable` value that is computed but never consulted before `preventDefault`)

**Evidence**

```js
// keyboard.js:355-363
const keyStr = eventToKeyString(e);
const effective = getEffectiveShortcuts();
const actionId = effective[keyStr];
if (actionId) {
  e.preventDefault();                 // <-- unconditional
  e.stopImmediatePropagation();
  runAction(actionId, e);
  return;
}
```

`runAction` guards *some* actions on editability (`clearTargets` :180, `selectCurrentPage` :206, `prevItem/nextItem` :212, `runQualityCheck` :252) but **not** `translateSelected` (:192) or `translateAll` (:196). `Shift+Enter` is bound to `translateAll` (`keyboard.js:15`, `defaultKeys: "shift+enter"`).

Empirical jsdom result (instrumented `window.translateAll` call counter + `defaultPrevented`):

```
{ "label": "#sourceEditorContent (textarea)",
  "Shift+Enter": { "prevented": true, "triggeredTranslateAll": true },
  "Ctrl+Enter":  { "prevented": true, "triggeredTranslateSelected": true },
  "Enter(plain)":{ "prevented": false } }
{ "label": "#projectPromptTemplateGeneral (textarea)",
  "Shift+Enter": { "prevented": true, "triggeredTranslateAll": true } }
{ "label": "#termDefinition (textarea)",
  "Shift+Enter": { "prevented": true, "triggeredTranslateAll": true } }
{ "label": "#searchInput (input)",
  "Shift+Enter": { "prevented": true, "triggeredTranslateAll": true } }
translateAllCalls: 4          # one per focused field
```

**Impact:** `Shift+Enter` is the universal "insert newline without submitting" gesture in a textarea. With focus in **any** `textarea` or `input` — the source-file editor (`#sourceEditorContent`), all four Prompt-template editors, the terminology definition box, every file/translation search box — the keystroke is cancelled (no newline is inserted) **and a whole-project translation is started**. In the source-file editor this is especially destructive: the user cannot add a line break and instead kicks off a paid API batch.

---

### 2. `Ctrl+A` (select all) is suppressed inside every text field and does nothing

**Severity: high**

**Location:** `public/app/ui/event-listeners/keyboard.js:358-360` (`preventDefault` before the guard) + `:204-209` (`selectCurrentPage` action returns early when editable)

**Evidence**

```js
// keyboard.js:204-209
if (id === "selectCurrentPage" && typeof selectCurrentPageTranslationItems === "function") {
  const target = e && e.target;
  const isEditable = !!(target && (target.isContentEditable || target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" || target.tagName === "SELECT"));
  if (!isEditable) selectCurrentPageTranslationItems();   // <-- editable: nothing happens
  return;
}
```

but `preventDefault()` has **already** run at line 359. Empirical:

```
{ "key": "Ctrl+A (select all in field)", "preventDefault": true, "modalOpened": [], "focusAfter": "projectPromptTemplateGeneral" }
```

**Impact:** `Ctrl+A` / `Cmd+A` never selects the text in any input or textarea (source editor, Prompt templates, search boxes, term definition, API-key fields) and performs no application action either — the shortcut is registered for both `ctrl+a` and `meta+a` (`keyboard.js:17, 49-54`), so this affects Windows/Linux **and** macOS. The user must drag-select by mouse.

---

### 3. `Ctrl+Enter` inside text fields triggers translation, and `Ctrl+F` steals focus out of the field

**Severity: medium**

**Location:** `public/app/ui/event-listeners/keyboard.js:168-177` (`focusSearch`, unguarded), `:192-195` (`translateSelected`, unguarded), `:147-155` / `:164-167` / `:184-191` (modal-opening actions, unguarded)

**Evidence** (focused field = `#projectPromptTemplateGeneral`)

```
{ "key": "Ctrl+Enter",                    "preventDefault": true, "focusAfter": "projectPromptTemplateGeneral" }
{ "key": "Ctrl+F (find)",                 "preventDefault": true, "focusAfter": "translationSearchInput" }
{ "key": "Ctrl+,",      "preventDefault": true, "modalOpened": ["settingsModal"] }
{ "key": "Ctrl+Alt+N",  "preventDefault": true, "modalOpened": ["newProjectModal"] }
{ "key": "Ctrl+Alt+T",  "preventDefault": true, "modalOpened": ["terminologyModal"] }
{ "key": "Ctrl+Alt+Q",  "preventDefault": true, "modalOpened": ["qualityReportModal"] }
{ "key": "Ctrl+Alt+R",              "preventDefault": true, "modalOpened": [] }   # swallowed, no action
{ "key": "Ctrl+Shift+Backspace",    "preventDefault": true, "modalOpened": [] }   # swallowed, no action
{ "key": "Ctrl+Alt+ArrowUp",        "preventDefault": true, "modalOpened": [] }   # swallowed, no action
```

**Impact:** While typing, `Ctrl+F` cancels the browser's own find and yanks focus into the translation search box; `Ctrl+Enter` launches a selective translation; four more chords open modals on top of a half-written editor; and three chords are swallowed entirely with no effect (`Ctrl+Alt+R`, `Ctrl+Shift+Backspace`, `Ctrl+Alt+ArrowUp/Down`) — the text field loses those keystrokes for nothing.

---

### 4. Dangling DOM lookups: 4 ids, 8 call sites in `TranslationUIController`

**Severity: medium**

**Location:** `public/app/features/translations/ui-controller.js:55, 63, 71, 79` and `:314, 315, 316, 317`
(the same code is present in the shipped `public/app.bundle.js`, so this is live, not source-only)

**Evidence**

```js
// ui-controller.js:55-84
const translateSelectedBtn = DOMCache.get('translateSelected');   // :55  -> no such id
const translateAllBtn      = DOMCache.get('translateAll');        // :63  -> no such id
const cancelBtn            = DOMCache.get('cancelTranslation');   // :71  -> no such id
const pauseBtn             = DOMCache.get('pauseTranslation');    // :79  -> no such id
if (pauseBtn && this.eventManager) { … }                          // guard -> silently skipped
```

The real ids in `index.html` all carry the `Btn` suffix:

| Looked up as | Actual id in `index.html` | Line |
|---|---|---|
| `translateSelected` | `translateSelectedBtn` | 202 |
| `translateAll` | `translateAllBtn` | 205 |
| `cancelTranslation` | `cancelTranslationBtn` | 663 |
| `pauseTranslation` | `pauseTranslationBtn` | 686 |

Empirical jsdom probe (`document.getElementById`):

```
MISSING #pauseTranslation      EXISTS #pauseTranslationBtn
MISSING #translateSelected     EXISTS #translateSelectedBtn
MISSING #translateAll          EXISTS #translateAllBtn
MISSING #cancelTranslation     EXISTS #cancelTranslationBtn
```

Bundle confirmation:

```
bundle DOMCache.get("translateSelected") occurrences: 2
bundle DOMCache.get("pauseTranslation")  occurrences: 2
```

**Interference note (this is why it is "medium", not "critical"):** the `...Btn` elements are correctly wired elsewhere — `file-panels.js:248-271, 403-407` — and the canonical `updateTranslationControlState()` lives in `progress.js:39-72` with the correct ids and is called first (`ui-controller.js:309-311`). jsdom confirms each button carries **exactly one** direct `click` listener:

```
"translateSelectedBtn": { "clickListenerOnSelf": true, "clickTypesOnSelf": ["click"] }
"translateAllBtn":      { "clickListenerOnSelf": true, "clickTypesOnSelf": ["click"] }
"cancelTranslationBtn": { "clickListenerOnSelf": true, "clickTypesOnSelf": ["click"] }
"pauseTranslationBtn":  { "clickListenerOnSelf": true, "clickTypesOnSelf": ["click"] }
```

**Impact:** `TranslationUIController.bindTranslationControls()` is a silent no-op — buttons never receive a listener from it. Because the duplicated `BusinessLogic`/`progress.js` path exists, users do not currently lose the feature: **the feature is not visibly broken, only the controller's own wiring is dead**, and the enable/disable lines `ui-controller.js:319-322` never execute. This is exactly the failure mode the file-loss incident was expected to produce, and it will become user-visible the moment the redundant path is removed. Fix = rename the four strings to `…Btn`.

---

### 5. Dead UI: `#filterSourceBtn` and `#filterTargetBtn` do nothing

**Severity: medium**

**Location:** `public/index.html:305` (`#filterSourceBtn`), `public/index.html:314` (`#filterTargetBtn`)

**Evidence** — these two strings occur **exactly once each in the entire project** (in the HTML that defines them), and nowhere in any JS file, in `styles.css`, or in the bundle:

```
ID "filterSourceBtn"  (index.html:305, <button>)
   public/index.html:305  ... <button id="filterSourceBtn" class="text-xs md:text-sm ...
   -> total textual occurrences outside bundle: 1
ID "filterTargetBtn"  (index.html:314, <button>)
   public/index.html:314  ... <button id="filterTargetBtn" class="text-xs md:text-sm ...
   -> total textual occurrences outside bundle: 1
```

```
id                           index.html styles.css bundle
filterSourceBtn              1          0          0
filterTargetBtn              1          0          0
```

jsdom listener probe — no direct `click` listener, and no delegated ancestor handler:

```
"filterSourceBtn": { "clickListenerOnSelf": false, "clickListenerOnAncestor": ["body.bg-gray-50"] }
"filterTargetBtn": { "clickListenerOnSelf": false, "clickListenerOnAncestor": ["body.bg-gray-50"] }
```

The single `document.body` click listener is `ui/event-listeners/data-and-ui.js:465-485` — the cosmetic `.btn-click-spin-trigger` rotation effect. It only reacts to `e.target.closest(".btn-click-spin-trigger")`, does not dispatch on ids, and neither button carries that class (`class="text-xs md:text-sm text-gray-500 dark:text-gray-400 hover:text-primary"`), so it cannot activate them.

**Impact:** The two filter icons next to the `原文` / `译文` column headers (`index.html:305, 314`) are rendered, focusable, hover-styled buttons that a user can click with **no effect whatsoever**. Nothing in the app filters the source or target column.

---

### 6. `#qualityIssueBadge` is declared but never updated

**Severity: low**

**Location:** `public/index.html:398`

**Evidence**

```html
<span class="tab-badge hidden" id="qualityIssueBadge">0</span>
```

Zero occurrences of the string `qualityIssueBadge` outside `index.html` (HTML 1 / styles.css 0 / bundle 0), i.e. no code ever removes the `hidden` class or sets its text.

**Impact:** The quality-report tab badge is permanently invisible and permanently reads `0`. Purely cosmetic; no interaction is lost.

---

### 7. Missing Font Awesome webfont binaries after the restore

**Severity: low**

**Location:** `public/lib/font-awesome/webfonts/`

**Evidence** — the stylesheet's `@font-face` rules resolve like this:

```
url() refs in all.min.css: 8
MISSING: ../webfonts/fa-brands-400.woff2  -> public/lib/font-awesome/webfonts/fa-brands-400.woff2
MISSING: ../webfonts/fa-brands-400.ttf
ok:      ../webfonts/fa-regular-400.woff2
MISSING: ../webfonts/fa-regular-400.ttf
ok:      ../webfonts/fa-solid-900.woff2
MISSING: ../webfonts/fa-solid-900.ttf
MISSING: ../webfonts/fa-v4compatibility.woff2
MISSING: ../webfonts/fa-v4compatibility.ttf
missing: 6
```

Files actually present:

```
public/lib/font-awesome/css/all.min.css
public/lib/font-awesome/webfonts/fa-regular-400.woff2
public/lib/font-awesome/webfonts/fa-solid-900.woff2
```

**Impact: none today, low risk.** The `.woff2` source is listed **first** in every `src:` list (`src:url(../webfonts/fa-solid-900.woff2) format("woff2"),url(../webfonts/fa-solid-900.ttf) format("truetype")`), and every browser that runs this app supports woff2, so the missing `.ttf` fallbacks are harmless. `fa-brands-400.woff2` is absent entirely, which would break brand icons — but **no brand icon is used**: the 54 distinct icon classes in `index.html` all resolve against the Free solid/regular fonts (`grep 'fa-brands|fa-v4compatibility' public/index.html` → no matches). Restoring `fa-brands-400.woff2` (or dropping the brand `@font-face`) closes the gap.

---

### 8. Buttons without `type` and one button without an accessible label

**Severity: low**

**Location:** `public/index.html:2410` (`#notificationActionBtn`), plus 109 of 139 buttons overall

**Evidence**

```
buttons: 139   no label: 1   no type: 109   no id: 41

{
 "id": "notificationActionBtn",
 "line": 2410,
 "text": "",
 "hasAria": false,
 "hasTitle": false,
 "hasIcon": false
}
```

**Impact: none functionally.**
- `<form>` does not appear anywhere in `index.html` (`grep '<form|</form|onsubmit' public/index.html` → no matches), so a missing `type` cannot cause an unexpected submit. It remains a latent robustness issue if a form is ever introduced.
- `#notificationActionBtn` is filled in at runtime before it is shown — `notification.js:103` sets `actionBtn.textContent = opts.actionLabel || '撤销'` and only then unhides `#notificationActions` — so its empty static label is not user-visible. Flagged only because a static-HTML audit reports it.

---

### 9. Two source files are loaded by nothing

**Severity: low**

**Location:** `public/app/core/event-binding-manager.js`, `public/app/features/translations/export.js`

**Evidence** — every `app/*.js` path string in the tree was collected and compared with the files on disk:

```
### source files never referenced anywhere ###
   UNREFERENCED: app/core/event-binding-manager.js
   UNREFERENCED: app/features/translations/export.js

(referenced set size = 139, files on disk = 141)
```

`export.js` is a compatibility shim whose whole body is a loader for `app/features/translations/export/*.js` (`export.js:39-50`), but those parts are already loaded eagerly by `public/app.js` (`featureScripts`, lines 149-152) or lazily by `utils.js:345-374`, so the shim is never reached. `app.js:65` documents `event-binding-manager.js` as intentionally unused.

**Impact:** none at runtime (dead weight only). Relevant to the file-loss review as a "was this file supposed to be loaded?" question — answer: no.

---

### 10. `#qualityRuleCardsContainer` is a pure wrapper with no reader

**Severity: info**

**Location:** `public/index.html:1073`

`qualityRuleCardsContainer` occurs once in `index.html` and nowhere else. Its **child** `#qualityRuleCards` (`index.html:1075`) *is* looked up (`features/quality/ui.js:2`), and the individual cards are found by `.quality-rule-card[data-check-id]` (`ui.js:15`). The wrapper is redundant but harmless.

---

## Raw data

### Full list of dangling DOM lookups

All lookups in `public/app/**`: **652** total
(`DOMCache.get` 588, `getElementById` 58, `querySelector/All('#id')` 6).
Ids that do not resolve to an element in `index.html`:

| # | Looked-up id | Kind | Call site(s) | Element with that id exists? | Closest real id |
|---|---|---|---|---|---|
| 1 | `translateSelected` | `DOMCache.get` | `public/app/features/translations/ui-controller.js:55`, `:314` | ❌ | `translateSelectedBtn` (`index.html:202`) |
| 2 | `translateAll` | `DOMCache.get` | `public/app/features/translations/ui-controller.js:63`, `:315` | ❌ | `translateAllBtn` (`index.html:205`) |
| 3 | `cancelTranslation` | `DOMCache.get` | `public/app/features/translations/ui-controller.js:71`, `:316` | ❌ | `cancelTranslationBtn` (`index.html:663`) |
| 4 | `pauseTranslation` | `DOMCache.get` | `public/app/features/translations/ui-controller.js:79`, `:317` | ❌ | `pauseTranslationBtn` (`index.html:686`) |

**8 call sites, 4 unique ids, all in one file.** No dangling `getElementById` and no dangling `querySelector('#…')` was found anywhere.

*No other lookup is dangling.* Ids that appear only as JS-built strings or dynamic nodes were checked and are **not** dangling — e.g. `terminologyListPanel` / `terminologyImportExportPanel` are built as `` `terminology${tabName === "list" ? "List" : "ImportExport"}Panel` `` (`export/terminology-list.js:90`) and consumed by `switchTabState(..., {activePanelId})` (`core/utils.js:193-199`); `browseImportFileBtn` is both created (`export/terminology-import.js:308`) and present statically.

### Full list of orphaned element ids

Definition used: an `id` that exists in `index.html` but is never the target of any JS lookup. 396 ids total, 56 orphans, of which **18 are `aria-labelledby` targets** (legitimate) and **38 have no JS lookup**.

#### A. Dead interactive UI (no reference anywhere — not in JS, not in CSS, not in the bundle)

| id | `index.html` line | Tag | Verdict |
|---|---|---|---|
| `filterSourceBtn` | 305 | `button` | **dead — clickable, no handler, string absent from all JS** |
| `filterTargetBtn` | 314 | `button` | **dead — clickable, no handler, string absent from all JS** |

#### B. Stale display element (never updated by any code)

| id | `index.html` line | Tag | Verdict |
|---|---|---|---|
| `qualityIssueBadge` | 398 | `span` | stays `hidden` forever; always reads `0` |

#### C. Benign: layout / CSS hooks and pure wrappers (no defect)

| id | `index.html` line | Tag | Why it is fine |
|---|---|---|---|
| `appViewport` | 21 | `div` | styled in `styles.css` (`#appViewport{position:fixed…}`, 4 refs); layout only |
| `sourceScrollArea` | 325 | `div` | styled in `styles.css` (3 refs); real scroll host is `translationScrollWrapper` |
| `targetScrollArea` | 344 | `div` | styled in `styles.css` (3 refs) |
| `sourcePagination` | 363 | `div` | styled in `styles.css` (3 refs); real controls `sourcePrevBtn` / `sourceNextBtn` are wired |
| `targetPagination` | 372 | `div` | empty hidden placeholder, kept for layout symmetry |
| `notificationProgress` | 2418 | `div` | progress **track** wrapper; the bar it contains (`notificationProgressBar`, line 2419) is animated by `ui/notification.js:142-192` |
| `qualityRuleCardsContainer` | 1073 | `div` | pure wrapper; child `qualityRuleCards` (1075) is read by `features/quality/ui.js:2` |

#### D. `aria-labelledby` targets — correct by design, listed for completeness

| id | Line | id | Line |
|---|---|---|---|
| `newProjectModalTitle` | 466 | `addTermModalTitle` | 1220 |
| `projectManagerModalTitle` | 518 | `settingsModalTitle` | 1261 |
| `confirmDialogTitle` | 622 | `clearCacheModalTitle` | 2125 |
| `sourceEditorTitle` | 639 | `helpModalTitle` | 2157 |
| `translationProgressModalTitle` | 662 | `aboutModalTitle` | 2357 |
| `exportModalTitle` | 704 | `aiPrimingSamplesModalTitle` | 2426 |
| `findReplaceModalTitle` | 746 | `aiConversationViewerModalTitle` | 2448 |
| `terminologyModalTitle` | 810 | `tmManagerModalTitle` | 2478 |
| `qualityReportModalTitle` | 994 | `customEngineModalTitle` | 2531 |

All 18 resolve to a real element (`ariaRefsMissing: []`).

#### E. Candidates investigated and **cleared** (they are wired, just not via a literal `DOMCache.get`)

| id(s) | Wired how |
|---|---|
| `mobileOpenProjectBtn`, `mobileProjectManagerBtn`, `mobileSaveProjectBtn`, `mobileSettingsBtn`, `mobileHelpBtn`, `mobileAboutBtn` | delegation map `menuActions` keyed by id — `ui/event-listeners/data-and-ui.js:339-344`; jsdom confirms an ancestor `#mobileMoreMenu` click listener |
| `projectManagerModal`, `projectManagerListPanel`, `projectManagerCreateImportPanel` | `features/projects/manager.js:41-42, 202, 561` (id built by ternary) |
| `confirmDialog`, `confirmDialogTitle/Message/Input/Error/Cancel/Ok` | `ui/confirm-dialog.js` via the `__el(...)` helper (lines 34-38, 57, 92, 101-127, 143) |
| `findReplaceModal`, `terminologyModal`, `qualityReportModal`, `clearCacheModal`, `helpModal`, `aboutModal`, `aiPrimingSamplesModal`, `aiConversationViewerModal`, `tmManagerModal` | opened/closed through the `openModal(id)` / `closeModal(id)` helpers (`file-panels.js:279, 618, 631`, `find-replace.js:296`, `data-management.js:91, 224, 239`, `data-and-ui.js:660, 668`, `settings-ai-engine.js:275, 325, 489`, `features/tm/ui.js:19`, `features/quality/ui.js:389`) |
| `browseImportFileBtn` | ancestor `#importDropArea` handler (jsdom: `clickListenerOnAncestor: ["#importDropArea"]`) plus the button is re-created at `export/terminology-import.js:308` |
| `cancelAiPrimingSamples` | direct listener bound via `settings-ai-engine.js` (jsdom: `clickListenerOnSelf: true`) |

---

## Verified working

| Area | Check | Result |
|---|---|---|
| **Duplicate ids** | Two independently written regexes over all 396 `id=` attributes | **0 duplicates.** No `getElementById`-returns-the-first hazard exists. |
| **Inline handlers** | Scan for `on(click\|change\|input\|submit\|keydown\|…)=` in `index.html` | **0** — all interaction is bound via `EventManager`/`addEventListener`. |
| **Assets referenced by `index.html`** | `favicon.svg`, `styles.css`, `lib/font-awesome/css/all.min.css`, and the inline loader's `app.bundle.js` → `app.js` fallback | **all present on disk** (`public/favicon.svg`, `public/styles.css`, `public/lib/font-awesome/css/all.min.css`, `public/app.bundle.js`, `public/app.js`). `styles.css` itself contains **0** `url()` references and **0** `@import`s, so nothing else can be missing there. |
| **`data-*` hooks** | All 9 distinct `data-*` attributes checked for a real JS reader | **9/9 wired**: `data-sidebar` (`data-and-ui.js:526, 548, 583`), `data-spin` + `data-spin-target` (`:471-472`), `data-tab` (`core/utils.js:182`, `data-and-ui.js:647, 674`, `settings.js:172`), `data-active` (`file-drop.js:6`, `projects/manager.js:478-510`), `data-check-id` (`quality/ui.js:15-16`), `data-engine-key` (`engine-model-sync.js:312-316`), `data-target` (`data-and-ui.js:19`), `data-shortcut-id` (`settings.js:30-32, 51-74`). |
| **Intra-HTML id references** | `aria-labelledby`, `aria-controls`, `aria-describedby`, `aria-owns`, `for`, `form`, `list`, `headers`, `href="#…"` | **0 dangling** (`ariaRefsMissing: []`, `anchorRefsMissing: []`). |
| **Script load order — missing files** | All 127 `app/…js` references parsed out of `public/app.js` and stat-ed | **0 missing.** |
| **Script load order — bundle coverage** | Parsed the bundle's own `/*! @bundle-modules (123) */` manifest and diffed it against the loader list | 123 modules listed; the only loader entries absent from the bundle are `app/dev-tools/error-demo.js`, `error-test.js`, `error-system-test.js`, `error-handling-examples.js` — which the loader pushes **only** under `if (isDevelopment)` (`app.js:210-216`). The production entry `app/core/errors/error-production.js` **is** in the bundle. Loader and bundle are consistent. |
| **Script load order — parse-time inversion** | Scope-aware depth-0 call analysis over the 123-script order; flagged any top-level call to a global first defined in a later file | **0 forward references.** Negative control: the same pass detected **344** depth-0 call candidates, 297 of which resolved to a known global definition (10 confirmed backward refs such as `compat/quality.js:160 → throttle()` defined in `core/utils.js`), so the detector was demonstrably able to see real calls. |
| **Loader mechanics** | `app.js:311-377` | Each script is appended with `script.async = false` and the next is only requested inside `onload`, so **execution order is strictly the array order**; the `?v=` cache-busting suffix is propagated (`app.js:223-231`). |
| **Files not in the loader** | 14 of 141 files | All 14 are **lazily loaded on demand**, verified in `core/utils.js`: quality modules at `:313-319`, export split modules at `:345-347`, terminology import/export at `:373-374`, project manager at `:400`. None is orphaned. |
| **App actually boots** | `index.html` + `app.bundle.js` loaded in jsdom | Boots (**`window.__appBootstrap` defined**, `window.App` populated with 13 namespaces), **224 `addEventListener` registrations**, 0 runtime errors thrown during the probe. |
| **Key buttons are wired** | jsdom per-element listener map | Direct `click` listeners confirmed on: `translateSelectedBtn`, `translateAllBtn`, `cancelTranslationBtn`, `pauseTranslationBtn`, `clearSelectedTargetBtn`, `clearAllSampleData`, `openFindReplaceBtn`, `moreActionsBtn`, `exportBtn`, `cancelAiPrimingSamples`, `mobileMoreBtn`, `swapLanguagesBtn`, `openTMManagerBtn`, `openCustomEngineBtn`, `sourcePrevBtn`, `sourceNextBtn`, `terminologyPrevBtn`, `terminologyNextBtn`, `openFullSettingsBtn`, `saveSettings`. Native `change` confirmed on `themeMode`. |
| **Shortcut registry ↔ UI** | `DEFAULT_SHORTCUTS` (`keyboard.js:8-27`) vs `data-shortcut-id` attributes in `settings.html` section | **exact 1:1 match on all 18 ids**, and `settings.js:30-107` renders the 修改 / 恢复默认 controls the help text promises. |
| **Esc handling** | `keyboard.js:136-146, 316-324` | Correctly scoped: Esc in a translation-list textarea blurs the field; otherwise it closes the topmost visible modal, else clears the multi-selection. |

---

## Reproduction

The scratch scripts used for this review were temporary and have been removed; the tree
contains **no modification other than this report**. To re-derive any number above:

- **Dangling lookups / orphans** — extract `(?<![-\w])id\s*=\s*"([^"]*)"` from `public/index.html`,
  extract `DOMCache\.get\(\s*["'`]([^"'`$]+)["'`]`, `getElementById\(\s*["'`]([^"'`$]+)["'`]` and
  `querySelector(?:All)?\(\s*["'`]#([\w-]+)` from `public/app/**/*.js`, then diff. Verify each
  candidate by grepping the bare id string across `index.html`, `styles.css` and every JS file
  *before* reporting it (delegation maps and built ids produce false positives otherwise).
- **Keyboard behaviour** — `npm ls jsdom` then boot `public/index.html` with the inline loader
  stripped and `public/app.bundle.js` injected as an inline `<script>`; dispatch
  `new KeyboardEvent('keydown', {key:'Enter', shiftKey:true, bubbles:true, cancelable:true})`
  at a focused textarea and read `event.defaultPrevented`.
- **Bundle ↔ loader** — parse the `/*! @bundle-modules (N) */` header of `public/app.bundle.js`.

### Priority for remediation

1. **`keyboard.js`** — hoist the `isEditable` guard above `preventDefault` (or make `preventDefault`
   conditional on the action actually being applicable) and hard-guard `translateAll` / `translateSelected`.
   This one change fixes findings 1, 2 and 3.
2. **`ui-controller.js:55/63/71/79/314-317`** — rename the four ids to `…Btn` (or delete the redundant
   methods now that `progress.js` owns the behaviour).
3. **`index.html:305/314`** — either implement column filtering and wire these buttons, or remove them.
4. Restore `fa-brands-400.woff2` (or drop the brand `@font-face`); delete `qualityIssueBadge`,
   `event-binding-manager.js` and `features/translations/export.js` if they are confirmed dead.
