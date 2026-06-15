import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const landingPages = ['index.html', 'docs/index.html']

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

test('landing page mobile header uses a compact scrollable nav row', () => {
  for (const page of landingPages) {
    const css = cssFor(page)
    assert.match(css, /@media\s*\(max-width:\s*639px\)/, `${page} has mobile-specific layout rules`)
    assert.ok(
      hasDeclaration(css, 'nav', /flex-wrap\s*:\s*nowrap\s*;.*overflow-x\s*:\s*auto\s*;/) ||
        hasDeclaration(css, 'header nav', /flex-wrap\s*:\s*nowrap\s*;.*overflow-x\s*:\s*auto\s*;/),
      `${page} keeps mobile nav on a horizontally scrollable row`
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
