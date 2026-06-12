# tinyproctor.js

Minimal, self-hosted, dependency-free browser integrity monitoring for online exams.

One script tag detects tab switching, focus loss, fullscreen exits, copy/cut/paste, right-click, print attempts, DevTools heuristics, and inactivity — scores them into a live 0–100 integrity score, and reports event batches reliably to **your** server via `navigator.sendBeacon()` / `fetch(keepalive)`.

No webcam. No extensions. No vendor cloud. No per-student fees. MIT licensed.

- **Website:** https://tanzir71.github.io/tinyproctorjs/
- **Live demo:** https://tanzir71.github.io/tinyproctorjs/demo/exam.html
- **Docs:** https://tanzir71.github.io/tinyproctorjs/docs.html
- **Comparisons:** https://tanzir71.github.io/tinyproctorjs/compare.html
- **Support the project:** https://buymeacoffee.com/tanzir ☕

## Quick start

Host `tinyproctor.min.js` (~6 KB gzipped) on your own domain and embed it on the exam page:

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

Monitoring starts automatically. Events POST to `data-endpoint` as JSON batches.

## What it detects

| Violation key | Trigger | Default weight |
| --- | --- | --- |
| `tab_hidden` | Tab switched / browser minimized | 10 |
| `window_blur` | Window lost focus | 5 |
| `fullscreen_exit` | Left fullscreen | 25 |
| `devtools_key` | F12, Ctrl/Cmd+Shift+I/J/C | 20 |
| `devtools_resize` | Outer/inner window delta heuristic | 15 |
| `copy_attempt` | Copy event | 10 |
| `cut_attempt` | Cut event | 10 |
| `paste_attempt` | Paste event | 15 |
| `context_menu` | Right-click | 5 |
| `print_attempt` | Ctrl/Cmd+P or `beforeprint` | 10 |
| `page_idle` | No activity for `idleMs` (default 60s) | 5 |

Every signal can be disabled individually; clipboard and context menu can also be **blocked** (`data-block-clipboard`, `data-block-contextmenu`). A heartbeat fires every 30s so dropped sessions stand out server-side.

**Integrity score:** `score = 100 − Σ(weight × count)`, clamped to `[0, 100]`. Weights are configurable via `data-weights='{"tab_hidden":20}'`.

## Configuration

See the full reference in the [docs](https://tanzir71.github.io/tinyproctorjs/docs.html#configuration). Highlights:

| Attribute | Default | Notes |
| --- | --- | --- |
| `data-endpoint` | — | Collector URL (required for reporting) |
| `data-attempt-id` | auto | Strongly recommended — your exam system's attempt ID |
| `data-silent` | `true` | `false` shows a live score badge |
| `data-idle-ms` | `60000` | Inactivity threshold |
| `data-weights` | defaults | JSON object of violation weights |
| `data-block-clipboard` | `false` | Prevent copy/cut/paste, not just detect |
| `data-block-contextmenu` | `false` | Prevent right-click |
| `data-format` | `json` | `form` for legacy PHP (`payload=<json>`) |
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
proctor.getState()                 // score, counts, recent violations
proctor.markViolation('custom')    // your own violation keys
proctor.flush()                    // force-send queue
TinyProctor.destroy()              // stop + allow re-init
```

## Backend payload

Events arrive as JSON batches (`kind: "batch"`) with a session envelope (userAgent, language, screen size, timezone) and per-event records carrying `eventType`, `violationKey`, `integrityScore`, timestamps and page state. Full schema + copy-paste **PHP/SQLite** and **Node.js** collector examples: [docs → Building a collector](https://tanzir71.github.io/tinyproctorjs/docs.html#collector).

Delivery is at-least-once with exponential-backoff retry; dedupe on `(sessionId, clientTime, eventType, violationKey)` if exact counts matter.

## Honest limits

Client-side signals are **deterrence and triage**, not proof and not prevention. A technically skilled candidate can disable any in-page script — use heartbeat gaps to detect that server-side, and pair flags with human review. For high-stakes certification, layer with stronger controls ([comparison](https://tanzir71.github.io/tinyproctorjs/compare.html)).

**Privacy:** never accesses camera, microphone, screen contents, keystroke contents, or clipboard contents. Self-hosted by design — simplifies GDPR/FERPA.

## Development

```bash
node demo/server.mjs        # local demo at http://localhost:8787/
npm install jsdom           # once
node test/run-tests.mjs     # run the 54-test suite
```

`docs/` is the GitHub Pages site; root files are the source of truth. After changing pages or the library, re-copy them into `docs/`.

Minified build: `npx terser tinyproctor.js --compress --mangle --comments "/^!/" -o tinyproctor.min.js`

## License

MIT — free for commercial use. If it saves you a proctoring-vendor contract, consider [buying me a coffee](https://buymeacoffee.com/tanzir). ☕
