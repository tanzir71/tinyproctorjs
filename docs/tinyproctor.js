/*!
 * tinyproctor.js v1.1.0
 * Minimal, self-hosted, dependency-free browser exam integrity monitoring.
 * https://github.com/tanzir71/tinyproctorjs
 * License: MIT
 */
(function (window, document) {
  'use strict'

  var TinyProctor = {}
  var VERSION = '1.1.0'

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  function nowIso() {
    return new Date().toISOString()
  }

  function clamp(n, min, max) {
    if (n < min) return min
    if (n > max) return max
    return n
  }

  function toInt(v, fallback) {
    var n = Number(v)
    if (!isFinite(n)) return fallback
    return Math.floor(n)
  }

  function parseBool(v, fallback) {
    if (v === true || v === false) return v
    if (v == null) return fallback
    var s = String(v).trim().toLowerCase()
    if (s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true
    if (s === '0' || s === 'false' || s === 'no' || s === 'n' || s === 'off') return false
    return fallback
  }

  function safeJsonParse(s, fallback) {
    if (s == null || s === '') return fallback
    try {
      return JSON.parse(String(s))
    } catch (e) {
      return fallback
    }
  }

  function pickFirst(obj, keys) {
    var i
    for (i = 0; i < keys.length; i++) {
      if (obj[keys[i]] != null && obj[keys[i]] !== '') return obj[keys[i]]
    }
    return undefined
  }

  function createId(prefix) {
    var id
    try {
      id = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : ''
    } catch (e) {
      id = ''
    }
    if (!id) id = Date.now().toString(16) + '_' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
    return (prefix ? prefix + '_' : '') + id
  }

  /* sessionStorage helpers: per-tab persistence so paginated exams keep one session */
  function storeGet(key) {
    try {
      return JSON.parse(window.sessionStorage.getItem(key) || 'null')
    } catch (e) {
      return null
    }
  }

  function storeSet(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key)
      else window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      /* storage full or disabled: keep working in memory */
    }
  }

  function throttle(fn, waitMs) {
    var last = 0
    var timer = null
    var pendingArgs = null

    return function throttled() {
      var now = Date.now()
      var remaining = waitMs - (now - last)
      pendingArgs = arguments
      if (remaining <= 0) {
        last = now
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        fn.apply(null, pendingArgs)
        pendingArgs = null
        return
      }
      if (timer) return
      timer = setTimeout(function () {
        last = Date.now()
        timer = null
        fn.apply(null, pendingArgs || [])
        pendingArgs = null
      }, remaining)
    }
  }

  function getCurrentScript() {
    var s = document.currentScript
    if (s) return s
    var scripts = document.getElementsByTagName('script')
    var i
    for (i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i] && scripts[i].getAttribute('data-tinyproctor') != null) return scripts[i]
    }
    for (i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i] && scripts[i].getAttribute('src')
      if (src && /tinyproctor(\.min)?\.js(\?|#|$)/i.test(src)) return scripts[i]
    }
    return null
  }

  function normalizeUrl(url) {
    if (!url) return ''
    try {
      return new URL(url, window.location.href).toString()
    } catch (e) {
      return String(url)
    }
  }

  function supportsBeacon() {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
  }

  function supportsKeepaliveFetch() {
    return typeof window.fetch === 'function'
  }

  function detectFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null
  }

  function requestFullscreen(el) {
    var target = el || document.documentElement
    if (target.requestFullscreen) return target.requestFullscreen()
    if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen()
    return Promise.reject(new Error('fullscreen_not_supported'))
  }

  function exitFullscreen() {
    if (!detectFullscreenElement()) return Promise.resolve()
    if (document.exitFullscreen) return document.exitFullscreen()
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen()
    return Promise.reject(new Error('fullscreen_not_supported'))
  }

  function computeScore(weights, counts) {
    var sum = 0
    var k
    for (k in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, k)) continue
      var w = weights && weights[k] != null ? Number(weights[k]) : 0
      if (!isFinite(w)) w = 0
      sum += w * counts[k]
    }
    return clamp(Math.round((100 - sum) * 100) / 100, 0, 100)
  }

  function shallowCopy(obj) {
    var out = {}
    var k
    for (k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]
    }
    return out
  }

  function safeCallback(fn, args) {
    if (typeof fn !== 'function') return
    try {
      fn.apply(null, args)
    } catch (e) {
      /* user callback errors must never break monitoring */
    }
  }

  var DEFAULT_WEIGHTS = {
    tab_hidden: 10,
    window_blur: 5,
    fullscreen_exit: 25,
    devtools_key: 20,
    devtools_resize: 15,
    copy_attempt: 10,
    cut_attempt: 10,
    paste_attempt: 15,
    context_menu: 5,
    print_attempt: 10,
    page_idle: 5,
    multi_screen: 10,
    automation_flag: 25,
    drop_attempt: 15,
    insert_burst: 15
  }

  /* ------------------------------------------------------------------ *
   * Status badge (optional, silent=false)
   * ------------------------------------------------------------------ */

  function createBadge() {
    var el = document.createElement('div')
    el.setAttribute('data-tinyproctor-badge', '1')
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:2147483647;' +
      'font:12px/1.2 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;' +
      'color:#E6EDF7;background:rgba(15,27,51,.92);border:1px solid rgba(255,255,255,.12);' +
      'border-radius:10px;padding:8px 10px;backdrop-filter:blur(6px);' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none'
    el.textContent = 'Integrity: 100 | Violations: 0'
    return el
  }

  function updateBadge(el, score, violations) {
    if (!el) return
    el.textContent = 'Integrity: ' + String(score) + ' | Violations: ' + String(violations)
    el.style.borderColor = score >= 80 ? 'rgba(18,183,106,0.55)' : score >= 50 ? 'rgba(247,184,75,0.6)' : 'rgba(240,68,56,0.65)'
  }

  /* ------------------------------------------------------------------ *
   * Client
   * ------------------------------------------------------------------ */

  function createClient(config) {
    var state = {
      version: VERSION,
      sessionId: config.sessionId,
      examId: config.examId,
      attemptId: config.attemptId,
      candidateLabel: config.candidateLabel,
      startedAt: nowIso(),
      lastHeartbeatAt: null,
      lastFlushAt: 0,
      lastActivityAt: Date.now(),
      isIdle: false,
      isFocused: document.hasFocus(),
      visibilityState: document.visibilityState || 'visible',
      isFullscreen: !!detectFullscreenElement(),
      devtoolsSuspected: false,
      violationCounts: {},
      violations: [],
      queue: [],
      sentEvents: 0,
      droppedEvents: 0,
      failedFlushes: 0,
      stopped: false,
      seq: 0,
      awayMs: 0,
      hiddenAt: 0,
      flags: {},
      resumed: false
    }

    /* Resume the same session after a page change or reload (same tab, same attempt). */
    var storeKey = config.persist ? 'tinyproctor:' + config.attemptId : ''
    var saved = storeKey ? storeGet(storeKey) : null
    if (saved && saved.sessionId) {
      config.sessionId = state.sessionId = saved.sessionId
      state.startedAt = saved.startedAt || state.startedAt
      state.violationCounts = saved.counts || {}
      state.seq = saved.seq || 0
      state.queue = saved.queue || []
      state.awayMs = saved.awayMs || 0
      state.flags = saved.flags || {}
      state.resumed = true
      state.gapMs = saved.at ? Math.max(0, Date.now() - saved.at) : 0
    }

    var cleared = false
    function save() {
      if (!storeKey || cleared) return
      storeSet(storeKey, {
        sessionId: state.sessionId,
        startedAt: state.startedAt,
        counts: state.violationCounts,
        seq: state.seq,
        queue: state.queue,
        awayMs: state.awayMs,
        flags: state.flags,
        at: Date.now()
      })
    }

    var badgeEl = null
    var badgeDomReadyListener = null
    function ensureBadge() {
      if (config.silent) return
      if (badgeEl) return
      if (!document || !document.body) return
      badgeEl = createBadge()
      document.body.appendChild(badgeEl)
      updateBadge(badgeEl, integrityScore(), totalViolations())
    }
    if (!config.silent) {
      if (document && document.body) {
        ensureBadge()
      } else {
        badgeDomReadyListener = function () {
          ensureBadge()
        }
        document.addEventListener('DOMContentLoaded', badgeDomReadyListener, { once: true })
      }
    }

    function totalViolations() {
      var n = 0
      var k
      for (k in state.violationCounts) {
        if (Object.prototype.hasOwnProperty.call(state.violationCounts, k)) n += state.violationCounts[k]
      }
      return n
    }

    function integrityScore() {
      return computeScore(config.weights, state.violationCounts)
    }

    function pushViolation(violationKey, eventType, eventData, isViolation) {
      if (state.stopped) return
      var t = nowIso()
      var rec = {
        t: t,
        eventType: eventType,
        violationKey: violationKey || null,
        eventData: eventData || null
      }
      state.violations.push(rec)
      if (state.violations.length > 500) state.violations.splice(0, state.violations.length - 500)
      if (isViolation && violationKey) {
        state.violationCounts[violationKey] = (state.violationCounts[violationKey] || 0) + 1
      }
      updateBadge(badgeEl, integrityScore(), totalViolations())
      enqueueEvent(eventType, eventData, violationKey, t)
      if (isViolation && violationKey) {
        safeCallback(config.onViolation, [violationKey, eventData || null, getState()])
      }
    }

    function buildEventPayload(eventType, eventData, violationKey, clientTime) {
      var score = computeScore(config.weights, state.violationCounts)
      state.seq += 1
      var payload = {
        schemaVersion: 1,
        clientVersion: VERSION,
        seq: state.seq,
        sessionId: config.sessionId,
        examId: config.examId,
        attemptId: config.attemptId,
        candidateLabel: config.candidateLabel,
        clientTime: clientTime || nowIso(),
        eventType: eventType,
        violationKey: violationKey || null,
        eventData: eventData || null,
        pageUrl: String(window.location.href),
        referrer: document.referrer ? String(document.referrer) : '',
        visibilityState: document.visibilityState || '',
        hasFocus: !!document.hasFocus(),
        isFullscreen: !!detectFullscreenElement(),
        violationCount: totalViolations(),
        integrityScore: score
      }
      return payload
    }

    function enqueueEvent(eventType, eventData, violationKey, clientTime) {
      var payload = buildEventPayload(eventType, eventData, violationKey, clientTime)
      safeCallback(config.onEvent, [payload])
      if (!config.endpoint) return
      state.queue.push(payload)
      if (state.queue.length > config.queueMax) {
        state.queue.shift()
        state.droppedEvents += 1
      }
      save()
      armDeferred()
      scheduleFlush(false)
    }

    var flushTimer = null
    function flushDelay() {
      if (!state.failedFlushes) return config.flushMs
      var d = config.flushMs * Math.pow(2, Math.min(state.failedFlushes, 6))
      return clamp(d, config.flushMs, 30000)
    }

    function scheduleFlush(immediate) {
      if (!config.endpoint || state.stopped) return
      if (immediate) {
        flush(true)
        return
      }
      if (flushTimer) return
      flushTimer = setTimeout(function () {
        flushTimer = null
        flush(false)
      }, flushDelay())
    }

    function encodeBody(bodyJson) {
      var jsonText = JSON.stringify(bodyJson)
      if (config.payloadFormat === 'form') {
        return {
          contentType: 'application/x-www-form-urlencoded; charset=utf-8',
          bodyText: 'payload=' + encodeURIComponent(jsonText)
        }
      }
      /* text/plain is CORS-safelisted: no preflight for cross-origin collectors */
      if (config.payloadFormat === 'text') return { contentType: 'text/plain;charset=UTF-8', bodyText: jsonText }
      return { contentType: 'application/json', bodyText: jsonText }
    }

    function sendJsonOnce(bodyJson, preferBeacon) {
      var url = config.endpoint
      var enc = encodeBody(bodyJson)
      var bodyText = enc.bodyText

      if (preferBeacon && supportsBeacon()) {
        try {
          var ok = navigator.sendBeacon(url, new Blob([bodyText], { type: enc.contentType }))
          if (ok) return Promise.resolve({ ok: true, via: 'beacon' })
        } catch (e) {
        }
      }

      if (supportsKeepaliveFetch()) {
        try {
          return window
            .fetch(url, {
              method: 'POST',
              mode: 'cors',
              credentials: config.credentials,
              headers: {
                'Content-Type': enc.contentType,
                'Accept': 'application/json, text/plain, */*'
              },
              body: bodyText,
              keepalive: true
            })
            .then(function (res) {
              return { ok: res && res.ok, status: res ? res.status : 0, via: 'fetch' }
            })
            .catch(function () {
              return { ok: false, status: 0, via: 'fetch' }
            })
        } catch (e2) {
          return Promise.resolve({ ok: false, status: 0, via: 'fetch' })
        }
      }

      return Promise.resolve({ ok: false, status: 0, via: 'none' })
    }

    function batchEnvelope(events) {
      return {
        schemaVersion: 1,
        clientVersion: VERSION,
        kind: 'batch',
        sessionId: config.sessionId,
        examId: config.examId,
        attemptId: config.attemptId,
        candidateLabel: config.candidateLabel,
        sentAt: nowIso(),
        userAgent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '',
        language: typeof navigator !== 'undefined' ? String(navigator.language || '') : '',
        screen: {
          w: window.screen ? window.screen.width : 0,
          h: window.screen ? window.screen.height : 0
        },
        timezoneOffsetMin: new Date().getTimezoneOffset(),
        events: events
      }
    }

    var flushInFlight = false
    function flush(preferBeacon) {
      if (!config.endpoint) return
      if (!state.queue.length) return
      if (flushInFlight && !preferBeacon) return
      var batch = state.queue.splice(0, config.batchMax)
      var payload = batchEnvelope(batch)
      /* keepalive/beacon bodies share a 64 KiB budget: keep each batch under batchBytes */
      while (batch.length > 1 && JSON.stringify(payload).length > config.batchBytes) {
        state.queue.unshift(batch.pop())
        payload.events = batch
      }
      flushInFlight = true
      sendJsonOnce(payload, preferBeacon)
        .then(function (res) {
          flushInFlight = false
          if (res && res.ok) {
            state.sentEvents += batch.length
            state.lastFlushAt = Date.now()
            state.failedFlushes = 0
            save()
            armDeferred()
            if (state.queue.length) scheduleFlush(false)
            return
          }
          state.failedFlushes += 1
          state.queue = batch.concat(state.queue)
          if (state.queue.length > config.queueMax) {
            state.droppedEvents += state.queue.length - config.queueMax
            state.queue.length = config.queueMax
          }
          save()
          scheduleFlush(false)
        })
        .catch(function () {
          flushInFlight = false
          state.failedFlushes += 1
          state.queue = batch.concat(state.queue)
          save()
          scheduleFlush(false)
        })
    }

    /* fetchLater(): the browser sends the pending batch even if the tab is killed
       before pagehide runs. Re-armed on every change, disarmed once sent. */
    var deferred = null
    function disarmDeferred() {
      if (!deferred) return
      try {
        deferred.abort()
      } catch (e) {
      }
      deferred = null
    }

    function armDeferred() {
      disarmDeferred()
      if (!config.endpoint || state.stopped || !state.queue.length || typeof window.fetchLater !== 'function') return
      try {
        var enc = encodeBody(batchEnvelope(state.queue.slice(0, config.batchMax)))
        deferred = new AbortController()
        window.fetchLater(config.endpoint, {
          method: 'POST',
          credentials: config.credentials,
          headers: { 'Content-Type': enc.contentType },
          body: enc.bodyText,
          signal: deferred.signal
        })
      } catch (e) {
        deferred = null
      }
    }

    /* ---------------- DevTools heuristics ---------------- */

    var lastDevtoolsResizeAt = 0
    var devtoolsResizeActive = false
    function devtoolsResizeCheck(atStart) {
      if (!config.devtools) return
      /* at start: once per session, desktop only (mobile toolbars and keyboards skew the sizes) */
      if (atStart === true && (state.flags.devtools_resize || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))) return
      var dw = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0))
      var dh = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0))
      var threshold = config.devtoolsResizeThreshold
      var suspected = dw > threshold || dh > threshold
      var now = Date.now()
      if (!suspected) {
        devtoolsResizeActive = false
        return
      }
      if (!devtoolsResizeActive || now - lastDevtoolsResizeAt >= config.devtoolsResizeCooldownMs) {
        devtoolsResizeActive = true
        lastDevtoolsResizeAt = now
        state.devtoolsSuspected = true
        state.flags.devtools_resize = 1
        pushViolation('devtools_resize', 'devtools', { signal: atStart === true ? 'start' : 'resize', dw: dw, dh: dh, threshold: threshold }, true)
      }
    }

    var onResize = throttle(function () { devtoolsResizeCheck(false) }, config.resizeThrottleMs)

    var lastDevtoolsKeyAt = 0

    function devtoolsKeyCheck(ev) {
      if (!config.devtools) return
      var e = ev || window.event
      if (!e) return
      var key = e.key || ''
      var code = e.code || ''
      var isF12 = key === 'F12' || code === 'F12' || e.keyCode === 123
      var ctrl = !!e.ctrlKey
      var shift = !!e.shiftKey
      var meta = !!e.metaKey
      var alt = !!e.altKey
      var k = String(key).toLowerCase()
      var isCombo = (ctrl || meta) && shift && (k === 'i' || k === 'j' || k === 'c')
      var isAltMetaI = (meta && alt && k === 'i')
      if (isF12 || isCombo || isAltMetaI) {
        var now = Date.now()
        if (now - lastDevtoolsKeyAt < 2000) return
        lastDevtoolsKeyAt = now
        state.devtoolsSuspected = true
        pushViolation('devtools_key', 'devtools', { signal: 'key', key: key, code: code, ctrl: ctrl, shift: shift, alt: alt, meta: meta }, true)
      }
    }

    /* ---------------- Print detection ---------------- */

    var lastPrintAt = 0
    function reportPrint(signal) {
      if (!config.print) return
      var now = Date.now()
      if (now - lastPrintAt < 2000) return
      lastPrintAt = now
      pushViolation('print_attempt', 'print', { signal: signal }, true)
      flush(false)
    }

    function printKeyCheck(ev) {
      if (!config.print) return
      var e = ev || window.event
      if (!e) return
      var k = String(e.key || '').toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'p') {
        reportPrint('key')
      }
    }

    function onBeforePrint() {
      reportPrint('beforeprint')
    }

    function onKeydown(ev) {
      markActivity()
      devtoolsKeyCheck(ev)
      printKeyCheck(ev)
    }

    /* ---------------- Clipboard detection ---------------- */

    function clipboardHandler(kind) {
      return function (ev) {
        if (!config.clipboard) return
        if (config.blockClipboard && ev && typeof ev.preventDefault === 'function') {
          try { ev.preventDefault() } catch (e) {}
        }
        var target = ev && ev.target ? ev.target : null
        var tag = target && target.tagName ? String(target.tagName).toLowerCase() : ''
        pushViolation(kind + '_attempt', 'clipboard', { action: kind, targetTag: tag, blocked: !!config.blockClipboard }, true)
        flush(false)
      }
    }

    var onCopy = clipboardHandler('copy')
    var onCut = clipboardHandler('cut')
    var onPaste = clipboardHandler('paste')

    /* ---------------- Context menu detection ---------------- */

    function onContextMenu(ev) {
      if (!config.contextmenu) return
      if (config.blockContextmenu && ev && typeof ev.preventDefault === 'function') {
        try { ev.preventDefault() } catch (e) {}
      }
      pushViolation('context_menu', 'contextmenu', { blocked: !!config.blockContextmenu }, true)
      flush(false)
    }

    /* ---------------- Idle detection ---------------- */

    var idleTimer = null
    function markActivity() {
      state.lastActivityAt = Date.now()
      if (state.isIdle) {
        state.isIdle = false
        pushViolation(null, 'idle', { idle: false }, false)
        scheduleFlush(false)
      }
    }

    var onActivity = throttle(markActivity, 1000)

    function idleCheck() {
      if (!config.idle) return
      if (state.isIdle) return
      var idleFor = Date.now() - state.lastActivityAt
      if (idleFor >= config.idleMs) {
        state.isIdle = true
        pushViolation('page_idle', 'idle', { idle: true, idleMs: idleFor }, true)
        flush(false)
      }
    }

    function startIdleWatch() {
      if (!config.idle) return
      if (idleTimer) return
      idleTimer = setInterval(idleCheck, Math.max(1000, Math.min(5000, Math.floor(config.idleMs / 4))))
    }

    function stopIdleWatch() {
      if (!idleTimer) return
      clearInterval(idleTimer)
      idleTimer = null
    }

    /* ---------------- Core event handlers ---------------- */

    /* Away time: one period runs from the first hide/blur until the page is visible AND focused again. */
    function awayStart() {
      if (!state.awaySince) state.awaySince = Date.now()
    }

    function awayEnd() {
      if (!state.awaySince || document.hidden || !document.hasFocus()) return 0
      var d = Date.now() - state.awaySince
      state.awaySince = 0
      state.awayMs += d
      return d
    }

    var blurTimer = null
    function recordBlur(deduped) {
      blurTimer = null
      if (deduped) pushViolation(null, 'focus', { focused: false, deduped: true }, false)
      else pushViolation('window_blur', 'focus', { focused: false }, true)
      flush(true)
    }

    function onVisibilityChange() {
      var vs = document.visibilityState || (document.hidden ? 'hidden' : 'visible')
      state.visibilityState = vs
      if (document.hidden || vs === 'hidden') {
        /* hidden because the page is unloading (next quiz page, reload): not a tab switch.
           The server sees how long the candidate was gone via the next page's session gapMs. */
        if (state.unloading) {
          pushViolation(null, 'visibility', { visibilityState: vs, unload: true }, false)
          return flush(true)
        }
        state.hiddenAt = Date.now()
        awayStart()
        if (blurTimer) {
          clearTimeout(blurTimer)
          recordBlur(true)
        }
        pushViolation('tab_hidden', 'visibility', { visibilityState: vs }, true)
        flush(true)
      } else {
        pushViolation(null, 'visibility', { visibilityState: vs, awayMs: awayEnd() }, false)
        scheduleFlush(false)
      }
    }

    /* Capture-phase window listeners also receive every element's blur/focus:
       only the window itself losing focus counts. */
    function onBlur(ev) {
      if (ev && ev.target && ev.target !== window) return
      state.isFocused = false
      awayStart()
      var grace = config.blurDedupeMs
      if (!grace) return recordBlur(false)
      if (Date.now() - state.hiddenAt < grace) return recordBlur(true)
      if (!blurTimer) blurTimer = setTimeout(function () { recordBlur(false) }, grace)
    }

    function onFocus(ev) {
      if (ev && ev.target && ev.target !== window) return
      state.isFocused = true
      markActivity()
      pushViolation(null, 'focus', { focused: true, awayMs: awayEnd() }, false)
      scheduleFlush(false)
    }

    /* Second screen: Window Management API boolean, no permission prompt (Chromium). */
    function onScreenChange() {
      if (!config.screens || !window.screen || !('isExtended' in window.screen)) return
      var ext = !!window.screen.isExtended
      if (ext && !state.flags.multi_screen) {
        state.flags.multi_screen = 1
        pushViolation('multi_screen', 'screen', { isExtended: true }, true)
      } else if (!ext && state.flags.multi_screen) {
        state.flags.multi_screen = 0
        pushViolation(null, 'screen', { isExtended: false }, false)
      }
    }

    /* WebDriver-controlled browsers must set navigator.webdriver. Easy to spoof, so false proves nothing. */
    function checkAutomation() {
      if (!config.automation || state.flags.automation_flag) return
      if (typeof navigator !== 'undefined' && navigator.webdriver === true) {
        state.flags.automation_flag = 1
        pushViolation('automation_flag', 'automation', { webdriver: true }, true)
      }
    }

    function tagOf(t) {
      return t && t.tagName ? String(t.tagName).toLowerCase() : ''
    }

    /* Text dragged and dropped into the page bypasses paste events. File drops are ignored. */
    function onDrop(ev) {
      if (!config.clipboard || !ev) return
      var types = ev.dataTransfer && ev.dataTransfer.types ? Array.prototype.slice.call(ev.dataTransfer.types) : []
      if (types.indexOf('Files') !== -1) return
      if (config.blockClipboard && typeof ev.preventDefault === 'function') {
        try { ev.preventDefault() } catch (e) {}
      }
      pushViolation('drop_attempt', 'clipboard', { action: 'drop', targetTag: tagOf(ev.target), blocked: !!config.blockClipboard }, true)
      flush(false)
    }

    /* A large block of text inserted in one go (agent browsers, auto-typers, text expanders).
       Records the length only, never the text. */
    var lastInsertAt = 0
    function onBeforeInput(ev) {
      if (!config.insert || !ev) return
      var type = ev.inputType || ''
      if (type !== 'insertText' && type !== 'insertReplacementText') return
      var n = typeof ev.data === 'string' ? ev.data.length : 0
      if (!n && ev.dataTransfer) {
        try { n = ev.dataTransfer.getData('text/plain').length } catch (e) {}
      }
      var now = Date.now()
      if (n < config.insertChars || now - lastInsertAt < 1000) return
      lastInsertAt = now
      pushViolation('insert_burst', 'input', { inputType: type, chars: n, targetTag: tagOf(ev.target) }, true)
      flush(false)
    }

    function onFullscreenChange() {
      var fs = !!detectFullscreenElement()
      var prev = state.isFullscreen
      state.isFullscreen = fs
      if (prev && !fs) {
        pushViolation('fullscreen_exit', 'fullscreen', { fullscreen: false }, true)
        flush(true)
        return
      }
      if (!prev && fs) {
        pushViolation(null, 'fullscreen', { fullscreen: true }, false)
        scheduleFlush(false)
      }
    }

    function heartbeat() {
      state.lastHeartbeatAt = nowIso()
      enqueueEvent('heartbeat', { active: !state.isIdle }, null, state.lastHeartbeatAt)
      flush(false)
    }

    var heartbeatTimer = null
    function startHeartbeat() {
      if (heartbeatTimer) return
      heartbeatTimer = setInterval(heartbeat, config.heartbeatMs)
      heartbeat()
    }

    function stopHeartbeat() {
      if (!heartbeatTimer) return
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    function onPagehide() {
      state.unloading = true
      save()
      flush(true)
    }

    function onPageshow(ev) {
      if (ev && ev.persisted) state.unloading = false
    }

    function bind() {
      document.addEventListener('visibilitychange', onVisibilityChange, true)
      window.addEventListener('blur', onBlur, true)
      window.addEventListener('focus', onFocus, true)
      document.addEventListener('fullscreenchange', onFullscreenChange, true)
      document.addEventListener('webkitfullscreenchange', onFullscreenChange, true)
      window.addEventListener('resize', onResize, true)
      window.addEventListener('keydown', onKeydown, true)
      window.addEventListener('beforeprint', onBeforePrint, true)
      document.addEventListener('copy', onCopy, true)
      document.addEventListener('cut', onCut, true)
      document.addEventListener('paste', onPaste, true)
      document.addEventListener('contextmenu', onContextMenu, true)
      document.addEventListener('mousemove', onActivity, true)
      document.addEventListener('mousedown', onActivity, true)
      document.addEventListener('scroll', onActivity, true)
      document.addEventListener('touchstart', onActivity, true)
      window.addEventListener('pagehide', onPagehide, true)
      window.addEventListener('pageshow', onPageshow, true)
      document.addEventListener('drop', onDrop, true)
      document.addEventListener('beforeinput', onBeforeInput, true)
      if (window.screen && window.screen.addEventListener) window.screen.addEventListener('change', onScreenChange)
    }

    function unbind() {
      document.removeEventListener('visibilitychange', onVisibilityChange, true)
      window.removeEventListener('blur', onBlur, true)
      window.removeEventListener('focus', onFocus, true)
      document.removeEventListener('fullscreenchange', onFullscreenChange, true)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange, true)
      window.removeEventListener('resize', onResize, true)
      window.removeEventListener('keydown', onKeydown, true)
      window.removeEventListener('beforeprint', onBeforePrint, true)
      document.removeEventListener('copy', onCopy, true)
      document.removeEventListener('cut', onCut, true)
      document.removeEventListener('paste', onPaste, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('mousemove', onActivity, true)
      document.removeEventListener('mousedown', onActivity, true)
      document.removeEventListener('scroll', onActivity, true)
      document.removeEventListener('touchstart', onActivity, true)
      window.removeEventListener('pagehide', onPagehide, true)
      window.removeEventListener('pageshow', onPageshow, true)
      document.removeEventListener('drop', onDrop, true)
      document.removeEventListener('beforeinput', onBeforeInput, true)
      if (window.screen && window.screen.removeEventListener) window.screen.removeEventListener('change', onScreenChange)
    }

    var startCheckTimer = null
    function start() {
      state.stopped = false
      bind()
      enqueueEvent('session', { resumed: state.resumed, persisted: !!storeKey, gapMs: state.gapMs || 0 }, null)
      startHeartbeat()
      startIdleWatch()
      ensureBadge()
      onScreenChange()
      checkAutomation()
      startCheckTimer = setTimeout(function () {
        if (!state.stopped) devtoolsResizeCheck(true)
      }, 1000)
      scheduleFlush(false)
    }

    function stop() {
      stopHeartbeat()
      stopIdleWatch()
      unbind()
      clearTimeout(startCheckTimer)
      clearTimeout(blurTimer)
      save()
      flush(true)
      disarmDeferred()
      state.stopped = true
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      if (badgeEl && badgeEl.parentNode) badgeEl.parentNode.removeChild(badgeEl)
      badgeEl = null
      if (badgeDomReadyListener) {
        document.removeEventListener('DOMContentLoaded', badgeDomReadyListener)
        badgeDomReadyListener = null
      }
    }

    function getState() {
      return {
        version: state.version,
        sessionId: state.sessionId,
        examId: state.examId,
        attemptId: state.attemptId,
        candidateLabel: state.candidateLabel,
        startedAt: state.startedAt,
        lastHeartbeatAt: state.lastHeartbeatAt,
        devtoolsSuspected: state.devtoolsSuspected,
        visibilityState: state.visibilityState,
        isFocused: state.isFocused,
        isFullscreen: state.isFullscreen,
        isIdle: state.isIdle,
        violationCounts: shallowCopy(state.violationCounts),
        violationCount: totalViolations(),
        integrityScore: integrityScore(),
        recentViolations: state.violations.slice(Math.max(0, state.violations.length - 50)),
        sentEvents: state.sentEvents,
        droppedEvents: state.droppedEvents,
        queuedEvents: state.queue.length,
        failedFlushes: state.failedFlushes,
        seq: state.seq,
        awayMs: state.awayMs,
        resumed: state.resumed,
        flags: shallowCopy(state.flags)
      }
    }

    function markCustomViolation(key, data) {
      pushViolation(String(key || 'custom'), 'custom', data || null, true)
      flush(false)
    }

    return {
      start: start,
      stop: stop,
      flush: function () {
        flush(true)
      },
      getState: getState,
      getConfig: function () {
        return shallowCopy(config)
      },
      requestFullscreen: requestFullscreen,
      exitFullscreen: exitFullscreen,
      markViolation: markCustomViolation,
      clearSession: function () {
        cleared = true
        if (storeKey) storeSet(storeKey, null)
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Config
   * ------------------------------------------------------------------ */

  function normalizeCredentials(v) {
    var s = String(v || '').trim().toLowerCase()
    if (s === 'include' || s === 'same-origin' || s === 'omit') return s
    return 'omit'
  }

  function normalizePayloadFormat(v) {
    var s = String(v || '').trim().toLowerCase()
    if (s === 'form' || s === 'x-www-form-urlencoded' || s === 'urlencoded') return 'form'
    if (s === 'text' || s === 'text/plain' || s === 'plain') return 'text'
    return 'json'
  }

  function mergeWeights(weights) {
    var out = shallowCopy(DEFAULT_WEIGHTS)
    var k
    if (weights && typeof weights === 'object') {
      for (k in weights) {
        if (Object.prototype.hasOwnProperty.call(weights, k)) out[k] = Number(weights[k]) || 0
      }
    }
    return out
  }

  function normalizeConfig(raw) {
    var cfg = raw && typeof raw === 'object' ? shallowCopy(raw) : {}
    cfg.endpoint = normalizeUrl(cfg.endpoint)
    cfg.examId = cfg.examId != null ? String(cfg.examId) : ''
    var hasAttempt = cfg.attemptId != null && cfg.attemptId !== ''
    cfg.attemptId = hasAttempt ? String(cfg.attemptId) : createId('attempt')
    /* resume only works for a real attempt id: an auto id changes on every page */
    cfg.persist = hasAttempt && parseBool(cfg.persist, true)
    cfg.candidateLabel = cfg.candidateLabel != null ? String(cfg.candidateLabel) : ''
    cfg.sessionId = cfg.sessionId != null && cfg.sessionId !== '' ? String(cfg.sessionId) : createId('tp')
    cfg.heartbeatMs = clamp(toInt(cfg.heartbeatMs, 30000), 5000, 10 * 60 * 1000)
    cfg.flushMs = clamp(toInt(cfg.flushMs, 900), 150, 5000)
    cfg.batchMax = clamp(toInt(cfg.batchMax, 20), 1, 100)
    cfg.batchBytes = clamp(toInt(cfg.batchBytes, 48 * 1024), 4096, 60 * 1024)
    cfg.blurDedupeMs = clamp(toInt(cfg.blurDedupeMs, 0), 0, 5000)
    cfg.insertChars = clamp(toInt(cfg.insertChars, 40), 5, 100000)
    cfg.queueMax = clamp(toInt(cfg.queueMax, 250), 50, 5000)
    cfg.resizeThrottleMs = clamp(toInt(cfg.resizeThrottleMs, 500), 100, 3000)
    cfg.devtoolsResizeThreshold = clamp(toInt(cfg.devtoolsResizeThreshold, 160), 60, 600)
    cfg.devtoolsResizeCooldownMs = clamp(toInt(cfg.devtoolsResizeCooldownMs, 10000), 1000, 60000)
    cfg.idleMs = clamp(toInt(cfg.idleMs, 60000), 10000, 30 * 60 * 1000)
    cfg.silent = parseBool(cfg.silent, true)
    cfg.devtools = parseBool(cfg.devtools, true)
    cfg.clipboard = parseBool(cfg.clipboard, true)
    cfg.blockClipboard = parseBool(cfg.blockClipboard, false)
    cfg.contextmenu = parseBool(cfg.contextmenu, true)
    cfg.blockContextmenu = parseBool(cfg.blockContextmenu, false)
    cfg.print = parseBool(cfg.print, true)
    cfg.idle = parseBool(cfg.idle, true)
    cfg.screens = parseBool(cfg.screens, true)
    cfg.automation = parseBool(cfg.automation, true)
    cfg.insert = parseBool(cfg.insert, true)
    cfg.credentials = normalizeCredentials(cfg.credentials)
    cfg.payloadFormat = normalizePayloadFormat(cfg.payloadFormat)
    cfg.weights = mergeWeights(cfg.weights)
    if (typeof cfg.onViolation !== 'function') cfg.onViolation = null
    if (typeof cfg.onEvent !== 'function') cfg.onEvent = null
    return cfg
  }

  function buildConfigFromScript(scriptEl) {
    var ds = (scriptEl && scriptEl.dataset) ? scriptEl.dataset : {}
    var raw = {
      endpoint: pickFirst(ds, ['apiUrl', 'apiurl', 'endpoint', 'collectUrl', 'collecturl', 'url']),
      examId: pickFirst(ds, ['examId', 'examid']),
      attemptId: pickFirst(ds, ['attemptId', 'attemptid']),
      candidateLabel: pickFirst(ds, ['candidateLabel', 'candidatelabel', 'candidate']),
      silent: pickFirst(ds, ['silent', 'silentMode', 'silentmode']),
      devtools: pickFirst(ds, ['devtools', 'devtoolsDetect', 'devtoolsdetect']),
      clipboard: pickFirst(ds, ['clipboard', 'clipboardDetect', 'clipboarddetect']),
      blockClipboard: pickFirst(ds, ['blockClipboard', 'blockclipboard']),
      contextmenu: pickFirst(ds, ['contextmenu', 'contextMenu', 'rightclick', 'rightClick']),
      blockContextmenu: pickFirst(ds, ['blockContextmenu', 'blockContextMenu', 'blockcontextmenu', 'blockRightclick']),
      print: pickFirst(ds, ['print', 'printDetect', 'printdetect']),
      idle: pickFirst(ds, ['idle', 'idleDetect', 'idledetect']),
      idleMs: pickFirst(ds, ['idleMs', 'idlems']),
      screens: ds.screens,
      automation: ds.automation,
      insert: ds.insert,
      insertChars: ds.insertChars,
      blurDedupeMs: ds.blurDedupeMs,
      persist: ds.persist,
      batchBytes: ds.batchBytes,
      heartbeatMs: pickFirst(ds, ['heartbeatMs', 'heartbeatms', 'heartbeat']),
      flushMs: pickFirst(ds, ['flushMs', 'flushms']),
      batchMax: pickFirst(ds, ['batchMax', 'batchmax']),
      queueMax: pickFirst(ds, ['queueMax', 'queuemax']),
      resizeThrottleMs: pickFirst(ds, ['resizeThrottleMs', 'resizethrottlems']),
      devtoolsResizeThreshold: pickFirst(ds, ['devtoolsResizeThreshold', 'devtoolsresizethreshold']),
      devtoolsResizeCooldownMs: pickFirst(ds, ['devtoolsResizeCooldownMs', 'devtoolsresizecooldownms']),
      credentials: pickFirst(ds, ['credentials']),
      payloadFormat: pickFirst(ds, ['payloadFormat', 'payloadformat', 'format']),
      weights: safeJsonParse(pickFirst(ds, ['weights', 'violationWeights', 'violationweights']), null)
    }
    var cfg = normalizeConfig(raw)
    cfg.autoinit = parseBool(pickFirst(ds, ['autoinit', 'autoInit', 'auto-init']), true)
    return cfg
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */

  var instance = null

  TinyProctor.init = function init(config) {
    if (instance) return instance
    var cfg
    if (config && typeof config === 'object') {
      cfg = normalizeConfig(config)
    } else {
      cfg = buildConfigFromScript(getCurrentScript())
    }
    instance = createClient(cfg)
    instance.start()
    return instance
  }

  TinyProctor.get = function get() {
    return instance
  }

  /* destroy(true) also forgets the saved session, e.g. after the exam is submitted */
  TinyProctor.destroy = function destroy(clearSession) {
    if (!instance) return
    try {
      instance.stop()
      if (clearSession) instance.clearSession()
    } catch (e) {
    }
    instance = null
  }

  TinyProctor.version = VERSION
  TinyProctor.defaultWeights = shallowCopy(DEFAULT_WEIGHTS)

  function autoInit() {
    if (instance) return
    var s = getCurrentScript()
    /* bundled or imported without a script tag: wait for an explicit init(config) */
    if (!s) return
    var cfg = buildConfigFromScript(s)
    if (cfg && cfg.autoinit === false) return
    instance = createClient(cfg)
    instance.start()
  }

  autoInit()

  window.TinyProctor = TinyProctor
  /* CommonJS bundlers: require('tinyproctor') returns the API (no auto-start without a script tag) */
  if (typeof module === 'object' && module && module.exports) module.exports = TinyProctor
})(window, document)
