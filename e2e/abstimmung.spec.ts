import { expect, test } from '@playwright/test'
import { KEY, activity, connect, localDate, seed, trip } from './helpers'

test('Abstimmung: anlegen mit Idee, abstimmen als zwei Personen, Antwort ergänzen, beenden, Gewinner einplanen', async ({ page }) => {
  await connect(page, KEY, 'iPad Abstimmung')
  await seed(page, {
    trips: [trip({ id: 'ab1', title: 'Rom', startDate: localDate(5), endDate: localDate(9) })],
    activities: [activity({ id: 'ab-x', tripId: 'ab1', title: 'Kolosseum', status: 'idee', plannedDate: '' })]
  })
  await page.goto('/#/trip/ab1/abstimmungen')
  await page.locator('#poll-me').selectOption('Marco')

  await page.locator('[data-poll-new]').click()
  await page.locator('#poll-q').fill('Was machen wir am Samstag?')
  await page.locator('#poll-lines').fill('Strand\n\nstrand\nMuseum')
  await page.locator('[data-poll-form] summary').click()
  await page.getByLabel('Kolosseum').check()
  await page.getByRole('button', { name: 'Abstimmung starten' }).click()

  const poll = page.locator('[data-poll]').first()
  await expect(poll.locator('[data-poll-option]')).toHaveCount(3)
  await expect(poll).toContainText('von Marco')
  await poll.locator('[data-poll-option]', { hasText: 'Kolosseum' }).click()
  await expect(poll.locator('[data-poll-status]')).toContainText('1 Stimme · fehlt noch: Birgit')
  // Andere Antwort wählen ersetzt die Stimme
  await poll.locator('[data-poll-option]', { hasText: 'Strand' }).click()
  await expect(poll.locator('[data-poll-option]', { hasText: 'Strand' })).toContainText('Marco')
  await expect(poll.locator('[data-poll-option]', { hasText: 'Kolosseum' })).not.toContainText('Marco')

  // Gleiches Gerät, jetzt als Birgit – plus eine weitere Antwort
  await page.locator('#poll-me').selectOption('Birgit')
  await poll.getByPlaceholder('Weitere Antwort').fill('Vatikan')
  await poll.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(poll.locator('[data-poll-option]')).toHaveCount(4)
  await poll.locator('[data-poll-option]', { hasText: 'Kolosseum' }).click()
  await expect(poll.locator('[data-poll-status]')).toContainText('2 Stimmen · alle haben abgestimmt')

  // Marco wechselt zum Kolosseum → klarer Gewinner
  await page.locator('#poll-me').selectOption('Marco')
  await poll.locator('[data-poll-option]', { hasText: 'Kolosseum' }).click()
  await expect(poll.locator('[data-poll-option]', { hasText: 'Kolosseum' })).toContainText('Birgit, Marco')

  await page.goto('/#/trip/ab1')
  await expect(page.locator('body')).toContainText('1 offen')

  await page.goto('/#/trip/ab1/abstimmungen')
  await poll.locator('[data-poll-close]').click()
  await expect(poll).toContainText('beendet')
  await expect(poll.locator('[data-poll-option]').first()).toBeDisabled()
  await poll.getByRole('button', { name: '„Kolosseum“ einplanen' }).click()
  await expect(poll.getByRole('button', { name: '„Kolosseum“ einplanen' })).toHaveCount(0)
  await page.goto('/#/trip/ab1/unternehmungen')
  await expect(page.locator('body')).toContainText('1 geplant')
})
