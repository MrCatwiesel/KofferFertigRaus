import { expect, test } from '@playwright/test'
import { KEY, connect, seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  await connect(page, KEY, 'iPad Marco')
  await seed(page, { trips: [trip({ destination: 'Fusch, Österreich' })] })
})

test('Zielland angeben → Reisehinweise und Einträge in der Dokumentenliste', async ({ page }) => {
  await page.goto('/#/trip/t1/bearbeiten')
  // Aus dem Reiseziel erkannt
  await page.getByRole('button', { name: /Österreich hinzufügen/ }).click()
  await expect(page.getByRole('button', { name: 'Österreich entfernen' })).toBeVisible()
  // Weiteres Land per Eingabe, dann wieder entfernen
  await page.locator('#country').fill('Schweiz')
  await page.locator('#country').press('Enter')
  await page.getByRole('button', { name: 'Schweiz entfernen' }).click()
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/#\/trip\/t1$/)

  await page.goto('/#/trip/t1/reisehinweise')
  const card = page.locator('.card', { hasText: 'Österreich' }).first()
  await expect(card).toContainText('Keine Reisewarnung')
  await expect(card).toContainText('FSME')
  await card.locator('summary', { hasText: 'Gesundheit' }).click()
  await expect(card).toContainText('Als Reiseimpfung wird eine Impfung gegen FSME empfohlen.')

  await page.goto('/#/trip/t1/dokumente')
  await expect(page.locator('body')).toContainText('Einreise Österreich')
  await expect(page.locator('body')).toContainText('Impfschutz Österreich')
  await expect(page.locator('body')).toContainText('Sicherheitslage Österreich: Keine Reisewarnung')
  // Erneutes Speichern legt keine doppelten Einträge an
  await page.goto('/#/trip/t1/bearbeiten')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/#\/trip\/t1$/)
  await page.goto('/#/trip/t1/dokumente')
  await expect(page.getByText('Impfschutz Österreich')).toHaveCount(1)
})
