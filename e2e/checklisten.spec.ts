import { expect, test } from '@playwright/test'
import { NOW, accommodation, localDate, seed, trip } from './helpers'

const flight = {
  id: 'l1', tripId: 't1', direction: 'hin', position: 0, mode: 'flug', from: 'NUE', to: 'PMI', date: localDate(5), departTime: '06:40', arriveTime: '09:05',
  distanceKm: null, cost: null, currency: 'EUR', consumption: null, fuelPrice: null, tolls: null, bookingRef: '', url: '', notes: '', createdAt: NOW, updatedAt: NOW
}

test('Abreise-Checklisten: zu Hause, Check-in, Auschecken, Erinnerungen, Übernehmen', async ({ page }) => {
  await seed(page, {
    trips: [trip({ startDate: localDate(5), endDate: localDate(10), transport: 'flug' }), trip({ id: 't2', title: 'Herbst', startDate: localDate(40), endDate: localDate(44) })],
    accommodations: [accommodation({ checkIn: localDate(5), checkOut: localDate(10) })],
    travelLegs: [flight]
  })
  await page.goto('/#/trip/t1/checklisten')

  // Zu Hause: Vorschläge, abhaken, eigener Punkt
  const home = page.locator('[data-checklist="zuhause"]')
  await home.locator('[data-take-suggestions]').click()
  await expect(home.locator('li')).toHaveCount(14)
  await home.getByText('Haustür abschließen').click()
  await expect(home.locator('[data-progress]')).toHaveText('1 von 14')
  await home.getByPlaceholder('Eigener Punkt …').fill('Katze zur Oma bringen')
  await home.getByPlaceholder('Eigener Punkt …').press('Enter')
  await expect(home.locator('li')).toHaveCount(15)
  await home.getByRole('button', { name: 'Heizung herunterdrehen entfernen' }).click()
  await expect(home.locator('li')).toHaveCount(14)
  await home.getByRole('button', { name: /Weitere Vorschläge \(1\)/ }).click()
  await home.getByRole('button', { name: 'Heizung herunterdrehen hinzufügen' }).click()
  await expect(home.locator('li')).toHaveCount(15)

  // Online-Check-in
  const checkin = page.locator('[data-checklist="checkin"]')
  await expect(checkin).toContainText('NUE → PMI')
  await checkin.locator('input[type="checkbox"]').check()

  // Auschecken aus dem Hotel
  const out = page.locator('[data-checklist="auschecken"][data-ref="a1"]')
  await out.locator('[data-take-suggestions]').click()
  await expect(out).toContainText('Safe leeren')
  await expect(out).not.toContainText('Müll entsorgen')

  // Erinnerungen bei den Terminen: Check-in ist erledigt
  await page.goto('/#/trip/t1/termine')
  await expect(page.locator('body')).toContainText('Bevor es losgeht: 14 Punkte offen')
  await expect(page.locator('body')).toContainText('Auschecken: Hotel Lampenhäusl')
  await expect(page.locator('body')).not.toContainText('Online-Check-in: NUE → PMI')

  // Nächste Reise: Liste übernehmen – mit eigenem Punkt, ohne Häkchen
  await page.goto('/#/trip/t2/checklisten')
  const next = page.locator('[data-checklist="zuhause"]')
  await next.locator('[data-take-previous]').click()
  await expect(next.locator('li')).toHaveCount(15)
  await expect(next).toContainText('Katze zur Oma bringen')
  await expect(next.locator('[data-progress]')).toHaveText('0 von 15')
})
