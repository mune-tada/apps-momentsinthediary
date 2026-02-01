const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT_DIR = __dirname
const HOST = process.env.HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 4174)

function normalizeUrlPath(urlPath) {
  if (!urlPath) return '/'
  const withoutQuery = urlPath.split('?')[0]
  return withoutQuery || '/'
}

function ensureLeadingSlash(p) {
  if (!p) return '/'
  if (p.startsWith('/')) return p
  return `/${p}`
}

function ensureTrailingSlash(p) {
  if (!p.endsWith('/')) return `${p}/`
  return p
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.ico') return 'image/x-icon'
  return 'application/octet-stream'
}

function safeJoin(root, filePath) {
  const resolved = path.resolve(root, filePath)
  if (!resolved.startsWith(root)) return null
  return resolved
}

function readAppsConfig() {
  const appsPath = path.join(ROOT_DIR, 'apps.json')
  const raw = fs.readFileSync(appsPath, 'utf8')
  const data = JSON.parse(raw)
  const apps = Array.isArray(data?.apps) ? data.apps : []
  return apps
    .map((app) => {
      const appPath = ensureTrailingSlash(ensureLeadingSlash(String(app.path || '')))
      const destination = String(app.destination || '')
      return { ...app, path: appPath, destination }
    })
    .filter((app) => app.path !== '/' && app.destination.startsWith('http'))
}

function serveStatic(reqPath, res) {
  const file = reqPath === '/' ? '/index.html' : reqPath
  const resolved = safeJoin(ROOT_DIR, `.${file}`)
  if (!resolved) return false
  if (!fs.existsSync(resolved)) return false
  const stat = fs.statSync(resolved)
  if (!stat.isFile()) return false

  res.writeHead(200, {
    'content-type': contentTypeFor(resolved),
    'cache-control': 'no-store',
  })
  fs.createReadStream(resolved).pipe(res)
  return true
}

async function proxyTo(req, res, targetUrl) {
  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection
  delete headers['accept-encoding']

  const init = {
    method: req.method,
    headers,
    redirect: 'manual',
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req
  }

  const upstream = await fetch(targetUrl, init)

  const responseHeaders = {}
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-encoding') return
    if (key.toLowerCase() === 'content-length') return
    responseHeaders[key] = value
  })

  res.writeHead(upstream.status, responseHeaders)

  if (upstream.body) {
    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
  }
  res.end()
}

const server = http.createServer(async (req, res) => {
  try {
    const reqPath = normalizeUrlPath(req.url)

    // Static for the router UI itself
    if (serveStatic(reqPath, res)) return

    // Normalize /app -> /app/
    const apps = readAppsConfig()
    for (const app of apps) {
      const noSlash = app.path.endsWith('/') ? app.path.slice(0, -1) : app.path
      if (reqPath === noSlash) {
        res.writeHead(307, { location: app.path })
        res.end()
        return
      }
    }

    // Reverse proxy for subpath apps (similar to Vercel rewrites)
    for (const app of apps) {
      if (!reqPath.startsWith(app.path)) continue
      const suffix = reqPath.slice(app.path.length)
      const targetUrl = new URL(suffix, app.destination).toString()
      await proxyTo(req, res, targetUrl)
      return
    }

    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
    console.error(err)
  }
})

server.on('error', (err) => {
  console.error('[router] failed to start server:', err?.message || err)
  console.error('[router] try: PORT=5174 node dev-server.js')
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`[router] http://${HOST}:${PORT}`)
})
