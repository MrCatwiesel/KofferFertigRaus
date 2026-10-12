/** Die gebaute App (NWW_APP_DIR) ausliefern – mit passenden Cache-Regeln für PWA und Bootstrap. */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { HttpError, MIME } from './http.mjs'

export function createStatic(dir) {
  const appDir = resolve(dir)

  function stat(file) {
    try {
      return existsSync(file) ? statSync(file) : null
    } catch {
      return null
    }
  }

  function sendFile(req, res, file, st) {
    const name = file.slice(appDir.length).replace(/\\/g, '/')
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(st.size),
      // Dateien mit Prüfsumme im Namen ändern sich nie; alles andere (index.html, sw.js …) immer frisch prüfen
      'Cache-Control': name.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(file).pipe(res)
  }

  return {
    serve(req, res, pathname) {
      let rel
      try {
        rel = decodeURIComponent(pathname)
      } catch {
        throw new HttpError(400, 'Ungültige Adresse')
      }

      // Lese-Link: /s/<token> → Betrachter-Seite (liest den Code selbst aus der Adresse)
      if (/^\/s\/[A-Za-z0-9_-]+$/.test(rel)) rel = '/share.html'

      if (rel.endsWith('/')) rel += 'index.html'
      let file = normalize(join(appDir, rel))
      if (file !== appDir && !file.startsWith(appDir + sep)) throw new HttpError(403, 'Verboten')
      let st = stat(file)
      if (st?.isDirectory()) {
        file = join(file, 'index.html')
        st = stat(file)
      }
      if (!st) {
        // Unbekannte Seite → Startseite (die App nutzt #-Adressen), fehlende Dateien mit Endung → 404
        if (extname(rel)) throw new HttpError(404, 'Nicht gefunden')
        file = join(appDir, 'index.html')
        st = stat(file)
        if (!st) throw new HttpError(503, 'App ist auf dem Server noch nicht installiert (update.sh ausführen).')
      }
      return sendFile(req, res, file, st)
    }
  }
}
