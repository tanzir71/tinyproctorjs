/*
 * tinyproctor.js test suite (Node + jsdom)
 * Usage: npm install jsdom && node test/run-tests.mjs
 */
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(__dirname, '..', 'tinyproctor.js'), 'utf8')

let passed = 0
let failed = 0
const failures = []

function assert(cond, name) {
  if (cond) {
    passed++
    console.log('  ok   ' + name)
  } else {
    failed++
    failures.push(name)
    console.log('  FAIL ' + name)
  }
}

function makeDom({ scriptAttrs = '', fetchOk = true, captureFetch = null, before = null } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><body><textarea id="answer"></textarea>
     <script data-tinyproctor ${scriptAttrs}>/* placeholder */</script>
     </body></html>`,
    { url: 'https://exam.example.com/exam', runScripts: 'outside-only', pretendToBeVisual: true }
  )
  const { window } = dom
  // jsdom lacks fetch/sendBeacon in this mode; provide stubs
  window.fetch = function (url, opts) {
    if (captureFetch) captureFetch.push({ url, opts })
    return Promise.resolve({ ok: fetchOk, status: fetchOk ? 200 : 500 })
  }
  // do NOT define sendBeacon so fetch path is used (deterministic)
  if (before) before(window)
  window.eval(SRC)
  return dom
}

function dispatch(win, target, type, init = {}) {
  const ev = new win.Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, init)
  target.dispatchEvent(ev)
  return ev
}

function keydown(win, init) {
  const ev = new win.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  win.dispatchEvent(ev)
}

console.log('\n== Boot & config ==')
{
  const dom = makeDom()
  const TP = dom.window.TinyProctor
  assert(!!TP, 'TinyProctor global exists')
  assert(TP.version === '1.1.0', 'version is 1.1.0')
  const inst = TP.get()
  assert(!!inst, 'auto-init created an instance')
  const st = inst.getState()
  assert(st.integrityScore === 100, 'initial integrity score is 100')
  assert(st.violationCount === 0, 'initial violation count is 0')
  assert(/^tp_/.test(st.sessionId), 'sessionId generated with tp_ prefix')
  assert(/^attempt_/.test(st.attemptId), 'attemptId auto-generated')
  TP.destroy()
  assert(TP.get() === null || TP.get() === undefined || !TP.get(), 'destroy() clears instance')
}

console.log('\n== Data-attribute config ==')
{
  const dom = makeDom({
    scriptAttrs:
      'data-endpoint="/collect" data-exam-id="E1" data-attempt-id="A1" data-candidate-label="c42" ' +
      'data-heartbeat-ms="5000" data-idle-ms="10000" data-weights=\'{"tab_hidden":50}\''
  })
  const inst = dom.window.TinyProctor.get()
  const cfg = inst.getConfig()
  assert(cfg.examId === 'E1', 'examId read from data attribute')
  assert(cfg.attemptId === 'A1', 'attemptId read from data attribute')
  assert(cfg.candidateLabel === 'c42', 'candidateLabel read from data attribute')
  assert(cfg.endpoint === 'https://exam.example.com/collect', 'relative endpoint normalized to absolute')
  assert(cfg.heartbeatMs === 5000, 'heartbeatMs respected (min clamp 5000)')
  assert(cfg.weights.tab_hidden === 50, 'custom weight overrides default')
  assert(cfg.weights.fullscreen_exit === 25, 'unspecified weights fall back to defaults')
  dom.window.TinyProctor.destroy()
}

console.log('\n== Violation signals ==')
{
  const dom = makeDom()
  const win = dom.window
  const doc = win.document
  const inst = win.TinyProctor.get()

  // tab_hidden via visibilitychange
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' })
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true })
  dispatch(win, doc, 'visibilitychange')
  let st = inst.getState()
  assert(st.violationCounts.tab_hidden === 1, 'tab_hidden recorded on visibilitychange')

  // window_blur
  dispatch(win, win, 'blur')
  st = inst.getState()
  assert(st.violationCounts.window_blur === 1, 'window_blur recorded on blur')

  // devtools key F12
  keydown(win, { key: 'F12', code: 'F12' })
  st = inst.getState()
  assert(st.violationCounts.devtools_key === 1, 'devtools_key recorded on F12')
  assert(st.devtoolsSuspected === true, 'devtoolsSuspected flag set')

  // devtools key debounce (<2s)
  keydown(win, { key: 'I', ctrlKey: true, shiftKey: true })
  st = inst.getState()
  assert(st.violationCounts.devtools_key === 1, 'devtools_key debounced within 2s')

  // copy
  dispatch(win, doc, 'copy')
  st = inst.getState()
  assert(st.violationCounts.copy_attempt === 1, 'copy_attempt recorded')

  // paste
  dispatch(win, doc, 'paste')
  st = inst.getState()
  assert(st.violationCounts.paste_attempt === 1, 'paste_attempt recorded')

  // cut
  dispatch(win, doc, 'cut')
  st = inst.getState()
  assert(st.violationCounts.cut_attempt === 1, 'cut_attempt recorded')

  // contextmenu
  dispatch(win, doc, 'contextmenu')
  st = inst.getState()
  assert(st.violationCounts.context_menu === 1, 'context_menu recorded')

  // print via Ctrl+P
  keydown(win, { key: 'p', ctrlKey: true })
  st = inst.getState()
  assert(st.violationCounts.print_attempt === 1, 'print_attempt recorded on Ctrl+P')

  // score arithmetic: 10+5+20+10+15+10+5+10 = 85 -> score 15
  assert(st.integrityScore === 15, 'integrity score = 100 - weighted sum (expected 15, got ' + st.integrityScore + ')')
  assert(st.violationCount === 8, 'total violation count is 8')

  // custom violation
  inst.markViolation('custom', { note: 'x' })
  st = inst.getState()
  assert(st.violationCounts.custom === 1, 'custom violation recorded via markViolation')

  win.TinyProctor.destroy()
}

console.log('\n== Score floor/clamp ==')
{
  const dom = makeDom()
  const win = dom.window
  const inst = win.TinyProctor.get()
  for (let i = 0; i < 30; i++) dispatch(win, win, 'blur')
  const st = inst.getState()
  assert(st.integrityScore === 0, 'score clamps at 0 (got ' + st.integrityScore + ')')
  win.TinyProctor.destroy()
}

console.log('\n== Config toggles disable signals ==')
{
  const dom = makeDom({
    scriptAttrs: 'data-clipboard="false" data-contextmenu="false" data-print="false" data-devtools="false"'
  })
  const win = dom.window
  const doc = win.document
  const inst = win.TinyProctor.get()
  dispatch(win, doc, 'copy')
  dispatch(win, doc, 'contextmenu')
  keydown(win, { key: 'F12', code: 'F12' })
  keydown(win, { key: 'p', ctrlKey: true })
  const st = inst.getState()
  assert(st.violationCount === 0, 'disabled signals record nothing')
  assert(st.integrityScore === 100, 'score remains 100 with disabled signals')
  win.TinyProctor.destroy()
}

console.log('\n== Blocking modes ==')
{
  const dom = makeDom({ scriptAttrs: 'data-block-clipboard="true" data-block-contextmenu="true"' })
  const win = dom.window
  const doc = win.document
  const evCopy = dispatch(win, doc, 'copy')
  const evCtx = dispatch(win, doc, 'contextmenu')
  assert(evCopy.defaultPrevented === true, 'blockClipboard prevents default copy')
  assert(evCtx.defaultPrevented === true, 'blockContextmenu prevents default context menu')
  win.TinyProctor.destroy()
}

console.log('\n== Reporting / batching ==')
{
  const captured = []
  const dom = makeDom({ scriptAttrs: 'data-endpoint="/collect"', captureFetch: captured })
  const win = dom.window
  const inst = win.TinyProctor.get()
  dispatch(win, win, 'blur') // violation triggers immediate flush
  await new Promise((r) => setTimeout(r, 50))
  assert(captured.length >= 1, 'events POSTed to endpoint')
  const body = JSON.parse(captured[0].opts.body)
  assert(body.kind === 'batch', 'payload kind is batch')
  assert(body.schemaVersion === 1, 'schemaVersion present')
  assert(Array.isArray(body.events) && body.events.length >= 1, 'batch contains events')
  assert(typeof body.userAgent === 'string' && body.userAgent.length > 0, 'batch envelope includes userAgent')
  const allEvents = captured.flatMap((c) => JSON.parse(c.opts.body).events)
  const hb = allEvents.find((e) => e.eventType === 'heartbeat')
  assert(!!hb, 'heartbeat event sent on start')
  const blur = allEvents.find((e) => e.violationKey === 'window_blur')
  assert(!!blur, 'window_blur event present in batches')
  assert(blur && blur.integrityScore === 95, 'event carries integrity score')
  const st = inst.getState()
  assert(st.sentEvents >= 1, 'sentEvents counter incremented')
  win.TinyProctor.destroy()
}

console.log('\n== Retry backoff on failure ==')
{
  const captured = []
  const dom = makeDom({ scriptAttrs: 'data-endpoint="/collect" data-flush-ms="150"', fetchOk: false, captureFetch: captured })
  const win = dom.window
  const inst = win.TinyProctor.get()
  await new Promise((r) => setTimeout(r, 700))
  const st = inst.getState()
  assert(st.failedFlushes >= 1, 'failedFlushes incremented on 500 responses')
  assert(st.queuedEvents >= 1, 'failed events re-queued, not lost')
  assert(st.sentEvents === 0, 'nothing marked sent on failure')
  win.TinyProctor.destroy()
}

console.log('\n== Callbacks ==')
{
  const dom = makeDom({ scriptAttrs: 'data-autoinit="false"' })
  const win = dom.window
  win.TinyProctor.destroy() // ensure clean
  const hits = []
  const events = []
  const inst = win.TinyProctor.init({
    onViolation: (key, data, state) => hits.push({ key, score: state.integrityScore }),
    onEvent: (p) => events.push(p)
  })
  dispatch(win, win, 'blur')
  assert(hits.length === 1 && hits[0].key === 'window_blur', 'onViolation fired with key')
  assert(hits[0].score === 95, 'onViolation receives updated state')
  assert(events.some((e) => e.eventType === 'focus'), 'onEvent receives event payloads')
  // callback that throws must not break monitoring
  win.TinyProctor.destroy()
  const inst2 = win.TinyProctor.init({ onViolation: () => { throw new Error('boom') } })
  dispatch(win, win, 'blur')
  assert(inst2.getState().violationCounts.window_blur === 1, 'throwing callback does not break monitoring')
  win.TinyProctor.destroy()
}

console.log('\n== stop() / destroy() lifecycle ==')
{
  const dom = makeDom()
  const win = dom.window
  const inst = win.TinyProctor.get()
  inst.stop()
  dispatch(win, win, 'blur')
  const st = inst.getState()
  assert(st.violationCount === 0, 'no events recorded after stop()')
  win.TinyProctor.destroy()
  const fresh = win.TinyProctor.init({ examId: 'NEW' })
  assert(fresh.getConfig().examId === 'NEW', 're-init after destroy works')
  win.TinyProctor.destroy()
}

console.log('\n== Badge (silent=false) ==')
{
  const dom = makeDom({ scriptAttrs: 'data-silent="false"' })
  const win = dom.window
  const badge = win.document.querySelector('[data-tinyproctor-badge]')
  assert(!!badge, 'badge rendered when silent=false')
  dispatch(win, win, 'blur')
  assert(badge.textContent.indexOf('95') !== -1, 'badge shows updated score')
  win.TinyProctor.destroy()
  assert(!win.document.querySelector('[data-tinyproctor-badge]'), 'badge removed on destroy')
}

console.log('\n== v1.1: focus changes between fields are not violations ==')
{
  const dom = makeDom()
  const win = dom.window
  const ta = win.document.getElementById('answer')
  const inst = win.TinyProctor.get()
  ta.dispatchEvent(new win.FocusEvent('focus'))
  ta.dispatchEvent(new win.FocusEvent('blur'))
  assert(!inst.getState().violationCounts.window_blur, 'element blur (field change) records no window_blur')
  dispatch(win, win, 'blur')
  assert(inst.getState().violationCounts.window_blur === 1, 'window blur still records window_blur')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: sequence numbers and session event ==')
{
  const captured = []
  const dom = makeDom({ scriptAttrs: 'data-endpoint="/collect"', captureFetch: captured })
  const win = dom.window
  dispatch(win, win, 'blur')
  dispatch(win, win, 'blur')
  await new Promise((r) => setTimeout(r, 50))
  const events = captured.flatMap((c) => JSON.parse(c.opts.body).events)
  const seqs = events.map((e) => e.seq)
  assert(seqs.length > 0 && seqs.every((n) => Number.isInteger(n)), 'every event carries an integer seq')
  assert(new Set(seqs).size === seqs.length, 'seq values are unique')
  assert(events.some((e) => e.eventType === 'session'), 'session start event is sent')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: session continuity (sessionStorage) ==')
{
  const dom = makeDom({ scriptAttrs: 'data-attempt-id="A9"' })
  const win = dom.window
  const first = win.TinyProctor.get()
  dispatch(win, win, 'blur')
  const sid = first.getState().sessionId
  win.TinyProctor.destroy() // keep the saved session, as a page change would
  const second = win.TinyProctor.init({ attemptId: 'A9' })
  const st = second.getState()
  assert(st.resumed === true, 'second init resumes the saved session')
  assert(st.sessionId === sid, 'sessionId is kept across pages')
  assert(st.violationCounts.window_blur === 1, 'violation counts are kept across pages')
  win.TinyProctor.destroy(true)
  assert(win.sessionStorage.getItem('tinyproctor:A9') === null, 'destroy(true) clears the saved session')
  const third = win.TinyProctor.init({})
  assert(third.getState().resumed === false && third.getConfig().persist === false, 'no persistence without an explicit attemptId')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: page unload is not a tab switch ==')
{
  const dom = makeDom()
  const win = dom.window
  const doc = win.document
  const inst = win.TinyProctor.get()
  dispatch(win, win, 'pagehide')
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' })
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true })
  dispatch(win, doc, 'visibilitychange')
  assert(!inst.getState().violationCounts.tab_hidden, 'hidden during unload records no tab_hidden')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: new signals ==')
{
  const dom = makeDom({
    before: (w) => {
      Object.defineProperty(w.screen, 'isExtended', { configurable: true, get: () => true })
      Object.defineProperty(w.navigator, 'webdriver', { configurable: true, get: () => true })
    }
  })
  const win = dom.window
  const doc = win.document
  const inst = win.TinyProctor.get()
  let st = inst.getState()
  assert(st.violationCounts.multi_screen === 1, 'multi_screen recorded when screen.isExtended')
  assert(st.violationCounts.automation_flag === 1, 'automation_flag recorded when navigator.webdriver')
  dispatch(win, doc, 'drop')
  assert(inst.getState().violationCounts.drop_attempt === 1, 'drop_attempt recorded on text drop')
  const ta = doc.getElementById('answer')
  dispatch(win, ta, 'beforeinput', { inputType: 'insertText', data: 'x'.repeat(60) })
  st = inst.getState()
  assert(st.violationCounts.insert_burst === 1, 'insert_burst recorded on a 60-character insert')
  const ev = st.recentViolations.filter((v) => v.violationKey === 'insert_burst').pop()
  assert(ev && ev.eventData.chars === 60 && !('data' in ev.eventData), 'insert_burst records the length, never the text')
  dispatch(win, ta, 'beforeinput', { inputType: 'insertText', data: 'abc' })
  assert(inst.getState().violationCounts.insert_burst === 1, 'short inserts (typing) are ignored')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: new signals can be turned off ==')
{
  const dom = makeDom({
    scriptAttrs: 'data-screens="false" data-automation="false" data-insert="false"',
    before: (w) => {
      Object.defineProperty(w.screen, 'isExtended', { configurable: true, get: () => true })
      Object.defineProperty(w.navigator, 'webdriver', { configurable: true, get: () => true })
    }
  })
  const win = dom.window
  const inst = win.TinyProctor.get()
  dispatch(win, win.document.getElementById('answer'), 'beforeinput', { inputType: 'insertText', data: 'x'.repeat(60) })
  assert(inst.getState().violationCount === 0, 'disabled v1.1 signals record nothing')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: blurDedupeMs scores a tab switch once ==')
{
  const dom = makeDom({ scriptAttrs: 'data-autoinit="false"' })
  const win = dom.window
  const doc = win.document
  const inst = win.TinyProctor.init({ blurDedupeMs: 300 })
  dispatch(win, win, 'blur')
  Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'hidden' })
  Object.defineProperty(doc, 'hidden', { configurable: true, get: () => true })
  dispatch(win, doc, 'visibilitychange')
  const st = inst.getState()
  assert(st.violationCounts.tab_hidden === 1 && !st.violationCounts.window_blur, 'blur followed by tab_hidden counts once')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: text format and byte-capped batches ==')
{
  const captured = []
  const dom = makeDom({ scriptAttrs: 'data-endpoint="/collect" data-format="text" data-batch-bytes="4096"', captureFetch: captured })
  const win = dom.window
  const inst = win.TinyProctor.get()
  for (let i = 0; i < 20; i++) inst.markViolation('custom', { pad: 'x'.repeat(900) })
  await new Promise((r) => setTimeout(r, 2500))
  const bodies = captured.map((c) => c.opts.body)
  assert(captured.length > 1 && captured.every((c) => c.opts.headers['Content-Type'].indexOf('text/plain') === 0), 'data-format="text" sends text/plain')
  assert(bodies.every((b) => b.length <= 4096), 'every batch stays under batchBytes')
  win.TinyProctor.destroy()
}

console.log('\n== v1.1: no auto-init without a script tag ==')
{
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://exam.example.com/', runScripts: 'outside-only' })
  dom.window.eval(SRC)
  assert(!dom.window.TinyProctor.get(), 'importing without a script tag does not auto-start')
  const inst = dom.window.TinyProctor.init({ examId: 'X' })
  assert(inst.getConfig().examId === 'X', 'explicit init(config) is honoured')
  dom.window.TinyProctor.destroy()
}

console.log('\n== Results ==')
console.log(`passed: ${passed}, failed: ${failed}`)
if (failed) {
  console.log('Failures:\n - ' + failures.join('\n - '))
  process.exit(1)
}
