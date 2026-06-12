/*!
 * tinyproctor.js v1.0.0
 * Minimal, self-hosted, dependency-free browser exam integrity monitoring.
 * https://github.com/tanzir71/tinyproctorjs
 * License: MIT
 */
(function (window, document) {
  'use strict'

  var TinyProctor = {}
  var VERSION = '1.0.0'

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
    var a = Math.random().toString(16).slice(2)
    var b = Math.random().toString(16).slice(2)
    var t = Date.now().toString(16)
    return (prefix ? prefix + '_' : '') + t + '_' + a + b
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
    return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null
  }

  function requestFullscreen(el) {
    var target = el || document.documentElement
    if (target.requestFullscreen) return target.requestFullscreen()
    if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen()
    if (target.mozRequestFullScreen) return target.mozRequestFullScreen()
    if (target.msRequestFullscreen) return target.msRequestFullscreen()
    return Promise.reject(new Error('fullscreen_not_supported'))
  }

  function exitFullscreen() {
    if (!detectFullscreenElement()) return Promise.resolve()
    if (document.exitFullscreen) return document.exitFullscreen()
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen()
    if (document.mozCancelFullScreen) return document.mozCancelFullScreen()
    if (document.msExitFullscreen) return document.msExitFullscreen()
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
    page_idle: 5
  }

  /* ------------------------------------------------------------------ *
   * Status badge (optional, silent=false)
   * ------------------------------------------------------------------ */

  function createBadge() {
    var el = document.createElement('div')
    el.setAttribute('data-tinyproctor-badge', '1')
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    el.style.position = 'fixed'
    el.style.top = '12px'
    el.style.right = '12px'
    el.style.zIndex = '2147483647'
    el.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
    el.style.fontSize = '12px'
    el.style.lineHeight = '1.2'
    el.style.color = '#E6EDF7'
    el.style.background = 'rgba(15, 27, 51, 0.92)'
    el.style.border = '1px solid rgba(255,255,255,0.12)'
    el.style.borderRadius = '10px'
    el.style.padding = '8px 10px'
    el.style.backdropFilter = 'blur(6px)'
    el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)'
    el.style.pointerEvents = 'none'
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
      stopped: false
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
      var payload = {
        schemaVersion: 1,
        clientVersion: VERSION,
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
      flushInFlight = true
      sendJsonOnce(payload, preferBeacon)
        .then(function (res) {
          flushInFlight = false
          if (res && res.ok) {
            state.sentEvents += batch.length
            state.lastFlushAt = Date.now()
            state.failedFlushes = 0
            if (state.queue.length) scheduleFlush(false)
            return
          }
          state.failedFlushes += 1
          state.queue = batch.concat(state.queue)
          if (state.queue.length > config.queueMax) {
            state.droppedEvents += state.queue.length - config.queueMax
            state.queue.length = config.queueMax
          }
          scheduleFlush(false)
        })
        .catch(function () {
          flushInFlight = false
          state.failedFlushes += 1
          state.queue = batch.concat(state.queue)
          scheduleFlush(false)
        })
    }

    /* ---------------- DevTools heuristics ---------------- */

    var lastDevtoolsResizeAt = 0
    var devtoolsResizeActive = false
    function devtoolsResizeCheck() {
      if (!config.devtools) return
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
        pushViolation('devtools_resize', 'devtools', { signal: 'resize', dw: dw, dh: dh, threshold: threshold }, true)
      }
    }

    var onResize = throttle(devtoolsResizeCheck, config.resizeThrottleMs)

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

    function onVisibilityChange() {
      var vs = document.visibilityState || (document.hidden ? 'hidden' : 'visible')
      state.visibilityState = vs
      if (document.hidden || vs === 'hidden') {
        pushViolation('tab_hidden', 'visibility', { visibilityState: vs }, true)
        flush(true)
      } else {
        pushViolation(null, 'visibility', { visibilityState: vs }, false)
        scheduleFlush(false)
      }
    }

    function onBlur() {
      state.isFocused = false
      pushViolation('window_blur', 'focus', { focused: false }, true)
      flush(true)
    }

    function onFocus() {
      state.isFocused = true
      markActivity()
      pushViolation(null, 'focus', { focused: true }, false)
      scheduleFlush(false)
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
      flush(true)
    }

    function onBeforeunload() {
      flush(true)
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
      window.addEventListener('beforeunload', onBeforeunload, true)
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
      window.removeEventListener('beforeunload', onBeforeunload, true)
    }

    function start() {
      state.stopped = false
      bind()
      startHeartbeat()
      startIdleWatch()
      ensureBadge()
      scheduleFlush(false)
    }

    function stop() {
      stopHeartbeat()
      stopIdleWatch()
      unbind()
      flush(true)
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
        failedFlushes: state.failedFlushes
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
      markViolation: markCustomViolation
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
    cfg.attemptId = cfg.attemptId != null && cfg.attemptId !== '' ? String(cfg.attemptId) : createId('attempt')
    cfg.candidateLabel = cfg.candidateLabel != null ? String(cfg.candidateLabel) : ''
    cfg.sessionId = cfg.sessionId != null && cfg.sessionId !== '' ? String(cfg.sessionId) : createId('tp')
    cfg.heartbeatMs = clamp(toInt(cfg.heartbeatMs, 30000), 5000, 10 * 60 * 1000)
    cfg.flushMs = clamp(toInt(cfg.flushMs, 900), 150, 5000)
    cfg.batchMax = clamp(toInt(cfg.batchMax, 20), 1, 100)
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

  TinyProctor.destroy = function destroy() {
    if (!instance) return
    try {
      instance.stop()
    } catch (e) {
    }
    instance = null
  }

  TinyProctor.version = VERSION
  TinyProctor.defaultWeights = shallowCopy(DEFAULT_WEIGHTS)

  function autoInit() {
    if (instance) return
    var s = getCurrentScript()
    var cfg = buildConfigFromScript(s)
    if (cfg && cfg.autoinit === false) return
    instance = createClient(cfg)
    instance.start()
  }

  autoInit()

  window.TinyProctor = TinyProctor
})(window, document)
