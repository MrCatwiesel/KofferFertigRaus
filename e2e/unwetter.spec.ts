import { expect, test } from '@playwright/test'
import { KEY, NOW, connect, localDate, seed, trip } from './helpers'

// MeteoAlarm ist im Klicktest-Server nachgebaut (e2e/server.mjs): Gewitter über Fusch (Umriss), Sturm „Zell am See“, Schnee in Tirol
test.beforeEach(async ({ page }) => {
  await connect(page, KEY, 'iPad Marco')
  await seed(page, {
    trips: [trip({ id: 'uw1', title: 'Großglockner', destination: 'Fusch, Österreich', countries: ['AT'], startDate: localDate(0), endDate: localDate(3) })],
    places: [{ id: 'accommodation:uwa', tripId: 'uw1', kind: 'accommodation', refId: 'uwa', lat: 47.23, lon: 12.82, label: 'Fusch an der Großglocknerstraße, Bezirk Zell am See, Salzburg, Österreich', updatedAt: NOW }]
  })
})

test('Warnungen für die Orte der Reise, Region beobachten, ganzes Land, aus', async ({ page }) => {
  await page.goto('/#/trip/uw1/unwetter')
  const cards = page.locator('[data-warning]')
  await expect(cards).toHaveCount(2)
  await expect(cards.nth(0)).toContainText('Gewitter')
  await expect(cards.nth(0)).toContainText('Orange · Gefährlich')
  await expect(cards.nth(0)).toContainText('ein Ort der Reise liegt im Gebiet')
  await expect(cards.nth(0)).toContainText('läuft gerade')
  await expect(cards.nth(1)).toContainText('Sturm')
  await expect(cards.nth(1)).toContainText('Gebiet passt zu einem Ort der Reise')
  await cards.nth(0).getByText('Was ist zu erwarten, was tun?').click()
  await expect(cards.nth(0)).toContainText('Im Haus bleiben.')

  // Schnee in Tirol steht unter „Weitere“ – Region beobachten → zählt dann mit
  const others = page.locator('[data-unwetter-others]')
  await others.locator('summary').click()
  await expect(others).toContainText('Tirol Oberland')
  await others.getByRole('button', { name: /Tirol Oberland beobachten/ }).click()
  await expect(cards).toHaveCount(3)
  await expect(page.locator('[data-watched-regions]')).toContainText('Tirol Oberland')
  await expect(page.locator('[data-warning]', { hasText: 'Schnee und Glätte' })).toContainText('beobachtete Region')
  await page.getByRole('button', { name: 'Tirol Oberland nicht mehr beobachten' }).click()
  await expect(cards).toHaveCount(2)

  // Kurzfassung auf der Reiseseite
  await page.goto('/#/trip/uw1')
  await expect(page.locator('body')).toContainText('2 Warnungen · Orange: Gewitter')
  // Hinweis im Tagesplaner (heute)
  await page.goto(`/#/trip/uw1/tagesplan?tag=${localDate(0)}`)
  await expect(page.locator('[data-warning-banner]')).toContainText('Orange: Gewitter')

  await page.goto('/#/trip/uw1/unwetter')
  await page.getByRole('button', { name: 'Ganzes Land' }).click()
  await expect(cards).toHaveCount(3)
  await page.getByRole('button', { name: 'Aus', exact: true }).click()
  await expect(cards).toHaveCount(0)
  await expect(page.locator('[data-unwetter-settings]')).toContainText('keine Unwetterwarnungen')
})

test('Ohne passende Orte: keine Warnungen, Land ohne MeteoAlarm', async ({ page }) => {
  await seed(page, { trips: [trip({ id: 'uw2', title: 'Wien und Bangkok', destination: 'Wien', countries: ['AT', 'TH'], startDate: localDate(0), endDate: localDate(3) })] })
  await page.goto('/#/trip/uw2/unwetter')
  await expect(page.locator('[data-unwetter-none]')).toContainText('Keine Warnungen für eure Orte')
  await expect(page.locator('[data-unwetter-none]')).toContainText('3 weitere')
  await expect(page.locator('body')).toContainText('Thailand: Für dieses Land gibt es bei MeteoAlarm keine Warnungen.')
})
