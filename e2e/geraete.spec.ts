import { expect, test } from '@playwright/test'
import { KEY, connect } from './helpers'

test('Gerät anmelden, weiteres Gerät einladen, abmelden', async ({ browser, baseURL }) => {
  const ipad = await browser.newPage()
  ipad.on('dialog', (d) => d.accept())
  await connect(ipad, KEY, 'iPad Marco')
  const devices = ipad.locator('.card', { hasText: 'Angemeldete Geräte' })
  await expect(devices.locator('.list-group-item', { hasText: 'iPad Marco' })).toContainText('dieses Gerät')

  // Einladung erzeugen
  await ipad.getByRole('button', { name: 'Gerät hinzufügen' }).click()
  const code = (await ipad.locator('.font-monospace.fs-4').innerText()).trim()
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  await expect(ipad.locator('.qr svg')).toBeVisible()

  // Zweites Gerät öffnet den Einladungslink
  const handy = await (await browser.newContext()).newPage()
  await handy.goto(`/#/abgleich?server=${encodeURIComponent(baseURL!)}&code=${code}`)
  await expect(handy.locator('#key')).toHaveValue(code)
  await expect(handy.getByText('Einladungscode erkannt')).toBeVisible()
  await handy.locator('#devname').fill('Handy Birgit')
  await handy.getByRole('button', { name: 'Verbinden' }).click()
  await expect(handy.getByText('als Handy Birgit')).toBeVisible()

  // Code ein zweites Mal → abgelehnt
  const dritter = await (await browser.newContext()).newPage()
  await dritter.goto(`/#/abgleich?server=${encodeURIComponent(baseURL!)}&code=${code}`)
  await dritter.getByRole('button', { name: 'Verbinden' }).click()
  await expect(dritter.locator('.alert-danger')).toContainText('schon benutzt')

  // iPad meldet das Handy ab
  await ipad.reload()
  const row = devices.locator('.list-group-item', { hasText: 'Handy Birgit' })
  await row.locator('[data-bs-toggle=dropdown]').click()
  await row.getByRole('button', { name: 'Abmelden' }).click()
  await expect(row).toHaveCount(0)

  // Handy merkt es beim nächsten Abgleich
  await handy.reload()
  await expect(handy.locator('.alert-warning')).toContainText('abgemeldet')
})
