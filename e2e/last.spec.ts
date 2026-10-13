import { chromium, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Lasttest: Wie schnell bleibt die App mit vielen Daten?
 * Läuft nur auf Wunsch (dauert einige Minuten und braucht ~0,6 GB Platz im Browser):
 *   NWW_LAST=1 npx playwright test last --project=chromium
 * Ergebnis: Tabelle in der Konsole und test-results/last.json.
 *
 * Datenmenge (Ziel aus dem Projektstand): 80 Reisen, 3200 Unternehmungen, 1100 Fotos,
 * 240 Routen (je 2000 gespeicherte Punkte, Originaldatei mit 4000 Punkten).
 * Reise „L00“ ist die große: 160 Unternehmungen, 150 Fotos, 12 Routen, 20 Tagebuchtage.
 */

test.skip(!process.env.NWW_LAST, 'nur mit NWW_LAST=1')

/** Läuft im Browser: erzeugt die Daten und schreibt sie direkt in IndexedDB */
async function fillDatabase(page: Page) {
  return page.evaluate(async () => {
    const NOW = '2026-07-01T10:00:00.000Z'
    let seed = 42
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const pad = (n: number, w = 2) => String(n).padStart(w, '0')
    const day = (iso: string, add: number) => {
      const d = new Date(iso + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() + add)
      return d.toISOString().slice(0, 10)
    }

    // Einige verschiedene Fotos (wie von der App verkleinert: 2048 bzw. 480 Pixel lange Kante)
    async function jpeg(w: number, h: number, hue: number) {
      const c = new OffscreenCanvas(w, h)
      const g = c.getContext('2d')!
      const grad = g.createLinearGradient(0, 0, w, h)
      grad.addColorStop(0, `hsl(${hue},60%,70%)`)
      grad.addColorStop(1, `hsl(${(hue + 80) % 360},50%,30%)`)
      g.fillStyle = grad
      g.fillRect(0, 0, w, h)
      // Rauschen, damit die Dateigröße echten Fotos ähnelt
      const step = Math.max(2, Math.round(w / 300))
      for (let y = 0; y < h; y += step)
        for (let x = 0; x < w; x += step) {
          g.fillStyle = `rgba(${(rnd() * 255) | 0},${(rnd() * 255) | 0},${(rnd() * 255) | 0},0.25)`
          g.fillRect(x, y, step, step)
        }
      return c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
    }
    const variants: { full: Blob; thumb: Blob }[] = []
    for (let v = 0; v < 6; v++) variants.push({ full: await jpeg(2048, 1536, v * 60), thumb: await jpeg(480, 360, v * 60) })
  
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('nix-wie-weg')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const counts: Record<string, number> = {}
    // Je Reise schreiben, damit nicht alles gleichzeitig im Speicher liegt
    const flush = async (table: string, list: object[]) => {
      counts[table] = (counts[table] ?? 0) + list.length
      const chunk = table === 'photos' ? 10 : 100
      for (let s = 0; s < list.length; s += chunk)
        await new Promise<void>((res, rej) => {
          const tx = db.transaction(table, 'readwrite')
          for (const x of list.slice(s, s + chunk)) tx.objectStore(table).put(x)
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
    }
    const trips: object[] = []
    let rows: Record<string, object[]> = {}
    const countries = ['AT', 'IT', 'FR', 'ES', 'HR', 'CH', 'NO', 'PT', 'GR', 'DE']
    const cats = ['natur', 'kultur', 'essen', 'aktiv', 'sonstiges']
    let photoBudget = 1100 - 150

    for (let i = 0; i < 80; i++) {
      rows = { activities: [], accommodations: [], places: [], journalEntries: [], photos: [], routes: [], expenses: [], packingItems: [] }
      const id = `L${pad(i)}`
      const big = i === 0
      const year = 2018 + Math.floor(i / 10)
      const start = big ? '2026-06-01' : `${year}-${pad(1 + (i % 12))}-${pad(1 + ((i * 7) % 20))}`
      const days = big ? 20 : 3 + (i % 10)
      const end = day(start, days - 1)
      const lat0 = 44 + rnd() * 8
      const lon0 = 6 + rnd() * 10
      trips.push({
        id, title: big ? 'Große Testreise' : `Testreise ${i}`, destination: `Ort ${i}`, countries: [countries[i % countries.length]],
        startDate: start, endDate: end, travelers: 2, participants: ['Marco', 'Birgit'], budget: 3000, currency: 'EUR',
        transport: 'auto', notes: '', archived: !big && year < 2024, createdAt: NOW, updatedAt: NOW
      })
      const nAct = big ? 160 : 38 + (i <= 38 ? 1 : 0) // zusammen 3200
      for (let a = 0; a < nAct; a++)
        rows.activities.push({
          id: `${id}-x${a}`, tripId: id, title: `Unternehmung ${a}`, category: cats[a % cats.length], place: `Ort ${a}`, url: '', setting: 'aussen',
          priority: 1 + (a % 3), durationHours: 2, pricePerPerson: 12, currency: 'EUR', openingHours: '', bookingRequired: false,
          status: a % 3 ? 'erledigt' : 'geplant', plannedDate: day(start, a % days), notes: 'Notiz '.repeat(10), createdAt: NOW, updatedAt: NOW
        })
      for (let k = 0; k < 2; k++) {
        const aid = `${id}-a${k}`
        rows.accommodations.push({
          id: aid, tripId: id, name: `Hotel ${i}/${k}`, type: 'hotel', address: `Straße ${k}`, url: '', checkIn: day(start, k * Math.floor(days / 2)),
          checkOut: day(start, k ? days - 1 : Math.floor(days / 2)), price: 400, currency: 'EUR', status: 'gebucht', bookingRef: `BK-${i}${k}`,
          cancelUntil: '', notes: '', createdAt: NOW, updatedAt: NOW
        })
        rows.places.push({ id: `accommodation:${aid}`, tripId: id, kind: 'accommodation', refId: aid, lat: lat0 + k * 0.05, lon: lon0, label: 'Ort', updatedAt: NOW })
      }
      for (let e = 0; e < 25; e++)
        rows.expenses.push({
          id: `${id}-e${e}`, tripId: id, date: day(start, e % days), amount: 10 + e, currency: 'EUR', rate: 1, category: 'essen',
          description: `Ausgabe ${e}`, paidBy: e % 2 ? 'Marco' : 'Birgit', splitAmong: [], receipt: null, createdAt: NOW, updatedAt: NOW
        })
      for (let p = 0; p < 50; p++)
        rows.packingItems.push({
          id: `${id}-p${p}`, tripId: id, name: `Ding ${p}`, category: 'kleidung', quantity: 1, person: '', packed: p % 2 === 0,
          essential: false, notes: '', createdAt: NOW, updatedAt: NOW
        })
      // Tagebuch mit Fotos
      const nEntries = big ? 20 : 6
      let nPhotos = big ? 150 : Math.min(photoBudget, i === 79 ? photoBudget : 12)
      if (!big) photoBudget -= nPhotos
      for (let j = 0; j < nEntries; j++) {
        const eid = `${id}-j${j}`
        const per = Math.floor(nPhotos / (nEntries - j))
        nPhotos -= per
        const photoIds: string[] = []
        for (let f = 0; f < per; f++) {
          const pid = `${eid}-f${f}`
          photoIds.push(pid)
          const v = variants[(i + j + f) % variants.length]
          rows.photos.push({
            id: pid, tripId: id, entryId: eid, full: v.full, thumb: v.thumb, width: 2048, height: 1536, caption: `Foto ${f}`,
            takenAt: `${day(start, j % days)}T1${f % 10}:00:00.000Z`, createdAt: NOW, updatedAt: NOW
          })
        }
        rows.journalEntries.push({
          id: eid, tripId: id, date: day(start, j % days), title: `Tag ${j + 1}`, text: 'Heute war ein schöner Tag. '.repeat(40),
          mood: 4, location: `Ort ${j}`, highlight: j % 3 === 0, photoIds, createdAt: NOW, updatedAt: NOW
        })
      }
      // Routen
      const nRoutes = big ? 12 : 2 + (i <= 70 ? 1 : 0) // zusammen 240
      for (let r = 0; r < nRoutes; r++) {
        const pts: [number, number, number, number][] = []
        let la = lat0 + rnd() * 0.1, lo = lon0 + rnd() * 0.1, ele = 800
        const t0 = Date.parse(start) / 1000
        for (let k = 0; k < 4000; k++) {
          la += (rnd() - 0.45) * 0.0004
          lo += (rnd() - 0.45) * 0.0004
          ele += (rnd() - 0.5) * 6
          pts.push([+la.toFixed(6), +lo.toFixed(6), +ele.toFixed(1), t0 + k * 5])
        }
        const gpx = '<?xml version="1.0"?><gpx><trk><trkseg>' +
          pts.map((p) => `<trkpt lat="${p[0]}" lon="${p[1]}"><ele>${p[2]}</ele><time>${new Date(p[3] * 1000).toISOString()}</time></trkpt>`).join('') +
          '</trkseg></trk></gpx>'
        const stored = pts.filter((_, k) => k % 2 === 0)
        rows.routes.push({
          id: `${id}-r${r}`, tripId: id, name: `Tour ${r}`, kind: 'track', color: '#e11d48', date: day(start, r % days), notes: '',
          showInShare: r % 2 === 0, points: stored, preview: stored.filter((_, k) => k % 5 === 0).map((p) => [p[0], p[1], p[2]]),
          stats: { distance: 8000 + r * 500, ascent: 400 + r * 10, descent: 400, minEle: 700, maxEle: 1200, start: t0, end: t0 + 20000, duration: 20000 },
          format: 'gpx', filename: `tour${r}.gpx`, original: new Blob([gpx], { type: 'application/gpx+xml' }), createdAt: NOW, updatedAt: NOW
        })
      }
      for (const [table, list] of Object.entries(rows)) await flush(table, list)
    }
    await flush('trips', trips)
    db.close()
    return counts
  })
}

/** Beobachter, die schon vor der App starten: letzte DOM-Änderung, lange Aufgaben */
const PROBE = () => {
  const w = window as unknown as { __nww: { last: number; long: number; longMax: number } }
  w.__nww = { last: 0, long: 0, longMax: 0 }
  new MutationObserver(() => (w.__nww.last = performance.now())).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        w.__nww.long += e.duration
        w.__nww.longMax = Math.max(w.__nww.longMax, e.duration)
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch { /* ältere Browser */ }
}

interface Messung { seite: string; ms: number; blockiertMs: number; laengsteMs: number; heapMB: number; dom: number }

/** Seite frisch laden und warten, bis sich 1,5 s lang nichts mehr ändert */
async function measure(page: Page, seite: string, hash: string, ready: string): Promise<Messung> {
  await page.goto('/leer.html') // sonst ändert sich nur der #-Teil und die Seite wird nicht neu geladen
  await page.goto('/' + hash)
  await page.locator(ready).first().waitFor({ timeout: 120_000 })
  await page.waitForFunction(() => {
    const w = window as unknown as { __nww: { last: number } }
    return performance.now() - w.__nww.last > 1500
  }, undefined, { timeout: 120_000, polling: 200 })
  return page.evaluate((seite) => {
    const w = window as unknown as { __nww: { last: number; long: number; longMax: number } }
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return {
      seite, ms: Math.round(w.__nww.last), blockiertMs: Math.round(w.__nww.long), laengsteMs: Math.round(w.__nww.longMax),
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e6) : 0, dom: document.getElementsByTagName('*').length
    }
  }, seite)
}

test('Lasttest: viele Reisen, Fotos und Routen', async ({ baseURL }) => {
  test.setTimeout(30 * 60_000)
  // Eigenes Browserprofil auf der Platte: im üblichen (flüchtigen) Testprofil liegt IndexedDB komplett
  // im Arbeitsspeicher und bleibt bei einigen hundert MB Fotos einfach stehen
  const profile = mkdtempSync(join(tmpdir(), 'nww-last-'))
  const context = await chromium.launchPersistentContext(profile, {
    baseURL, locale: 'de-DE', timezoneId: 'Europe/Berlin', serviceWorkers: 'block', viewport: { width: 1000, height: 1200 },
    args: ['--enable-precise-memory-info']
  })
  const page = context.pages()[0] ?? (await context.newPage())
  try {
  for (const host of ['tile.openstreetmap.org', 'api.open-meteo.com', 'archive-api.open-meteo.com', 'nominatim.openstreetmap.org', 'api.frankfurter.app'])
    await page.route(`https://${host}/**`, (r) => r.abort())
  await page.goto('/#/trip')
  await page.waitForFunction(() => document.querySelector('#app')?.children.length)
  await page.waitForTimeout(1000)
  // Daten auf einer ruhigen Seite derselben Herkunft schreiben – die App selbst läuft dabei nicht
  await page.route('**/leer.html', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>leer</title>' }))
  await page.goto('/leer.html')
  const logConsole = (m: { type(): string; text(): string }) => m.type() === 'error' && console.log('Browser-Fehler:', m.text().slice(0, 300))
  page.on('console', logConsole)
  const t = Date.now()
  const counts = await fillDatabase(page)
  console.log('Daten erzeugt in', Math.round((Date.now() - t) / 1000), 's:', JSON.stringify(counts))
  await page.addInitScript(PROBE)

  const pages: [string, string, string][] = [
    ['Reiseliste', '#/trip', 'text=Große Testreise'],
    ['Reise (groß)', '#/trip/L00', 'h1'],
    ['Tagebuch (150 Fotos)', '#/trip/L00/tagebuch', 'text=Tag 20'],
    ['Routen (12)', '#/trip/L00/routen', 'text=Tour 11'],
    ['Statistik', '#/statistik', 'text=Unsere Reisen in Zahlen'],
    ['Bericht', '#/trip/L00/bericht', 'text=Tag 20'],
    ['Karte', '#/trip/L00/karte', '.leaflet-container'],
    ['Unternehmungen (160)', '#/trip/L00/unternehmungen', 'h1'],
    ['Heute', '#/heute', '#app main, #app h2']
  ]
  // Langsameres Gerät nachstellen (Standard: 4× langsamer als dieser Rechner, ungefähr ein älteres iPad/Handy)
  const cpu = Number(process.env.NWW_LAST_CPU ?? 4)
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  console.log('CPU gebremst:', cpu + '×')
  const results: Messung[] = []
  for (const [name, hash, ready] of pages) {
    // zweimal: das erste Laden wärmt Browser-Caches an, gezählt wird das zweite
    await measure(page, name, hash, ready)
    const m = await measure(page, name, hash, ready)
    console.log(JSON.stringify(m))
    results.push(m)
  }

  // Arbeit im Hintergrund nach dem Start (Aufräumarbeiten der Module laufen erst nach einigen Sekunden)
  await page.goto('/leer.html')
  await page.goto('/#/trip')
  await page.getByText('Große Testreise').waitFor()
  await page.waitForTimeout(15_000)
  const bg = await page.evaluate(() => (window as unknown as { __nww: { long: number; longMax: number } }).__nww)
  console.log(JSON.stringify({ hintergrund15s: { blockiertMs: Math.round(bg.long), laengsteMs: Math.round(bg.longMax) } }))

  // Sicherung mit allen Fotos exportieren und wieder einlesen
  const backup: Record<string, unknown> = {}
  await page.goto('/#/einstellungen')
  await page.locator('#photos').check()
  let t1 = Date.now()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15 * 60_000 }).catch(() => null),
    page.getByRole('button', { name: 'Backup exportieren' }).click()
  ])
  const alert = await page.locator('.alert').first().textContent({ timeout: 5000 }).catch(() => '')
  backup.exportMs = Date.now() - t1
  backup.exportMeldung = alert?.trim()
  if (download) {
    const file = (await download.path())!
    const { statSync } = await import('node:fs')
    backup.exportMB = Math.round(statSync(file).size / 1e6)
    await page.goto('/leer.html')
    await page.goto('/#/einstellungen')
    t1 = Date.now()
    await page.locator('input[type=file][accept="application/json"]').setInputFiles(file)
    const done = page.locator('.alert')
    await done.first().waitFor({ timeout: 15 * 60_000 })
    backup.importMs = Date.now() - t1
    backup.importMeldung = (await done.first().textContent())?.trim()
  }
  console.log(JSON.stringify({ sicherung: backup }))

  console.table(results)
  page.off('console', logConsole)
  writeFileSync('test-results/last.json', JSON.stringify({ cpu, counts, results, hintergrund: bg, sicherung: backup }, null, 2))
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})
