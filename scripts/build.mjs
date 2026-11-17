#!/usr/bin/env node
/*
 * Build: minify tinyproctor.js, enforce the size budget, sync the GitHub Pages copy in docs/.
 *   node scripts/build.mjs           minify + size check + sync docs/
 *   node scripts/build.mjs --check   size check + docs/ drift check, writes nothing (CI)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')
const BUDGET_GZIP = 7 * 1024 // guardrail: the core file stays at or under 7 KB gzipped

const SITE = [
  'index.html', 'index-v1.html', 'docs.html', 'compare.html',
  'proctorio-alternative.html', 'honorlock-alternative.html',
  'respondus-lockdown-browser-alternative.html', 'safe-exam-browser-alternative.html',
  'llms.txt', 'robots.txt', 'sitemap.xml', 'site-menu.js',
  'tinyproctor.js', 'tinyproctor.min.js', 'tinyproctor.mjs', 'tinyproctor.d.ts',
  'demo/exam.html'
]
const ASSET_DIR = 'assets' // logo, favicon, self-hosted fonts

async function minify(source) {
  try {
    const { minify: terser } = await import('terser')
    const out = await terser(source, { compress: true, mangle: true, format: { comments: /^!/ } })
    return { code: out.code, tool: 'terser' }
  } catch (e) {
    /* fall through */
  }
  try {
    const esbuild = await import('esbuild')
    const out = await esbuild.transform(source, { minify: true, legalComments: 'inline', target: 'es2015' })
    return { code: out.code, tool: 'esbuild' }
  } catch (e) {
    return null
  }
}

const src = readFileSync(join(ROOT, 'tinyproctor.js'), 'utf8')
let min = await minify(src)
if (!min) {
  console.warn('! no minifier found (npm install terser): measuring the existing tinyproctor.min.js')
  min = { code: readFileSync(join(ROOT, 'tinyproctor.min.js'), 'utf8'), tool: 'existing file' }
} else if (!CHECK) {
  writeFileSync(join(ROOT, 'tinyproctor.min.js'), min.code.endsWith('\n') ? min.code : min.code + '\n')
}

const gz = gzipSync(Buffer.from(min.code), { level: 9 }).length
console.log(`tinyproctor.min.js  ${min.code.length} B raw, ${gz} B gzipped (${min.tool}); budget ${BUDGET_GZIP} B`)
let failed = gz > BUDGET_GZIP
if (failed) console.error(`x over the size budget by ${gz - BUDGET_GZIP} B`)

function walk(rel) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(rel + '/' + d.name) : [rel + '/' + d.name]))
}
const assets = walk(ASSET_DIR)
const drift = []
for (const rel of SITE.concat(assets)) {
  const from = join(ROOT, rel)
  if (!existsSync(from)) continue
  const to = join(ROOT, 'docs', rel)
  if (CHECK) {
    if (rel === 'tinyproctor.min.js') continue // minifier output can differ between machines
    if (!existsSync(to) || !readFileSync(from).equals(readFileSync(to))) drift.push(rel)
  } else {
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }
}
if (CHECK && drift.length) {
  failed = true
  console.error('x docs/ is out of date, run `npm run build`:\n  - ' + drift.join('\n  - '))
} else if (!CHECK) {
  console.log(`synced ${SITE.length + assets.length} files into docs/`)
}

process.exit(failed ? 1 : 0)
