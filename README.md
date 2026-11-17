<img src="assets/logo.svg" width="48" height="48" alt="">

# tinyproctor.js

Minimal, self-hosted, dependency-free browser integrity monitoring for online exams.

One script tag detects tab switching, focus loss, fullscreen exits, copy/cut/paste and text drops, right-click, print attempts, DevTools heuristics, second screens, browser automation, bulk text inserts and inactivity — scores them into a live 0–100 integrity score, and reports event batches reliably to **your** server via `navigator.sendBeacon()` / `fetch(keepalive)`.

No webcam. No extensions. No vendor cloud. No per-student fees. MIT licensed.

- **Website:** https://tanzir71.github.io/tinyproctorjs/
- **Live demo:** https://tanzir71.github.io/tinyproctorjs/demo/exam.html
- **Docs:** https://tanzir71.github.io/tinyproctorjs/docs.html
- **Comparisons:** https://tanzir71.github.io/tinyproctorjs/compare.html
- **What changed:** [CHANGELOG.md](./CHANGELOG.md)
- **Support the project:** https://buymeacoffee.com/tanzir ☕

## What's new in v1.1

- **Fixed:** moving between answer fields no longer counts as `window_blur` (v1.0 deducted 5 points per field change), and moving to the next quiz page or reloading is no longer a `tab_hidden`.
- **One session per attempt across pages.** With `data-attempt-id` set, the session, counts and unsent events survive page changes and reloads (sessionStorage, per tab).
- **Every event carries `seq`.** Dedupe on `(sessionId, seq)`; gaps mean lost events.
- **Time away is measured:** the return-to-tab and focus-back events carry `awayMs`; `getState().awayMs` keeps the total.
- **Four new signals:** `multi_screen`, `automation_flag`, `drop_attempt`, `insert_burst` (the trace AI agent browsers and auto-typers leave in the answer box).
- **Delivery:** byte-capped batches (48 KiB, under the 64 KiB keepalive budget), `data-format="text"` for cross-origin collectors without preflight, `fetchLater()` safety net in Chrome/Edge.
- **Developer experience:** TypeScript types, ESM entry, no auto-start when bundled, `package.json`, CI with a 7 KB gzip budget.

v1.1 is a drop-in replacement: same script tag, same payload (`schemaVersion` 1, new fields are additive).

## Quick start

**Fastest path — ask your AI agent** (Claude, Copilot, Cursor, etc.):

> Add tinyproctor.js exam integrity monitoring to my project: fetch
> https://tanzir71.github.io/tinyproctorjs/tinyproctor.min.js into my static assets,
> add its script tag to my exam page with data-endpoint pointing at a new /collect
> endpoint, and implement /collect per https://tanzir71.github.io/tinyproctorjs/llms.txt

The machine-readable integration contract lives at [`/llms.txt`](https://tanzir71.github.io/tinyproctorjs/llms.txt).

**One command:** `curl -LO https://tanzir71.github.io/tinyproctorjs/tinyproctor.min.js`

**Manual:** host `tinyproctor.min.js` (under 7 KB gzipped) on your own domain and embed it on the exam page:

```html
<script
  src="/js/tinyproctor.min.js"
  data-tinyproctor
  data-endpoint="https://your-domain.com/collect.php"
  data-exam-id="FINAL_2026_06"
  data-attempt-id="ATTEMPT_12345"
  data-candidate-label="student_42"
></script>
```

Monitoring starts automatically. Events POST to `data-endpoint` as JSON batches. On multi-page quizzes, put the same tag (same attempt ID) on every page.

**Bundlers / TypeScript:**

```js
import TinyProctor from 'tinyproctor' // or './tinyproctor.mjs'
const proctor = TinyProctor.init({ endpoint: '/collect', examId, attemptId })
```

## What it detects

| Violation key | Trigger | Default weight |
| --- | --- | --- |
| `tab_hidden` | Tab switched / browser minimized | 10 |
| `window_blur` | Browser window lost focus (not field-to-field focus changes) | 5 |
| `fullscreen_exit` | Left fullscreen | 25 |
| `devtools_key` | F12, Ctrl/Cmd+Shift+I/J/C | 20 |
| `devtools_resize` | Outer/inner window gap (DevTools, docked side panels, AI sidebars); also checked at start | 15 |
| `copy_attempt` | Copy event | 10 |
| `cut_attempt` | Cut event | 10 |
| `paste_attempt` | Paste event | 15 |
| `drop_attempt` | Text dragged and dropped into the page (file drops ignored) | 15 |
| `insert_burst` | 40+ characters inserted in one go (AI agent browsers, auto-typers, text expanders) | 15 |
| `context_menu` | Right-click | 5 |
| `print_attempt` | Ctrl/Cmd+P or `beforeprint` | 10 |
| `page_idle` | No activity for `idleMs` (default 60s) | 5 |
| `multi_screen` | `screen.isExtended` is true (Chromium; no permission prompt) | 10 |
| `automation_flag` | `navigator.webdriver` is true (WebDriver-controlled browser) | 25 |

Every signal can be disabled individually; clipboard (including drops) and context menu can also be **blocked** (`data-block-clipboard`, `data-block-contextmenu`). A heartbeat fires every 30s so dropped sessions stand out server-side.

A tab switch usually fires both `tab_hidden` and `window_blur` (15 points). Set `data-blur-dedupe-ms="500"` to count it once.

**Integrity score:** `score = 100 − Σ(weight × count)`, clamped to `[0, 100]`. Weights are configurable via `data-weights='{"tab_hidden":20}'`.

## Configuration

See the full reference in the [docs](https://tanzir71.github.io/tinyproctorjs/docs.html#configuration). Highlights:

| Attribute | Default | Notes |
| --- | --- | --- |
| `data-endpoint` | — | Collector URL (required for reporting) |
| `data-attempt-id` | auto | Strongly recommended — your attempt ID; also enables cross-page sessions |
| `data-silent` | `true` | `false` shows a live score badge |
| `data-idle-ms` | `60000` | Inactivity threshold |
| `data-weights` | defaults | JSON object of violation weights |
| `data-block-clipboard` | `false` | Prevent copy/cut/paste/drop, not just detect |
| `data-block-contextmenu` | `false` | Prevent right-click |
| `data-screens` / `data-automation` / `data-insert` | `true` | Toggle the v1.1 signals |
| `data-insert-chars` | `40` | Characters inserted at once that count as `insert_burst` |
| `data-blur-dedupe-ms` | `0` | e.g. `500`: one tab switch counts once |
| `data-persist` | `true`* | Cross-page session (*only with an explicit attempt ID) |
| `data-format` | `json` | `text` = text/plain JSON (no CORS preflight); `form` = `payload=<json>` for legacy PHP |
| `data-autoinit` | `true` | `false` to call `TinyProctor.init()` yourself |

## JavaScript API

```js
var proctor = TinyProctor.init({
  endpoint: '/collect',
  examId: 'FINAL_2026_06',
  attemptId: attempt.id,
  onViolation: function (key, data, state) {
    if (state.integrityScore < 50) showWarningBanner()
  }
})

proctor.requestFullscreen()        // call from a user gesture
proctor.getState()                 // score, counts, recent violations, seq, awayMs, resumed
proctor.markViolation('custom')    // your own violation keys
proctor.flush()                    // force-send queue
TinyProctor.destroy()              // stop + allow re-init (keeps the saved session)
TinyProctor.destroy(true)          // after submit: also forget the saved session
```

## Backend payload

Events arrive as JSON batches (`kind: "batch"`) with a session envelope (userAgent, language, screen size, timezone) and per-event records carrying `seq`, `eventType`, `violationKey`, `integrityScore`, timestamps and page state. Full schema + copy-paste **PHP/SQLite** and **Node.js** collector examples: [docs → Building a collector](https://tanzir71.github.io/tinyproctorjs/docs.html#collector).

Delivery is at-least-once with exponential-backoff retry; dedupe on `(sessionId, seq)`. Batches stay under 48 KiB.

**CORS:** JSON bodies need a preflight when the collector is on another origin, and beacons carry cookies, so echo the exact origin (not `*`) with `Access-Control-Allow-Credentials: true`. Or use `data-format="text"` to skip preflight.

## Honest limits

Client-side signals are **deterrence and triage**, not proof and not prevention. A technically skilled candidate can disable any in-page script or spoof `navigator.webdriver` — use heartbeat and `seq` gaps to detect that server-side, and pair flags with human review. Second-screen detection works in Chromium browsers only; a phone next to the keyboard is invisible to any browser script. For high-stakes certification, layer with stronger controls ([comparison](https://tanzir71.github.io/tinyproctorjs/compare.html)).

**Privacy:** never accesses camera, microphone, screen contents, keystroke contents, or clipboard contents. `insert_burst` records how many characters appeared, never the text. Self-hosted by design — simplifies GDPR/FERPA. Rule-based scoring with human-set weights; no AI or inference.

## Development

```bash
npm install                 # jsdom + terser (dev only)
npm test                    # jsdom unit tests
npm run build               # minify, check the 7 KB gzip budget, sync docs/
npm run size                # CI check: budget + docs/ drift, writes nothing
npm run serve               # local demo at http://localhost:8787/
```

`docs/` is the GitHub Pages site; root files are the source of truth and `npm run build` copies them into `docs/`. The vendor comparison pages are generated: `python3 build-alt-pages.py && python3 build-restyle.py` (generator + Volt design-system patcher).

## License

MIT — free for commercial use. If it saves you a proctoring-vendor contract, consider [buying me a coffee](https://buymeacoffee.com/tanzir). ☕
