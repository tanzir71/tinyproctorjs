(function () {
  'use strict'

  function $(sel, root) {
    return (root || document).querySelector(sel)
  }

  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel))
  }

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text)
    }
    var ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', 'readonly')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.left = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch (e) {
    }
    document.body.removeChild(ta)
    return Promise.resolve()
  }

  function setBtnState(btn, label) {
    if (!btn) return
    btn.dataset.originalLabel = btn.dataset.originalLabel || btn.textContent
    btn.textContent = label
    window.setTimeout(function () {
      btn.textContent = btn.dataset.originalLabel || 'Copy'
    }, 900)
  }

  function initCopyButtons() {
    $all('[data-copy-target]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-copy-target')
        var el = target ? $(target) : null
        var txt = el ? el.textContent : ''
        copyText(txt).then(function () {
          setBtnState(btn, 'Copied')
        })
      })
    })
  }

  function initAnchorScroll() {
    $all('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href') || ''
        if (href.length < 2) return
        var target = $(href)
        if (!target) return
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        try {
          history.replaceState(null, '', href)
        } catch (err) {
        }
      })
    })
  }

  function initSnippetGenerator() {
    var form = $('#snippetForm')
    if (!form) return

    function val(id) {
      var el = $('#' + id)
      return el ? String(el.value || '').trim() : ''
    }

    function boolVal(id) {
      var v = val(id).toLowerCase()
      return v === 'true' || v === '1' || v === 'yes' || v === 'on'
    }

    function parseWeights(s) {
      if (!s) return ''
      try {
        JSON.parse(s)
        return s
      } catch (e) {
        return ''
      }
    }

    function update() {
      var endpoint = val('endpoint') || 'https://your-domain.example/collect.php'
      var examId = val('examId')
      var attemptId = val('attemptId') || 'ATTEMPT_12345'
      var label = val('candidateLabel')
      var silent = boolVal('silent')
      var heartbeat = val('heartbeatMs') || '30000'
      var weights = parseWeights(val('weights'))
      var src = val('scriptSrc') || '/path/to/tinyproctor.js'

      var lines = []
      lines.push('<script')
      lines.push('  src="' + src.replace(/"/g, '&quot;') + '"')
      lines.push('  data-tinyproctor')
      lines.push('  data-endpoint="' + endpoint.replace(/"/g, '&quot;') + '"')
      if (examId) lines.push('  data-exam-id="' + examId.replace(/"/g, '&quot;') + '"')
      if (attemptId) lines.push('  data-attempt-id="' + attemptId.replace(/"/g, '&quot;') + '"')
      if (label) lines.push('  data-candidate-label="' + label.replace(/"/g, '&quot;') + '"')
      lines.push('  data-silent="' + String(silent) + '"')
      lines.push('  data-heartbeat-ms="' + String(heartbeat).replace(/"/g, '&quot;') + '"')
      if (weights) lines.push("  data-weights='" + weights.replace(/'/g, '&#39;') + "'")
      lines.push('></script>')

      var out = $('#snippetOut')
      if (out) out.textContent = lines.join('\n')
    }

    $all('input,select,textarea', form).forEach(function (el) {
      el.addEventListener('input', update)
      el.addEventListener('change', update)
    })
    update()
  }

  function init() {
    initCopyButtons()
    initAnchorScroll()
    initSnippetGenerator()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()

