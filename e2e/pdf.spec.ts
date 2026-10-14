import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { route, seed, trip } from './helpers'

/** Fotos mit echten Bilddaten direkt in die Datenbank (Blobs gehen nicht über seed) */
async function addPhotos(page: Page, entryId: string, n: number) {
  await page.evaluate(
    async ({ entryId, n }) => {
      const rows = []
      for (let i = 0; i < n; i++) {
        const portrait = i % 3 === 2
        const c = new OffscreenCanvas(portrait ? 900 : 1200, portrait ? 1200 : 900)
        const g = c.getContext('2d')!
        g.fillStyle = `hsl(${i * 47},60%,55%)`
        g.fillRect(0, 0, c.width, c.height)
        g.fillStyle = '#fff'
        g.fillRect(c.width / 2 - 40, c.height / 2 - 40, 80, 80)
        const full = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
        rows.push({
          id: `${entryId}-f${i}`, tripId: 't1', entryId, full, thumb: full, width: c.width, height: c.height, caption: i === 0 ? 'Am Pass' : '',
          takenAt: `2026-07-02T1${i}:00:00Z`, createdAt: '2026-07-02T18:00:00Z', updatedAt: '2026-07-02T18:00:00Z'
        })
      }
      await new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const tx = r.result.transaction('photos', 'readwrite')
          for (const x of rows) tx.objectStore('photos').put(x)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      })
    },
    { entryId, n }
  )
}

/** Seiten (MediaBox) und eingebettete Bilder einer PDF-Datei zählen */
function inspect(path: string) {
  const raw = readFileSync(path).toString('latin1')
  const boxes = [...raw.matchAll(/\/Type \/Page\n[^]*?\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Math.round(+m[1]), Math.round(+m[2])])
  return { head: raw.slice(0, 5), boxes, images: (raw.match(/\/Subtype \/Image/g) ?? []).length }
}

test('Reisebericht und Fotobuch als PDF-Datei', async ({ page }) => {
  test.setTimeout(120_000)
  const ids = Array.from({ length: 6 }, (_, i) => `e1-f${i}`)
  await seed(page, {
    trips: [trip({ countries: ['AT'] })],
    journalEntries: [
      { id: 'e1', tripId: 't1', date: '2026-07-02', title: 'Hochalpenstraße', text: 'Traumwetter.\n\nAbends Kaiserschmarrn.', mood: 5, location: 'Fusch', highlight: true, photoIds: ids, createdAt: '2026-07-02T18:00:00Z', updatedAt: '2026-07-02T18:00:00Z' }
    ],
    routes: [route({ date: '2026-07-02' })]
  })
  await addPhotos(page, 'e1', 6)
  await page.reload()

  await page.goto('/#/trip/t1/bericht')
  await expect(page.locator('article.report .r-title')).toHaveText('Großglockner')

  // 1. Bericht (A4 hoch)
  const [d1] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.locator('[data-make-pdf]').click()
      await page.locator('[data-pdf-ready]').getByRole('button', { name: /Teilen/ }).click()
    })()
  ])
  expect(d1.suggestedFilename()).toBe('grossglockner-bericht.pdf')
  if (process.env.PDF_OUT) await d1.saveAs(process.env.PDF_OUT + '/bericht.pdf')
  const r1 = inspect((await d1.path())!)
  expect(r1.head).toBe('%PDF-')
  expect(r1.boxes.length).toBeGreaterThanOrEqual(3)
  expect(r1.boxes.every(([w, h]) => w === 595 && h === 842)).toBe(true)
  expect(r1.images).toBeGreaterThanOrEqual(6)

  // 2. Fotobuch: Quadrat 21 cm mit Beschnitt, Druckqualität
  await page.getByRole('button', { name: 'Fotobuch', exact: true }).click()
  await page.locator('#r-format').selectOption('quadrat-21')
  await page.getByLabel('3 mm Beschnitt').check()
  await page.getByLabel('Bildqualität').selectOption('druck')
  await expect(page.locator('[data-pdf-ready]')).toHaveCount(0) // Optionen geändert → alte Datei verworfen
  const [d2] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.locator('[data-make-pdf]').click()
      await page.locator('[data-pdf-ready]').getByRole('button', { name: /Teilen/ }).click()
    })()
  ])
  expect(d2.suggestedFilename()).toBe('grossglockner-fotobuch.pdf')
  if (process.env.PDF_OUT) await d2.saveAs(process.env.PDF_OUT + '/fotobuch.pdf')
  const r2 = inspect((await d2.path())!)
  const side = Math.round((216 / 25.4) * 72)
  expect(r2.boxes.every(([w, h]) => w === side && h === side)).toBe(true)
  // Titel, Überblick, Eintrag (+ Fotos), weitere Fotoseiten, Tour
  expect(r2.boxes.length).toBeGreaterThanOrEqual(5)
  expect(r2.images).toBeGreaterThanOrEqual(6)
})
