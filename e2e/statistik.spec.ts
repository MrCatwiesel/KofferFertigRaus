import { expect, test } from '@playwright/test'
import { route, seed, trip } from './helpers'

test('Statistik: Zahlen je Jahr, Länder, Rekorde', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
  await seed(page, {
    trips: [
      trip({ id: 't1', title: 'Großglockner', startDate: '2025-07-01', endDate: '2025-07-05', countries: ['AT'] }),
      trip({ id: 't2', title: 'Gardasee', destination: 'Malcesine', startDate: '2024-06-28', endDate: '2024-07-03', countries: ['IT'] }),
      trip({ id: 't3', title: 'Zukunft', startDate: '2099-01-01', endDate: '2099-01-03' })
    ],
    routes: [route({ id: 'r1', tripId: 't1', name: 'Glocknerrunde', stats: { distance: 47548, ascent: 2025, descent: 0, minEle: 1500, maxEle: 2500, start: null, end: null, duration: null } })],
    places: [{ id: 'accommodation:a1', tripId: 't2', kind: 'accommodation', refId: 'a1', lat: 45.76, lon: 10.81, label: 'Malcesine', updatedAt: '2024-06-01T00:00:00Z' }]
  })
  await page.reload() // Daten wurden an der App vorbei geschrieben
  await page.getByRole('link', { name: 'Statistik' }).click()
  await expect(page.locator('h1')).toHaveText('Unsere Reisen in Zahlen')
  await expect(page.locator('.stat', { hasText: 'Reisen' })).toContainText('2')
  await expect(page.locator('.stat', { hasText: 'Reisetage' })).toContainText('11')
  await expect(page.locator('body')).toContainText('Dazu 1 geplante Reise')
  await expect(page.locator('body')).toContainText('Österreich')
  await expect(page.locator('body')).toContainText('Italien')
  await expect(page.locator('body')).toContainText('Längste Tour: Glocknerrunde (48 km, Großglockner)')
  await expect(page.locator('.leaflet-interactive')).toHaveCount(2)
  await page.getByRole('button', { name: '2024' }).click()
  await expect(page.locator('.stat', { hasText: 'Reise' }).first()).toContainText('1')
  await expect(page.locator('body')).not.toContainText('Österreich')
})
