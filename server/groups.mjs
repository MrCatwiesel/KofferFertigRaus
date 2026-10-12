/**
 * Reisegruppen: jede Gruppe hat einen geheimen Schlüssel und einen eigenen, getrennten Datenbereich.
 *
 *  - Schlüssel aus NWW_KEYS sind fest eingetragen; der ERSTE davon gehört dem Besitzer des Servers
 *    (Verwaltung der Gruppen, Piwigo immer erlaubt).
 *  - Weitere Gruppen legt der Besitzer in der App an („Reisegruppen“). Gespeichert wird nur eine Prüfsumme des Schlüssels.
 *  - Piwigo ist für andere Gruppen nur freigegeben, wenn der Besitzer es einschaltet.
 */
import { randomBytes } from 'node:crypto'
import { HttpError } from './http.mjs'
import { sha256, spaceOf } from './store.mjs'

const SEEN_EVERY_MS = 5 * 60_000

export function createGroups(store, envKeys) {
  const keys = (envKeys ?? []).map((k) => k.trim()).filter(Boolean)
  if (!keys.length) throw new Error('Kein Schlüssel konfiguriert (NWW_KEYS).')
  if (keys.some((k) => k.length < 16)) throw new Error('Schlüssel müssen mindestens 16 Zeichen lang sein.')

  const { db } = store
  const ownerSpace = spaceOf(keys[0])
  const envHashes = new Set(keys.map((k) => sha256(k)))
  const now = () => new Date().toISOString()

  const q = {
    insertEnv: db.prepare(`INSERT INTO groups (space, key_hash, name, source, piwigo, created) VALUES (?, ?, ?, 'env', ?, ?)
      ON CONFLICT (space) DO UPDATE SET key_hash = excluded.key_hash`),
    byHash: db.prepare('SELECT * FROM groups WHERE key_hash = ?'),
    bySpace: db.prepare('SELECT * FROM groups WHERE space = ?'),
    all: db.prepare('SELECT * FROM groups ORDER BY created'),
    insert: db.prepare(`INSERT INTO groups (space, key_hash, name, source, piwigo, created) VALUES (?, ?, ?, 'app', ?, ?)`),
    seen: db.prepare('UPDATE groups SET last_seen = ? WHERE space = ?'),
    remove: db.prepare('DELETE FROM groups WHERE space = ?')
  }

  // Feste Schlüssel eintragen (Name nur beim ersten Mal)
  keys.forEach((k, i) => q.insertEnv.run(spaceOf(k), sha256(k), i === 0 ? 'Meine Reisen' : `Gruppe ${i + 1}`, i === 0 ? 1 : 0, now()))

  const lastSeen = new Map()

  function toGroup(row) {
    return {
      space: row.space,
      name: row.name,
      source: row.source,
      owner: row.space === ownerSpace,
      piwigo: row.space === ownerSpace || !!row.piwigo,
      disabled: !!row.disabled,
      created: row.created,
      lastSeen: row.last_seen
    }
  }

  return {
    ownerSpace,

    /** Gruppe zum Schlüssel aus "Authorization: Bearer …" – oder null. */
    authenticate(req) {
      const m = (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)
      if (!m) return null
      const hash = sha256(m[1].trim())
      const row = q.byHash.get(hash)
      if (!row || row.disabled) return null
      // Feste Schlüssel gelten nur, solange sie in NWW_KEYS stehen
      if (row.source === 'env' && !envHashes.has(hash)) return null
      const t = Date.now()
      if ((lastSeen.get(row.space) ?? 0) + SEEN_EVERY_MS < t) {
        lastSeen.set(row.space, t)
        q.seen.run(new Date(t).toISOString(), row.space)
      }
      return toGroup(row)
    },

    list() {
      return q.all
        .all()
        .filter((r) => r.source !== 'env' || envHashes.has(r.key_hash))
        .map((r) => ({ ...toGroup(r), ...store.info(r.space) }))
    },

    /** Neue Gruppe: liefert den Schlüssel genau einmal zurück. */
    create(name, piwigo = false) {
      const clean = String(name ?? '').trim().slice(0, 80)
      if (!clean) throw new HttpError(400, 'Name fehlt.')
      const key = randomBytes(16).toString('hex')
      const space = spaceOf(key)
      q.insert.run(space, sha256(key), clean, piwigo ? 1 : 0, now())
      return { key, group: toGroup(q.bySpace.get(space)) }
    },

    update(space, patch) {
      const row = q.bySpace.get(space)
      if (!row) throw new HttpError(404, 'Gruppe nicht gefunden.')
      if (space === ownerSpace && (patch.disabled || patch.piwigo === false)) throw new HttpError(400, 'Die eigene Gruppe kann nicht gesperrt werden.')
      const changes = {}
      if (typeof patch.name === 'string' && patch.name.trim()) changes.name = patch.name.trim().slice(0, 80)
      if (typeof patch.piwigo === 'boolean') changes.piwigo = patch.piwigo ? 1 : 0
      if (typeof patch.disabled === 'boolean') changes.disabled = patch.disabled ? 1 : 0
      const cols = Object.keys(changes) // nur feste Spaltennamen von oben
      if (cols.length) db.prepare(`UPDATE groups SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE space = ?`).run(...Object.values(changes), space)
      return toGroup(q.bySpace.get(space))
    },

    /** Gruppe samt aller Daten löschen (nur in der App angelegte). */
    remove(space) {
      const row = q.bySpace.get(space)
      if (!row) throw new HttpError(404, 'Gruppe nicht gefunden.')
      if (row.source === 'env') throw new HttpError(400, 'Fest eingetragene Schlüssel (NWW_KEYS) werden in den Server-Einstellungen entfernt.')
      store.deleteSpace(space)
      q.remove.run(space)
    }
  }
}
