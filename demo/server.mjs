import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const PORT = Number(process.env.PORT || 8787)
const events = []

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 2_000_000) req.destroy()
    })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(''))
  })
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

function contentTypeFor(filePath) {
  var ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.md') return 'text/markdown; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

function serveFile(res, filePath, cors) {
  try {
    var buf = fs.readFileSync(filePath)
    var headers = { 'Content-Type': contentTypeFor(filePath) }
    send(res, 200, cors ? withCors(headers) : headers, buf)
  } catch (e) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
  }
}

function withCors(headers) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    send(res, 204, withCors({}), '')
    return
  }

  if (req.method === 'GET' && url.pathname === '/') {
    serveFile(res, path.join(rootDir, 'index.html'), false)
    return
  }

  if (req.method === 'GET' && (url.pathname === '/compare' || url.pathname === '/compare.html')) {
    serveFile(res, path.join(rootDir, 'compare.html'), false)
    return
  }

  if (req.method === 'GET' && (url.pathname === '/readme' || url.pathname === '/README.md')) {
    serveFile(res, path.join(rootDir, 'README.md'), false)
    return
  }

  if (req.method === 'GET' && url.pathname === '/exam') {
    serveFile(res, path.join(__dirname, 'exam.html'), false)
    return
  }

  if (req.method === 'GET' && url.pathname === '/tinyproctor.js') {
    serveFile(res, path.join(rootDir, 'tinyproctor.js'), false)
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
    serveFile(res, path.join(rootDir, url.pathname), false)
    return
  }

  if (req.method === 'GET' && url.pathname.startsWith('/demo/')) {
    serveFile(res, path.join(rootDir, url.pathname), false)
    return
  }

  if (req.method === 'POST' && url.pathname === '/collect') {
    const raw = await readBody(req)
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { raw }
    }
    events.push({ receivedAt: new Date().toISOString(), ip: req.socket.remoteAddress || '', data: parsed })
    while (events.length > 500) events.shift()
    send(res, 200, withCors({ 'Content-Type': 'application/json; charset=utf-8' }), JSON.stringify({ ok: true }))
    return
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    send(res, 200, withCors({ 'Content-Type': 'application/json; charset=utf-8' }), JSON.stringify({ ok: true, count: events.length, events }))
    return
  }

  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
})

server.listen(PORT, () => {
  process.stdout.write(`demo server: http://localhost:${PORT}/\n`)
  process.stdout.write(`compare:      http://localhost:${PORT}/compare\n`)
  process.stdout.write(`readme:       http://localhost:${PORT}/readme\n`)
  process.stdout.write(`exam:         http://localhost:${PORT}/exam\n`)
  process.stdout.write(`collector:    http://localhost:${PORT}/collect\n`)
  process.stdout.write(`events:       http://localhost:${PORT}/events\n`)
})

