import { expect, test } from '@playwright/test'
import { route, seed, trip } from './helpers'

test('Reisebericht: Seiten, Optionen, Drucken', async ({ page }) => {
  await seed(page, {
    trips: [trip({ countries: ['AT'] })],
    journalEntries: [
      { id: 'e1', tripId: 't1', date: '2026-07-02', title: 'Hochalpenstraße', text: 'Traumwetter.\n\nAbends Kaiserschmarrn.', mood: 5, location: 'Fusch', highlight: true, photoIds: [], createdAt: '2026-07-02T18:00:00Z', updatedAt: '2026-07-02T18:00:00Z' },
      { id: 'e2', tripId: 't1', date: '2026-07-03', title: 'Ruhetag', text: 'Lesen am See.', mood: 3, location: '', highlight: false, photoIds: [], createdAt: '2026-07-03T18:00:00Z', updatedAt: '2026-07-03T18:00:00Z' }
    ],
    routes: [route({ date: '2026-07-02' })]
  })
  await page.goto('/#/trip/t1?bereich=danach')
  await page.locator('.nww-tile[data-section=report]').click()
  const report = page.locator('article.report')
  await expect(report.locator('.r-title')).toHaveText('Großglockner')
  await expect(report).toContainText('Tag 2')
  await expect(report).toContainText('Abends Kaiserschmarrn.')
  await expect(report).toContainText('Testrunde')
  await expect(report.locator('.r-map svg path')).not.toHaveCount(0)
  await expect(report).toContainText('Ruhetag')
  await page.getByLabel('nur Höhepunkte').check()
  await expect(report).not.toContainText('Ruhetag')

  // Drucken öffnet den Druckdialog des Geräts
  await page.evaluate(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => void ((window as unknown as { printed: number }).printed += 1)
  })
  await page.getByRole('button', { name: /Drucken/ }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
})
