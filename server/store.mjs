/**
 * Datenhaltung des Abgleich-Servers: SQLite (eingebaut in Node.js) und Fotos als Dateien.
 * Jede Reisegruppe hat ihren eigenen Bereich (`space`), der aus ihrem Schlüssel abgeleitet ist.
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { HttpError } from './http.mjs'

const TABLE_RE = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/
export const HASH_RE = /^[a-f0-9]{64}$/

export const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Raum (Datenbereich) einer Reisegruppe: aus dem Schlüssel abgeleitet, der Schlüssel selbst wird nie gespeichert. */
export const spaceOf = (key) => sha256(`nix-wie-weg:${key}`).slice(0, 24)

export function createStore(dataDir) {
  mkdirSync(join(dataDir, 'blobs'), { recursive: true })
  const db = new DatabaseSync(join(dataDir, 'nix-wie-weg.sqlite'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      space TEXT NOT NULL, tbl TEXT NOT NULL, id TEXT NOT NULL,
      stamp TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT,
      seq INTEGER NOT NULL,
      PRIMARY KEY (space, tbl, id)
    );
    CREATE INDEX IF NOT EXISTS records_seq ON records (space, seq);
    CREATE TABLE IF NOT EXISTS counters (space TEXT PRIMARY KEY, seq INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blobs (
      space TEXT NOT NULL, hash TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL,
      PRIMARY KEY (space, hash)
    );
    CREATE TABLE IF NOT EXISTS groups (
      space TEXT PRIMARY KEY, key_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      source TEXT NOT NULL, piwigo INTEGER NOT NULL DEFAULT 0, disabled INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL, last_seen TEXT
    );
    CREATE TABLE IF NOT EXISTS shares (
      token TEXT PRIMARY KEY, space TEXT NOT NULL, trip_id TEXT NOT NULL,
      options TEXT NOT NULL, pw_hash TEXT, expires TEXT, revoked INTEGER NOT NULL DEFAULT 0,
      created TEXT NOT NULL, last_access TEXT, access_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS shares_trip ON shares (space, trip_id);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)

  const q = {
    get: db.prepare('SELECT stamp FROM records WHERE space = ? AND tbl = ? AND id = ?'),
    record: db.prepare('SELECT data FROM records WHERE space = ? AND tbl = ? AND id = ? AND deleted = 0'),
    byTrip: db.prepare("SELECT data FROM records WHERE space = ? AND tbl = ? AND deleted = 0 AND json_extract(data, '$.tripId') = ?"),
    upsert: db.prepare(`INSERT INTO records (space, tbl, id, stamp, deleted, data, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (space, tbl, id) DO UPDATE SET stamp = excluded.stamp, deleted = excluded.deleted, data = excluded.data, seq = excluded.seq`),
    nextSeq: db.prepare(`INSERT INTO counters (space, seq) VALUES (?, 1)
      ON CONFLICT (space) DO UPDATE SET seq = seq + 1 RETURNING seq`),
    pull: db.prepare('SELECT seq, tbl, id, stamp, deleted, data FROM records WHERE space = ? AND seq > ? ORDER BY seq LIMIT ?'),
    maxSeq: db.prepare('SELECT seq FROM counters WHERE space = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM records WHERE space = ? AND deleted = 0'),
    blobGet: db.prepare('SELECT type, size FROM blobs WHERE space = ? AND hash = ?'),
    blobPut: db.prepare('INSERT OR IGNORE INTO blobs (space, hash, type, size) VALUES (?, ?, ?, ?)'),
    blobSize: db.prepare('SELECT COALESCE(SUM(size), 0) AS bytes FROM blobs WHERE space = ?'),
    setting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  }

  const blobPath = (space, hash) => join(dataDir, 'blobs', space, hash)
  const parse = (row) => (row?.data ? JSON.parse(row.data) : null)

  return {
    db,

    /** Übernimmt Änderungen der Geräte – neuere gewinnt. */
    push(space, changes) {
      let accepted = 0
      let ignored = 0
      db.exec('BEGIN')
      try {
        // Zeitstempel weit in der Zukunft (falsch gehende Uhr) würden jede spätere Änderung blockieren → auf jetzt kürzen
        const limit = new Date(Date.now() + 5 * 60_000).toISOString()
        const nowIso = new Date().toISOString()
        for (const c of changes) {
          if (c && typeof c.stamp === 'string' && c.stamp > limit && c.stamp.length <= 40) c.stamp = nowIso
          if (!c || !TABLE_RE.test(c.tbl) || typeof c.id !== 'string' || !c.id || c.id.length > 200) throw new HttpError(400, 'Ungültige Änderung')
          if (typeof c.stamp !== 'string' || !c.stamp || c.stamp.length > 40) throw new HttpError(400, 'Ungültiger Zeitstempel')
          const existing = q.get.get(space, c.tbl, c.id)
          if (existing && existing.stamp >= c.stamp) {
            ignored++
            continue
          }
          const seq = q.nextSeq.get(space).seq
          q.upsert.run(space, c.tbl, c.id, c.stamp, c.deleted ? 1 : 0, c.deleted ? null : JSON.stringify(c.data ?? null), seq)
          accepted++
        }
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return { accepted, ignored, seq: q.maxSeq.get(space)?.seq ?? 0 }
    },

    pull(space, since, limit) {
      const rows = q.pull.all(space, since, limit + 1)
      const more = rows.length > limit
      const changes = rows.slice(0, limit).map((r) => ({
        seq: r.seq,
        tbl: r.tbl,
        id: r.id,
        stamp: r.stamp,
        deleted: !!r.deleted,
        data: r.data ? JSON.parse(r.data) : null
      }))
      return { changes, more, seq: changes.at(-1)?.seq ?? since }
    },

    info(space) {
      return { records: q.count.get(space).n, seq: q.maxSeq.get(space)?.seq ?? 0, bytes: q.blobSize.get(space).bytes }
    },

    /** Ein Datensatz (nicht gelöscht) – oder null. */
    record(space, tbl, id) {
      return parse(q.record.get(space, tbl, id))
    },

    /** Alle Datensätze einer Tabelle zu einer Reise. */
    byTrip(space, tbl, tripId) {
      return q.byTrip.all(space, tbl, tripId).map(parse).filter(Boolean)
    },

    blobMeta(space, hash) {
      const meta = q.blobGet.get(space, hash)
      return meta && existsSync(blobPath(space, hash)) ? { ...meta, path: blobPath(space, hash) } : null
    },

    putBlob(space, hash, type, body) {
      mkdirSync(join(dataDir, 'blobs', space), { recursive: true })
      const tmp = `${blobPath(space, hash)}.tmp-${process.pid}-${Date.now()}`
      writeFileSync(tmp, body)
      renameSync(tmp, blobPath(space, hash))
      q.blobPut.run(space, hash, type, statSync(blobPath(space, hash)).size)
    },

    /** Alle Daten einer Reisegruppe entfernen (Datensätze, Fotos, Lese-Links). */
    deleteSpace(space) {
      db.exec('BEGIN')
      try {
        for (const t of ['records', 'counters', 'blobs', 'shares']) db.prepare(`DELETE FROM ${t} WHERE space = ?`).run(space)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      rmSync(join(dataDir, 'blobs', space), { recursive: true, force: true })
    },

    /** Zufälliges Geheimnis des Servers (einmal erzeugt, bleibt erhalten). */
    secret(name) {
      q.setSetting.run(name, randomBytes(32).toString('hex'))
      return q.setting.get(name).value
    },

    close() {
      db.close()
    }
  }
}
