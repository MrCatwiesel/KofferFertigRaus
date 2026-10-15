import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Sprachführer: Sprachen der Reise, Allergie-Karte, Groß zeigen, andere Sprache', async ({ page }) => {
  await seed(page, { trips: [trip({ countries: ['IT', 'HR'], transit: ['AT'] })] })
  await page.goto('/#/trip/t1/sprachfuehrer')

  // Italienisch und Kroatisch – Deutsch (Österreich) nicht, das ist die Sprache der App
  await expect(page.locator('[data-lang]')).toHaveText([/Italienisch/, /Kroatisch/])
  await expect(page.locator('[data-phrase="bill"]')).toContainText('Il conto, per favore.')
  await expect(page.locator('[data-phrase="bill"]')).toContainText('Die Rechnung, bitte.')
  await page.locator('[data-lang="hr"]').click()
  await expect(page.locator('[data-phrase="bill"]')).toContainText('Račun, molim.')

  // Allergie-Karte
  await page.locator('[data-edit-allergens]').click()
  await page.getByLabel('Erdnüsse').check()
  await page.getByLabel('Gluten').check()
  await expect(page.locator('[data-allergy-text]')).toContainText('Imam alergiju na:')
  await expect(page.locator('[data-allergy-text]')).toContainText('kikiriki, gluten')

  // Eingetippt: bekanntes Wort wird angehakt und übersetzt, unbekanntes kommt in die eigene Liste
  await page.locator('#own-allergen').fill('Muscheln')
  await page.locator('[data-add-allergen]').click()
  await expect(page.locator('[data-add-note]')).toContainText('Weichtiere')
  await expect(page.locator('[data-allergy-text]')).toContainText('mekušci')
  await page.locator('#own-allergen').fill('Koriander')
  await page.locator('#own-allergen').press('Enter')
  await expect(page.locator('[data-own-allergens]')).toContainText('Koriander')
  await expect(page.locator('[data-allergy-text]')).toContainText('Koriander')
  await page.locator('[data-translate="Koriander"]').fill('korijander')
  await expect(page.locator('[data-allergy-text]')).toContainText('korijander')
  await page.locator('[data-lang="it"]').click()
  await expect(page.locator('[data-allergy-text]')).toContainText('arachidi, glutine')
  await expect(page.locator('[data-allergy-text]')).toContainText('Koriander') // auf Italienisch noch nicht übersetzt
  await page.locator('[data-edit-allergens]').click() // Fertig
  await expect(page.locator('[data-untranslated]')).toContainText('Koriander')

  // Groß zeigen und schließen
  await page.locator('[data-show-card]').click()
  await expect(page.locator('[data-big]')).toContainText('Ho un’allergia a:')
  await page.locator('[data-big]').click()
  await expect(page.locator('[data-big]')).toHaveCount(0)
  await page.locator('[data-phrase="help"]').getByRole('button', { name: /Groß zeigen/ }).click()
  await expect(page.locator('[data-big]')).toContainText('Aiuto!')
  await page.getByRole('button', { name: 'Schließen' }).click()

  // Andere Sprache: Griechisch mit Umschrift; Allergien bleiben nach dem Neuladen
  await page.locator('#phrase-lang').selectOption('el')
  await expect(page.locator('[data-phrase="thanks"]')).toContainText('Ευχαριστώ')
  await expect(page.locator('[data-phrase="thanks"]')).toContainText('Efcharistó')
  await page.reload()
  await expect(page.locator('[data-allergy-text]')).toContainText('αράπικα φιστίκια, γλουτένη')
  await page.locator('[data-lang="hr"]').click() // eigene Übersetzung bleibt erhalten
  await expect(page.locator('[data-allergy-text]')).toContainText('korijander')

  // Verweis aus dem Länder-Spickzettel
  await page.goto('/#/trip/t1/laender')
  await page.locator('[data-phrasebook-link]').click()
  await expect(page).toHaveURL(/#\/trip\/t1\/sprachfuehrer/)
})

test.describe('Englisch', () => {
  test.use({ locale: 'en-GB' })
  test('Österreich auf Englisch: deutsche Sätze', async ({ page }) => {
    await seed(page, { trips: [trip({ countries: ['AT'] })] })
    await page.goto('/#/trip/t1/sprachfuehrer')
    await expect(page.locator('[data-lang]')).toHaveText([/German/])
    await expect(page.locator('[data-phrase="bill"]')).toContainText('Die Rechnung, bitte.')
    await expect(page.locator('[data-phrase="bill"]')).toContainText('The bill, please.')
  })
})
