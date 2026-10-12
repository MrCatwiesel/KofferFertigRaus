import { expect, test } from '@playwright/test'
import { activity, route, seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  // Kartenkacheln aus dem Internet nicht laden (Test bleibt offline und schnell)
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
  await seed(page, {
    trips: [trip()],
    activities: [activity({ id: 'x1', title: 'Fuscher Törl' }), activity({ id: 'x2', title: 'Gipfelkreuz' }), activity({ id: 'x3', title: 'Parkplatz', place: "N 47° 04.507' E 012° 45.180'" })],
    routes: [route()]
  })
  await page.goto('/#/trip/t1/karte')
})

test('Verorten durch Antippen einer Route (nächster Routenpunkt)', async ({ page }) => {
  await page.locator('.list-group-item', { hasText: 'Fuscher Törl' }).getByRole('button', { name: 'Verorten' }).click()
  await page.getByRole('button', { name: 'Auf der Karte antippen' }).click()
  const hit = page.locator('path.nww-route-hit').first()
  await expect(hit).toBeVisible()
  // Mitte der Linie (etwas daneben) antippen
  const pt = await hit.evaluate((p: SVGPathElement) => {
    const m = p.getPointAtLength(p.getTotalLength() / 2)
    const r = p.getBoundingClientRect()
    const b = p.getBBox()
    return { x: r.left + (m.x - b.x) + 5, y: r.top + (m.y - b.y) + 4 }
  })
  await page.mouse.click(pt.x, pt.y)
  const placed = page.locator('section', { has: page.getByRole('heading', { name: /^Auf der Karte/ }) })
  await expect(placed).toContainText('Fuscher Törl')
  await expect(placed).toContainText(/N 47° 0\d\.\d{3}' E 012° 4\d\.\d{3}'/)
})

test('GPS-Koordinaten eingeben (ohne Internet) und Vorschlag aus dem Ort', async ({ page }) => {
  await page.locator('.list-group-item', { hasText: 'Gipfelkreuz' }).getByRole('button', { name: 'Verorten' }).click()
  const input = page.getByPlaceholder('Adresse, Ort oder GPS-Koordinaten')
  await input.fill("N 47° 04.507' E 012° 45.180'")
  await input.press('Enter')
  await page.getByRole('button', { name: /Koordinaten 47\.07512, 12\.75300/ }).click()
  const placed = page.locator('section', { has: page.getByRole('heading', { name: /^Auf der Karte/ }) })
  await expect(placed).toContainText('Gipfelkreuz')

  // Ort enthält schon Koordinaten → sofort vorgeschlagen; Start der Route übernehmen
  await page.locator('.list-group-item', { hasText: 'Parkplatz' }).getByRole('button', { name: 'Verorten' }).click()
  await expect(page.getByRole('button', { name: /Koordinaten 47\.07512/ })).toBeVisible()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(placed).toContainText("N 47° 03.000' E 012° 48.000'")
})
