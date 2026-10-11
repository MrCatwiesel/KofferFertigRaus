import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'familie-test-schluessel-123'
const KEY_ID = 'pkid-20261011-abcdefghij0123456789'
const SECRET = 'a'.repeat(40)
const SESSION = 'sitzung123'

// ---------- Nachgebautes Piwigo (nur das, was die Brücke nutzt) ----------
const fake = {
  albums: [
    { id: 1, name: 'Urlaube', id_uppercat: null, nb_images: 0, total_nb_images: 2, url: 'http://intern/index.php?/category/1' },
    { id: 2, name: 'Urlaube / Gardasee 2025', id_uppercat: '1', nb_images: 2, total_nb_images: 2, url: 'http://intern/index.php?/category/2' }
  ],
  images: new Map(),
  uploads: [],
  nextAlbum: 10,
  nextImage: 100,
  logins: 0,
  expireSession: false
}
let piwigoBase

function addImage(id, album, bytes) {
  fake.images.set(id, {
    id,
    album,
    md5: createHash('md5').update(bytes).digest('hex'),
    bytes,
    name: `Bild ${id}`,
    file: `bild${id}.jpg`,
    width: 4000,
    height: 3000,
    date_creation: '2025-08-0' + (id % 9) + ' 10:00:00'
  })
}
addImage(1, 2, Buffer.from('jpeg-eins'))
addImage(2, 2, Buffer.from('jpeg-zwei'))

const imgJson = (img) => ({
  id: img.id,
  name: img.name,
  file: img.file,
  width: img.width,
  height: img.height,
  date_creation: img.date_creation,
  page_url: `${piwigoBase}/picture.php?/${img.id}`,
  element_url: `${piwigoBase}/upload/${img.file}`,
  derivatives: {
    thumb: { url: `${piwigoBase}/i.php?/${img.id}-th.jpg` },
    xxlarge: { url: `${piwigoBase}/i.php?/${img.id}-xx.jpg` }
  }
})

const piwigo = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const loggedIn = !fake.expireSession && (req.headers.cookie ?? '').includes(`pwg_id=${SESSION}`)
  const out = (body) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const ok = (result) => out({ stat: 'ok', result })
  const fail = (err, message) => out({ stat: 'fail', err, message })

  if (url.pathname.startsWith('/i.php') || url.pathname.startsWith('/upload/')) {
    if (!loggedIn) {
      res.writeHead(403)
      return res.end()
    }
    const id = Number((url.search.match(/\/(\d+)-/) ?? url.pathname.match(/bild(\d+)/))?.[1])
    const img = fake.images.get(id)
    if (!img) {
      res.writeHead(404)
      return res.end()
    }
    res.writeHead(200, { 'Content-Type': 'image/jpeg' })
    return res.end(img.bytes)
  }

  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks)
  const ct = req.headers['content-type'] ?? ''
  let form = new Map()
  if (ct.startsWith('multipart/form-data')) {
    const fd = await new Response(raw, { headers: { 'content-type': ct } }).formData()
    form = new Map([...fd.entries()])
  } else if (raw.length) {
    form = new Map(new URLSearchParams(raw.toString()).entries())
  }
  const p = (k) => form.get(k) ?? url.searchParams.get(k)
  const method = url.searchParams.get('method')

  if (method === 'pwg.session.login') {
    if (p('username') === KEY_ID && p('password') === SECRET) {
      fake.logins++
      fake.expireSession = false
      res.setHeader('Set-Cookie', [`pwg_id=${SESSION}; path=/; HttpOnly`])
      return ok(true)
    }
    return fail(999, 'Invalid username/password')
  }
  if (method === 'pwg.session.getStatus') {
    return ok(loggedIn ? { username: 'denet', status: 'webmaster', pwg_token: 'tok', version: '16.4.0' } : { username: 'guest', status: 'guest' })
  }
  if (!loggedIn) return fail(401, 'Access denied')
  const needToken = () => p('pwg_token') === 'tok'

  switch (method) {
    case 'pwg.categories.getList':
      return ok({ categories: fake.albums })
    case 'pwg.categories.getImages': {
      const list = [...fake.images.values()].filter((i) => i.album === Number(p('cat_id')))
      return ok({ paging: { page: 0, per_page: 60, count: list.length, total_count: list.length }, images: list.map(imgJson) })
    }
    case 'pwg.images.getInfo': {
      const img = fake.images.get(Number(p('image_id')))
      return img ? ok(imgJson(img)) : fail(404, 'not found')
    }
    case 'pwg.categories.add': {
      if (!needToken()) return fail(403, 'token')
      const id = fake.nextAlbum++
      fake.albums.push({ id, name: p('name'), id_uppercat: p('parent') ?? null, nb_images: 0, total_nb_images: 0, status: p('status') })
      return ok({ info: 'Album added', id })
    }
    case 'pwg.images.exist': {
      const md5 = p('md5sum_list')
      const found = [...fake.images.values()].find((i) => i.md5 === md5)
      return ok({ [md5]: found ? String(found.id) : null })
    }
    case 'pwg.images.setInfo':
      return needToken() ? ok(null) : fail(403, 'token')
    case 'pwg.images.addSimple': {
      if (!needToken()) return fail(403, 'token')
      const file = form.get('image')
      if (!file || typeof file === 'string') return fail(1000, 'no file')
      const bytes = Buffer.from(await file.arrayBuffer())
      const id = fake.nextImage++
      addImage(id, Number(form.get('category')), bytes)
      fake.uploads.push({ id, name: form.get('name'), filename: file.name, category: form.get('category') })
      return ok({ image_id: id, url: `${piwigoBase}/picture.php?/${id}` })
    }
  }
  return fail(501, `unbekannt ${method}`)
})

// ---------- Abgleich-Server mit Piwigo-Brücke ----------
let server
let base
let dir
const auth = { Authorization: `Bearer ${KEY}` }

before(async () => {
  await new Promise((r) => piwigo.listen(0, r))
  piwigoBase = `http://127.0.0.1:${piwigo.address().port}`
  dir = mkdtempSync(join(tmpdir(), 'nww-pw-'))
  server = createSyncServer({
    keys: [KEY],
    dataDir: dir,
    piwigo: { url: piwigoBase, keyId: KEY_ID, secret: SECRET, publicUrl: 'https://fotos.example.de' }
  })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  await new Promise((r) => piwigo.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Piwigo: nur mit Schlüssel der Reisegruppe', async () => {
  assert.equal((await fetch(`${base}/api/piwigo/albums`)).status, 401)
})

test('Piwigo: Status und info melden die Brücke', async () => {
  const s = await (await fetch(`${base}/api/piwigo`, { headers: auth })).json()
  assert.equal(s.ok, true)
  assert.equal(s.user, 'denet')
  assert.equal(s.admin, true)
  const info = await (await fetch(`${base}/api/info`, { headers: auth })).json()
  assert.equal(info.piwigo, true)
})

test('Piwigo: Alben auflisten, Links zeigen auf die öffentliche Adresse', async () => {
  const r = await (await fetch(`${base}/api/piwigo/albums`, { headers: auth })).json()
  assert.equal(r.albums.length, 2)
  assert.equal(r.albums[1].parentId, 1)
  assert.equal(r.albums[1].name, 'Urlaube / Gardasee 2025')
})

test('Piwigo: Fotos eines Albums und Bilddatei über den Server', async () => {
  const r = await (await fetch(`${base}/api/piwigo/albums/2/images`, { headers: auth })).json()
  assert.equal(r.total, 2)
  assert.equal(r.images[0].width, 4000)
  assert.equal(r.images[0].pageUrl, 'https://fotos.example.de/picture.php?/1')
  const img = await fetch(`${base}/api/piwigo/images/1?size=xxlarge`, { headers: auth })
  assert.equal(img.status, 200)
  assert.equal(img.headers.get('content-type'), 'image/jpeg')
  assert.equal(Buffer.from(await img.arrayBuffer()).toString(), 'jpeg-eins')
  // nicht gemerktes Bild: Adresse wird per getInfo nachgeschlagen
  const orig = await fetch(`${base}/api/piwigo/images/2?size=original`, { headers: auth })
  assert.equal(Buffer.from(await orig.arrayBuffer()).toString(), 'jpeg-zwei')
  assert.equal((await fetch(`${base}/api/piwigo/images/1?size=riesig`, { headers: auth })).status, 400)
})

test('Piwigo: Album anlegen (privat) und Foto hochladen', async () => {
  const a = await (
    await fetch(`${base}/api/piwigo/albums`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gardasee 2026', parentId: 1 })
    })
  ).json()
  assert.equal(a.name, 'Gardasee 2026')
  assert.equal(fake.albums.find((x) => x.id === a.id).status, 'private')

  const up = await fetch(`${base}/api/piwigo/albums/${a.id}/images?filename=IMG_0001.HEIC.jpg&name=Seeblick`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'image/jpeg' },
    body: Buffer.from('neues-foto')
  })
  assert.equal(up.status, 201)
  const r = await up.json()
  assert.equal(r.existed, false)
  assert.equal(fake.uploads.at(-1).name, 'Seeblick')
  assert.equal(fake.uploads.at(-1).category, String(a.id))

  // zweiter Versuch mit denselben Daten → kein Doppel
  const again = await (
    await fetch(`${base}/api/piwigo/albums/${a.id}/images`, { method: 'POST', headers: { ...auth, 'Content-Type': 'image/jpeg' }, body: Buffer.from('neues-foto') })
  ).json()
  assert.equal(again.existed, true)
  assert.equal(again.id, r.id)
  assert.equal(fake.uploads.length, 1)
})

test('Piwigo: nur Bilder werden angenommen', async () => {
  const r = await fetch(`${base}/api/piwigo/albums/2/images`, { method: 'POST', headers: { ...auth, 'Content-Type': 'text/plain' }, body: 'hallo' })
  assert.equal(r.status, 400)
})

test('Piwigo: abgelaufene Sitzung → automatisch neu anmelden', async () => {
  const before = fake.logins
  fake.expireSession = true
  const r = await fetch(`${base}/api/piwigo/albums`, { headers: auth })
  assert.equal(r.status, 200)
  assert.equal(fake.logins, before + 1)
})

test('ohne Piwigo-Einstellung: 404 und info.piwigo = false', async () => {
  const d = mkdtempSync(join(tmpdir(), 'nww-pw2-'))
  const s = createSyncServer({ keys: [KEY], dataDir: d })
  await new Promise((r) => s.listen(0, r))
  const b = `http://127.0.0.1:${s.address().port}`
  assert.equal((await fetch(`${b}/api/piwigo/albums`, { headers: auth })).status, 404)
  assert.equal((await (await fetch(`${b}/api/info`, { headers: auth })).json()).piwigo, false)
  await new Promise((r) => s.close(r))
  rmSync(d, { recursive: true, force: true })
})

test('falscher Piwigo-Schlüssel: verständliche Meldung', async () => {
  const d = mkdtempSync(join(tmpdir(), 'nww-pw3-'))
  const s = createSyncServer({ keys: [KEY], dataDir: d, piwigo: { url: piwigoBase, keyId: KEY_ID, secret: 'b'.repeat(40) } })
  await new Promise((r) => s.listen(0, r))
  const b = `http://127.0.0.1:${s.address().port}`
  const r = await fetch(`${b}/api/piwigo`, { headers: auth })
  assert.equal(r.status, 502)
  assert.match((await r.json()).error, /API-Schlüssel/)
  await new Promise((r) => s.close(r))
  rmSync(d, { recursive: true, force: true })
})
