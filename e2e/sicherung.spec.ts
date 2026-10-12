import { expect, test } from '@playwright/test'
import { KEY, connect } from './helpers'

test('Server-Sicherung: Ziele anlegen, Passwort bleibt verborgen, Auftrag anstoßen', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await connect(page, KEY, 'iPad Marco')
  await page.locator('.card', { hasText: 'Server-Sicherung' }).getByRole('link', { name: 'Verwalten' }).click()
  await expect(page.getByRole('heading', { name: 'Server-Sicherung' })).toBeVisible()

  await page.getByRole('button', { name: /SMB-Freigabe/ }).click()
  await page.locator('#t-name').fill('NAS')
  await page.locator('#t-host').fill('192.168.5.10')
  await page.locator('#t-share').fill('backup')
  await page.locator('#t-user').fill('marco')
  await page.locator('#t-pw').fill('geheim123')
  await page.getByRole('button', { name: 'Speichern' }).click()
  const card = page.locator('.card', { hasText: '//192.168.5.10/backup' })
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Bearbeiten' }).click()
  await expect(page.locator('label[for=t-pw]')).toContainText('unverändert')
  await expect(page.locator('#t-pw')).toHaveValue('')
  await page.getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Jetzt sichern' }).click()
  await expect(page.getByRole('button', { name: 'Läuft …' })).toBeVisible()
})
