import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Stil wählen, Reiseseite in Bereichen, Archiv', async ({ page }) => {
  await seed(page, {
    trips: [
      trip({ id: 't1', title: 'Bald', startDate: '2099-07-01', endDate: '2099-07-05' }),
      trip({ id: 't2', title: 'Vorbei', destination: 'Insel Rügen', startDate: '2020-07-01', endDate: '2020-07-05' })
    ]
  })

  // Stil: Standard Alpin, umschalten auf Retro und dunkel – bleibt nach dem Neuladen
  await page.goto('/#/einstellungen')
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'alpin')
  await page.getByRole('radio', { name: /Retro-Reiseplakat/ }).click()
  await page.getByRole('button', { name: 'Dunkel' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'retro')
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'retro')
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark')

  // Reiseliste in Gruppen
  await page.goto('/#/trip')
  await expect(page.getByText('Geplant', { exact: true })).toBeVisible()
  await expect(page.getByText('Erinnerungen', { exact: true })).toBeVisible()

  // Geplante Reise öffnet „Planung“, Bereiche wechseln
  await page.goto('/#/trip/t1')
  await expect(page.locator('.phase-tab.active')).toContainText('Planung')
  await expect(page.locator('.nww-tile', { hasText: 'Packliste' })).toBeVisible()
  await page.locator('.phase-tab', { hasText: 'Unterwegs' }).click()
  await expect(page).toHaveURL(/bereich=unterwegs/)
  await expect(page.getByRole('link', { name: 'Notfall', exact: true })).toBeVisible()
  await expect(page.locator('.nww-tile', { hasText: 'Packliste' })).toHaveCount(0)
  await page.locator('.phase-tab', { hasText: 'Teilen' }).click()
  await expect(page.locator('.nww-tile', { hasText: 'Reise-Webseite' })).toBeVisible()

  // Vergangene Reise öffnet „Danach“ und lässt sich archivieren
  await page.goto('/#/trip/t2')
  await expect(page.locator('.phase-tab.active')).toContainText('Danach')
  await page.locator('.phase-tab', { hasText: 'Teilen' }).click()
  await page.getByRole('button', { name: 'Ins Archiv legen' }).click()
  await expect(page.getByRole('button', { name: 'Aus dem Archiv holen' })).toBeVisible()
  await page.goto('/#/trip')
  await expect(page.getByText('Erinnerungen', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Archiv \(1\)/ }).click()
  await expect(page.locator('.list-group-item', { hasText: 'Vorbei' })).toBeVisible()
})

test('Titelbild: gezeichnet, eigenes Foto, wieder zurück', async ({ page }) => {
  await seed(page, { trips: [trip()] })
  await page.goto('/#/trip/t1')
  await expect(page.locator('.hero svg.cover-art')).toBeVisible()
  await page.getByRole('link', { name: 'Titelbild ändern' }).click()
  // 1×1-PNG als „Foto“
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').setInputFiles({ name: 'berg.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('#cy')).toBeVisible()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/#\/trip\/t1$/)
  await expect(page.locator('.hero img.trip-cover-img')).toBeVisible()
  await page.getByRole('link', { name: 'Titelbild ändern' }).click()
  await page.getByRole('button', { name: 'Gezeichnete Landschaft' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('.hero svg.cover-art')).toBeVisible()
})
