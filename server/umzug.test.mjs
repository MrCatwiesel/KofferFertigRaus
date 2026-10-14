// Umzug vom alten Namen „nix-wie-weg“ auf einem nachgebauten Server (Ordnerbaum unter KFR_ROOT, systemctl als Attrappe)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const here = new URL('.', import.meta.url).pathname

test('umzug.sh: Ordner, Datenbank, Einstellungen, nginx und Dienste bekommen den neuen Namen', { skip: !isRoot && 'nur als root' }, () => {
  const R = mkdtempSync(join(tmpdir(), 'kfr-umzug-'))
  const bin = mkdtempSync(join(tmpdir(), 'kfr-bin-'))
  const log = join(bin, 'log')
  try {
    const p = (...x) => join(R, ...x)
    const file = (f, s = 'x') => (mkdirSync(join(f, '..'), { recursive: true }), writeFileSync(f, s))
    // Alter Stand
    mkdirSync(p('opt/nix-wie-weg/server'), { recursive: true })
    execFileSync('git', ['init', '-q', p('opt/nix-wie-weg')])
    execFileSync('git', ['-C', p('opt/nix-wie-weg'), 'remote', 'add', 'origin', 'https://github.com/MrCatwiesel/nix-wie-weg-.git'])
    cpSync(join(here, 'proxmox'), p('opt/nix-wie-weg/server/proxmox'), { recursive: true })
    file(p('opt/nix-wie-weg-app/index.html'))
    file(p('etc/nix-wie-weg/sync.env'), 'NWW_KEYS=geheim\nNWW_APP_DIR=/opt/nix-wie-weg-app\nNWW_BACKUP_DIR=/mnt/sicherung/nix-wie-weg\n')
    file(p('etc/nix-wie-weg/backup_ed25519'), 'SCHLUESSEL')
    file(p('var/lib/private/nix-wie-weg/nix-wie-weg.sqlite'), 'DB')
    file(p('var/lib/private/nix-wie-weg/nix-wie-weg.sqlite-wal'), 'WAL')
    file(p('var/lib/private/nix-wie-weg/blobs/abc/f1'), 'FOTO')
    symlinkSync('private/nix-wie-weg', p('var/lib/nix-wie-weg'))
    file(p('var/lib/nix-wie-weg-update/server-vorher'), 'abc')
    file(p('var/backups/nix-wie-weg/2026-10-14_0330/nix-wie-weg.sqlite'), 'ALT')
    for (const u of ['sync.service', 'update.service', 'update.timer', 'backup.service', 'backup.timer', 'backup.path']) file(p(`etc/systemd/system/nix-wie-weg-${u}`))
    file(p('etc/nginx/sites-available/nix-wie-weg'), 'server { root /var/www/nix-wie-weg; }')
    mkdirSync(p('etc/nginx/sites-enabled'), { recursive: true })
    symlinkSync('/etc/nginx/sites-available/nix-wie-weg', p('etc/nginx/sites-enabled/nix-wie-weg'))
    file(p('var/www/nix-wie-weg/index.html'))
    writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "$*" >> ${log}\n`, { mode: 0o755 })

    const env = { ...process.env, KFR_ROOT: R, PATH: `${bin}:${process.env.PATH}` }
    const out = execFileSync('bash', [join(here, 'proxmox/umzug.sh')], { env, encoding: 'utf8' })
    assert.match(out, /Umzug fertig/)

    // Alte Namen sind weg
    for (const old of ['opt/nix-wie-weg', 'opt/nix-wie-weg-app', 'etc/nix-wie-weg', 'var/lib/nix-wie-weg', 'var/lib/private/nix-wie-weg', 'var/lib/nix-wie-weg-update', 'var/backups/nix-wie-weg', 'var/www/nix-wie-weg', 'etc/nginx/sites-available/nix-wie-weg', 'etc/nginx/sites-enabled/nix-wie-weg'])
      assert.ok(!existsSync(p(old)) && !isLink(p(old)), `${old} noch da`)
    assert.deepEqual(readdirSync(p('etc/systemd/system')).filter((n) => n.startsWith('nix-wie-weg')), [])
    // Neue Namen, Inhalte unverändert
    assert.ok(existsSync(p('opt/koffer-fertig-raus/.git')))
    assert.match(execFileSync('git', ['-C', p('opt/koffer-fertig-raus'), 'remote', 'get-url', 'origin'], { encoding: 'utf8' }), /KofferFertigRaus/)
    assert.equal(readFileSync(p('var/lib/private/koffer-fertig-raus/koffer-fertig-raus.sqlite'), 'utf8'), 'DB')
    assert.equal(readFileSync(p('var/lib/private/koffer-fertig-raus/koffer-fertig-raus.sqlite-wal'), 'utf8'), 'WAL')
    assert.equal(readFileSync(p('var/lib/koffer-fertig-raus/blobs/abc/f1'), 'utf8'), 'FOTO')
    assert.equal(readlinkSync(p('var/lib/koffer-fertig-raus')), 'private/koffer-fertig-raus')
    assert.equal(readFileSync(p('etc/koffer-fertig-raus/backup_ed25519'), 'utf8'), 'SCHLUESSEL')
    assert.equal(readFileSync(p('etc/koffer-fertig-raus/sync.env'), 'utf8'), 'NWW_KEYS=geheim\nNWW_APP_DIR=/opt/koffer-fertig-raus-app\nNWW_BACKUP_DIR=/mnt/sicherung/nix-wie-weg\n', 'eigener NAS-Pfad bleibt')
    assert.ok(existsSync(p('opt/koffer-fertig-raus-app/index.html')))
    assert.ok(existsSync(p('var/lib/koffer-fertig-raus-update/server-vorher')))
    assert.ok(existsSync(p('var/backups/koffer-fertig-raus/2026-10-14_0330/nix-wie-weg.sqlite')), 'alte Sicherungen bleiben lesbar (restore.sh kennt den alten Dateinamen)')
    assert.equal(readFileSync(p('etc/nginx/sites-available/koffer-fertig-raus'), 'utf8'), 'server { root /var/www/koffer-fertig-raus; }')
    assert.equal(readlinkSync(p('etc/nginx/sites-enabled/koffer-fertig-raus')), '/etc/nginx/sites-available/koffer-fertig-raus')
    assert.ok(existsSync(p('var/www/koffer-fertig-raus/index.html')))
    assert.ok(existsSync(p('etc/systemd/system/koffer-fertig-raus-sync.service')))
    const calls = readFileSync(log, 'utf8')
    assert.match(calls, /disable -q --now nix-wie-weg-update\.timer/)
    assert.match(calls, /stop nix-wie-weg-sync/)
    assert.match(calls, /enable -q --now koffer-fertig-raus-update\.timer koffer-fertig-raus-backup\.timer koffer-fertig-raus-backup\.path/)
    assert.match(calls, /restart koffer-fertig-raus-sync/)

    // Zweiter Lauf: nichts mehr zu tun
    rmSync(log)
    assert.equal(execFileSync('bash', [join(here, 'proxmox/umzug.sh')], { env, encoding: 'utf8' }), '')
    assert.ok(!existsSync(log))
  } finally {
    rmSync(R, { recursive: true, force: true })
    rmSync(bin, { recursive: true, force: true })
  }
})

function isLink(f) {
  try {
    return lstatSync(f).isSymbolicLink()
  } catch {
    return false
  }
}

test('Server übernimmt die alte Datenbankdatei nix-wie-weg.sqlite', async () => {
  const { createSyncServer } = await import('./server.mjs')
  const { renameSync } = await import('node:fs')
  const dataDir = mkdtempSync(join(tmpdir(), 'kfr-db-'))
  const KEY = 'umzug-schluessel-123456'
  const start = async () => {
    const server = createSyncServer({ keys: [KEY], dataDir })
    await new Promise((r) => server.listen(0, r))
    const base = `http://127.0.0.1:${server.address().port}`
    const call = (m, path, body) => fetch(base + path, { method: m, headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body })
    return { call, stop: () => new Promise((r) => server.close(r)) }
  }
  try {
    let s = await start()
    await s.call('POST', '/api/push', JSON.stringify({ changes: [{ tbl: 'trips', id: 't1', stamp: '2026-10-14T10:00:00.000Z', data: { id: 't1', title: 'Maria Alm' } }] }))
    await s.stop()
    for (const x of ['', '-wal', '-shm']) if (existsSync(join(dataDir, `koffer-fertig-raus.sqlite${x}`))) renameSync(join(dataDir, `koffer-fertig-raus.sqlite${x}`), join(dataDir, `nix-wie-weg.sqlite${x}`))
    s = await start()
    const pulled = await (await s.call('GET', '/api/pull?since=0&limit=10')).json()
    assert.equal(pulled.changes.find((c) => c.id === 't1')?.data.title, 'Maria Alm')
    await s.stop()
    assert.ok(existsSync(join(dataDir, 'koffer-fertig-raus.sqlite')) && !existsSync(join(dataDir, 'nix-wie-weg.sqlite')))
  } finally {
    rmSync(dataDir, { recursive: true, force: true })
  }
})

test('Sicherungsziele: neue in „koffer-fertig-raus“, bestehende bleiben in „nix-wie-weg“', async () => {
  const { cleanTarget, targetFolder } = await import('./backup-targets.mjs')
  const neu = cleanTarget({ type: 'ordner', path: '/mnt/nas' })
  assert.equal(targetFolder(neu), 'koffer-fertig-raus')
  const alt = { id: 'aaaaaaaaaaaa', type: 'ordner', path: '/mnt/nas', name: 'NAS', enabled: true, keep: 7 } // von vor der Umbenennung
  assert.equal(targetFolder(alt), 'nix-wie-weg')
  assert.equal(targetFolder(cleanTarget({ ...alt, name: 'NAS neu' }, alt)), 'nix-wie-weg', 'Bearbeiten wechselt den Ordner nicht')
  assert.equal(targetFolder(cleanTarget({ ...neu, folder: 'nix-wie-weg' }, neu)), 'koffer-fertig-raus', 'App kann den Ordner nicht umbiegen')
})
