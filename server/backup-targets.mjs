/**
 * Sicherungsziele des Servers (zusätzlich zur täglichen Sicherung im Container):
 *   ordner  – ein Ordner, z. B. eine in Proxmox eingehängte Platte, SMB- oder NFS-Freigabe (mp0)
 *   smb     – Windows-/NAS-Freigabe direkt (smbclient, klappt auch im unprivilegierten Container)
 *   ssh     – anderer Rechner/NAS per SSH + rsync (nur Änderungen werden übertragen)
 *   webdav  – z. B. Nextcloud, Synology WebDAV, Hetzner Storage Box
 *
 * Die Ziele verwaltet der Besitzer in der App. Gespeichert werden sie in <daten>/sicherung/ziele.json
 * (Passwörter inklusive – die Datei ist nur für den Dienst und root lesbar; die App bekommt sie nie zurück).
 * Ausgeführt wird die Sicherung von backup.sh (root) → backup-run.mjs. Die App stößt sie über die Datei
 * <daten>/sicherung/jetzt an (systemd-Pfad-Einheit koffer-fertig-raus-backup.path).
 */
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpError, readJson, send } from './http.mjs'

export const TYPES = ['ordner', 'smb', 'ssh', 'webdav']

/** Ordner auf dem Ziel. Ziele von vor der Umbenennung (ohne Angabe) behalten „nix-wie-weg“ – dort liegen ihre Sicherungen und Fotos. */
export const FOLDER = 'koffer-fertig-raus'
export const LEGACY_FOLDER = 'nix-wie-weg'
export const targetFolder = (t) => (t.folder === FOLDER ? FOLDER : LEGACY_FOLDER)
const SECRET_FIELDS = ['password']
const MAX_TARGETS = 8

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max)
/** Nur „harmlose“ Zeichen für Hostnamen, Benutzer, Freigaben (werden an Programme übergeben) */
const SAFE = /^[A-Za-z0-9._@\-]+$/
const SAFE_PATH = /^[^\0\n\r'"`$\\;|&<>]*$/

function need(cond, msg) {
  if (!cond) throw new HttpError(400, msg)
}

/** Ziel prüfen und vereinheitlichen. Leeres Passwort = bisheriges behalten. */
export function cleanTarget(input, old = null) {
  const type = input?.type
  need(TYPES.includes(type), 'Unbekannte Art des Ziels.')
  const t = {
    id: /^[a-f0-9]{12}$/.test(input.id ?? '') ? input.id : randomBytes(6).toString('hex'),
    name: str(input.name, 60) || type.toUpperCase(),
    type,
    enabled: input.enabled !== false,
    keep: Math.min(60, Math.max(1, Number.parseInt(input.keep, 10) || 7)),
    // Ordner bleibt beim Bearbeiten erhalten; neue Ziele bekommen den neuen Namen
    folder: old ? targetFolder(old) : FOLDER
  }
  if (type === 'ordner') {
    t.path = str(input.path, 300)
    need(t.path.startsWith('/') && SAFE_PATH.test(t.path) && !t.path.includes('..'), 'Ordner: vollständiger Pfad nötig, z. B. /mnt/sicherung.')
  }
  if (type === 'smb') {
    t.host = str(input.host, 120)
    t.share = str(input.share, 80)
    t.path = str(input.path, 200).replace(/^[\\/]+|[\\/]+$/g, '').replace(/\\/g, '/')
    t.user = str(input.user, 80)
    t.domain = str(input.domain, 80)
    need(SAFE.test(t.host), 'SMB: Server-Name oder IP fehlt (z. B. 192.168.5.10 oder nas).')
    need(t.share && SAFE.test(t.share.replace(/ /g, '_')), 'SMB: Name der Freigabe fehlt (z. B. backup).')
    need(SAFE_PATH.test(t.path) && !t.path.includes('..'), 'SMB: Unterordner ungültig.')
    need(!t.user || SAFE.test(t.user), 'SMB: Benutzername ungültig.')
    need(!t.domain || SAFE.test(t.domain), 'SMB: Domäne ungültig.')
  }
  if (type === 'ssh') {
    t.host = str(input.host, 120)
    t.port = Math.min(65535, Math.max(1, Number.parseInt(input.port, 10) || 22))
    t.user = str(input.user, 80)
    t.path = str(input.path, 300)
    need(SAFE.test(t.host), 'SSH: Server-Name oder IP fehlt.')
    need(SAFE.test(t.user), 'SSH: Benutzername fehlt.')
    need(t.path && SAFE_PATH.test(t.path) && !t.path.includes('..'), 'SSH: Zielordner fehlt, z. B. /volume1/backup/koffer-fertig-raus.')
  }
  if (type === 'webdav') {
    t.url = str(input.url, 300).replace(/\/+$/, '')
    t.user = str(input.user, 120)
    need(/^https?:\/\/[^\s]+$/i.test(t.url), 'WebDAV: Adresse fehlt, z. B. https://cloud.example.de/remote.php/dav/files/marco/Sicherung.')
  }
  if (type === 'smb' || type === 'webdav') {
    const pw = typeof input.password === 'string' ? input.password : ''
    t.password = pw ? pw.slice(0, 200) : old?.type === type ? old.password ?? '' : ''
  }
  return t
}

/** Für die App: ohne Passwörter, dafür „hasPassword“. */
export function publicTarget(t) {
  const out = { ...t }
  for (const f of SECRET_FIELDS) {
    if (f in out) {
      out.hasPassword = !!out[f]
      delete out[f]
    }
  }
  return out
}

export const backupDir = (dataDir) => join(dataDir, 'sicherung')

export function readTargets(dataDir) {
  try {
    return JSON.parse(readFileSync(join(backupDir(dataDir), 'ziele.json'), 'utf8')).targets ?? []
  } catch {
    return []
  }
}

export function readStatus(dataDir) {
  try {
    return JSON.parse(readFileSync(join(backupDir(dataDir), 'status.json'), 'utf8'))
  } catch {
    return null
  }
}

function writeAtomic(path, text) {
  writeFileSync(`${path}.tmp`, text, { mode: 0o600 })
  renameSync(`${path}.tmp`, path)
}

/** Verwaltung durch den Besitzer: /api/admin/sicherung… */
export function createBackupAdmin(dataDir) {
  const dir = backupDir(dataDir)
  mkdirSync(dir, { recursive: true, mode: 0o700 })

  const save = (targets) => writeAtomic(join(dir, 'ziele.json'), JSON.stringify({ targets }, null, 2))
  const sshKey = () => {
    try {
      return readFileSync(join(dir, 'ssh.pub'), 'utf8').trim()
    } catch {
      return ''
    }
  }

  return {
    async handle(req, res, path) {
      const sub = path.slice('/api/admin/sicherung'.length)
      if (sub === '' && req.method === 'GET') {
        return send(res, 200, {
          targets: readTargets(dataDir).map(publicTarget),
          status: readStatus(dataDir),
          pending: existsSync(join(dir, 'jetzt')),
          sshPublicKey: sshKey(),
          // Läuft die Sicherung über systemd? (backup.sh legt die Datei an)
          installed: existsSync(join(dir, 'eingerichtet'))
        })
      }
      if (sub === '' && req.method === 'PUT') {
        const body = await readJson(req)
        need(Array.isArray(body.targets), 'targets fehlt.')
        need(body.targets.length <= MAX_TARGETS, `Höchstens ${MAX_TARGETS} Ziele.`)
        const old = new Map(readTargets(dataDir).map((t) => [t.id, t]))
        const targets = body.targets.map((t) => cleanTarget(t, old.get(t.id)))
        save(targets)
        return send(res, 200, { targets: targets.map(publicTarget) })
      }
      if (sub === '/jetzt' && req.method === 'POST') {
        const body = await readJson(req)
        const order = { at: new Date().toISOString(), mode: body.test ? 'test' : 'alle', target: str(body.target, 20) || null }
        if (order.target) need(readTargets(dataDir).some((t) => t.id === order.target), 'Ziel nicht gefunden.')
        writeAtomic(join(dir, 'jetzt'), JSON.stringify(order))
        return send(res, 202, { ok: true, order })
      }
      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
