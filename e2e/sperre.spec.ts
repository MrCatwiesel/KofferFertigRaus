import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('App-Sperre: Code, Fehlversuch, Neustart gesperrt, Face ID, ausschalten', async ({ page }) => {
  // Virtueller Plattform-Authentifikator (wie Face ID / Touch ID)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }
  })

  await seed(page, { trips: [trip()] })
  await page.goto('/#/einstellungen')
  await page.getByRole('link', { name: /App-Sperre/ }).click()
  await page.locator('#p1').fill('2468')
  await page.locator('#p2').fill('2469')
  await page.getByRole('button', { name: 'App-Sperre einschalten' }).click()
  await expect(page.getByRole('status')).toContainText('stimmen nicht überein')
  await page.locator('#p2').fill('2468')
  await page.getByRole('button', { name: 'App-Sperre einschalten' }).click()
  await expect(page.getByText('App-Sperre ist an')).toBeVisible()

  // Sperren, falscher Code, richtiger Code (Tastatur)
  await page.getByRole('button', { name: 'Jetzt sperren' }).click()
  const screen = page.getByRole('dialog', { name: 'App gesperrt' })
  await expect(screen).toBeVisible()
  await expect(page.locator('main')).toHaveAttribute('inert', '')
  for (const d of '1111') await screen.getByRole('button', { name: d, exact: true }).click()
  await expect(screen).toContainText('Falscher Code')
  await page.keyboard.type('2468')
  await expect(screen).toBeHidden()

  // Nach Neustart gesperrt
  await page.reload()
  await expect(screen).toBeVisible()
  await page.keyboard.type('2468')
  await expect(screen).toBeHidden()

  // Face ID einrichten und damit entsperren
  await page.goto('/#/einstellungen/sperre')
  await page.getByLabel('Mit Face ID / Touch ID entsperren').check()
  await expect(page.getByRole('status')).toContainText('Face ID / Touch ID ist eingerichtet')
  await page.getByRole('button', { name: 'Jetzt sperren' }).click()
  await screen.getByRole('button', { name: 'Mit Face ID / Touch ID entsperren' }).first().click()
  await expect(screen).toBeHidden()

  // Ausschalten nur mit Code
  await page.locator('#rm').fill('0000')
  await page.getByRole('button', { name: 'App-Sperre ausschalten' }).click()
  await expect(page.getByRole('status')).toContainText('Code ist falsch')
  await page.locator('#rm').fill('2468')
  await page.getByRole('button', { name: 'App-Sperre ausschalten' }).click()
  await expect(page.getByRole('status')).toContainText('aufgehoben')
  await page.reload()
  await expect(screen).toHaveCount(0)
})
