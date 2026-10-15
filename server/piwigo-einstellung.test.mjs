import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { cleanUrl } from './piwigo-config.mjs'

const OWNER = 'besitzer-schluessel-1234567890'
const FRIEND = 'freunde-schluessel-0987654321'
const KEY_ID = 'pkid-20261015-abcdefghij0123456789'
const SECRET = 's'.repeat(40)

// Zwei nachgebaute Piwigos (alte und neue Adresse) – nur Anmeldung und Status
function fakePiwigo(user) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const chunks = []
    for await (const c of req) chunks.push(c)
    const form = new URLSearchParams(Buffer.concat(chunks).toString())
    const out = (b) => (res.writeHead(200, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(b)))
    const method = url.searchParams.get('method')
    const loggedIn = (req.headers.cookie ?? '').includes('pwg_id=ok')
    if (method === 'pwg.session.login') {
      if (form.get('username') === KEY_ID && form.get('password') === SECRET) {
        res.setHeader('Set-Cookie', ['pwg_id=ok; path=/'])
        return out({ stat: 'ok', result: true })
      }
      return out({ stat: 'fail', err: 999, message: 'Invalid username/password' })
    }
    if (method === 'pwg.session.getStatus') return out({ stat: 'ok', result: loggedIn ? { username: user, status: 'webmaster', pwg_token: 't', version: '16.4.0' } : { username: 'guest', status: 'guest' } })
    if (method === 'pwg.categories.getList') return out(loggedIn ? { stat: 'ok', result: { categories: [{ id: 1, name: `Alben von ${user}` }] } } : { stat: 'fail', err: 401 })
    return out({ stat: 'fail', err: 501 })
  })
}

const oldPw = fakePiwigo('alt')
const newPw = fakePiwigo('neu')
let oldUrl, newUrl, server, base, dir
const owner = { Authorization: `Bearer ${OWNER}`, 'Content-Type': 'application/json' }
const friend = { Authorization: `Bearer ${FRIEND}`, 'Content-Type': 'application/json' }
const api = (path, headers = owner, method = 'GET', body) => fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })

before(async () => {
  for (const s of [oldPw, newPw]) await new Promise((r) => s.listen(0, r))
  oldUrl = `http://127.0.0.1:${oldPw.address().port}`
  newUrl = `http://127.0.0.1:${newPw.address().port}`
  dir = mkdtempSync(join(tmpdir(), 'nww-pwcfg-'))
  server = createSyncServer({ keys: [OWNER, FRIEND], dataDir: dir, push: { timer: false }, piwigo: { url: oldUrl, keyId: KEY_ID, secret: SECRET } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  for (const s of [oldPw, newPw]) await new Promise((r) => s.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Adressen werden geprüft und vereinheitlicht', () => {
  assert.equal(cleanUrl('192.168.5.15/piwigo/'), 'http://192.168.5.15/piwigo')
  assert.equal(cleanUrl(' https://fotos.example.de/ '), 'https://fotos.example.de')
  assert.equal(cleanUrl('', { optional: true }), '')
  assert.throws(() => cleanUrl(''), /fehlt/)
  assert.throws(() => cleanUrl('ftp://x'), /http/)
  assert.throws(() => cleanUrl('http://a:b@x'), /Benutzernamen/)
})

test('Gesundheit meldet die Einrichtung in der App', async () => {
  assert.equal((await (await fetch(`${base}/api/health`)).json()).piwigoSetup, true)
})

test('Nur der Besitzer sieht und ändert den Piwigo-Zugang – ohne Geheimnis', async () => {
  assert.equal((await api('/api/admin/piwigo', friend)).status, 403)
  const r = await (await api('/api/admin/piwigo')).json()
  assert.equal(r.source, 'env')
  assert.equal(r.url, oldUrl)
  assert.equal(r.keyId, KEY_ID)
  assert.equal(r.hasSecret, true)
  assert.equal(r.secret, undefined)
  assert.equal(JSON.stringify(r).includes(SECRET), false)
  assert.equal(r.status.user, 'alt')
})

test('Falsche Angaben werden nicht gespeichert', async () => {
  const bad = await api('/api/admin/piwigo', owner, 'PUT', { url: newUrl, keyId: KEY_ID, secret: 'falsch' })
  assert.equal(bad.status, 400)
  const body = await bad.json()
  assert.match(body.error, /Nicht gespeichert/)
  assert.match(body.detail, /Anmeldung bei Piwigo fehlgeschlagen/)
  assert.equal((await api('/api/admin/piwigo', owner, 'PUT', { url: newUrl, keyId: 'pkid-falsch' })).status, 400)
  assert.equal((await api('/api/admin/piwigo', owner, 'PUT', { url: 'http://127.0.0.1:1', keyId: KEY_ID })).status, 400)
  assert.equal((await (await api('/api/admin/piwigo')).json()).url, oldUrl)
})

test('Neue Adresse: Geheimnis bleibt, Brücke nutzt sofort die neue, öffentliche Adresse wird gemerkt', async () => {
  const r = await (await api('/api/admin/piwigo', owner, 'PUT', { url: `${newUrl}/`, publicUrl: 'https://fotos.example.de/', keyId: KEY_ID, secret: '' })).json()
  assert.equal(r.source, 'app')
  assert.equal(r.url, newUrl)
  assert.equal(r.publicUrl, 'https://fotos.example.de')
  assert.equal(r.status.user, 'neu')
  assert.equal(r.status.publicUrl, 'https://fotos.example.de/')
  const albums = await (await api('/api/piwigo/albums')).json()
  assert.equal(albums.albums[0].name, 'Alben von neu')
})

test('Zurücksetzen: wieder die Werte aus den Server-Einstellungen', async () => {
  const r = await (await api('/api/admin/piwigo', owner, 'DELETE')).json()
  assert.equal(r.source, 'env')
  assert.equal(r.url, oldUrl)
  assert.equal(r.status.user, 'alt')
})

test('Server ohne Piwigo: in der App einrichten, danach steht es allen freigegebenen Gruppen bereit', async () => {
  const d = mkdtempSync(join(tmpdir(), 'nww-pwcfg2-'))
  const s = createSyncServer({ keys: [OWNER], dataDir: d, push: { timer: false } })
  await new Promise((r) => s.listen(0, r))
  const b = `http://127.0.0.1:${s.address().port}`
  try {
    const empty = await (await fetch(`${b}/api/admin/piwigo`, { headers: owner })).json()
    assert.equal(empty.configured, false)
    assert.equal(empty.source, 'none')
    assert.equal((await fetch(`${b}/api/piwigo`, { headers: owner })).status, 404)
    const missing = await fetch(`${b}/api/admin/piwigo`, { method: 'PUT', headers: owner, body: JSON.stringify({ url: newUrl, keyId: KEY_ID }) })
    assert.equal(missing.status, 400) // ohne Geheimnis
    const ok = await fetch(`${b}/api/admin/piwigo`, { method: 'PUT', headers: owner, body: JSON.stringify({ url: newUrl, keyId: KEY_ID, secret: SECRET }) })
    assert.equal(ok.status, 200)
    assert.equal((await (await fetch(`${b}/api/info`, { headers: owner })).json()).piwigo, true)
  } finally {
    await new Promise((r) => s.close(r))
  }
  // Nach dem Neustart bleibt die Einstellung erhalten
  const s2 = createSyncServer({ keys: [OWNER], dataDir: d, push: { timer: false } })
  await new Promise((r) => s2.listen(0, r))
  try {
    const r = await (await fetch(`http://127.0.0.1:${s2.address().port}/api/admin/piwigo`, { headers: owner })).json()
    assert.equal(r.source, 'app')
    assert.equal(r.status.user, 'neu')
  } finally {
    await new Promise((r) => s2.close(r))
    rmSync(d, { recursive: true, force: true })
  }
})
