import { expect, test } from '@playwright/test'
import { accommodation, activity, route, seed, trip } from './helpers'

test('Tagebuch-Entwurf aus dem Tag', async ({ page }) => {
  await seed(page, {
    trips: [trip()], // 01.–05.07.2026, Ziel Fusch
    activities: [activity({ status: 'erledigt' }), activity({ id: 'x2', title: 'Zeller See', status: 'geplant', plannedDate: '2026-07-03' })],
    accommodations: [accommodation()],
    routes: [route({ kind: 'track', name: 'Glocknerrunde', date: '2026-07-02' })]
  })
  await page.reload()

  // Leerer Tag in der Tagebuch-Liste → „Entwurf aus dem Tag“
  await page.goto('/#/trip/t1/tagebuch')
  await page.locator('[data-draft-link]').nth(1).click() // Tag 2
  await expect(page.locator('[data-draft-note]')).toContainText('Entwurf eingefügt')
  await expect(page.locator('#title')).toHaveValue('Glocknerrunde')
  await expect(page.locator('#loc')).toHaveValue('Fusch')
  const text = await page.locator('#text').inputValue()
  expect(text).toContain('Unternommen: Hochalpenstraße.')
  expect(text).toContain('Tour „Glocknerrunde“: 5 km, 200 Höhenmeter hinauf')
  expect(text).toContain('Übernachtung in Hotel Lampenhäusl.')

  // Eigene Worte bleiben, zweimal Entwurf fügt nichts doppelt ein
  await page.locator('#text').fill('Was für ein Tag!')
  await page.locator('[data-day-draft]').click()
  await page.locator('[data-day-draft]').click()
  const twice = await page.locator('#text').inputValue()
  expect(twice.startsWith('Was für ein Tag!\n\n')).toBe(true)
  expect(twice.split('Unternommen').length).toBe(2)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('article.card')).toContainText('Glocknerrunde')

  // Tag ohne gespeicherte Daten (letzter Tag nach Abreise)
  await page.goto('/#/trip/t1/tagebuch/neu?tag=2026-07-05')
  await page.locator('[data-day-draft]').click()
  await expect(page.locator('[data-draft-note]')).toContainText('noch nichts gespeichert')
  await expect(page.locator('#text')).toHaveValue('')
})
