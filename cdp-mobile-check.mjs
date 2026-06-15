import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9337
const profile = `C:\\tmp\\tinyproctor-edge-${Date.now()}`
const outDir = 'C:\\tmp'

function fileUrl(path) {
  return `file:///${resolve(path).replace(/\\/g, '/')}`
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms))
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return response.json()
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function newTab(url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`
  let response = await fetch(endpoint, { method: 'PUT' })
  if (!response.ok) response = await fetch(endpoint)
  if (!response.ok) throw new Error(`Could not create tab: HTTP ${response.status}`)
  return response.json()
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.nextId = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolveConnect, rejectConnect) => {
      this.ws.addEventListener('open', resolveConnect, { once: true })
      this.ws.addEventListener('error', rejectConnect, { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && this.pending.has(message.id)) {
        const { resolveMessage, rejectMessage } = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) rejectMessage(new Error(message.error.message))
        else resolveMessage(message.result)
        return
      }
      const listeners = this.listeners.get(message.method) || []
      for (const listener of listeners) listener(message.params || {})
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    const payload = JSON.stringify({ id, method, params })
    const promise = new Promise((resolveMessage, rejectMessage) => {
      this.pending.set(id, { resolveMessage, rejectMessage })
    })
    this.ws.send(payload)
    return promise
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || []
    listeners.push(listener)
    this.listeners.set(method, listeners)
  }

  once(method) {
    return new Promise((resolveOnce) => {
      const listener = (params) => {
        const listeners = this.listeners.get(method) || []
        this.listeners.set(method, listeners.filter((item) => item !== listener))
        resolveOnce(params)
      }
      this.on(method, listener)
    })
  }

  close() {
    this.ws.close()
  }
}

async function capture(cdp, path) {
  const result = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  await writeFile(path, Buffer.from(result.data, 'base64'))
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed')
  return result.result.value
}

async function navigate(cdp, url) {
  const load = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  await load
  await delay(200)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const edge = spawn(edgePath, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' })

  try {
    await waitForJson(`http://127.0.0.1:${port}/json/version`)
    const tabInfo = await newTab('about:blank')
    const cdp = new CdpClient(tabInfo.webSocketDebuggerUrl)
    await cdp.connect()

    const runtimeErrors = []
    const logMessages = []
    cdp.on('Runtime.exceptionThrown', (params) => runtimeErrors.push(params.exceptionDetails?.text || 'runtime exception'))
    cdp.on('Log.entryAdded', (params) => {
      const entry = params.entry || {}
      if (entry.level === 'error' || entry.level === 'warning') logMessages.push(`${entry.level}: ${entry.text}`)
    })

    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    })
    await navigate(cdp, fileUrl('index.html'))
    const closedState = await evaluate(cdp, `(() => {
      const nav = document.querySelector('header nav')
      const toggle = document.querySelector('.menu-toggle')
      const toggleRect = toggle.getBoundingClientRect()
      return {
        url: location.href,
        title: document.title,
        bodyLength: document.body.innerText.length,
        hasToggle: !!toggle,
        toggleDisplay: getComputedStyle(toggle).display,
        toggleWidth: Math.round(toggleRect.width),
        toggleHeight: Math.round(toggleRect.height),
        toggleGap: getComputedStyle(toggle).gap,
        spanTransition: getComputedStyle(toggle.querySelector('span')).transitionDuration,
        navDisplay: getComputedStyle(nav).display,
        menuOpen: document.querySelector('.site-menu').open,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })()`)
    const mobileClosed = 'C:\\tmp\\tinyproctor-mobile-index-closed.png'
    await capture(cdp, mobileClosed)
    await evaluate(cdp, `document.querySelector('.menu-toggle').click()`)
    await delay(200)
    const openState = await evaluate(cdp, `(() => {
      const nav = document.querySelector('header nav')
      return {
        navDisplay: getComputedStyle(nav).display,
        menuOpen: document.querySelector('.site-menu').open,
        links: Array.from(nav.querySelectorAll('a')).map((link) => link.textContent.trim()).join('|'),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })()`)
    const mobileOpen = 'C:\\tmp\\tinyproctor-mobile-index-open.png'
    await capture(cdp, mobileOpen)

    await navigate(cdp, fileUrl('docs.html'))
    await evaluate(cdp, `document.querySelector('.menu-toggle').click()`)
    await delay(200)
    const docsState = await evaluate(cdp, `(() => {
      const nav = document.querySelector('header nav')
      return {
        title: document.title,
        navDisplay: getComputedStyle(nav).display,
        menuOpen: document.querySelector('.site-menu').open,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })()`)
    const docsMobileOpen = 'C:\\tmp\\tinyproctor-mobile-docs-open.png'
    await capture(cdp, docsMobileOpen)

    await navigate(cdp, fileUrl('demo/exam.html'))
    const demoState = await evaluate(cdp, `(() => {
      function left(selector) {
        return Math.round(document.querySelector(selector).getBoundingClientRect().left)
      }
      function rightGap(selector) {
        const rect = document.querySelector(selector).getBoundingClientRect()
        return Math.round(window.innerWidth - rect.right)
      }
      return {
        title: document.title,
        brandLeft: left('header .brand'),
        toggleRightGap: rightGap('.menu-toggle'),
        heroContentLeft: left('.hero-inner .pill'),
        firstCardLeft: left('.section .card'),
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })()`)
    const demoMobile = 'C:\\tmp\\tinyproctor-mobile-demo.png'
    await capture(cdp, demoMobile)

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await navigate(cdp, fileUrl('compare.html'))
    const desktopState = await evaluate(cdp, `(() => {
      const nav = document.querySelector('header nav')
      const toggle = document.querySelector('.menu-toggle')
      return {
        title: document.title,
        toggleDisplay: getComputedStyle(toggle).display,
        navDisplay: getComputedStyle(nav).display,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })()`)
    const desktopCompare = 'C:\\tmp\\tinyproctor-desktop-compare.png'
    await capture(cdp, desktopCompare)

    cdp.close()
    console.log(JSON.stringify({
      closedState,
      openState,
      docsState,
      demoState,
      desktopState,
      runtimeErrors,
      logMessages,
      screenshots: { mobileClosed, mobileOpen, docsMobileOpen, demoMobile, desktopCompare },
    }, null, 2))
  } finally {
    edge.kill()
    try {
      await rm(profile, { recursive: true, force: true })
    } catch {}
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
