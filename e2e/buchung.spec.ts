import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test.beforeEach(async ({ page }) => {
  await seed(page, { trips: [trip({ startDate: '2026-07-03', endDate: '2026-07-10' })] })
})

test('PDF-Bestätigung einer Unterkunft einlesen und übernehmen', async ({ page }) => {
  await page.goto('/#/trip/t1/unterkuenfte')
  await page.getByRole('link', { name: 'Buchung einlesen' }).click()
  await page.getByTestId('booking-file').setInputFiles('e2e/fixtures/buchung-hotel.pdf')
  await expect(page.locator('#bk-name')).toHaveValue('Gasthof Alpenrose')
  await expect(page.locator('#bk-in')).toHaveValue('2026-07-03')
  await expect(page.locator('#bk-out')).toHaveValue('2026-07-05')
  await expect(page.locator('#bk-price')).toHaveValue('286')
  await expect(page.locator('#bk-cancel')).toHaveValue('2026-06-30')
  await expect(page.locator('#bk-ref')).toHaveValue('AR-77341')
  await expect(page.locator('#bk-addr')).toHaveValue('Dorfstraße 3, 6105 Leutasch, Österreich')
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page).toHaveURL(/unterkuenfte\/[^/]+$/)
  await page.goto('/#/trip/t1/unterkuenfte')
  await expect(page.locator('body')).toContainText('Gasthof Alpenrose')

  // Dieselbe Buchung noch einmal → wird erkannt und aktualisiert, nicht doppelt angelegt
  await page.goto('/#/trip/t1/buchung')
  await page.getByTestId('booking-file').setInputFiles('e2e/fixtures/buchung-hotel.pdf')
  await expect(page.getByText(/gibt es schon – wird aktualisiert/)).toBeVisible()
  await page.getByRole('button', { name: 'Aktualisieren' }).click()
  await expect(page).toHaveURL(/unterkuenfte\/[^/]+$/) // erst fertig speichern lassen
  await page.goto('/#/trip/t1/unterkuenfte')
  await expect(page.getByText('Gasthof Alpenrose')).toHaveCount(1)
})

test('Flug als Text einfügen → Hin- und Rückflug', async ({ page }) => {
  await seed(page, { trips: [trip({ startDate: '2026-07-18', endDate: '2026-07-25', transport: 'flug' })] })
  await page.goto('/#/trip/t1/buchung')
  await page.locator('#bk-text').fill(`Ihre Flugbuchung – Buchungscode (PNR): X7YZQ2
Hinflug
Sa., 18. Juli 2026
LH 2110 München (MUC) 07:05 – Palma de Mallorca (PMI) 09:15
Rückflug
Sa., 25. Juli 2026
LH 2111 Palma de Mallorca (PMI) 10:05 – München (MUC) 12:20
Gesamtpreis 412,58 EUR`)
  await expect(page.locator('#lg-nr-1')).toHaveValue('LH 2111')
  await expect(page.locator('#lg-dir-1')).toHaveValue('rueck')
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page).toHaveURL(/anreise$/)
  await expect(page.locator('body')).toContainText('Palma de Mallorca (PMI)')
  await expect(page.locator('body')).toContainText('07:05')
})
