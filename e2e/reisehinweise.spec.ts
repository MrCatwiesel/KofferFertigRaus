import { expect, test } from '@playwright/test'
import { KEY, connect, seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  await connect(page, KEY, 'iPad Marco')
  await seed(page, { trips: [trip({ destination: 'Zell am See, Österreich' })] })
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

test('Botschaft in den Notfallnummern, Impfungen in der Reiseapotheke', async ({ page }) => {
  await seed(page, { trips: [trip({ destination: 'Zell am See, Österreich', countries: ['AT'] })] })
  await page.goto('/#/trip/t1/reisehinweise')
  const card = page.locator('.card', { hasText: 'Österreich' }).first()
  await expect(card).toContainText('Deutsche Botschaft Wien')
  await expect(card.getByRole('link', { name: 'Notfall: +43 664 000 1111' })).toHaveAttribute('href', 'tel:+436640001111')
  await card.getByText('Honorarkonsuln (2)').click()
  await expect(card).toContainText('zell@hk-diplo.de')

  await card.getByRole('link', { name: 'Notfallnummern' }).click()
  await expect(page.getByRole('link', { name: 'Deutsche Botschaft Wien', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Deutsche Botschaft Wien – Notfall-Bereitschaft', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Honorarkonsul Zell am See', exact: true })).toBeVisible()
  await expect(page.getByText('Honorarkonsulin Innsbruck')).toHaveCount(0)

  await page.goto('/#/trip/t1/apotheke')
  await page.getByRole('button', { name: /Impfungen/ }).click()
  const advice = page.locator('.card', { hasText: 'Laut Reisehinweisen' })
  await expect(advice).toContainText('FSME')
  await advice.locator('li', { hasText: 'FSME' }).getByRole('button', { name: 'Übernehmen' }).click()
  await expect(advice.locator('li', { hasText: 'FSME' })).toContainText('eingetragen: Prüfen')
  await advice.getByRole('button', { name: 'Alle übernehmen (3)' }).click()
  await expect(advice.getByRole('button', { name: 'Übernehmen' })).toHaveCount(0)
  await expect(page.locator('.stretched-link', { hasText: 'Masern' })).toBeVisible()
})
