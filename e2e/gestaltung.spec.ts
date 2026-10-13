import { expect, test } from '@playwright/test'
import { seed, trip } from './helpers'

test('Stil wählen, Reiseseite in Bereichen, Archiv', async ({ page }) => {
  await seed(page, {
    trips: [
      trip({ id: 't1', title: 'Bald', startDate: '2099-07-01', endDate: '2099-07-05' }),
      trip({ id: 't2', title: 'Vorbei', destination: 'Insel Rügen', startDate: '2020-07-01', endDate: '2020-07-05' })
    ]
  })

  // Design: Standard Alpin, umschalten auf Retro und dunkel – bleibt nach dem Neuladen
  await page.goto('/#/einstellungen')
  await page.getByRole('link', { name: /Aussehen/ }).click()
  await expect(page.getByRole('radio')).toHaveCount(18)
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'alpin')
  await page.getByRole('radio', { name: /Retro-Reiseplakat/ }).click()
  await page.getByRole('button', { name: 'Dunkel' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'retro')
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-nww-style', 'retro')
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark')

  // Reiseliste in Gruppen
  await page.goto('/#/trip')
  await expect(page.getByText('Geplant', { exact: true })).toBeVisible()
  await expect(page.getByText('Erinnerungen', { exact: true })).toBeVisible()

  // Geplante Reise öffnet „Planung“, Bereiche wechseln
  await page.goto('/#/trip/t1')
  await expect(page.locator('.phase-tab.active')).toContainText('Planung')
  await expect(page.locator('.nww-tile', { hasText: 'Packliste' })).toBeVisible()
  await page.locator('.phase-tab', { hasText: 'Unterwegs' }).click()
  await expect(page).toHaveURL(/bereich=unterwegs/)
  await expect(page.getByRole('link', { name: 'Notfall', exact: true })).toBeVisible()
  await expect(page.locator('.nww-tile', { hasText: 'Packliste' })).toHaveCount(0)
  await page.locator('.phase-tab', { hasText: 'Teilen' }).click()
  await expect(page.locator('.nww-tile', { hasText: 'Reise-Webseite' })).toBeVisible()

  // Vergangene Reise öffnet „Danach“ und lässt sich archivieren
  await page.goto('/#/trip/t2')
  await expect(page.locator('.phase-tab.active')).toContainText('Danach')
  await page.locator('.phase-tab', { hasText: 'Teilen' }).click()
  await page.getByRole('button', { name: 'Ins Archiv legen' }).click()
  await expect(page.getByRole('button', { name: 'Aus dem Archiv holen' })).toBeVisible()
  await page.goto('/#/trip')
  await expect(page.getByText('Erinnerungen', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Archiv \(1\)/ }).click()
  await expect(page.locator('.list-group-item', { hasText: 'Vorbei' })).toBeVisible()
})

test('Titelbild: gezeichnet, eigenes Foto, wieder zurück', async ({ page }) => {
  await seed(page, { trips: [trip()] })
  await page.goto('/#/trip/t1')
  await expect(page.locator('.hero svg.cover-art')).toBeVisible()
  await page.getByRole('link', { name: 'Titelbild ändern' }).click()
  // 1×1-PNG als „Foto“
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[type=file]').setInputFiles({ name: 'berg.png', mimeType: 'image/png', buffer: png })
  await expect(page.locator('#cy')).toBeVisible()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page).toHaveURL(/#\/trip\/t1$/)
  await expect(page.locator('.hero img.trip-cover-img')).toBeVisible()
  await page.getByRole('link', { name: 'Titelbild ändern' }).click()
  await page.getByRole('button', { name: 'Gezeichnete Landschaft' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('.hero svg.cover-art')).toBeVisible()
})

test('Reiseseite anpassen: Bereich verschieben, aus allen Reitern nehmen, Liste ohne Reiter', async ({ page }) => {
  await seed(page, { trips: [trip({ startDate: '2099-07-01', endDate: '2099-07-05' })] })
  await page.goto('/#/trip/t1')
  await page.getByRole('link', { name: 'Anpassen' }).click()
  await expect(page).toHaveURL(/einstellungen\/aussehen\?teil=reiseseite/)

  // Packliste aus „Planung“ nehmen → auf der Reiseseite unter „Weitere Bereiche“
  const editor = page.locator('#teil-reiseseite')
  await editor.getByRole('button', { name: 'Packliste aus diesem Reiter nehmen' }).click()
  await expect(editor).toContainText('In keinem Reiter: Packliste')
  // Reisetagebuch nach „Planung“ holen und ganz nach oben schieben
  await editor.getByLabel('Bereich hinzufügen').selectOption({ label: 'Reisetagebuch' })
  await editor.getByRole('button', { name: 'Hinzufügen' }).click()
  for (let i = 0; i < 20; i++) {
    const up = editor.getByRole('button', { name: 'Reisetagebuch nach oben' })
    if (await up.isDisabled()) break
    await up.click()
  }

  await page.goto('/#/trip/t1')
  await expect(page.locator('.nww-tile').first()).toHaveAttribute('data-section', 'journal')
  await expect(page.locator('.nww-tile[data-section=packing]')).toHaveCount(0)
  await page.getByText('Weitere Bereiche (1)').click()
  await page.locator('details.extra [data-section=packing]').click()
  await expect(page).toHaveURL(/packliste/) // Funktion bleibt erreichbar

  // Ohne Reiter, als Liste
  await page.goto('/#/einstellungen/aussehen?teil=reiseseite')
  await page.getByLabel('Bereiche zeigen als').selectOption('liste')
  await page.getByLabel(/Reiter \(Planung/).uncheck()
  await page.goto('/#/trip/t1')
  await expect(page.locator('.phase-tabs')).toHaveCount(0)
  await expect(page.locator('a.list-group-item[data-section=website]')).toBeVisible()

  // Zurücksetzen
  page.on('dialog', (d) => d.accept())
  await page.goto('/#/einstellungen/aussehen?teil=reiseseite')
  await page.getByRole('button', { name: 'Ursprüngliche Aufteilung wiederherstellen' }).click()
  await page.goto('/#/trip/t1')
  await expect(page.locator('.nww-tile[data-section=packing]')).toBeVisible()
})

test('Hintergrund: eigenes Foto, Regler wirken, entfernen', async ({ page }) => {
  await page.goto('/#/einstellungen/aussehen?teil=hintergrund')
  const html = page.locator('html')
  await expect(html).not.toHaveAttribute('data-nww-photo', '')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[data-scope=alle]').setInputFiles({ name: 'berg.png', mimeType: 'image/png', buffer: png })
  await expect(html).toHaveAttribute('data-nww-photo', '')
  await page.getByRole('button', { name: 'Ruhig' }).click()
  await expect(page.getByLabel(/Schleier über dem Foto/)).toHaveValue('55')
  await page.getByLabel(/Unschärfe/).fill('12')
  expect(await html.evaluate((e) => e.style.getPropertyValue('--nww-bg-blur'))).toBe('12px')
  await page.getByLabel(/Karten durchscheinend/).fill('30')
  await expect(html).toHaveAttribute('data-nww-glass', '')
  await page.getByRole('button', { name: /Foto entfernen/ }).click()
  await expect(html).not.toHaveAttribute('data-nww-photo', '')
})
