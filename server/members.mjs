/**
 * Personen und Rechte in einer Reisegruppe.
 *
 *  - Personen (`members`) mit Rolle: verwalter (Personen und Rechte verwalten), mitglied (bearbeiten), leser (nur lesen).
 *    Anmelden per Einladung (legt das Passwort fest) oder mit Name + Passwort auf weiteren Geräten.
 *  - Je Reise abweichend: bearbeiten / lesen / kein (Reise wird gar nicht ausgeliefert). Verwalter haben immer Zugriff.
 *  - Private Einträge: Packliste, Medikamente, Impfungen und Dokumente einer Person, deren Teilnehmer-Name an der Reise
 *    mit ihrem Konto verknüpft ist (`trip.memberLinks[name] = memberId`). Sichtbar nur für sie selbst und für die
 *    Personen in `sharedWith` (`'*'` = alle). Nicht verknüpfte Teilnehmer und „für alle“ bleiben für die Gruppe sichtbar.
 *  - Abstimmungen: die Stimme (`pollVotes`) eines verknüpften Teilnehmers gibt nur die Person selbst ab – auch mit „nur lesen“.
 *  - Geräte ohne Person (Gruppenschlüssel, ältere Geräte) haben – wie bisher – vollen Zugriff.
 *
 * Der Server setzt die Rechte beim Abgleich durch: Unsichtbares geht als Löschung ans Gerät, unerlaubte Änderungen
 * werden abgelehnt und mit der Server-Fassung beantwortet.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http.mjs'

export const ROLES = ['verwalter', 'mitglied', 'leser']
export const TRIP_ROLES = ['bearbeiten', 'lesen', 'kein']
/** Tabellen mit persönlichen Einträgen (Feld `person`). */
export const PRIVATE_TABLES = new Set(['packingItems', 'medications', 'vaccinations', 'documents'])

const MIN_PASSWORD = 8

export function hashPassword(pw) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 32).toString('hex')}`
}

export function checkPassword(pw, stored) {
  const [kind, salt, hash] = String(stored ?? '').split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const got = scryptSync(String(pw), Buffer.from(salt, 'hex'), 32)
  const want = Buffer.from(hash, 'hex')
  return want.length === got.length && timingSafeEqual(got, want)
}

export function validPassword(pw) {
  if (typeof pw !== 'string' || pw.length < MIN_PASSWORD) throw new HttpError(400, `Das Passwort braucht mindestens ${MIN_PASSWORD} Zeichen.`, { code: 'passwort' })
  if (pw.length > 200) throw new HttpError(400, 'Das Passwort ist zu lang.', { code: 'passwort' })
  return pw
}

/** Anmeldename: Kleinbuchstaben, Leerzeichen zusammengefasst. */
export const loginOf = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

const cleanName = (name) => {
  const s = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!s) throw new HttpError(400, 'Name fehlt.')
  return s
}

/** Blob-Verweise in einem Datensatz (`{ __blobRef: <hash> }`). */
export function blobHashes(json) {
  const out = new Set()
  if (!json) return out
  for (const m of String(json).matchAll(/"__blobRef":"([a-f0-9]{64})"/g)) out.add(m[1])
  return out
}

/** Reise eines Datensatzes (Reise selbst: ihre id). */
export const tripOf = (tbl, id, data) => (tbl === 'trips' ? id : typeof data?.tripId === 'string' ? data.tripId : null)

export function createMembers(store) {
  const { db } = store
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, space TEXT NOT NULL, name TEXT NOT NULL, login TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL, pw_hash TEXT, created TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS members_space ON members (space);
    CREATE TABLE IF NOT EXISTS trip_access (
      space TEXT NOT NULL, trip_id TEXT NOT NULL, member_id TEXT NOT NULL, role TEXT NOT NULL,
      PRIMARY KEY (space, trip_id, member_id)
    );
    CREATE TABLE IF NOT EXISTS blob_refs (
      space TEXT NOT NULL, tbl TEXT NOT NULL, id TEXT NOT NULL, hash TEXT NOT NULL,
      PRIMARY KEY (space, tbl, id, hash)
    );
    CREATE INDEX IF NOT EXISTS blob_refs_hash ON blob_refs (space, hash);
  `)

  const q = {
    byId: db.prepare('SELECT * FROM members WHERE id = ? AND space = ?'),
    byLogin: db.prepare('SELECT * FROM members WHERE login = ?'),
    list: db.prepare('SELECT * FROM members WHERE space = ? ORDER BY created'),
    insert: db.prepare('INSERT INTO members (id, space, name, login, role, pw_hash, created) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE members SET name = ?, login = ?, role = ?, disabled = ? WHERE id = ? AND space = ?'),
    setPw: db.prepare('UPDATE members SET pw_hash = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM members WHERE id = ? AND space = ?'),
    activeAdmins: db.prepare("SELECT COUNT(*) AS n FROM members WHERE space = ? AND role = 'verwalter' AND disabled = 0"),
    access: db.prepare('SELECT role FROM trip_access WHERE space = ? AND trip_id = ? AND member_id = ?'),
    accessOfTrip: db.prepare('SELECT member_id, role FROM trip_access WHERE space = ? AND trip_id = ?'),
    accessOfMember: db.prepare('SELECT trip_id, role FROM trip_access WHERE space = ? AND member_id = ?'),
    setAccess: db.prepare(`INSERT INTO trip_access (space, trip_id, member_id, role) VALUES (?, ?, ?, ?)
      ON CONFLICT (space, trip_id, member_id) DO UPDATE SET role = excluded.role`),
    clearAccess: db.prepare('DELETE FROM trip_access WHERE space = ? AND trip_id = ? AND member_id = ?'),
    clearMemberAccess: db.prepare('DELETE FROM trip_access WHERE space = ? AND member_id = ?'),
    removeSpace: db.prepare('DELETE FROM members WHERE space = ?'),
    removeSpaceAccess: db.prepare('DELETE FROM trip_access WHERE space = ?'),
    refsOf: db.prepare('SELECT tbl, id FROM blob_refs WHERE space = ? AND hash = ?'),
    refsClear: db.prepare('DELETE FROM blob_refs WHERE space = ? AND tbl = ? AND id = ?'),
    refsAdd: db.prepare('INSERT OR IGNORE INTO blob_refs (space, tbl, id, hash) VALUES (?, ?, ?, ?)'),
    refsCount: db.prepare('SELECT COUNT(*) AS n FROM blob_refs'),
    tripRecords: db.prepare(`SELECT tbl, id FROM records WHERE space = ? AND deleted = 0
      AND ((tbl = 'trips' AND id = ?) OR json_extract(data, '$.tripId') = ?)`),
    privateRecords: db.prepare(`SELECT tbl, id FROM records WHERE space = ? AND deleted = 0
      AND tbl IN ('packingItems', 'medications', 'vaccinations', 'documents')
      AND (? IS NULL OR json_extract(data, '$.tripId') = ?)`)
  }

  // Blob-Verweise einmalig aus dem Bestand aufbauen (Server-Update von 1.15)
  if (!store.db.prepare("SELECT value FROM settings WHERE key = 'blob_refs_v1'").get()) {
    db.exec('BEGIN')
    try {
      for (const r of db.prepare('SELECT space, tbl, id, data FROM records WHERE deleted = 0 AND data LIKE \'%__blobRef%\'').iterate()) {
        for (const h of blobHashes(r.data)) q.refsAdd.run(r.space, r.tbl, r.id, h)
      }
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('blob_refs_v1', '1')").run()
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  const now = () => new Date().toISOString()
  const toMember = (row) => row && { id: row.id, name: row.name, role: row.role, disabled: !!row.disabled, hasPassword: !!row.pw_hash, created: row.created }

  function get(space, id) {
    return q.byId.get(id, space) ?? null
  }

  /** Effektive Rolle für eine Reise. `member` null = volles Recht (Gruppenschlüssel / Gerät ohne Person). */
  function tripRole(space, member, tripId) {
    if (!member || member.role === 'verwalter') return 'bearbeiten'
    const o = tripId ? q.access.get(space, tripId, member.id)?.role : null
    if (o) return o
    return member.role === 'leser' ? 'lesen' : 'bearbeiten'
  }

  /**
   * Rechte-Prüfer für eine Anfrage – mit Zwischenspeicher für Reisen und Rollen.
   * @param {string} space
   * @param {{ id: string, role: string } | null} member
   */
  function accessFor(space, member) {
    const full = !member
    const roles = new Map()
    const trips = new Map()
    const memberIds = new Set(q.list.all(space).map((m) => m.id))
    const role = (tripId) => {
      if (!roles.has(tripId)) roles.set(tripId, tripRole(space, member, tripId))
      return roles.get(tripId)
    }
    const trip = (tripId) => {
      if (!trips.has(tripId)) trips.set(tripId, store.record(space, 'trips', tripId))
      return trips.get(tripId)
    }
    /** Besitzer eines privaten Eintrags (Person, deren Teilnehmer-Name verknüpft ist) oder null. */
    const ownerOf = (tbl, data) => {
      if (!PRIVATE_TABLES.has(tbl) || !data?.person || typeof data.tripId !== 'string') return null
      const id = trip(data.tripId)?.memberLinks?.[data.person]
      return typeof id === 'string' && memberIds.has(id) ? id : null
    }

    function canSee(tbl, id, data) {
      if (full) return true
      if (!data) return true
      const t = tripOf(tbl, id, data)
      if (t && role(t) === 'kein') return false
      const owner = ownerOf(tbl, data)
      if (!owner || owner === member.id) return true
      const shared = Array.isArray(data.sharedWith) ? data.sharedWith : []
      return shared.includes('*') || shared.includes(member.id)
    }

    /** Warum eine Änderung nicht erlaubt ist – oder null. `oldData` = Fassung auf dem Server, `newData` null = Löschen. */
    function denyWrite(tbl, id, oldData, newData) {
      if (full) return null
      const affected = new Set([oldData && tripOf(tbl, id, oldData), newData && tripOf(tbl, id, newData), tbl === 'trips' ? id : null].filter(Boolean))
      // Stimmen bei Abstimmungen: die Stimme eines verknüpften Teilnehmers gibt nur die Person selbst ab –
      // die aber auch mit „nur lesen“ (mitreden darf jeder, der die Reise sieht)
      if (tbl === 'pollVotes') {
        const voters = [oldData, newData].filter(Boolean).map((d) => {
          const v = typeof d.tripId === 'string' ? trip(d.tripId)?.memberLinks?.[d.voter] : null
          return typeof v === 'string' && memberIds.has(v) ? v : null
        })
        if (voters.some((v) => v && v !== member.id)) return 'privat'
        if (voters.length && voters.every((v) => v === member.id)) {
          for (const t of affected) if (role(t) === 'kein') return 'nur-lesen'
          return null
        }
      }
      if (affected.size) {
        for (const t of affected) if (role(t) !== 'bearbeiten') return 'nur-lesen'
      } else if (member.role === 'leser') return 'nur-lesen'
      const oldOwner = oldData ? ownerOf(tbl, oldData) : null
      if (oldOwner && oldOwner !== member.id) return 'privat'
      // Verknüpfung Teilnehmer ↔ Person: eine fremde Verknüpfung lösen oder umhängen darf nur die Person selbst
      if (tbl === 'trips' && oldData) {
        const before = oldData.memberLinks ?? {}
        const after = newData ? (newData.memberLinks ?? {}) : before
        for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
          if (before[name] === after[name]) continue
          if (before[name] && before[name] !== member.id && memberIds.has(before[name])) return 'verknuepfung'
        }
      }
      return null
    }

    return { full, member, role, canSee, denyWrite, ownerOf }
  }

  return {
    ROLES,
    get,
    toMember,
    tripRole,
    accessFor,

    list(space) {
      return q.list.all(space).map(toMember)
    },

    byLogin(name) {
      return q.byLogin.get(loginOf(name)) ?? null
    },

    create(space, body) {
      const name = cleanName(body.name)
      const role = ROLES.includes(body.role) ? body.role : 'mitglied'
      if (q.byLogin.get(loginOf(name))) throw new HttpError(409, 'Diesen Namen gibt es auf dem Server schon – bitte z. B. den Nachnamen ergänzen.')
      const id = randomBytes(8).toString('hex')
      const pw = body.password !== undefined ? hashPassword(validPassword(body.password)) : null
      q.insert.run(id, space, name, loginOf(name), role, pw, now())
      return toMember(q.byId.get(id, space))
    },

    update(space, id, body) {
      const row = q.byId.get(id, space)
      if (!row) throw new HttpError(404, 'Person nicht gefunden.')
      const name = body.name !== undefined ? cleanName(body.name) : row.name
      const role = body.role !== undefined ? (ROLES.includes(body.role) ? body.role : row.role) : row.role
      const disabled = typeof body.disabled === 'boolean' ? (body.disabled ? 1 : 0) : row.disabled
      const other = q.byLogin.get(loginOf(name))
      if (other && other.id !== id) throw new HttpError(409, 'Diesen Namen gibt es auf dem Server schon.')
      db.exec('BEGIN')
      try {
        q.update.run(name, loginOf(name), role, disabled, id, space)
        if (row.role === 'verwalter' && !row.disabled && q.activeAdmins.get(space).n === 0) throw new HttpError(400, 'Es muss mindestens ein Verwalter bleiben.')
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      if (typeof body.password === 'string') q.setPw.run(hashPassword(validPassword(body.password)), id)
      return toMember(q.byId.get(id, space))
    },

    setPassword(id, pw) {
      q.setPw.run(hashPassword(validPassword(pw)), id)
    },

    remove(space, id) {
      const row = q.byId.get(id, space)
      if (!row) throw new HttpError(404, 'Person nicht gefunden.')
      if (row.role === 'verwalter' && !row.disabled && q.activeAdmins.get(space).n <= 1) throw new HttpError(400, 'Der letzte Verwalter kann nicht entfernt werden.')
      q.remove.run(id, space)
      q.clearMemberAccess.run(space, id)
      // Verknüpfte Einträge sind jetzt nicht mehr privat → an alle Geräte neu ausliefern
      store.bump(space, q.privateRecords.all(space, null, null))
    },

    /** Zugriff je Reise: { memberId: role } (nur Abweichungen). */
    tripAccess(space, tripId) {
      return Object.fromEntries(q.accessOfTrip.all(space, tripId).map((r) => [r.member_id, r.role]))
    },

    memberAccess(space, memberId) {
      return Object.fromEntries(q.accessOfMember.all(space, memberId).map((r) => [r.trip_id, r.role]))
    },

    setTripAccess(space, tripId, memberId, role) {
      if (!q.byId.get(memberId, space)) throw new HttpError(404, 'Person nicht gefunden.')
      if (role === null || role === undefined || role === '') q.clearAccess.run(space, tripId, memberId)
      else if (TRIP_ROLES.includes(role)) q.setAccess.run(space, tripId, memberId, role)
      else throw new HttpError(400, 'Unbekanntes Recht.')
      // Alles zu dieser Reise neu ausliefern – Geräte ohne Zugriff bekommen Löschungen, neue Berechtigte die Daten
      store.bump(space, q.tripRecords.all(space, tripId, tripId))
    },

    /** Nach dem Speichern einer Reise mit geänderten Verknüpfungen: private Einträge neu ausliefern. */
    linksChanged(space, tripId) {
      store.bump(space, q.privateRecords.all(space, tripId, tripId))
    },

    /** Blob-Verweise eines Datensatzes nachführen. */
    trackRefs(space, tbl, id, json) {
      q.refsClear.run(space, tbl, id)
      for (const h of blobHashes(json)) q.refsAdd.run(space, tbl, id, h)
    },

    /** Darf `access` die Datei mit Prüfsumme `hash` sehen? (mindestens ein sichtbarer Datensatz verweist darauf) */
    canSeeBlob(space, access, hash) {
      if (access.full) return true
      for (const r of q.refsOf.all(space, hash)) {
        const data = store.record(space, r.tbl, r.id)
        if (data && access.canSee(r.tbl, r.id, data)) return true
      }
      return false
    },

    removeSpace(space) {
      q.removeSpace.run(space)
      q.removeSpaceAccess.run(space)
      db.prepare('DELETE FROM blob_refs WHERE space = ?').run(space)
    }
  }
}
