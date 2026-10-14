import { expect, test } from '@playwright/test'
import { KEY, NOW, accommodation, connect, localDate, seed, trip } from './helpers'

// Klicktest-Server: MeteoAlarm nachgebaut (e2e/fixtures/meteoalarm-*.xml) – Orange-Gewitter in Tirol, Gelb-Hitze in Wien
test('Unwetter: Warnung am Ort der Unterkunft – Seite, Reise-Kachel und Tagesplan', async ({ page }) => {
  await connect(page, KEY, 'iPad Unwetter')
  await seed(page, {
    trips: [trip({ id: 'uw1', title: 'Innsbruck', destination: 'Innsbruck', countries: ['AT'], startDate: localDate(0), endDate: localDate(4) })],
    accommodations: [accommodation({ id: 'uwa', tripId: 'uw1', name: 'Hotel Innsbruck', checkIn: localDate(0), checkOut: localDate(4) })],
    places: [{ id: 'accommodation:uwa', tripId: 'uw1', kind: 'accommodation', refId: 'uwa', lat: 47.2692, lon: 11.4041, label: 'Innsbruck', updatedAt: NOW }]
  })

  await page.goto('/#/trip/uw1/unwetter')
  const card = page.locator('[data-unwetter-warnung]').first()
  await expect(card).toContainText('Orange')
  await expect(card).toContainText('Gewitter')
  await expect(card).toContainText('Tirol')
  await expect(card).toContainText('Unwetterwarnung & Hagel: schwere Gewitter')
  await expect(card).toContainText('Bergtouren meiden')
  await expect(card).toContainText('GeoSphere Austria')
  // Gelb-Regen für „Innsbruck (Stadt)“ (über den Namen zugeordnet), Wien betrifft die Reise nicht
  await expect(page.locator('[data-unwetter-warnung]')).toHaveCount(2)
  await expect(page.locator('body')).not.toContainText('Hitze')
  await page.locator('[data-unwetter-orte] summary').click()
  await expect(page.locator('[data-unwetter-orte]')).toContainText('Warnregion: Tirol / Innsbruck (Stadt)')

  await page.goto('/#/trip/uw1/tagesplan')
  await expect(page.locator('[data-unwetter-hinweis]')).toContainText('Warnstufe Orange: Gewitter')
  await page.locator('[data-unwetter-hinweis]').click()
  await expect(page).toHaveURL(/#\/trip\/uw1\/unwetter$/)

  await page.goto('/#/trip/uw1')
  await expect(page.locator('body')).toContainText('Orange: Gewitter (Tirol) · 1 weitere')
})

test('Unwetter: Reise ohne Ort und Land → Hinweis, wie man einen Ort angibt', async ({ page }) => {
  await connect(page, KEY, 'iPad Unwetter 2')
  await seed(page, { trips: [trip({ id: 'uw2', destination: '', startDate: localDate(1), endDate: localDate(3) })] })
  await page.goto('/#/trip/uw2/unwetter')
  await expect(page.getByText('Für diese Reise ist noch kein Ort bekannt')).toBeVisible()
})
