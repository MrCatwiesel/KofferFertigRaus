import { expect, test } from '@playwright/test'
import { KEY, connect, seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
  // Höhen (Open-Meteo) nachbauen
  await page.route('https://api.open-meteo.com/v1/elevation**', async (r) => {
    const n = new URL(r.request().url()).searchParams.get('latitude')!.split(',').length
    await r.fulfill({ json: { elevation: Array.from({ length: n }, (_, i) => 1200 + i * 10) } })
  })
  await connect(page, KEY, 'iPad Marco')
  await seed(page, { trips: [trip()] })
})

test('Strecke von A nach B planen und speichern', async ({ page }) => {
  await page.goto('/#/trip/t1/routen')
  await page.getByRole('link', { name: 'Strecke planen' }).click()
  const map = page.locator('.planner-map')
  await expect(map).toBeVisible()
  const box = (await map.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height * 0.4)
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.6)
  await expect(page.locator('.nww-wp')).toHaveCount(2)
  await expect(page.locator('.card', { hasText: 'Dauer ca.' })).toContainText('km')
  await expect(page.locator('#rp-name')).toHaveValue('Start → Ziel')
  await page.locator('#rp-name').fill('Zum Glocknerhaus')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/\/routen\/[^/]+$/)
  await expect(page.locator('body')).toContainText('Zum Glocknerhaus')
  await expect(page.locator('textarea')).toHaveValue(/Geplant mit BRouter \(Wandern\)/)
})

test('Wanderweg im Kartenausschnitt suchen und übernehmen', async ({ page }) => {
  await page.goto('/#/trip/t1/routen/planen?tab=wanderwege')
  await page.getByRole('button', { name: 'Im Ausschnitt suchen' }).click()
  await expect(page.locator('.alert-danger')).toContainText('zu groß')
  for (let i = 0; i < 2; i++) {
    await page.locator('.leaflet-control-zoom-in').click()
    await page.waitForTimeout(600) // Zoom-Animation abwarten
  }
  await page.getByRole('button', { name: 'Im Ausschnitt suchen' }).click()
  const first = page.locator('.trail-list button').first()
  await expect(first).toContainText('Glocknerrunde')
  await expect(first).toContainText('regional · Heiligenblut – Kaprun')
  await first.click()
  await expect(page.getByText(/„Glocknerrunde“ · ca\./)).toBeVisible()
  await expect(page.locator('#rp-name')).toHaveValue('Glocknerrunde (GR)')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/\/routen\/[^/]+$/)
  await expect(page.locator('textarea')).toHaveValue(/Aus OpenStreetMap \(Relation 4711\).*Heiligenblut – Kaprun.*Gehzeit ca\./)
})
