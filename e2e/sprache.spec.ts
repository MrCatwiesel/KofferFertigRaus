import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Englisch: umschalten in den Einstellungen, Reise, Packliste, Ausgaben, Tagebuch, Hilfe und Einführung auf Englisch, zurück auf Deutsch', async ({ page }) => {
  await page.goto('/#/einstellungen')
  await page.locator('#app-lang').selectOption('en')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.locator('.bottom-nav, .navbar-nav').first()).toContainText('Trips')

  // Bleibt nach dem Neuladen
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await seed(page, { trips: [trip({ id: 'en1', title: 'Vienna', participants: ['Anna', 'Ben'], transport: 'bahn' })] })
  await page.goto('/#/trip/en1')
  await expect(page.locator('body')).toContainText('Train')
  await expect(page.locator('body')).toContainText('5 days')
  await expect(page.locator('body')).toContainText('01/07/2026')

  // Weitere Bereiche: Packliste, Ausgaben, Tagebuch, Unwetter
  await page.goto('/#/trip/en1/packliste')
  await expect(page.getByRole('heading', { name: 'Packing list' })).toBeVisible()
  await page.goto('/#/trip/en1/ausgaben')
  await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible()
  await page.goto('/#/trip/en1/tagebuch')
  await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible()

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

test('Englisch automatisch für englischsprachige Geräte', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-GB' })
  const page = await ctx.newPage()
  await page.goto('/#/trip')
  await expect(page.getByRole('heading', { name: 'My trips' })).toBeVisible()
  await expect(page.getByText('Short introduction (1 minute)')).toBeVisible()
  await ctx.close()
})
