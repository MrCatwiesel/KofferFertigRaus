import { expect, test, type Page } from '@playwright/test'

/** Kein echtes Internet für Wetter und Kartenkacheln (in CI wären sie erreichbar) */
async function offlineServices(page: Page) {
  await page.route('https://api.open-meteo.com/**', (r) => r.abort())
  await page.route('https://*.tile.openstreetmap.org/**', (r) => r.abort())
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
}

test.describe('Englisches Gerät', () => {
  test.use({ locale: 'en-GB' })

  test('App, Hilfe und Beispielreise auf Englisch, Wechsel auf Deutsch und zurück', async ({ page }) => {
    await offlineServices(page)
    await page.goto('/#/trip')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toHaveText('My trips')
    await expect(page.locator('[data-welcome]')).toContainText('Welcome!')

    // Beispielreise: Texte in der Sprache der App
    await page.locator('[data-welcome-sample]').click()
    await expect(page).toHaveURL(/#\/trip\/[^/]+$/)
    await expect(page.locator('body')).toContainText('Sample: Lake Garda')
    await expect(page.locator('body')).toContainText('Planning')
    const tripId = page.url().split('/').pop()!
    await page.goto(`/#/trip/${tripId}/packliste`)
    await expect(page.locator('body')).toContainText('Toothbrush & toothpaste')
    await page.goto(`/#/trip/${tripId}/unterkuenfte`)
    await expect(page.locator('body')).toContainText('Holiday flat by the lake')
    await expect(page.locator('body')).toContainText(/\d+ nights/) // Mehrzahl/Einzahl je Sprache

    // Hilfe in der Sprache der App
    await page.locator('[data-help-link]').click()
    await expect(page.locator('[data-help-topic] h1')).toHaveText('Accommodation')
    await page.goto('/#/hilfe')
    await expect(page.locator('body')).toContainText('Getting started')

    // Wechsel auf Deutsch (lädt neu)
    await page.goto('/#/einstellungen')
    await page.locator('#app-language').selectOption('de')
    await expect(page.locator('h1')).toHaveText('Einstellungen')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    // Vorhandene Daten bleiben, wie sie angelegt wurden
    await page.goto('/#/trip')
    await expect(page.locator('h1')).toHaveText('Meine Reisen')
    await expect(page.locator('body')).toContainText('Sample: Lake Garda')

    // Zurück: wie das Gerät (Englisch)
    await page.goto('/#/einstellungen')
    await page.locator('#app-language').selectOption('')
    await expect(page.locator('h1')).toHaveText('Settings')
  })
})

test('Deutsches Gerät bleibt deutsch, Datum und Geld im deutschen Format', async ({ page }) => {
  await offlineServices(page)
  await page.goto('/#/trip')
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('h1')).toHaveText('Meine Reisen')
  await page.goto('/#/einstellungen')
  await expect(page.locator('#app-language')).toHaveValue('')
  await expect(page.locator('[data-language]')).toContainText('Sprache · Language')
})
