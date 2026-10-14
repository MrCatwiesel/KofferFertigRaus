import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Englisch: umschalten in den Einstellungen, Reise, Hilfe und Einführung auf Englisch, zurück auf Deutsch', async ({ page }) => {
  await page.goto('/#/einstellungen')
  await page.locator('#app-lang').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.locator('[data-settings-lang]')).toContainText('English is still a work in progress')
  await expect(page.locator('.bottom-nav, .navbar-nav').first()).toContainText('Trips')

  // Bleibt nach dem Neuladen
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await seed(page, { trips: [trip({ id: 'en1', title: 'Vienna', participants: ['Anna', 'Ben'], transport: 'bahn' })] })
  await page.goto('/#/trip/en1')
  await expect(page.locator('body')).toContainText('Train')
  await expect(page.locator('body')).toContainText('5 days')
  await expect(page.locator('body')).toContainText('01/07/2026')

  await page.goto('/#/hilfe')
  await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible()
  await page.locator('[data-help-search]').fill('thunderstorm')
  await expect(page.locator('[data-help-topic]').first()).toContainText('Severe weather warnings')

  await page.goto('/#/einfuehrung')
  await expect(page.locator('[data-intro] h1')).toHaveText('Welcome to “Nix wie weg”')

  await page.goto('/#/einstellungen')
  await page.locator('#app-lang').selectOption('de')
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible()
})
