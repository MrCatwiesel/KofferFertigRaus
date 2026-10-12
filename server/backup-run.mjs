/**
 * Überträgt eine fertige Sicherung (Ordner von backup.sh) an die in der App eingetragenen Ziele.
 * Läuft als root (aus backup.sh). Programme werden ohne Shell aufgerufen – Eingaben aus der App
 * können also keine Befehle einschleusen.
 *
 * Aufbau am Ziel:
 *   ordner, ssh:   <ziel>/nix-wie-weg/<datum_uhrzeit>/{nix-wie-weg.sqlite, sync.env, blobs/…}
 *                  (Fotos als harte Verknüpfungen bzw. rsync --link-dest: jedes Foto liegt nur einmal da)
 *   smb, webdav:   <ziel>/nix-wie-weg/<datum_uhrzeit>/{nix-wie-weg.sqlite, sync.env}
 *                  <ziel>/nix-wie-weg/fotos/<gruppe>/<prüfsumme>   (gemeinsamer Fotobestand, nur Neues wird hochgeladen)
 *
 * Aufruf: node backup-run.mjs --daten /var/lib/nix-wie-weg [--snapshot <ordner>] [--auftrag <datei>]
 */
import { spawn } from 'node:child_process'
import { chownSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { backupDir, readStatus, readTargets } from './backup-targets.mjs'

const STAMP_RE = /^20\d\d-\d\d-\d\d_\d{4}$/
const ROOT = 'nix-wie-weg'

/** Programm ohne Shell starten; liefert stdout, wirft mit stderr bei Fehler. */
function run(cmd, args, { allowFail = false, timeout = 30 * 60_000, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout)
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(e.code === 'ENOENT' ? `Programm „${cmd}“ fehlt – update.sh ausführen.` : e.message))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 || allowFail) resolve({ code, out, err })
      else reject(new Error(lastLines(err || out) || `${cmd} endete mit Fehler ${code}`))
    })
  })
}
const lastLines = (s) => String(s).trim().split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300)

/** Alle Dateien eines Ordners (relativ), rekursiv */
function walk(dir, rel = '') {
  const out = []
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...walk(dir, r))
    else if (e.isFile()) out.push(r)
  }
  return out
}

const stampsIn = (names) => names.filter((n) => STAMP_RE.test(n)).sort()
const toPrune = (stamps, keep) => (stamps.length > keep ? stamps.slice(0, stamps.length - keep) : [])

// ───────────────────────────── Ordner ─────────────────────────────
async function toFolder(t, snap) {
  if (!existsSync(t.path)) throw new Error(`Ordner ${t.path} gibt es nicht – ist die Platte/Freigabe eingehängt?`)
  const base = join(t.path, ROOT)
  mkdirSync(base, { recursive: true })
  const name = basename(snap)
  const prev = stampsIn(readdirSync(base)).filter((s) => s !== name).at(-1)
  const tmp = join(base, `.${name}.unfertig`)
  rmSync(tmp, { recursive: true, force: true })
  let linked = 0
  for (const rel of walk(snap)) {
    const dst = join(tmp, rel)
    mkdirSync(join(dst, '..'), { recursive: true })
    const old = prev && rel.startsWith('blobs/') ? join(base, prev, rel) : null
    if (old && existsSync(old) && statSync(old).size === statSync(join(snap, rel)).size) {
      try {
        linkSync(old, dst)
        linked++
        continue
      } catch {
        /* anderes Dateisystem o. ä. → kopieren */
      }
    }
    copyFileSync(join(snap, rel), dst)
  }
  rmSync(join(base, name), { recursive: true, force: true })
  renameSync(tmp, join(base, name))
  for (const old of toPrune(stampsIn(readdirSync(base)), t.keep)) rmSync(join(base, old), { recursive: true, force: true })
  return `${name} gespeichert${linked ? ` (${linked} Fotos unverändert verknüpft)` : ''}`
}

async function testFolder(t) {
  if (!existsSync(t.path)) throw new Error(`Ordner ${t.path} gibt es nicht – ist die Platte/Freigabe eingehängt?`)
  const f = join(t.path, '.nix-wie-weg-test')
  writeFileSync(f, 'test')
  rmSync(f)
  return 'Ordner ist beschreibbar.'
}

// ───────────────────────────── SMB (smbclient) ─────────────────────────────
function smbSession(t, bin) {
  const dir = mkdtempSync(join(tmpdir(), 'nww-smb-'))
  const auth = join(dir, 'auth')
  // Zugangsdaten als Datei (nicht auf der Befehlszeile, dort wären sie für andere Prozesse sichtbar)
  writeFileSync(auth, `username = ${t.user || 'guest'}\npassword = ${t.password ?? ''}\n${t.domain ? `domain = ${t.domain}\n` : ''}`, { mode: 0o600 })
  const service = `//${t.host}/${t.share}`
  const q = (s) => `"${s.replace(/"/g, '')}"`
  const exec = (cmds, opts) => run(bin, [service, '-A', auth, '-m', 'SMB3', '-c', cmds.join('; ')], opts)
  const remote = (...parts) => [t.path, ROOT, ...parts].filter(Boolean).join('/')
  return {
    q,
    remote,
    exec,
    async mkdirs(path) {
      const parts = path.split('/')
      for (let i = 1; i <= parts.length; i++) await exec([`mkdir ${q(parts.slice(0, i).join('/'))}`], { allowFail: true })
    },
    /** Namen in einem Ordner */
    async list(path) {
      const r = await exec([`ls ${q(`${path}/*`)}`], { allowFail: true })
      return r.out
        .split('\n')
        .map((l) => /^\s{2}(\S.*?)\s+[ADHSRN]*\s+\d+\s+\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4}\s*$/.exec(l)?.[1])
        .filter((n) => n && n !== '.' && n !== '..')
    },
    done: () => rmSync(dir, { recursive: true, force: true })
  }
}

async function toSmb(t, snap, bins) {
  const s = smbSession(t, bins.smbclient)
  try {
    await s.mkdirs(s.remote('fotos'))
    // 1. Neue Fotos in den gemeinsamen Bestand
    let uploaded = 0
    const blobs = join(snap, 'blobs')
    for (const space of existsSync(blobs) ? readdirSync(blobs) : []) {
      const remoteDir = s.remote('fotos', space)
      await s.mkdirs(remoteDir)
      const have = new Set(await s.list(remoteDir))
      const missing = readdirSync(join(blobs, space)).filter((n) => !have.has(n))
      for (let i = 0; i < missing.length; i += 100) {
        const batch = missing.slice(i, i + 100)
        await s.exec([`lcd ${s.q(join(blobs, space))}`, `cd ${s.q(remoteDir)}`, ...batch.map((n) => `put ${s.q(n)}`)])
        uploaded += batch.length
      }
    }
    // 2. Datenbank und Einstellungen
    const name = basename(snap)
    await s.mkdirs(s.remote(name))
    const files = ['nix-wie-weg.sqlite', 'sync.env'].filter((f) => existsSync(join(snap, f)))
    await s.exec([`lcd ${s.q(snap)}`, `cd ${s.q(s.remote(name))}`, ...files.map((f) => `put ${s.q(f)}`)])
    // 3. Alte Stände entfernen
    for (const old of toPrune(stampsIn(await s.list(s.remote())), t.keep)) {
      await s.exec([`cd ${s.q(s.remote(old))}`, 'prompt OFF', 'mask *', 'mdel *', 'cd ..', `rmdir ${s.q(old)}`], { allowFail: true })
    }
    return `${name} gespeichert (${uploaded} neue Fotos)`
  } finally {
    s.done()
  }
}

async function testSmb(t, bins) {
  const s = smbSession(t, bins.smbclient)
  try {
    await s.mkdirs(s.remote())
    const local = mkdtempSync(join(tmpdir(), 'nww-smbt-'))
    writeFileSync(join(local, 'nix-wie-weg-test.txt'), 'test')
    await s.exec([`lcd ${s.q(local)}`, `cd ${s.q(s.remote())}`, 'put "nix-wie-weg-test.txt"', 'del "nix-wie-weg-test.txt"'])
    rmSync(local, { recursive: true, force: true })
    return `Freigabe //${t.host}/${t.share} ist erreichbar und beschreibbar.`
  } finally {
    s.done()
  }
}

// ───────────────────────────── SSH + rsync ─────────────────────────────
function sshArgs(t, keys) {
  return ['-i', keys.key, '-p', String(t.port), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${keys.knownHosts}`, '-o', 'ConnectTimeout=20']
}
const sq = (s) => `'${s.replace(/'/g, '')}'`

async function toSsh(t, snap, bins, keys) {
  const target = `${t.path.replace(/\/+$/, '')}/${ROOT}`
  const ssh = (cmd) => run(bins.ssh, [...sshArgs(t, keys), `${t.user}@${t.host}`, cmd])
  await ssh(`mkdir -p ${sq(target)}`)
  const name = basename(snap)
  const prev = stampsIn((await ssh(`ls -1 ${sq(target)}`)).out.split('\n').map((s) => s.trim())).filter((s) => s !== name).at(-1)
  const args = ['-a', '--delete', '-e', `${bins.ssh} ${sshArgs(t, keys).join(' ')}`]
  if (prev) args.push(`--link-dest=../${prev}`)
  args.push(`${snap}/`, `${t.user}@${t.host}:${target}/${name}/`)
  await run(bins.rsync, args)
  const stamps = stampsIn((await ssh(`ls -1 ${sq(target)}`)).out.split('\n').map((s) => s.trim()))
  for (const old of toPrune(stamps, t.keep)) await ssh(`rm -rf ${sq(`${target}/${old}`)}`)
  return `${name} gespeichert${prev ? ' (nur Änderungen übertragen)' : ''}`
}

async function testSsh(t, bins, keys) {
  const target = `${t.path.replace(/\/+$/, '')}/${ROOT}`
  await run(bins.ssh, [...sshArgs(t, keys), `${t.user}@${t.host}`, `mkdir -p ${sq(target)} && touch ${sq(`${target}/.test`)} && rm ${sq(`${target}/.test`)} && command -v rsync >/dev/null`])
  return `Anmeldung bei ${t.user}@${t.host} klappt, Ordner ist beschreibbar, rsync ist vorhanden.`
}

// ───────────────────────────── WebDAV ─────────────────────────────
function dav(t, fetchImpl) {
  const auth = t.user ? { Authorization: `Basic ${Buffer.from(`${t.user}:${t.password ?? ''}`).toString('base64')}` } : {}
  const url = (...parts) => [t.url, ...parts.map(encodeURIComponent)].join('/')
  const req = async (method, u, opts = {}) => {
    const r = await fetchImpl(u, { method, ...opts, headers: { ...auth, ...(opts.headers ?? {}) } })
    if (r.status === 401) throw new Error('WebDAV: Benutzer oder Passwort falsch.')
    return r
  }
  return {
    url,
    async mkcol(u) {
      const r = await req('MKCOL', u)
      if (!r.ok && r.status !== 405 && r.status !== 301) throw new Error(`WebDAV: Ordner anlegen fehlgeschlagen (${r.status}).`)
    },
    async list(u) {
      const r = await req('PROPFIND', `${u}/`, { headers: { Depth: '1', 'Content-Type': 'application/xml' }, body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>' })
      if (r.status === 404) return []
      if (!r.ok) throw new Error(`WebDAV: Auflisten fehlgeschlagen (${r.status}).`)
      const text = await r.text()
      return [...text.matchAll(/<(?:[a-z0-9]+:)?href>([^<]+)<\/(?:[a-z0-9]+:)?href>/gi)]
        .map((m) => decodeURIComponent(m[1].replace(/\/+$/, '').split('/').pop() ?? ''))
        .filter(Boolean)
    },
    async put(u, file) {
      const r = await req('PUT', u, { body: readFileSync(file) })
      if (!r.ok) throw new Error(`WebDAV: Hochladen fehlgeschlagen (${r.status}).`)
    },
    async del(u) {
      await req('DELETE', u)
    }
  }
}

async function toWebdav(t, snap, fetchImpl) {
  const d = dav(t, fetchImpl)
  await d.mkcol(d.url(ROOT))
  await d.mkcol(d.url(ROOT, 'fotos'))
  let uploaded = 0
  const blobs = join(snap, 'blobs')
  for (const space of existsSync(blobs) ? readdirSync(blobs) : []) {
    await d.mkcol(d.url(ROOT, 'fotos', space))
    const have = new Set(await d.list(d.url(ROOT, 'fotos', space)))
    for (const n of readdirSync(join(blobs, space)).filter((x) => !have.has(x))) {
      await d.put(d.url(ROOT, 'fotos', space, n), join(blobs, space, n))
      uploaded++
    }
  }
  const name = basename(snap)
  await d.mkcol(d.url(ROOT, name))
  for (const f of ['nix-wie-weg.sqlite', 'sync.env']) if (existsSync(join(snap, f))) await d.put(d.url(ROOT, name, f), join(snap, f))
  for (const old of toPrune(stampsIn(await d.list(d.url(ROOT))), t.keep)) await d.del(`${d.url(ROOT, old)}/`)
  return `${name} gespeichert (${uploaded} neue Fotos)`
}

async function testWebdav(t, fetchImpl) {
  const d = dav(t, fetchImpl)
  await d.mkcol(d.url(ROOT))
  const tmp = mkdtempSync(join(tmpdir(), 'nww-dav-'))
  writeFileSync(join(tmp, 't.txt'), 'test')
  await d.put(d.url(ROOT, 'nix-wie-weg-test.txt'), join(tmp, 't.txt'))
  await d.del(d.url(ROOT, 'nix-wie-weg-test.txt'))
  rmSync(tmp, { recursive: true, force: true })
  return 'WebDAV ist erreichbar und beschreibbar.'
}

// ───────────────────────────── Ablauf ─────────────────────────────

/** Status schreiben – lesbar für den Dienst (gehört dem Besitzer des Sicherungsordners). */
function writeStatus(dataDir, status) {
  const dir = backupDir(dataDir)
  mkdirSync(dir, { recursive: true })
  const f = join(dir, 'status.json')
  writeFileSync(`${f}.tmp`, JSON.stringify(status, null, 2), { mode: 0o600 })
  renameSync(`${f}.tmp`, f)
  try {
    const st = statSync(dir)
    chownSync(f, st.uid, st.gid)
  } catch {
    /* nicht root (Tests) */
  }
}

/**
 * @param {{ dataDir: string, snapshotDir?: string|null, order?: { mode: 'alle'|'test', target?: string|null } | null,
 *   local?: object|null, bins?: object, keys?: object, fetchImpl?: typeof fetch, now?: () => string }} opts
 */
export async function runBackup(opts) {
  const { dataDir } = opts
  const bins = { smbclient: 'smbclient', rsync: 'rsync', ssh: 'ssh', ...(opts.bins ?? {}) }
  const keys = { key: '/etc/nix-wie-weg/backup_ed25519', knownHosts: '/etc/nix-wie-weg/known_hosts', ...(opts.keys ?? {}) }
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? (() => new Date().toISOString())
  const order = opts.order ?? { mode: 'alle', target: null }
  const status = readStatus(dataDir) ?? { targets: {} }
  status.targets ??= {}
  if (opts.local) status.local = opts.local

  const targets = readTargets(dataDir).filter((t) => (order.target ? t.id === order.target : t.enabled))
  status.running = true
  status.started = now()
  writeStatus(dataDir, status)

  for (const t of targets) {
    const entry = { at: now(), test: order.mode === 'test', ok: false, message: '' }
    try {
      if (order.mode === 'test') {
        entry.message =
          t.type === 'ordner' ? await testFolder(t) : t.type === 'smb' ? await testSmb(t, bins) : t.type === 'ssh' ? await testSsh(t, bins, keys) : await testWebdav(t, fetchImpl)
      } else {
        if (!opts.snapshotDir) throw new Error('Keine Sicherung zum Übertragen.')
        entry.message =
          t.type === 'ordner'
            ? await toFolder(t, opts.snapshotDir)
            : t.type === 'smb'
              ? await toSmb(t, opts.snapshotDir, bins)
              : t.type === 'ssh'
                ? await toSsh(t, opts.snapshotDir, bins, keys)
                : await toWebdav(t, opts.snapshotDir, fetchImpl)
      }
      entry.ok = true
    } catch (e) {
      entry.message = e.message
    }
    // Letzte echte Sicherung merken, auch wenn danach nur getestet wurde
    const prev = status.targets[t.id] ?? {}
    status.targets[t.id] = entry.test ? { ...prev, lastTest: entry } : { ...entry, lastTest: prev.lastTest }
    writeStatus(dataDir, status)
    ;(opts.log ?? console.log)(`${t.name}: ${entry.ok ? 'ok' : 'FEHLER'} – ${entry.message}`)
  }
  status.running = false
  status.finished = now()
  writeStatus(dataDir, status)
  return status
}

// Direkter Aufruf aus backup.sh
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = (name) => {
    const i = process.argv.indexOf(name)
    return i > 0 ? process.argv[i + 1] : null
  }
  const dataDir = arg('--daten') ?? '/var/lib/nix-wie-weg'
  const orderFile = arg('--auftrag')
  let order = null
  if (orderFile) {
    try {
      order = JSON.parse(readFileSync(orderFile, 'utf8'))
    } catch {
      order = null
    }
  }
  const snapshotDir = arg('--snapshot')
  const local = snapshotDir ? { at: new Date().toISOString(), path: snapshotDir, size: arg('--groesse') ?? '' } : null
  runBackup({ dataDir, snapshotDir, order, local })
    .then((s) => process.exit(Object.values(s.targets).some((e) => e.at >= s.started && !e.ok && !e.test) ? 1 : 0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
