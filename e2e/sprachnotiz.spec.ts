import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test.use({ permissions: ['microphone'] })

test('Sprachnotizen: aufnehmen, benennen, speichern, anhören, löschen', async ({ page }) => {
  await seed(page, { trips: [trip()] })
  await page.reload()

  await page.goto('/#/trip/t1/tagebuch/neu?tag=2026-07-02')
  await page.locator('#title').fill('Am Pass')
  await page.locator('[data-start-recording]').click()
  await expect(page.locator('[data-recording]')).toBeVisible()
  await page.waitForTimeout(1600)
  await page.locator('[data-stop-recording]').click()
  await expect(page.locator('[data-voice-item]')).toHaveCount(1)
  await page.getByLabel('Titel der Sprachnotiz 1').fill('Murmeltiere')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/tagebuch$/)

  // gespeichert: echte Tondaten, Länge, Titel; in der Liste abspielbar
  const saved = await page.evaluate(
    () =>
      new Promise<{ title: string; duration: number; size: number; type: string; entryId: string }[]>((resolve) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const q = r.result.transaction('voiceNotes').objectStore('voiceNotes').getAll()
          q.onsuccess = () => resolve(q.result.map((v) => ({ title: v.title, duration: v.duration, size: v.audio.size, type: v.audio.type, entryId: v.entryId })))
        }
      })
  )
  expect(saved).toHaveLength(1)
  expect(saved[0].title).toBe('Murmeltiere')
  expect(saved[0].duration).toBeGreaterThan(1)
  expect(saved[0].size).toBeGreaterThan(1000)
  expect(saved[0].type).toMatch(/^audio\//)
  const row = page.locator('[data-voice-row]')
  await expect(row).toContainText('Murmeltiere')
  const playable = await row.locator('audio').evaluate(
    (a: HTMLAudioElement) =>
      new Promise<number>((resolve) => {
        a.preload = 'metadata'
        a.onloadedmetadata = () => resolve(a.duration)
        a.onerror = () => resolve(-1)
        a.load()
      })
  )
  expect(playable).not.toBe(-1)

  // Bearbeiten: vorhandene Notiz wird geladen und lässt sich löschen
  await page.locator('article.card').getByRole('link').first().click()
  await expect(page.locator('[data-voice-item]')).toHaveCount(1)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Sprachnotiz 1 löschen' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/tagebuch$/)
  await expect(page.locator('[data-voice-row]')).toHaveCount(0)
})
