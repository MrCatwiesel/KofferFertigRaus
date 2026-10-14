/**
 * Kalender-Abo: Die App lädt Termine und Fristen aller Reisen als iCalendar-Datei hoch,
 * Kalender-Apps (iPad, iPhone, Android, Outlook) abonnieren sie über eine geheime Adresse und
 * aktualisieren sich selbst – inklusive Erinnerungen (echte Benachrichtigungen auf dem Gerät).
 *
 *  GET    /api/kalender               Stand (Link vorhanden? zuletzt hochgeladen?)       – mit Zugang
 *  POST   /api/kalender/link          geheime Adresse anlegen bzw. erneuern (alte gilt nicht mehr)
 *  DELETE /api/kalender/link          Abo beenden (Adresse und Datei löschen)
 *  PUT    /api/kalender               Kalenderdatei hochladen (text/calendar, höchstens 2 MB)
 *  GET    /api/kalender/<token>.ics   die Datei – öffentlich, nur mit der geheimen Adresse
 *
 * Gespeichert in <data>/kalender/: tokens.json (Adresse → Gruppe) und <gruppe>.ics
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpError, readBody, send } from './http.mjs'

const MAX = 2 * 1024 * 1024
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/

export function createKalender(dataDir, groups = null) {
  const dir = join(dataDir, 'kalender')
  mkdirSync(dir, { recursive: true })
  const tokensFile = join(dir, 'tokens.json')
  /** @type {Record<string, string>} token → space */
  let tokens = existsSync(tokensFile) ? JSON.parse(readFileSync(tokensFile, 'utf8')) : {}
  const save = () => {
    writeFileSync(`${tokensFile}.neu`, JSON.stringify(tokens))
    renameSync(`${tokensFile}.neu`, tokensFile)
  }
  // Dateiname aus der Gruppenkennung (sicher für das Dateisystem)
  const fileOf = (space) => join(dir, `${createHash('sha256').update(space).digest('hex').slice(0, 32)}.ics`)
  const tokenOf = (space) => Object.keys(tokens).find((t) => tokens[t] === space) ?? null

  function status(space) {
    const f = fileOf(space)
    return { token: tokenOf(space), updated: existsSync(f) ? statSync(f).mtime.toISOString() : null }
  }

  return {
    /** Öffentlicher Abruf über die geheime Adresse */
    handlePublic(req, res, path) {
      const m = path.match(/^\/api\/kalender\/([^/]+)\.ics$/)
      if (!m || !TOKEN_RE.test(m[1]) || !Object.hasOwn(tokens, m[1])) throw new HttpError(404, 'Kalender nicht gefunden.')
      // Gesperrte oder gelöschte Reisegruppe: Abo liefert nichts mehr
      // Abo einer Person: „<gruppe>:<person>“
      const grp = groups?.get(tokens[m[1]].split(':')[0])
      if (groups && (!grp || grp.disabled)) throw new HttpError(404, 'Kalender nicht gefunden.')
      const f = fileOf(tokens[m[1]])
      const body = existsSync(f)
        ? readFileSync(f)
        : Buffer.from('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KofferFertigRaus//Reiseplaner//DE\r\nX-WR-CALNAME:KofferFertigRaus\r\nEND:VCALENDAR\r\n')
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="koffer-fertig-raus.ics"',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      })
      return res.end(req.method === 'HEAD' ? undefined : body)
    },

    /** Reisegruppe gelöscht: Abo-Adresse und Kalenderdatei entfernen */
    removeSpace(space) {
      let changed = false
      // auch die Abos der einzelnen Personen („<space>:<person>“)
      for (const t of Object.keys(tokens)) if (tokens[t] === space || tokens[t].startsWith(`${space}:`)) {
        rmSync(fileOf(tokens[t]), { force: true })
        delete tokens[t]
        changed = true
      }
      if (changed) save()
      rmSync(fileOf(space), { force: true })
    },

    async handle(req, res, path, space) {
      if (path === '/api/kalender' && req.method === 'GET') return send(res, 200, status(space))
      if (path === '/api/kalender' && req.method === 'PUT') {
        const body = await readBody(req, MAX)
        const text = body.toString('utf8')
        if (!text.startsWith('BEGIN:VCALENDAR') || !text.trimEnd().endsWith('END:VCALENDAR')) throw new HttpError(400, 'Keine Kalenderdatei.')
        writeFileSync(`${fileOf(space)}.neu`, text)
        renameSync(`${fileOf(space)}.neu`, fileOf(space))
        return send(res, 200, status(space))
      }
      if (path === '/api/kalender/link' && req.method === 'POST') {
        const old = tokenOf(space)
        if (old) delete tokens[old]
        tokens[randomBytes(24).toString('base64url')] = space
        save()
        return send(res, 200, status(space))
      }
      if (path === '/api/kalender/link' && req.method === 'DELETE') {
        const old = tokenOf(space)
        if (old) delete tokens[old]
        save()
        rmSync(fileOf(space), { force: true })
        return send(res, 200, status(space))
      }
      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
