import { expect, test } from '@playwright/test'
import { KEY, connect } from './helpers'

const KEY_ID = 'pkid-20261015-klicktest0123456789a'
const SECRET = 'klicktest-geheimnis-piwigo-1234567890'

test('Piwigo-Zugang in den Einstellungen: prüfen, speichern, Adresse ändern, entfernen', async ({ page }) => {
  await connect(page, KEY, 'Klicktest Piwigo')
  const card = page.locator('[data-piwigo-settings]')
  await expect(card).toContainText('Piwigo-Galerie')
  await card.getByRole('link').click()
  await expect(page).toHaveURL(/#\/piwigo$/)
  await expect(page.locator('[data-piwigo-state="none"]')).toBeVisible()

  // Falsches Geheimnis: nichts gespeichert
  await page.locator('#pw-url').fill('piwigo.example/galerie/')
  await page.locator('#pw-key').fill(KEY_ID)
  await page.locator('#pw-secret').fill('falsch')
  await page.locator('[data-piwigo-save]').click()
  await expect(page.locator('[data-piwigo-result]')).toContainText('Nicht gespeichert')
  await expect(page.locator('[data-piwigo-result]')).toContainText('Anmeldung bei Piwigo fehlgeschlagen')
  await expect(page.locator('[data-piwigo-state="none"]')).toBeVisible()

  // Richtig: verbunden, Adresse vereinheitlicht
  await page.locator('#pw-secret').fill(SECRET)
  await page.locator('[data-piwigo-save]').click()
  await expect(page.locator('[data-piwigo-result]')).toContainText('Gespeichert – verbunden als denet.')
  await expect(page.locator('[data-piwigo-state="ok"]')).toContainText('Verbunden als denet')
  await expect(page.locator('#pw-url')).toHaveValue('http://piwigo.example/galerie')
  await expect(page.locator('#pw-secret')).toHaveValue('')
  await expect(page.locator('#pw-secret')).toHaveAttribute('placeholder', 'unverändert lassen')

  // Nur die öffentliche Adresse ändern – Geheimnis bleibt
  await page.locator('#pw-public').fill('https://fotos.example.de')
  await page.locator('[data-piwigo-save]').click()
  await expect(page.locator('[data-piwigo-result]')).toContainText('verbunden als denet')
  await page.reload()
  await expect(page.locator('#pw-public')).toHaveValue('https://fotos.example.de')

  // Unerreichbare Adresse: alte Werte bleiben
  await page.locator('#pw-url').fill('http://anderswo.example')
  await page.locator('[data-piwigo-save]').click()
  await expect(page.locator('[data-piwigo-result]')).toContainText('Nicht gespeichert')
  await page.reload()
  await expect(page.locator('#pw-url')).toHaveValue('http://piwigo.example/galerie')

  // Entfernen (sonst sähen andere Klicktests Piwigo)
  page.once('dialog', (d) => void d.accept())
  await page.locator('[data-piwigo-reset]').click()
  await expect(page.locator('[data-piwigo-state="none"]')).toBeVisible()
})
