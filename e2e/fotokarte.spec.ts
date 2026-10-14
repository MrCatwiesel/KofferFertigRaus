import { expect, test, type Page } from '@playwright/test'
import { NOW, route, seed, trip } from './helpers'

const readPhotos = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ id: string; lat?: number; lon?: number; placeSource?: string; takenAt: string }[]>((resolve) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const q = r.result.transaction('photos').objectStore('photos').getAll()
          q.onsuccess = () => resolve(q.result.map(({ id, lat, lon, placeSource, takenAt }) => ({ id, lat, lon, placeSource, takenAt })))
        }
      })
  )

test('Fotos auf der Karte: GPS aus der Datei, aus der Tour geschätzt, von Hand gesetzt', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
  // Tour am 5.10. 12:00–13:00 UTC mit Zeiten; ein vorhandenes Foto ohne Ort um 12:30 UTC
  const t0 = Date.parse('2026-10-05T12:00:00Z') / 1000
  const pts = Array.from({ length: 61 }, (_, i) => [47.3 + i * 0.001, 12.8 + i * 0.001, 1500, t0 + i * 60])
  await seed(page, {
    trips: [trip({ startDate: '2026-10-04', endDate: '2026-10-09' })],
    routes: [route({ kind: 'track', points: pts, preview: pts.map((p) => p.slice(0, 3)), date: '2026-10-05' })],
    journalEntries: [{ id: 'e0', tripId: 't1', date: '2026-10-05', title: 'Wanderung', text: '', mood: 0, location: '', highlight: false, photoIds: ['alt'], createdAt: NOW, updatedAt: NOW }]
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = async () => {
          const c = new OffscreenCanvas(40, 30)
          c.getContext('2d')!.fillRect(0, 0, 40, 30)
          const b = await c.convertToBlob({ type: 'image/jpeg' })
          const tx = r.result.transaction('photos', 'readwrite')
          tx.objectStore('photos').put({ id: 'alt', tripId: 't1', entryId: 'e0', full: b, thumb: b, width: 40, height: 30, caption: 'Unterwegs', takenAt: '2026-10-05T12:30:00.000Z', createdAt: '2026-10-05T18:00:00Z', updatedAt: '2026-10-05T18:00:00Z' })
          tx.oncomplete = () => resolve()
        }
      })
  )
  await page.reload()

  // 1. Neuer Eintrag mit einem Foto mit GPS und einem ohne
  await page.goto('/#/trip/t1/tagebuch/neu')
  await page.locator('#title').fill('Gipfeltag')
  await page.locator('input[type=file][accept="image/*"]').setInputFiles(['e2e/fixtures/foto-gps.jpg', 'e2e/fixtures/foto-ohne-gps.jpg'])
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/tagebuch$/)

  const photos = await readPhotos(page)
  const gps = photos.find((p) => p.lat !== undefined && p.id !== 'alt')
  expect(gps).toMatchObject({ placeSource: 'exif', takenAt: '2026-10-05T12:32:10.000Z' })
  expect(gps!.lat).toBeCloseTo(47.4252, 3)
  expect(gps!.lon).toBeCloseTo(12.9, 3)
  expect(photos.filter((p) => p.lat === undefined)).toHaveLength(2) // ohne GPS + das alte

  // 2. Karte: Foto mit GPS und das alte (aus der Tour geschätzt) – das dritte steht unter „ohne Ort“
  await page.goto('/#/trip/t1/karte')
  await expect(page.locator('[data-photos-toggle]')).toContainText('Fotos (3)')
  await expect(page.locator('[data-unplaced-photos] .photo-pick')).toHaveCount(1)
  await expect(page.locator('.nww-photo')).not.toHaveCount(0)
  const markers = await page.locator('.nww-photo').count()
  // Antippen zeigt die Fotos; das aus der Tour ist als geschätzt gekennzeichnet
  const popups: string[] = []
  for (let i = 0; i < markers; i++) {
    await page.locator('.nww-photo').nth(i).click()
    popups.push((await page.locator('.nww-photo-popup').textContent()) ?? '')
    await page.locator('.leaflet-popup-close-button').click()
  }
  expect(popups.join(' ')).toContain('aus der Tour zur Aufnahmezeit geschätzt')

  // 3. Foto ohne Ort von Hand setzen
  await page.locator('[data-unplaced-photos] .photo-pick').click()
  await expect(page.locator('[data-photo-target]')).toBeVisible()
  const box = (await page.locator('.map').boundingBox())!
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8)
  await expect(page.locator('[data-photo-target]')).toHaveCount(0)
  await expect(page.locator('[data-unplaced-photos]')).toHaveCount(0)
  const after = await readPhotos(page)
  expect(after.filter((p) => p.placeSource === 'karte')).toHaveLength(1)

  // 4. Fotos ausblenden
  await page.locator('[data-photos-toggle]').click()
  await expect(page.locator('.nww-photo')).toHaveCount(0)
})
