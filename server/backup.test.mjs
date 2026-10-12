import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { cleanTarget, publicTarget } from './backup-targets.mjs'
import { runBackup } from './backup-run.mjs'

const KEY = 'sicherung-test-schluessel-1'
const OTHER = 'andere-gruppe-schluessel-2'
let dir
let server
let base

const call = async (method, path, key, body) => {
  const r = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}

/** Kleine Sicherung wie von backup.sh */
function snapshot(root, name, photos) {
  const s = join(root, name)
  mkdirSync(join(s, 'blobs', 'abc123'), { recursive: true })
  writeFileSync(join(s, 'nix-wie-weg.sqlite'), `DB ${name}`)
  writeFileSync(join(s, 'sync.env'), 'NWW_KEYS=geheim')
  for (const p of photos) writeFileSync(join(s, 'blobs', 'abc123', p), `Foto ${p}`)
  return s
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-backup-'))
  server = createSyncServer({ keys: [KEY, OTHER], dataDir: join(dir, 'data') })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Ziele prüfen: nur sinnvolle Werte, Passwort bleibt beim Bearbeiten erhalten, App sieht es nie', () => {
  assert.throws(() => cleanTarget({ type: 'ftp' }), /Unbekannte/)
  assert.throws(() => cleanTarget({ type: 'ordner', path: 'relativ' }), /vollständiger Pfad/)
  assert.throws(() => cleanTarget({ type: 'ordner', path: '/mnt/x;rm -rf /' }), /vollständiger Pfad/)
  assert.throws(() => cleanTarget({ type: 'smb', host: 'nas', share: '' }), /Freigabe/)
  assert.throws(() => cleanTarget({ type: 'ssh', host: 'nas', user: 'a b', path: '/x' }), /Benutzername/)
  const smb = cleanTarget({ type: 'smb', name: 'NAS', host: '192.168.5.10', share: 'backup', path: '\\Reise\\', user: 'marco', password: 'pw1' })
  assert.equal(smb.path, 'Reise')
  assert.equal(smb.keep, 7)
  const edited = cleanTarget({ ...publicTarget(smb), password: '' }, smb)
  assert.equal(edited.password, 'pw1')
  assert.equal(edited.id, smb.id)
  assert.deepEqual(Object.keys(publicTarget(smb)).includes('password'), false)
  assert.equal(publicTarget(smb).hasPassword, true)
})

test('API: nur Besitzer, Passwörter maskiert, Auftrag „jetzt“', async () => {
  assert.equal((await call('GET', '/api/admin/sicherung', OTHER)).status, 403)
  const empty = await call('GET', '/api/admin/sicherung', KEY)
  assert.deepEqual(empty.body.targets, [])
  assert.equal((await call('PUT', '/api/admin/sicherung', KEY, { targets: [{ type: 'smb', host: '' }] })).status, 400)
  const put = await call('PUT', '/api/admin/sicherung', KEY, {
    targets: [{ type: 'smb', name: 'NAS', host: 'nas', share: 'backup', user: 'marco', password: 'geheim123' }, { type: 'ordner', path: '/mnt/usb' }]
  })
  assert.equal(put.status, 200)
  assert.equal(put.body.targets[0].hasPassword, true)
  assert.ok(!JSON.stringify(put.body).includes('geheim123'))
  const stored = JSON.parse(readFileSync(join(dir, 'data', 'sicherung', 'ziele.json'), 'utf8'))
  assert.equal(stored.targets[0].password, 'geheim123')
  assert.equal(statSync(join(dir, 'data', 'sicherung', 'ziele.json')).mode & 0o777, 0o600)
  // Bearbeiten ohne Passwort → bleibt
  await call('PUT', '/api/admin/sicherung', KEY, { targets: [{ ...put.body.targets[0], name: 'NAS neu' }] })
  assert.equal(JSON.parse(readFileSync(join(dir, 'data', 'sicherung', 'ziele.json'), 'utf8')).targets[0].password, 'geheim123')
  const order = await call('POST', '/api/admin/sicherung/jetzt', KEY, { test: true, target: put.body.targets[0].id })
  assert.equal(order.status, 202)
  assert.equal(JSON.parse(readFileSync(join(dir, 'data', 'sicherung', 'jetzt'), 'utf8')).mode, 'test')
  assert.equal((await call('GET', '/api/admin/sicherung', KEY)).body.pending, true)
})

test('Ordner: Fotos als harte Verknüpfungen, alte Stände werden entfernt, fehlende Platte wird gemeldet', async () => {
  const data = mkdtempSync(join(dir, 'd1-'))
  const target = mkdtempSync(join(dir, 'usb-'))
  mkdirSync(join(data, 'sicherung'))
  writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [cleanTarget({ type: 'ordner', name: 'USB', path: target, keep: 2 }), cleanTarget({ type: 'ordner', name: 'Weg', path: '/gibt/es/nicht' })] }))
  const snaps = mkdtempSync(join(dir, 's-'))
  const s1 = snapshot(snaps, '2026-10-12_0330', ['a1', 'b2'])
  let st = await runBackup({ dataDir: data, snapshotDir: s1, log: () => {} })
  const [usb, weg] = Object.values(st.targets)
  assert.equal(usb.ok, true)
  assert.equal(weg.ok, false)
  assert.match(weg.message, /eingehängt/)
  await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-13_0330', ['a1', 'b2', 'c3']), log: () => {} })
  st = await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-14_0330', ['a1', 'b2', 'c3']), log: () => {} })
  const root = join(target, 'nix-wie-weg')
  assert.deepEqual(readdirSync(root).sort(), ['2026-10-13_0330', '2026-10-14_0330'], 'nur die neuesten 2')
  const ino = (s) => statSync(join(root, s, 'blobs', 'abc123', 'a1')).ino
  assert.equal(ino('2026-10-13_0330'), ino('2026-10-14_0330'), 'gleiches Foto, eine Datei')
  assert.equal(readFileSync(join(root, '2026-10-14_0330', 'nix-wie-weg.sqlite'), 'utf8'), 'DB 2026-10-14_0330')
  assert.match(Object.values(st.targets)[0].message, /verknüpft/)
})

test('SMB: Fotobestand nur einmal hochladen, Datenbank je Stand, Aufräumen, Test', async () => {
  const data = mkdtempSync(join(dir, 'd2-'))
  const share = mkdtempSync(join(dir, 'share-'))
  const log = join(dir, 'smb.log')
  // Nachgebautes smbclient: führt die Befehle auf einem lokalen Ordner aus
  const fake = join(dir, 'smbclient')
  writeFileSync(
    fake,
    `#!/usr/bin/env node
const fs = require('fs'), path = require('path')
const args = process.argv.slice(2)
const auth = fs.readFileSync(args[args.indexOf('-A') + 1], 'utf8')
if (!/password = pw1/.test(auth)) { console.error('NT_STATUS_LOGON_FAILURE'); process.exit(1) }
const cmds = args[args.indexOf('-c') + 1].split('; ')
const root = ${JSON.stringify(share)}
let cwd = '', lcd = '.'
const un = (s) => s.replace(/^"|"$/g, '')
fs.appendFileSync(${JSON.stringify(log)}, cmds.join(' | ') + '\\n')
for (const c of cmds) {
  const [op, ...rest] = c.split(' '); const a = un(rest.join(' '))
  const abs = (p) => path.join(root, p.startsWith('/') ? p : path.join(cwd, p))
  if (op === 'mkdir') { if (fs.existsSync(abs(a))) { console.log('NT_STATUS_OBJECT_NAME_COLLISION'); process.exit(1) } fs.mkdirSync(abs(a)) }
  else if (op === 'ls') { const d = abs(a.replace(/\\/\\*$/, '')); if (!fs.existsSync(d)) process.exit(1); for (const n of fs.readdirSync(d)) console.log('  ' + n + '   ' + (fs.statSync(path.join(d, n)).isDirectory() ? 'D' : 'A') + '   5  Mon Oct 12 22:37:00 2026') }
  else if (op === 'lcd') lcd = a
  else if (op === 'cd') cwd = a === '..' ? path.dirname(cwd) : a
  else if (op === 'put') fs.copyFileSync(path.join(lcd, a), abs(a))
  else if (op === 'del') fs.rmSync(abs(a))
  else if (op === 'mdel') for (const n of fs.readdirSync(abs(''))) fs.rmSync(abs(n))
  else if (op === 'rmdir') fs.rmdirSync(abs(a))
}
`
  )
  chmodSync(fake, 0o755)
  mkdirSync(join(data, 'sicherung'))
  const t = cleanTarget({ type: 'smb', name: 'NAS', host: 'nas', share: 'backup', path: 'Reise', user: 'marco', password: 'pw1', keep: 1 })
  writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [t] }))
  const snaps = mkdtempSync(join(dir, 's2-'))
  mkdirSync(join(share, 'Reise'))
  let st = await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-12_0330', ['a1', 'b2']), bins: { smbclient: fake }, log: () => {} })
  assert.equal(st.targets[t.id].ok, true, st.targets[t.id].message)
  assert.match(st.targets[t.id].message, /2 neue Fotos/)
  st = await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-13_0330', ['a1', 'b2', 'c3']), bins: { smbclient: fake }, log: () => {} })
  assert.match(st.targets[t.id].message, /1 neue Fotos/)
  const root = join(share, 'Reise', 'nix-wie-weg')
  assert.deepEqual(readdirSync(root).sort(), ['2026-10-13_0330', 'fotos'], 'alter Stand entfernt, Fotobestand bleibt')
  assert.deepEqual(readdirSync(join(root, 'fotos', 'abc123')).sort(), ['a1', 'b2', 'c3'])
  assert.equal(readFileSync(join(root, '2026-10-13_0330', 'nix-wie-weg.sqlite'), 'utf8'), 'DB 2026-10-13_0330')
  assert.ok(!readFileSync(log, 'utf8').includes('pw1'), 'Passwort nie auf der Befehlszeile')

  st = await runBackup({ dataDir: data, order: { mode: 'test', target: t.id }, bins: { smbclient: fake }, log: () => {} })
  assert.equal(st.targets[t.id].lastTest.ok, true)
  assert.equal(st.targets[t.id].ok, true, 'letzte echte Sicherung bleibt sichtbar')
  // falsches Passwort
  writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [{ ...t, password: 'falsch' }] }))
  st = await runBackup({ dataDir: data, order: { mode: 'test', target: t.id }, bins: { smbclient: fake }, log: () => {} })
  assert.equal(st.targets[t.id].lastTest.ok, false)
  assert.match(st.targets[t.id].lastTest.message, /LOGON_FAILURE/)
})

test('SSH: rsync mit --link-dest auf den vorigen Stand, Aufräumen per ssh', async () => {
  const data = mkdtempSync(join(dir, 'd3-'))
  const remote = mkdtempSync(join(dir, 'remote-'))
  const log = join(dir, 'ssh.log')
  const fakeSsh = join(dir, 'ssh')
  const fakeRsync = join(dir, 'rsync')
  // ssh: letztes Argument ist der Befehl → lokal ausführen
  writeFileSync(fakeSsh, `#!/bin/sh\nfor a; do cmd="$a"; done\necho "ssh $*" >> ${log}\nsh -c "$cmd"\n`)
  // rsync: Quelle → Ziel (ohne user@host:) kopieren, Argumente merken
  writeFileSync(fakeRsync, `#!/bin/sh\necho "rsync $*" >> ${log}\nfor a; do prev="$last"; last="$a"; done\ndst=$(echo "$last" | sed 's/^[^:]*://')\nmkdir -p "$dst" && cp -a "$prev"/. "$dst"\n`)
  chmodSync(fakeSsh, 0o755)
  chmodSync(fakeRsync, 0o755)
  mkdirSync(join(data, 'sicherung'))
  const t = cleanTarget({ type: 'ssh', name: 'Synology', host: 'nas', port: 2222, user: 'backup', path: remote, keep: 1 })
  writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [t] }))
  const snaps = mkdtempSync(join(dir, 's3-'))
  const opts = { dataDir: data, bins: { ssh: fakeSsh, rsync: fakeRsync }, keys: { key: '/k', knownHosts: '/kh' }, log: () => {} }
  let st = await runBackup({ ...opts, snapshotDir: snapshot(snaps, '2026-10-12_0330', ['a1']) })
  assert.equal(st.targets[t.id].ok, true, st.targets[t.id].message)
  st = await runBackup({ ...opts, snapshotDir: snapshot(snaps, '2026-10-13_0330', ['a1', 'b2']) })
  assert.match(st.targets[t.id].message, /nur Änderungen/)
  const l = readFileSync(log, 'utf8')
  assert.match(l, /--link-dest=\.\.\/2026-10-12_0330/)
  assert.match(l, /-p 2222/)
  assert.match(l, /backup@nas:/)
  assert.deepEqual(readdirSync(join(remote, 'nix-wie-weg')), ['2026-10-13_0330'])
  assert.ok(existsSync(join(remote, 'nix-wie-weg', '2026-10-13_0330', 'blobs', 'abc123', 'b2')))
})

test('WebDAV: Ordner anlegen, nur neue Fotos, aufräumen, Anmeldung prüfen', async () => {
  const root = mkdtempSync(join(dir, 'dav-'))
  const puts = []
  const dav = createServer((req, res) => {
    if (req.headers.authorization !== `Basic ${Buffer.from('marco:pw').toString('base64')}`) {
      res.writeHead(401)
      return res.end()
    }
    const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname.replace(/^\/dav/, '')))
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      if (req.method === 'MKCOL') {
        if (existsSync(p)) res.writeHead(405)
        else (mkdirSync(p), res.writeHead(201))
      } else if (req.method === 'PUT') {
        writeFileSync(p, Buffer.concat(chunks))
        puts.push(p)
        res.writeHead(201)
      } else if (req.method === 'PROPFIND') {
        if (!existsSync(p)) res.writeHead(404)
        else {
          res.writeHead(207, { 'Content-Type': 'application/xml' })
          return res.end(`<d:multistatus xmlns:d="DAV:">${readdirSync(p).map((n) => `<d:response><d:href>/dav/x/${encodeURIComponent(n)}</d:href></d:response>`).join('')}</d:multistatus>`)
        }
      } else if (req.method === 'DELETE') {
        rmSync(p, { recursive: true, force: true })
        res.writeHead(204)
      }
      res.end()
    })
  })
  await new Promise((r) => dav.listen(0, r))
  const url = `http://127.0.0.1:${dav.address().port}/dav`
  const data = mkdtempSync(join(dir, 'd4-'))
  mkdirSync(join(data, 'sicherung'))
  const t = cleanTarget({ type: 'webdav', name: 'Nextcloud', url, user: 'marco', password: 'pw', keep: 1 })
  writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [t] }))
  const snaps = mkdtempSync(join(dir, 's4-'))
  try {
    let st = await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-12_0330', ['a1', 'b2']), log: () => {} })
    assert.equal(st.targets[t.id].ok, true, st.targets[t.id].message)
    const before = puts.length
    st = await runBackup({ dataDir: data, snapshotDir: snapshot(snaps, '2026-10-13_0330', ['a1', 'b2', 'c3']), log: () => {} })
    assert.match(st.targets[t.id].message, /1 neue Fotos/)
    assert.equal(puts.length - before, 3, '1 Foto + Datenbank + Einstellungen')
    assert.deepEqual(readdirSync(join(root, 'nix-wie-weg')).sort(), ['2026-10-13_0330', 'fotos'])
    writeFileSync(join(data, 'sicherung', 'ziele.json'), JSON.stringify({ targets: [{ ...t, password: 'falsch' }] }))
    st = await runBackup({ dataDir: data, order: { mode: 'test', target: t.id }, log: () => {} })
    assert.match(st.targets[t.id].lastTest.message, /Passwort falsch/)
  } finally {
    await new Promise((r) => dav.close(r))
  }
})
