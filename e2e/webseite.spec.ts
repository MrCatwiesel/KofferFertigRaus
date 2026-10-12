import { expect, test } from '@playwright/test'
import { NOW, accommodation, activity, seed, trip } from './helpers'

test('Webseite: Auswahlknöpfe, Unterkünfte ohne Preise und Buchungsnummern', async ({ page }) => {
  await seed(page, {
    trips: [trip()],
    accommodations: [accommodation(), accommodation({ id: 'a2', name: 'Alpenhof Idee', status: 'idee' })],
    activities: [activity({ status: 'erledigt' })],
    journalEntries: [{ id: 'j1', tripId: 't1', date: '2026-07-02', title: 'Auf den Glockner', text: 'Traumhaft.', mood: 5, location: 'Franz-Josefs-Höhe', highlight: true, photoIds: [], createdAt: NOW, updatedAt: NOW }]
  })
  await page.goto('/#/trip/t1/webseite')
  const preview = page.frameLocator('iframe.preview')
  await expect(preview.locator('body')).toContainText('Hotel Lampenhäusl')
  await expect(preview.locator('body')).toContainText('3 Nächte')
  await expect(preview.locator('body')).not.toContainText('Alpenhof Idee')
  await expect(preview.locator('body')).not.toContainText('BK-4711')
  await expect(preview.locator('body')).not.toContainText('777')
  await expect(preview.locator('body')).not.toContainText('Fusch 12')
  await expect(preview.locator('body')).not.toContainText('Hochalpenstraße')

  await page.locator('label[for=sec-showActivities]').click()
  await page.getByLabel('Adresse und Link der Unterkünfte zeigen').check()
  await page.locator('label[for=sec-showParticipants]').click()
  await expect(preview.locator('body')).toContainText('Hochalpenstraße')
  await expect(preview.locator('body')).toContainText('Fusch 12')
  await expect(preview.locator('body')).not.toContainText('Birgit')

  await page.locator('label[for=sec-showStays]').click()
  await expect(preview.locator('body')).not.toContainText('Hotel Lampenhäusl')
})
