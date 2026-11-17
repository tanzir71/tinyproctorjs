# Changelog

All notable changes to tinyproctor.js. The payload stays at `schemaVersion: 1`; new fields are additive.

## 1.1.0 — 2026-11-17

Drop-in upgrade: replace `tinyproctor.min.js`, keep your script tag.

### Fixed
- `window_blur` no longer fires when a candidate moves focus between form fields. The window-level capture listener also received every element's `blur`, so v1.0 deducted 5 points per field change.
- Moving to the next page of a quiz, or reloading, no longer records `tab_hidden`. Hidden-while-unloading is sent as an info event with `{ unload: true }`.
- Loading the library without a `data-tinyproctor` script tag (bundlers, `import`) no longer auto-starts a monitor with default settings, which made a later `init(config)` a no-op.
- Docs: cross-origin JSON beacons need a CORS preflight, and beacons carry cookies. The CORS guidance in `llms.txt` and the docs is corrected.

### Added
- **Session continuity.** With an explicit attempt ID, the session ID, violation counts, unsent queue and away time are saved in `sessionStorage` (per tab) and resumed on the next page. Each page sends a `session` event with `{ resumed, persisted, gapMs }`. `TinyProctor.destroy(true)` / `instance.clearSession()` forget it. Opt out with `data-persist="false"`.
- **`seq` on every event** — a per-session counter. Dedupe on `(sessionId, seq)`; gaps reveal lost or suppressed events.
- **Time away.** Return-to-tab (`visibility`) and focus-back (`focus`) events carry `awayMs`; `getState().awayMs` keeps the total.
- **New signals** (all can be turned off):
  - `multi_screen` (10) — `screen.isExtended` is true at start or after a display change. Chromium, no permission prompt. `data-screens`.
  - `automation_flag` (25) — `navigator.webdriver` is true. Easy to spoof; `false` proves nothing. `data-automation`.
  - `drop_attempt` (15) — text dragged and dropped into the page; file drops are ignored. Covered by `data-clipboard` and `data-block-clipboard`.
  - `insert_burst` (15) — 40+ characters inserted in one input event (agent browsers, auto-typers, text expanders, some dictation tools). Records the length only. `data-insert`, `data-insert-chars`.
- `devtools_resize` is also checked once at start (desktop only), so panels opened before the exam are seen.
- `data-blur-dedupe-ms` — count a tab switch once (drops the `window_blur` that comes with a `tab_hidden`). Off by default to keep scores comparable with v1.0.
- `data-format="text"` — JSON sent as `text/plain`, which needs no CORS preflight.
- `data-batch-bytes` (default 48 KiB) — batches stay under the 64 KiB keepalive budget.
- `fetchLater()` safety net (Chrome/Edge 135+): the pending batch is sent even if the tab is killed before `pagehide`.
- `tinyproctor.d.ts`, `tinyproctor.mjs` (ESM entry), CommonJS export, `package.json`, `scripts/build.mjs` (minify + 7 KB gzip budget + docs/ sync), GitHub Actions CI, LICENSE.

### Changed
- IDs use `crypto.randomUUID()` where available.
- Removed the `beforeunload` listener (`pagehide` and `visibilitychange` already flush).
- Dropped `moz`/`ms` fullscreen prefixes (unprefixed + `webkit` remain).
- Size: under 7 KB gzipped (was ~5.4 KB).

## 1.0.0 — 2026-06-12

First release.
