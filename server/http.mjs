/** Kleine HTTP-Helfer für den Abgleich-Server (ohne Fremdpakete). */

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

/** JSON-Antwort, nie zwischengespeichert. */
export function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

/** Rohdaten lesen, mit Obergrenze. */
export function readBody(req, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new HttpError(413, 'Zu groß'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** JSON-Körper lesen (leer = {}). */
export async function readJson(req, limit = 64 * 1024) {
  const text = (await readBody(req, limit)).toString('utf8')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Ungültiges JSON')
  }
}

/** CORS-Kopfzeilen für erlaubte App-Adressen. */
export function corsFor(origins) {
  const list = origins?.length ? origins : ['*']
  return (req, res) => {
    const origin = req.headers.origin
    const allow = list.includes('*') ? '*' : origin && list.includes(origin) ? origin : ''
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Share-Password, X-NWW-Pending')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
}

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
}

/**
 * Nur bekannte, harmlose Dateiarten für hochgeladene Dateien (Fotos, Sprachnotizen, Belege, Routen-Originale).
 * Alles andere wird als „application/octet-stream“ gespeichert – so kann niemand eine Webseite mit Skript
 * als „Foto“ hochladen, die dann unter der Adresse des Servers läuft.
 */
const SAFE_BLOB_TYPES = /^(image\/(jpeg|png|webp|gif|avif|heic|heif)|audio\/(mp4|mpeg|webm|ogg|aac|x-m4a|wav)|video\/(mp4|quicktime|webm)|application\/(pdf|gpx\+xml|vnd\.google-earth\.kml\+xml|vnd\.google-earth\.kmz|geo\+json|json|octet-stream)|text\/(plain|calendar|csv))$/
export function safeBlobType(t) {
  const type = String(t ?? '').split(';')[0].trim().toLowerCase()
  return SAFE_BLOB_TYPES.test(type) ? type : 'application/octet-stream'
}

/** Kopfzeilen für ausgelieferte Dateien: nie als Seite ausführen, Nicht-Bilder nur zum Herunterladen */
export function blobHeaders(type, size) {
  const h = {
    'Content-Type': safeBlobType(type),
    'Content-Length': String(size),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"
  }
  if (!/^(image|audio|video)\//.test(h['Content-Type'])) h['Content-Disposition'] = 'attachment'
  return h
}
