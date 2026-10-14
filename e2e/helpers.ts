import type { Page } from '@playwright/test'

export const KEY = 'klicktest-schluessel-1234567890'
export const KEY2 = 'klicktest-personen-0987654321'
export const KEY3 = 'klicktest-push-1122334455'
export const NOW = '2026-07-01T10:00:00.000Z'

/** Heutiges Datum (+ Tage) so, wie die App im Testbrowser es sieht – dort gilt Europe/Berlin (playwright.config.ts),
 *  auf GitHub läuft der Testprozess dagegen in UTC: zwischen Mitternacht und 2 Uhr wären das verschiedene Tage */
export const localDate = (days = 0) => new Date(Date.now() + days * 86400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })

/** Datensätze direkt in die App-Datenbank schreiben (an der App vorbei, ohne Abgleich) */
export async function seed(page: Page, data: Record<string, object[]>) {
  await page.goto('/#/trip')
  await page.waitForFunction(() => document.querySelector('#app')?.children.length)
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const tx = r.result.transaction(Object.keys(rows), 'readwrite')
          for (const [t, list] of Object.entries(rows)) for (const x of list) tx.objectStore(t).put(x)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    data
  )
}

export const trip = (over: object = {}) => ({
  id: 't1', title: 'Großglockner', destination: 'Fusch', startDate: '2026-07-01', endDate: '2026-07-05', travelers: 2,
  participants: ['Marco', 'Birgit'], budget: null, currency: 'EUR', transport: 'auto', notes: '', createdAt: NOW, updatedAt: NOW, ...over
})

export const activity = (over: object = {}) => ({
  id: 'x1', tripId: 't1', title: 'Hochalpenstraße', category: 'natur', place: '', url: '', setting: 'aussen', priority: 1,
  durationHours: null, pricePerPerson: null, currency: 'EUR', openingHours: '', bookingRequired: false, status: 'geplant',
  plannedDate: '2026-07-02', notes: '', createdAt: NOW, updatedAt: NOW, ...over
})

export const accommodation = (over: object = {}) => ({
  id: 'a1', tripId: 't1', name: 'Hotel Lampenhäusl', type: 'hotel', address: 'Fusch 12', url: 'https://hotel.example', checkIn: '2026-07-01',
  checkOut: '2026-07-04', price: 777.77, currency: 'EUR', status: 'gebucht', bookingRef: 'BK-4711', cancelUntil: '', notes: 'geheim',
  createdAt: NOW, updatedAt: NOW, ...over
})

/** Eine einfache Route (40 Punkte, schräg durch das Glocknergebiet) */
export const route = (over: object = {}) => {
  const pts = Array.from({ length: 40 }, (_, i) => [47.05 + i * 0.001, 12.8 - i * 0.0015, 1500 + i * 5, null])
  return {
    id: 'r1', tripId: 't1', name: 'Testrunde', kind: 'route', color: '#e11d48', date: '', notes: '', showInShare: false, points: pts,
    preview: pts.map((p) => p.slice(0, 3)), stats: { distance: 5000, ascent: 200, descent: 0, minEle: 1500, maxEle: 1700, start: null, end: null, duration: null },
    format: 'gpx', filename: 't.gpx', original: null, createdAt: NOW, updatedAt: NOW, ...over
  }
}

/** Mit dem Abgleich-Server verbinden (Gruppenschlüssel oder Einladungscode) */
export async function connect(page: Page, secret: string, name: string, query = '') {
  await page.goto(`/#/abgleich${query}`)
  await page.locator('#key').fill(secret)
  await page.locator('#devname').fill(name)
  await page.getByRole('button', { name: 'Verbinden' }).click()
  await page.getByText('Angemeldete Geräte').waitFor()
}
