import { expect, test } from '@playwright/test'
import { accommodation, connect, KEY, localDate, seed, trip } from './helpers'

const plus = localDate

test('Termine & Fristen: Übersicht, Heute, Kalender-Abo', async ({ page, request }) => {
  // Eigene IDs: andere Klicktests legen t1/a1 auf demselben Server an – deren Stand käme sonst beim Abgleich zurück
  await connect(page, KEY, 'iPad Marco')
  await seed(page, {
    trips: [trip({ id: 'tf1', startDate: plus(20), endDate: plus(25) })],
    accommodations: [accommodation({ id: 'tfa1', tripId: 'tf1', checkIn: plus(20), checkOut: plus(23), cancelUntil: plus(3) })],
    documents: [{ id: 'tfd1', tripId: 'tf1', type: 'reisepass', title: '', person: 'Birgit', number: '', validUntil: plus(22), status: 'vorhanden', hasCopy: false, packed: false, notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' }]
  })

  await page.goto('/#/trip/tf1/termine')
  await expect(page.locator('h2', { hasText: 'Heute' })).toBeVisible()
  await expect(page.locator('[data-reminder="doc:tfd1:verlaengern"]')).toContainText('Verlängern: Reisepass (Birgit)')
  await expect(page.locator('[data-reminder="acc:tfa1:storno"]')).toContainText('Kostenlos stornierbar bis heute: Hotel Lampenhäusl')
  await expect(page.locator('[data-reminder="trip:tf1"]')).toBeVisible()

  // Auf „Heute“ (keine laufende Reise) erscheint, was heute dran ist
  await page.goto('/#/heute')
  await page.reload() // direkt in die Datenbank geschriebene Testdaten: Zwischenspeicher der Abfragen leeren
  await expect(page.locator('[data-due-reminders]')).toContainText('Verlängern: Reisepass')

  // Kalender-Abo einrichten → öffentliche Adresse liefert die Termine
  await page.goto('/#/trip/tf1/termine')
  await page.getByRole('button', { name: 'Kalender-Abo einrichten' }).click()
  const link = page.getByRole('link', { name: 'Im Kalender abonnieren' })
  await expect(link).toHaveAttribute('href', /^webcal:\/\/.+\/api\/kalender\/[\w-]+\.ics$/)
  const https = (await link.getAttribute('href'))!.replace(/^webcal:/, 'http:')
  const res = await request.get(https)
  expect(res.status()).toBe(200)
  const ics = (await res.text()).replace(/\r\n /g, '')
  expect(ics).toContain('SUMMARY:Kostenlos stornierbar bis heute: Hotel Lampenhäusl')
  expect(ics).toContain('SUMMARY:Reise: Großglockner')
  expect(ics).toContain('TRIGGER:-P2D')

  // Abo beenden
  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Abo beenden' }).click()
  await expect(page.getByRole('button', { name: 'Kalender-Abo einrichten' })).toBeVisible()
  expect((await request.get(https)).status()).toBe(404)
})
