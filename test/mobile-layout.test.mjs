import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const landingPages = ['index.html', 'docs/index.html']
const sitePages = [
  ...readdirSync(root)
    .filter((name) => name.endsWith('.html'))
    .sort(),
  'demo/exam.html',
  ...readdirSync(join(root, 'docs'))
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => `docs/${name}`),
  'docs/demo/exam.html',
]

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cssFor(page) {
  const html = readFileSync(join(root, page), 'utf8')
  const match = html.match(/<style>([\s\S]*?)<\/style>/)
  assert.ok(match, `${page} has inline CSS`)
  return match[1]
}

function behaviorScriptFor(page) {
  const html = readFileSync(join(root, page), 'utf8')
  const scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1])
  assert.ok(scripts.length, `${page} has inline behavior script`)
  return scripts[scripts.length - 1]
}

function ruleBodies(css, selector) {
  const pattern = new RegExp(`${escapeRegex(selector)}\\s*\\{([^}]*)\\}`, 'g')
  return Array.from(css.matchAll(pattern), (match) => match[1].replace(/\s+/g, ' ').trim())
}

function hasDeclaration(css, selector, declarationPattern) {
  return ruleBodies(css, selector).some((body) => declarationPattern.test(body))
}

function expectedMenuScript(page) {
  return page.includes('/demo/') ? '../site-menu.js' : './site-menu.js'
}

test('landing page inner containers preserve horizontal gutters', () => {
  for (const page of landingPages) {
    const css = cssFor(page)
    for (const selector of ['.header-inner', '.hero-inner', '.support-inner']) {
      const [body] = ruleBodies(css, selector)
      assert.ok(body, `${page} defines ${selector}`)
      assert.match(body, /padding-top\s*:/, `${page} ${selector} sets vertical padding without resetting sides`)
      assert.match(body, /padding-bottom\s*:/, `${page} ${selector} sets vertical padding without resetting sides`)
      assert.doesNotMatch(body, /padding\s*:\s*[^;]*\s0(?:px)?(?:\s|;)/, `${page} ${selector} does not zero side padding`)
    }
  }
})

test('landing page hero grid allows mobile columns to shrink', () => {
  for (const page of landingPages) {
    const css = cssFor(page)
    assert.ok(
      hasDeclaration(css, '.hero-grid > *', /min-width\s*:\s*0\s*;/),
      `${page} lets hero grid children shrink inside the viewport`
    )
  }
})

test('site pages expose a mobile hamburger menu instead of a desktop nav strip', () => {
  for (const page of sitePages) {
    const html = readFileSync(join(root, page), 'utf8')
    const css = cssFor(page)
    assert.match(html, /<details class="site-menu">/, `${page} wraps navigation in a native menu disclosure`)
    assert.match(html, /<summary class="menu-toggle" aria-label="Open navigation">/, `${page} has an accessible hamburger summary`)
    assert.match(html, /<nav aria-label="Primary navigation">/, `${page} labels the primary navigation`)
    assert.match(
      html,
      new RegExp(`<script src="${escapeRegex(expectedMenuScript(page))}"></script>`),
      `${page} loads the shared menu behavior helper`
    )
    assert.match(css, /@media\s*\(max-width:\s*639px\)/, `${page} has mobile-specific layout rules`)
    assert.ok(hasDeclaration(css, '.menu-toggle', /display\s*:\s*none\s*;/), `${page} hides the hamburger on desktop`)
    assert.ok(hasDeclaration(css, '.menu-toggle', /display\s*:\s*inline-grid\s*;/), `${page} shows the hamburger on mobile`)
    assert.ok(hasDeclaration(css, 'header nav', /display\s*:\s*none\s*;/), `${page} hides menu links behind the hamburger on mobile`)
    assert.ok(hasDeclaration(css, '.site-menu[open] nav', /display\s*:\s*flex\s*;/), `${page} reveals menu links when opened`)
  }
})

test('site pages let dense mobile content shrink inside the viewport', () => {
  for (const page of sitePages) {
    const css = cssFor(page)
    assert.ok(
      hasDeclaration(css, 'main, .layout > *, .grid > *, .demo-grid > *, .hero-grid > *, .paths > *', /min-width\s*:\s*0\s*;/),
      `${page} lets grid and page children shrink around dense content`
    )
    assert.ok(
      hasDeclaration(css, 'pre, .snippet, .table-wrap', /max-width\s*:\s*100%\s*;/),
      `${page} keeps code blocks and table wrappers constrained to the viewport`
    )
  }
})

test('landing page copy button falls back when clipboard permission is denied', () => {
  for (const page of landingPages) {
    const script = behaviorScriptFor(page)
    let clickHandler
    let execCommand = ''
    const button = {
      textContent: 'COPY',
      addEventListener(type, handler) {
        if (type === 'click') clickHandler = handler
      },
      getAttribute() {
        return 'snippet'
      },
    }
    const clone = {
      textContent: 'copy me',
      querySelector() {
        return null
      },
    }
    const target = {
      cloneNode() {
        return clone
      },
    }
    const textarea = {
      value: '',
      select() {},
    }
    const context = {
      Array,
      navigator: {
        clipboard: {
          writeText() {
            return {
              then() {
                return {
                  catch(handler) {
                    handler()
                  },
                }
              },
            }
          },
        },
      },
      document: {
        querySelectorAll() {
          return [button]
        },
        getElementById() {
          return target
        },
        createElement() {
          return textarea
        },
        execCommand(command) {
          execCommand = command
          return true
        },
        body: {
          appendChild() {},
          removeChild() {},
        },
      },
      setTimeout() {},
    }
    vm.runInNewContext(script, context)
    assert.equal(typeof clickHandler, 'function', `${page} wires copy button click handler`)
    clickHandler()
    assert.equal(execCommand, 'copy', `${page} falls back to execCommand after clipboard rejection`)
    assert.equal(button.textContent, 'COPIED', `${page} still shows copied feedback`)
  }
})
