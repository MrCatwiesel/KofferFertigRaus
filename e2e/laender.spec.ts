import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Länder-Spickzettel: Zielland, Durchreise hinzufügen und entfernen', async ({ page }) => {
  await seed(page, { trips: [trip({ countries: ['IT'], transport: 'auto' })] })
  await page.goto('/#/trip/t1')
  await page.getByText('Planung', { exact: true }).click() // Reise liegt zurück → Seite öffnet „Danach“
  await expect(page.locator('body')).toContainText('Länder-Spickzettel')
  await expect(page.locator('body')).toContainText('Italien: Notruf 112')

  await page.goto('/#/trip/t1/laender')
  const it = page.locator('[data-country="IT"]')
  await expect(it.locator('[data-fact="notruf"]')).toContainText('112')
  await expect(it.locator('[data-fact="notruf"] a').first()).toHaveAttribute('href', /^tel:/)
  await expect(it.locator('[data-fact="strom"]')).toContainText('Deutsche Stecker passen')
  await expect(it.locator('[data-fact="zeit"]')).toContainText('Jetzt dort:')
  await expect(it.locator('[data-fact="geld"]')).toContainText('Euro')
  // Reise mit dem Auto: Verkehrsregeln aufgeklappt
  await expect(it.locator('[data-fact="auto"]')).toHaveAttribute('open', '')
  await expect(it.locator('[data-fact="auto"]')).toContainText('130 km/h')
  await expect(it.locator('[data-fact="auto"]')).toContainText('0,5 ‰ · Fahranfänger 0,0 ‰')
  await expect(it.locator('[data-fact="hinweise"]')).toContainText('ZTL')

  // Durchreise Österreich
  await page.locator('#transit-country').selectOption('AT')
  await page.locator('[data-add-transit]').click()
  const at = page.locator('[data-country="AT"]')
  await expect(at).toContainText('Durchreise')
  await expect(at.locator('[data-fact="auto"]')).toContainText('Vignette')
  await expect(at.locator('[data-fact="hinweise"]')).toContainText('18. Tag')

  // Großbritannien: Adapter und Linksverkehr
  await page.locator('#transit-country').selectOption('GB')
  await page.locator('[data-add-transit]').click()
  const gb = page.locator('[data-country="GB"]')
  await expect(gb.locator('[data-fact="strom"]')).toContainText('Adapter nötig (Typ G)')
  await expect(gb.locator('[data-fact="auto"]')).toContainText('Linksverkehr')
  await expect(gb.locator('[data-fact="auto"]')).toContainText('70 mph')

  // Entfernen bleibt nach dem Neuladen
  await gb.getByRole('button', { name: /entfernen/ }).click()
  await expect(gb).toHaveCount(0)
  await page.reload()
  await expect(page.locator('[data-country="AT"]')).toBeVisible()
  await expect(page.locator('[data-country="GB"]')).toHaveCount(0)
})

test.describe('Englisch', () => {
  test.use({ locale: 'en-GB' })
  test('Spickzettel auf Englisch', async ({ page }) => {
    await seed(page, { trips: [trip({ countries: ['US'], transport: 'flug' })] })
    await page.goto('/#/trip/t1/laender')
    const us = page.locator('[data-country="US"]')
    await expect(us.locator('[data-fact="notruf"]')).toContainText('911')
    await expect(us.locator('[data-fact="strom"]')).toContainText('Adapter needed (type A/B)')
    await expect(us.locator('[data-fact="strom"]')).toContainText('100–240 V')
    await expect(us.locator('[data-fact="zeit"]')).toContainText('Several time zones')
    await expect(us.locator('[data-fact="auto"]')).not.toHaveAttribute('open', '')
    await expect(us.locator('[data-fact="hinweise"]')).toContainText('ESTA')
  })
})
