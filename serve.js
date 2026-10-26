// 预览路由：把会话工作区里的文件按原路径发给浏览器，HTML 响应里补一段批注桥。
// 这一层只做三件事：定位会话目录、挡住越界路径、认对 Content-Type。
import { readFileSync, statSync } from 'node:fs'
import { bridgeMain } from './bridge.js'

/** Host 半边注册的路由前缀；客户端按同一个前缀拼 iframe 地址（client.js 的 ROUTE_PREFIX）。 */
export const ROUTE_PREFIX = '/html-annotate'
/** 桥脚本单独走固定地址，页面之间来回跳也只加载一次。 */
export const BRIDGE_PATH = `${ROUTE_PREFIX}/bridge.js`

const MIME_BY_EXT = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  wasm: 'application/wasm',
  pdf: 'application/pdf',
}

/**
 * 桥脚本正文：把 bridge.js 的源码原样取来、去掉 export 再调用一次。
 * 直接读文件而不是用 bridgeMain.toString()，这样改 bridge.js 只要刷新页面就生效，不用重启 DSH。
 */
let bridgeCache = { at: 0, source: '' }
export function bridgeSource() {
  try {
    const file = new URL('./bridge.js', import.meta.url)
    const info = statSync(file)
    if (info.mtimeMs !== bridgeCache.at) {
      const text = readFileSync(file, 'utf8').replace(/^export function bridgeMain/m, 'function bridgeMain')
      bridgeCache = { at: info.mtimeMs, source: `${text}\n;(bridgeMain)();` }
    }
    if (bridgeCache.source) return bridgeCache.source
  } catch (error) {
    /* 读不到就退回序列化，至少还能跑 */
  }
  return `(${bridgeMain.toString()})();`
}

/** 扩展名 → Content-Type；认不出来按二进制发。 */
export function mimeForPath(path) {
  const text = String(path || '')
  const dot = text.lastIndexOf('.')
  if (dot === -1) return 'application/octet-stream'
  return MIME_BY_EXT[text.slice(dot + 1).toLowerCase()] || 'application/octet-stream'
}

/**
 * URL 里的路径段 → 会话内相对路径。
 * 只要安全的单段名字：空段、`.`、`..`、带斜杠或反斜杠的一律拒绝，
 * 否则 `readBytes` 虽然允许读工作区外的文件，这里就是越狱入口。
 */
export function safeRelativePath(segments) {
  const out = []
  for (const raw of Array.isArray(segments) ? segments : []) {
    let segment
    try {
      segment = decodeURIComponent(raw)
    } catch {
      return undefined
    }
    if (!segment || segment === '.' || segment === '..') return undefined
    if (segment.includes('/') || segment.includes('\\') || segment.includes('\u0000')) return undefined
    out.push(segment)
  }
  return out.length ? out.join('/') : undefined
}

/** 把 HTML 字节解成文本：UTF-8 优先，中文老页面退回 GB18030。 */
export function decodeHtml(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) return new TextDecoder('utf-16le').decode(data.subarray(2))
  if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) return new TextDecoder('utf-16be').decode(data.subarray(2))
  const body = data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? data.subarray(3) : data
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(body)
    } catch {
      return new TextDecoder('utf-8').decode(body)
    }
  }
}

/** 页面自带的 charset 会和我们发出去的不一致，统一换成 UTF-8，再把桥挂到 </body> 前。 */
export function prepareHtml(html) {
  let out = String(html || '').replace(/<meta[^>]+charset[^>]*>/gi, '')
  const meta = '<meta charset="utf-8">'
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (tag) => tag + meta)
  else out = meta + out
  const bridge = `<script src="${BRIDGE_PATH}"></script>`
  if (/<\/body\s*>/i.test(out)) return out.replace(/<\/body\s*>/i, `${bridge}</body>`)
  return out + bridge
}

function send(res, status, type, body, method, headers) {
  try {
    res.statusCode = status
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    for (const [name, value] of Object.entries(headers || {})) res.setHeader(name, value)
    if (method === 'HEAD' || body === undefined || body === null) res.end()
    else res.end(body)
  } catch {
    // 浏览器已经断开，写不出去就算了
  }
}

/** 路由处理器：`/html-annotate/s/<sessionId>/<文件相对路径>`。 */
export function createPreviewHandler(deps) {
  const sessions = deps && deps.sessions
  const workspaceFiles = deps && deps.workspaceFiles
  const connection = deps && deps.connection

  return async function previewHandler(req, res) {
    const method = String((req && req.method) || 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
      send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed', method)
      return
    }
    // 和 DSH 自己的 Web 路由用同一套信任检查，别单开一个没门槛的入口
    if (connection && typeof connection.requestRejection === 'function') {
      let rejection
      try {
        rejection = await connection.requestRejection(req)
      } catch {
        rejection = 403
      }
      if (rejection === 401 || rejection === 403) {
        send(res, rejection, 'text/plain; charset=utf-8', rejection === 401 ? 'Unauthorized' : 'Forbidden', method)
        return
      }
    }

    let pathname
    try {
      pathname = new URL(String((req && req.url) || '/'), 'http://html-annotate.invalid').pathname
    } catch {
      send(res, 400, 'text/plain; charset=utf-8', 'Bad Request', method)
      return
    }
    if (pathname === BRIDGE_PATH) {
      send(res, 200, 'text/javascript; charset=utf-8', bridgeSource(), method)
      return
    }

    const segments = pathname.split('/').filter((part) => part !== '')
    if (segments[0] !== 'html-annotate') {
      send(res, 404, 'text/plain; charset=utf-8', 'Not Found', method)
      return
    }
    if (segments.length === 1) {
      send(res, 200, 'text/plain; charset=utf-8', 'html-annotate preview route\n', method)
      return
    }
    if (segments[1] !== 's' || segments.length < 4) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not Found', method)
      return
    }

    let sessionId
    try {
      sessionId = decodeURIComponent(segments[2])
    } catch {
      send(res, 400, 'text/plain; charset=utf-8', 'Bad Request', method)
      return
    }
    const relative = safeRelativePath(segments.slice(3))
    if (!relative) {
      send(res, 404, 'text/plain; charset=utf-8', 'Not Found', method)
      return
    }

    const session = sessions && typeof sessions.get === 'function' ? sessions.get(sessionId) : null
    const cwd = session && session.header ? session.header.cwd : ''
    if (!cwd) {
      send(res, 404, 'text/plain; charset=utf-8', 'Session not found', method)
      return
    }
    if (!workspaceFiles || typeof workspaceFiles.readBytes !== 'function') {
      send(res, 503, 'text/plain; charset=utf-8', 'File service unavailable', method)
      return
    }

    let read
    try {
      read = await workspaceFiles.readBytes({ sessionId, workspaceRoot: cwd }, relative, {}, new AbortController().signal)
    } catch {
      send(res, 404, 'text/plain; charset=utf-8', `Cannot read ${relative}`, method)
      return
    }
    const data = read && read.data
    if (!(data instanceof Uint8Array) || data.length === 0) {
      send(res, 404, 'text/plain; charset=utf-8', `Cannot read ${relative}`, method)
      return
    }

    if (/\.html?$/i.test(relative)) {
      send(res, 200, 'text/html; charset=utf-8', prepareHtml(decodeHtml(data)), method)
      return
    }
    send(res, 200, mimeForPath(relative), data, method)
  }
}
