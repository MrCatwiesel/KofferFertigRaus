import { expect, test } from '@playwright/test'
import { activity, localDate, seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  await seed(page, {
    trips: [trip({ participants: ['Marco', 'Birgit', 'Oma'] })],
    activities: [activity({ id: 'x1', title: 'Gletschertour', plannedDate: '', status: 'idee' }), activity({ id: 'x2', title: 'Kaprun Stausee', plannedDate: '', status: 'idee' })]
  })
})

test('Freie Abstimmung: anlegen, abstimmen als verschiedene Teilnehmer, beenden', async ({ page }) => {
  await page.goto('/#/trip/t1/abstimmungen')
  await expect(page.locator('[data-polls-empty]')).toBeVisible()
  await page.locator('[data-new-poll]').click()

  await page.locator('button[type=submit]').click()
  await expect(page.getByText('Bitte eine Frage eingeben.')).toBeVisible()
  await page.locator('#question').fill('Wo essen wir heute?')
  await page.getByLabel('Antwort 1', { exact: true }).fill('Pizzeria')
  await page.getByLabel('Antwort 2', { exact: true }).fill('Almhütte')
  await page.locator('[data-add-option]').click()
  await page.getByLabel('Antwort 3', { exact: true }).fill('Selbst kochen')
  await page.locator('#deadline').fill(localDate(5))
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/#\/trip\/t1\/abstimmungen$/)

  const card = page.locator('[data-poll]')
  await expect(card).toContainText('Wo essen wir heute?')
  await expect(page.getByText('Zum Abstimmen oben deinen Namen wählen.')).toBeVisible()
  await page.locator('#voter').selectOption('Marco')
  await card.locator('[data-option]', { hasText: 'Almhütte' }).click()
  await expect(card.locator('[data-option]', { hasText: 'Almhütte' })).toHaveAttribute('aria-pressed', 'true')
  await expect(card.locator('[data-missing]')).toContainText('noch offen: Birgit, Oma')
  // Andere Antwort ersetzt die erste (nur eine erlaubt)
  await card.locator('[data-option]', { hasText: 'Pizzeria' }).click()
  await expect(card.locator('[data-option]', { hasText: 'Almhütte' }).locator('[data-count]')).toHaveText('0')

  await page.locator('#voter').selectOption('Birgit')
  await card.locator('[data-option]', { hasText: 'Pizzeria' }).click()
  await page.locator('#voter').selectOption('Oma')
  await card.locator('[data-option]', { hasText: 'Almhütte' }).click()
  await expect(card.locator('[data-option]', { hasText: 'Pizzeria' }).locator('[data-count]')).toHaveText('2')
  await expect(card.locator('[data-option]', { hasText: 'Pizzeria' })).toContainText('Marco, Birgit')
  await expect(card).toContainText('3 Stimmen')

  // Frist erscheint bei Termine & Fristen; Kurzfassung auf der Reiseseite
  await page.goto('/#/trip/t1/termine')
  await expect(page.locator('body')).toContainText('Abstimmung endet: Wo essen wir heute?')
  await page.goto('/#/trip/t1')
  await page.getByText('Planung', { exact: true }).click() // Reise liegt zurück → Seite öffnet „Danach“
  await expect(page.locator('body')).toContainText('1 offen')

  await page.goto('/#/trip/t1/abstimmungen')
  await card.getByRole('button', { name: /Mehr zu/ }).click()
  await card.getByRole('button', { name: 'Abstimmung beenden' }).click()
  await expect(card.locator('[data-result]')).toContainText('Ergebnis: Pizzeria')
  await expect(card.locator('[data-option]').first()).toBeDisabled()
})

test('Tag für eine Unternehmung finden und eintragen', async ({ page }) => {
  await page.goto('/#/trip/t1/abstimmungen/neu')
  await page.locator('[data-kind=termin]').click()
  // Die Reisetage stehen schon da (1.–5.7.), mehrere Antworten sind an
  await expect(page.locator('[data-option-row]')).toHaveCount(5)
  await expect(page.locator('#multiple')).toBeChecked()
  await page.locator('#question').fill('Welcher Tag für die Gletschertour?')
  await page.locator('#activity').selectOption({ label: 'Gletschertour' })
  await page.locator('button[type=submit]').click()

  const card = page.locator('[data-poll]')
  await page.locator('#voter').selectOption('Marco')
  await card.locator('[data-option]', { hasText: 'Do 02.07.' }).click()
  await card.locator('[data-option]', { hasText: 'Fr 03.07.' }).click()
  await page.locator('#voter').selectOption('Birgit')
  await card.locator('[data-option]', { hasText: 'Fr 03.07.' }).click()
  await card.getByRole('button', { name: /Mehr zu/ }).click()
  await card.getByRole('button', { name: 'Abstimmung beenden' }).click()
  await expect(card.locator('[data-result]')).toContainText('Fr 03.07.')
  await card.locator('[data-adopt]').click()
  await expect(card.locator('[data-result]')).toContainText('eingetragen')

  await page.goto('/#/trip/t1/unternehmungen')
  await expect(page.locator('body')).toContainText('Gletschertour')
  await page.goto('/#/trip/t1/tagesplan?tag=2026-07-03')
  await expect(page.locator('body')).toContainText('Gletschertour')
})
