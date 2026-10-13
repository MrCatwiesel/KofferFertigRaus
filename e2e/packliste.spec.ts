import { expect, test } from '@playwright/test'
import { localDate, route, seed, trip } from './helpers'

const plus = localDate

test('Packliste: Vorschläge nach Wetter der Vorjahre, Zielland und Routen', async ({ page }) => {
  // Ortssuche und Wetterarchiv (Open-Meteo) nachbauen: kalt und nass
  await page.route('https://geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ name: 'Zermatt', latitude: 46.02, longitude: 7.75, country: 'Schweiz' }] } }))
  let archive = 0
  await page.route('https://archive-api.open-meteo.com/**', (r) => {
    archive++
    const u = new URL(r.request().url())
    const start = u.searchParams.get('start_date')!
    return r.fulfill({
      json: { daily: { time: [start, start, start], weather_code: [61, 3, 71], temperature_2m_max: [9, 12, 4], temperature_2m_min: [1, 2, -1], precipitation_sum: [6, 0, 3], wind_speed_10m_max: [20, 15, 30] } }
    })
  })
  await seed(page, { trips: [trip({ destination: 'Zermatt', countries: ['CH'], startDate: plus(40), endDate: plus(44) })], routes: [route({ stats: { distance: 9000, ascent: 800, descent: 800, minEle: 1600, maxEle: 2900, start: null, end: null, duration: null } })] })
  await page.reload()
  await page.goto('/#/trip/t1/packliste')

  const box = page.locator('[data-packing-suggestions]')
  await expect(box).toContainText('-1 bis 12 °C, Regen an 67 % der Tage, Schnee möglich (so war es dort in den Jahren')
  expect(archive).toBe(3)
  for (const k of ['regenjacke', 'muetze', 'stecker-CH', 'vignette-CH', 'geld-CH', 'roaming-CH', 'wanderschuhe', 'stoecke'])
    await expect(box.locator(`[data-suggestion="${k}"]`)).toBeVisible()
  await expect(box.locator('[data-suggestion="vignette-CH"]')).toContainText('Vignette Schweiz')

  // Ein Vorschlag abwählen, einer ausblenden, Rest übernehmen
  await box.locator('[data-suggestion="schirm"] input').uncheck()
  await box.getByRole('button', { name: 'Datenpaket oder eSIM fürs Handy ausblenden' }).click()
  await box.getByRole('button', { name: /übernehmen/ }).click()

  await expect(page.locator('body')).toContainText('Vignette Schweiz')
  await expect(page.getByRole('checkbox', { name: /^Wanderschuhe / })).toHaveCount(2) // je Person
  await expect(box.locator('[data-suggestion="schirm"]')).toBeVisible() // abgewählt → noch vorgeschlagen
  await expect(box.locator('[data-suggestion="roaming-CH"]')).toHaveCount(0) // ausgeblendet
  await expect(box.locator('[data-suggestion="wanderschuhe"]')).toHaveCount(0) // schon auf der Liste
})
