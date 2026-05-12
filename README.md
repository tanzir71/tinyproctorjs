# tinyproctor.js

Minimal, self-hosted, dependency-free browser integrity monitoring for online exams.

It auto-initializes from `<script>` `data-*` attributes, maintains local violation state, calculates an integrity score, and reports events reliably via `navigator.sendBeacon()` or `fetch({ keepalive: true })`.

- Landing page: `docs/index.html`
- Compare page: `docs/compare.html`

## Quick Start

Host `tinyproctor.js` somewhere reachable by the exam page and embed it:

```html
<script
  src="/path/to/tinyproctor.js"
  data-tinyproctor
  data-endpoint="https://your-domain.example/collect.php"
  data-exam-id="EXAM_2026_05"
  data-attempt-id="ATTEMPT_12345"
  data-candidate-label="student_42"
  data-silent="true"
  data-heartbeat-ms="30000"
  data-weights='{"tab_hidden":10,"window_blur":5,"fullscreen_exit":25,"devtools_key":20,"devtools_resize":15}'
></script>
```

## What It Tracks

- Tab switching: `visibilitychange` (`hidden` increments `tab_hidden`)
- Window focus: `blur` / `focus` (`blur` increments `window_blur`)
- Fullscreen integrity: `fullscreenchange` (`exit` increments `fullscreen_exit`)
- DevTools heuristics (best-effort)
  - Key combos: `F12`, `Ctrl+Shift+I/J/C`, `Meta+Alt+I` (`devtools_key`)
  - Resize heuristic: `outer/inner` dimension deltas (`devtools_resize`)
- Integrity heartbeat every `data-heartbeat-ms` (default `30000`)

## Silent Mode

`data-silent="true"` reports only (no UI). If `data-silent="false"`, a small read-only badge is shown with integrity score and total violations.

## Integrity Score

Calculated locally:

`score = 100 - Σ(weight[key] * count[key])`, clamped to `[0, 100]`.

Default violation keys:

- `tab_hidden`
- `window_blur`
- `fullscreen_exit`
- `devtools_key`
- `devtools_resize`

## Configuration (data-attributes)

Required:

- `data-endpoint`: Collector URL (absolute or relative)

Strongly recommended:

- `data-attempt-id`: Per-attempt identifier from your quiz/exam system

Optional:

- `data-exam-id`
- `data-candidate-label`
- `data-silent`: `true`/`false` (default `true`)
- `data-heartbeat-ms`: integer ms (default `30000`)
- `data-flush-ms`: integer ms (default `900`)
- `data-batch-max`: integer (default `20`)
- `data-queue-max`: integer (default `250`)
- `data-devtools`: `true`/`false` (default `true`)
- `data-devtools-resize-threshold`: integer pixels (default `160`)
- `data-devtools-resize-cooldown-ms`: integer ms (default `10000`)
- `data-resize-throttle-ms`: integer ms (default `500`)
- `data-credentials`: `omit` (default) | `same-origin` | `include`
- `data-format`: `json` (default) | `form` (sends `payload=<urlencoded json>`)
- `data-weights`: JSON object string
- `data-autoinit`: `true`/`false` (default `true`)

## JavaScript API (optional)

The library exposes `window.TinyProctor`:

- `TinyProctor.init(config)`
- `TinyProctor.get()`

Instance methods:

- `instance.getState()`
- `instance.flush()`
- `instance.stop()`
- `instance.requestFullscreen(el?)`
- `instance.exitFullscreen()`
- `instance.markViolation(key, data?)`

## Backend Payload

By default, events are sent in batches:

```json
{
  "schemaVersion": 1,
  "clientVersion": "0.1.0",
  "kind": "batch",
  "sessionId": "tp_...",
  "examId": "...",
  "attemptId": "...",
  "candidateLabel": "...",
  "sentAt": "2026-05-12T12:00:00.000Z",
  "events": [
    {
      "clientTime": "...",
      "eventType": "heartbeat|visibility|focus|fullscreen|devtools|custom",
      "violationKey": "tab_hidden|window_blur|fullscreen_exit|devtools_key|devtools_resize|custom|...",
      "eventData": {},
      "pageUrl": "...",
      "violationCount": 3,
      "integrityScore": 65
    }
  ]
}
```

## CORS Notes

If the exam page origin differs from your collector origin, the collector must respond with CORS headers (and handle `OPTIONS`). `sendBeacon()` requests do not include custom headers.

## Local Demo

```bash
node demo/server.mjs
```

- Landing: `http://localhost:8787/`
- Compare: `http://localhost:8787/compare`
- Exam demo: `http://localhost:8787/exam`
- Collector: `http://localhost:8787/collect`
- Received events: `http://localhost:8787/events`
