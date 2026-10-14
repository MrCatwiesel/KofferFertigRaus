import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Einführung beim ersten Start, Hilfe mit Suche und „?“ passend zur Seite', async ({ page }) => {
  await page.goto('/#/trip')
  await page.locator('[data-intro-link]').click()
  await expect(page.locator('[data-intro] h1')).toHaveText('Willkommen bei „Nix wie weg“')
  for (let i = 0; i < 4; i++) await page.locator('[data-intro-next]').click()
  await expect(page.locator('[data-intro] h1')).toContainText('Als App installieren')
  await page.locator('[data-intro-start]').click()
  await expect(page).toHaveURL(/#\/trip\/neu$/)

  // „?“ auf einer Seite → passendes Thema ist offen
  await seed(page, { trips: [trip({ id: 'h1' })] })
  await page.goto('/#/trip/h1/packliste')
  await page.locator('[data-help-link]').click()
  await expect(page).toHaveURL(/#\/hilfe\?von=packing-list$/)
  await expect(page.locator('#hilfe-packliste')).toHaveAttribute('open', '')
  await expect(page.locator('#hilfe-packliste')).toContainText('je Person')
  await expect(page.locator('#hilfe-tagebuch')).not.toHaveAttribute('open', '')

  // Suche
  await page.locator('[data-help-search]').fill('gewitter')
  await expect(page.locator('[data-help-topic]').first()).toContainText('Unwetterwarnungen')
  await page.locator('[data-help-search]').fill('xyzxyz')
  await expect(page.getByText('Nichts gefunden')).toBeVisible()

  // Aus den Einstellungen
  await page.goto('/#/einstellungen')
  await page.locator('[data-settings-help]').click()
  await expect(page.getByRole('heading', { name: 'Hilfe', exact: true })).toBeVisible()
})
