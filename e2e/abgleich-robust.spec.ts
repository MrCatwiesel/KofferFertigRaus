import { expect, test } from '@playwright/test'
import { KEY, NOW, connect, route } from './helpers'

// Aus der Code-Durchsicht: ein einzelner kaputter Eintrag darf den Abgleich nicht anhalten
test('Abgleich läuft weiter bei fehlender oder zu großer Datei', async ({ page, baseURL, request }) => {
  // Auf dem Server: Reise mit einem Foto, dessen Datei fehlt (z. B. Sicherung ohne Fotos zurückgespielt)
  const ghost = { __blobRef: 'f'.repeat(64), type: 'image/jpeg' }
  const r = await request.post(`${baseURL}/api/push`, {
    headers: { Authorization: `Bearer ${KEY}` },
    data: {
      changes: [
        { tbl: 'trips', id: 'robust', stamp: NOW, data: { id: 'robust', title: 'Robust-Reise', destination: 'Irgendwo', startDate: '2026-08-01', endDate: '2026-08-03', travelers: 2, participants: [], budget: null, currency: 'EUR', transport: 'auto', notes: '', createdAt: NOW, updatedAt: NOW } },
        { tbl: 'photos', id: 'geist', stamp: NOW, data: { id: 'geist', tripId: 'robust', entryId: 'x', full: ghost, thumb: ghost, width: 10, height: 10, caption: 'Geisterfoto', takenAt: NOW, createdAt: NOW } }
      ]
    }
  })
  expect(r.ok()).toBe(true)

  await connect(page, KEY, 'iPad Robust')
  await page.getByRole('button', { name: 'Jetzt' }).click()
  await expect(page.locator('.alert-warning')).toContainText('Datei fehlt auf dem Server')
  await page.goto('/#/trip')
  await expect(page.getByText('Robust-Reise')).toBeVisible()

  // Hier: Route mit riesiger Originaldatei (31 MB) – wird ohne die Datei abgeglichen, alles andere geht hoch
  await page.evaluate(
    (rt) =>
      new Promise<void>((resolve) => {
        const o = indexedDB.open('nix-wie-weg')
        o.onsuccess = () => {
          const tx = o.result.transaction(['routes', 'outbox'], 'readwrite')
          const original = new Blob([new Uint8Array(31 * 1024 * 1024)], { type: 'application/gpx+xml' })
          tx.objectStore('routes').put({ ...rt, original })
          tx.objectStore('outbox').put({ key: `routes\u0001${rt.id}`, tbl: 'routes', id: rt.id, at: rt.updatedAt })
          tx.oncomplete = () => resolve()
        }
      }),
    route({ id: 'riesig', tripId: 'robust', name: 'Riesenroute', updatedAt: '2026-08-02T10:00:00.000Z' })
  )
  await page.goto('/#/abgleich')
  await page.getByRole('button', { name: 'Jetzt' }).click()
  await expect(page.locator('.alert-warning')).toContainText('Riesenroute')
  await expect(page.locator('.alert-warning')).toContainText('Datei zu groß')
  // Die Route selbst (ohne Datei) ist auf dem Server angekommen
  const pulled = await (await request.get(`${baseURL}/api/pull?since=0&limit=1000`, { headers: { Authorization: `Bearer ${KEY}` } })).json()
  const rec = pulled.changes.find((c: { id: string }) => c.id === 'riesig')
  expect(rec?.data?.name).toBe('Riesenroute')
  expect(rec?.data?.original).toBeNull()
})
