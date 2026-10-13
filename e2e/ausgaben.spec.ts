import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

const today = new Date().toLocaleDateString('sv-SE') // lokales Datum wie in der App (UTC wäre nach Mitternacht falsch)

test('Ausgabe in Franken: EZB-Kurs automatisch, offline gespeicherter Kurs, Landeswährung vorgeschlagen', async ({ page, context }) => {
  let calls = 0
  await page.route('https://api.frankfurter.dev/**', (r) => {
    calls++
    const u = new URL(r.request().url())
    expect(u.searchParams.get('base')).toBe('CHF')
    return r.fulfill({ json: { amount: 1, base: 'CHF', date: '2026-10-09', rates: { EUR: 1.0712 } } })
  })
  await seed(page, { trips: [trip({ destination: 'Zermatt', countries: ['CH'], startDate: today, endDate: today })] })
  await page.reload()

  await page.goto('/#/trip/t1/ausgaben/neu')
  // Reise läuft, Zielland Schweiz → Franken vorausgewählt
  await expect(page.locator('#cur')).toHaveValue('CHF')
  await expect(page.locator('#cur option[value=CHF]')).toHaveText('CHF – Schweizer Franken')
  await expect(page.locator('[data-rate-hint]')).toContainText('EZB-Referenzkurs vom 09.10.2026')
  await expect(page.locator('#rate')).toHaveValue('1.0712')
  await page.locator('#amount').fill('48.50')
  await expect(page.locator('[data-converted]')).toContainText('51,95')
  await page.locator('#desc').fill('Raclette')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/ausgaben$/)
  await expect(page.locator('body')).toContainText('51,95')

  // Offline: gespeicherter Kurs wird benutzt
  await context.setOffline(true)
  await page.goto('/#/trip/t1/ausgaben/neu')
  await expect(page.locator('#cur')).toHaveValue('CHF') // zuletzt benutzt
  await expect(page.locator('[data-rate-hint]')).toContainText('gespeichert, offline')
  await expect(page.locator('#rate')).toHaveValue('1.0712')
  await context.setOffline(false)
  expect(calls).toBe(1)

  // Währung ohne EZB-Kurs → Hinweis, Kurs von Hand
  await page.locator('#cur').selectOption('MAD')
  await expect(page.locator('[data-rate-hint]')).toContainText('Kein EZB-Kurs für MAD')
})
