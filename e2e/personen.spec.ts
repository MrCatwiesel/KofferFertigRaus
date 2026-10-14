import { expect, test, type Page } from '@playwright/test'
import { KEY2, connect, localDate } from './helpers'

/** Jetzt abgleichen und warten, bis es fertig ist */
async function sync(page: Page) {
  await page.goto('/#/abgleich')
  const btn = page.getByRole('button', { name: 'Jetzt' })
  await expect(btn).toBeEnabled()
  await btn.click()
  await expect(page.locator('.spin')).toHaveCount(0)
  await expect(page.getByText('Abgeglichen gerade eben')).toBeVisible()
}

test('Personen einladen, private Dokumente freigeben, nur lesen, Anmeldung mit Passwort', async ({ browser, baseURL }) => {
  // Marco: verbindet mit dem Gruppenschlüssel und trägt sich als erste Person ein
  const marco = await (await browser.newContext()).newPage()
  marco.on('dialog', (d) => d.accept())
  await connect(marco, KEY2, 'iPad Marco')
  await marco.getByRole('link', { name: 'Verwalten' }).first().click()
  await expect(marco.getByRole('heading', { name: 'Personen & Rechte' })).toBeVisible()
  await marco.locator('#self-name').fill('Marco')
  await marco.locator('#self-pw').fill('marco-passwort')
  await marco.locator('#self-pw2').fill('marco-passwort')
  await marco.getByRole('button', { name: 'Das bin ich' }).click()
  await expect(marco.getByText('Du bist Verwalter')).toBeVisible()
  await expect(marco.locator('[data-member="Marco"]')).toContainText('ich')

  // Birgit einladen
  await marco.locator('#new-name').fill('Birgit')
  await marco.getByRole('button', { name: 'Einladen' }).click()
  await expect(marco.locator('[data-invite]')).toContainText('Einladung für Birgit')
  const code = (await marco.locator('[data-invite-code]').innerText()).trim()

  // Reise mit beiden Teilnehmern, verknüpft mit den Konten
  await marco.goto('/#/trip/neu')
  await marco.locator('#title').fill('Wien')
  await marco.locator('#destination').fill('Wien, Österreich')
  await marco.locator('#start').fill(localDate(10))
  await marco.locator('#end').fill(localDate(14))
  for (const n of ['Marco', 'Birgit']) {
    await marco.locator('#participant').fill(n)
    await marco.locator('#participant').press('Enter')
  }
  const links = marco.locator('[data-member-links]')
  await links.getByLabel('Konto für Marco').selectOption({ label: 'Marco (ich)' })
  await links.getByLabel('Konto für Birgit').selectOption({ label: 'Birgit' })
  await marco.getByRole('button', { name: /Speichern|Reise anlegen/ }).click()
  await marco.waitForURL((u) => /#\/trip\/[^/?]+/.test(u.hash) && !u.hash.includes('/neu'))
  const tripId = marco.url().match(/#\/trip\/([^/?]+)/)![1]

  // Marcos Allergiepass – privat
  await marco.goto(`/#/trip/${tripId}/dokumente/neu`)
  await marco.locator('#person').selectOption('Marco')
  await expect(marco.locator('[data-private]')).toContainText('Privat')
  await expect(marco.locator('[data-visibility]')).toContainText('Nur ich')
  await marco.locator('#title').fill('Allergiepass Marco')
  await marco.getByRole('button', { name: 'Speichern' }).click()
  await expect(marco.getByText('Allergiepass Marco')).toBeVisible()
  await sync(marco)

  // Birgit: öffnet die Einladung, legt ihr Passwort fest
  const birgit = await (await browser.newContext()).newPage()
  await birgit.goto(`/#/abgleich?server=${encodeURIComponent(baseURL!)}&code=${code}`)
  await birgit.locator('#devname').fill('Handy Birgit')
  await birgit.getByRole('button', { name: 'Verbinden' }).click()
  await expect(birgit.locator('[data-new-password]')).toContainText('Passwort für Birgit')
  await birgit.getByLabel('Neues Passwort').fill('birgit-passwort')
  await birgit.getByLabel('Passwort wiederholen').fill('birgit-passwort')
  await birgit.getByRole('button', { name: 'Verbinden' }).click()
  await expect(birgit.locator('[data-people-card]')).toContainText('Angemeldet als Birgit')
  await expect(birgit.locator('[data-people-card]').getByRole('link', { name: 'Verwalten' })).toHaveCount(0)

  // Birgit sieht die Reise, aber nicht Marcos privates Dokument
  await birgit.goto(`/#/trip/${tripId}/dokumente`)
  await expect(birgit.getByRole('heading', { name: /Dokumente/ })).toBeVisible()
  await expect(birgit.getByText('Allergiepass Marco')).toHaveCount(0)

  // Marco gibt den Allergiepass frei
  await marco.goto(`/#/trip/${tripId}/dokumente`)
  await marco.getByText('Allergiepass Marco').click()
  await marco.locator('#visibility').selectOption('alle')
  await expect(marco.locator('[data-visibility]')).toContainText('Für alle in der Reisegruppe sichtbar')
  await marco.getByRole('button', { name: 'Speichern' }).click()
  await marco.waitForURL(/dokumente$/)
  await sync(marco)
  await sync(birgit)
  await birgit.goto(`/#/trip/${tripId}/dokumente`)
  await expect(birgit.getByText('Allergiepass Marco')).toBeVisible()

  // Nur lesen für Birgit in dieser Reise
  await marco.goto('/#/personen')
  const row = marco.locator('[data-member="Birgit"]')
  await row.getByRole('button', { name: 'Reisen' }).click()
  await row.getByLabel('Birgit: Wien').selectOption('lesen')
  await expect(row.getByLabel('Birgit: Wien')).toHaveValue('lesen')
  await sync(birgit)
  await birgit.goto(`/#/trip/${tripId}`)
  await expect(birgit.locator('[data-read-only]')).toBeVisible()

  // Birgits Änderung an der Reise wird zurückgenommen
  await birgit.goto(`/#/trip/${tripId}/dokumente`)
  await birgit.getByText('Allergiepass Marco').click()
  await expect(birgit.locator('[data-read-only]')).toBeVisible()
  await birgit.locator('#title').fill('Von Birgit geändert')
  await birgit.getByRole('button', { name: 'Speichern' }).click()
  await birgit.waitForURL(/dokumente$/)
  await sync(birgit)
  await expect(birgit.locator('.alert-warning')).toContainText('nur Leserecht')
  await birgit.goto(`/#/trip/${tripId}/dokumente`)
  await expect(birgit.getByText('Allergiepass Marco')).toBeVisible()
  await expect(birgit.getByText('Von Birgit geändert')).toHaveCount(0)

  // Neues Gerät: Anmelden mit Name und Passwort
  const laptop = await (await browser.newContext()).newPage()
  await laptop.goto('/#/abgleich')
  await laptop.getByText('Name und Passwort').click()
  await laptop.locator('#server').fill(baseURL!)
  await laptop.locator('#login').fill('birgit')
  await laptop.locator('#login-pw').fill('birgit-passwort')
  await laptop.locator('#devname').fill('Laptop Birgit')
  await laptop.getByRole('button', { name: 'Verbinden' }).click()
  await expect(laptop.locator('[data-people-card]')).toContainText('Angemeldet als Birgit')
  await laptop.goto('/#/trip')
  await expect(laptop.getByText('Wien').first()).toBeVisible()
})
