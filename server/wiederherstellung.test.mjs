// Ernstfall-Übung: Server mit Daten → backup.sh → Daten weg → restore.sh → alles wieder da, Geräte gleichen neu ab.
// Braucht bash und root (wie im Container); sonst übersprungen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'wiederherstellung-schluessel-1'
const sha = (b) => createHash('sha256').update(b).digest('hex')
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const here = new URL('.', import.meta.url).pathname

async function start(dataDir) {
  const server = createSyncServer({ keys: [KEY], dataDir })
  await new Promise((r) => server.listen(0, r))
  const base = `http://127.0.0.1:${server.address().port}`
  const call = async (method, path, body, type) => {
    const r = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${KEY}`, ...(type ? { 'Content-Type': type } : {}) }, body })
    return r
  }
  return { server, call, stop: () => new Promise((r) => server.close(r)) }
}

test('Sicherung und Wiederherstellung (backup.sh / restore.sh)', { skip: !isRoot && 'nur als root' }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'nww-restore-'))
  const data = join(root, 'daten')
  const backups = join(root, 'sicherungen')
  const env = { ...process.env, NWW_DATA: data, NWW_BACKUP_DIR: backups, NWW_BACKUP_KEEP: '3' }
  try {
    // 1. Server mit Reise und Foto
    let s = await start(data)
    const foto = Buffer.from('JPEG-Bilddaten-vom-Großglockner')
    assert.equal((await s.call('PUT', `/api/blob/${sha(foto)}`, foto, 'image/jpeg')).status, 201)
    const stamp = '2026-10-04T10:00:00.000Z'
    const changes = [
      { tbl: 'trips', id: 't1', stamp, data: { id: 't1', title: 'Maria Alm' } },
      { tbl: 'photos', id: 'p1', stamp, data: { id: 'p1', tripId: 't1', full: { __blobRef: sha(foto), type: 'image/jpeg' } } }
    ]
    await s.call('POST', '/api/push', JSON.stringify({ changes }), 'application/json')
    const epochBefore = (await (await s.call('GET', '/api/info')).json()).epoch
    await s.stop()

    // 2. Sicherung
    const out = execFileSync('bash', [join(here, 'proxmox/backup.sh')], { env, encoding: 'utf8' })
    const name = readdirSync(backups).find((n) => /^20/.test(n))
    assert.ok(name, `Sicherung angelegt (${out.trim().split('\n').pop()})`)
    assert.ok(existsSync(join(backups, name, 'nix-wie-weg.sqlite')))

    // 3. Unglück: Reise gelöscht, Foto-Datei weg
    s = await start(data)
    await s.call('POST', '/api/push', JSON.stringify({ changes: [{ tbl: 'trips', id: 't1', stamp: '2026-10-05T10:00:00.000Z', deleted: true, data: null }] }), 'application/json')
    await s.stop()
    rmSync(join(data, 'blobs'), { recursive: true, force: true })

    // 4. Zurückspielen (mit Bestätigung „ja“)
    execFileSync('bash', [join(here, 'proxmox/restore.sh'), name], { env, input: 'ja\n', encoding: 'utf8' })
    assert.ok(readdirSync(root).some((n) => n.startsWith('daten.vor-wiederherstellung-')), 'alter Stand beiseitegelegt')

    // 5. Alles wieder da – und eine neue Kennung, damit die Geräte vollständig neu abgleichen
    s = await start(data)
    const pulled = await (await s.call('GET', '/api/pull?since=0&limit=100')).json()
    const trip = pulled.changes.find((c) => c.tbl === 'trips' && c.id === 't1')
    assert.equal(trip.deleted, false)
    assert.equal(trip.data.title, 'Maria Alm')
    const blob = await s.call('GET', `/api/blob/${sha(foto)}`)
    assert.equal(blob.status, 200)
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), foto)
    const epochAfter = (await (await s.call('GET', '/api/info')).json()).epoch
    assert.notEqual(epochAfter, epochBefore, 'neue Kennung → Geräte gleichen vollständig ab')
    await s.stop()
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
