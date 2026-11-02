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
  await page.locator('[data-group=geraet]').click()
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

  // Geplante Reise: „Jetzt wichtig“ für vorher, umschaltbar
  await page.goto('/#/trip/t1')
  await expect(page.locator('[data-phase=vorher]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-now-card=packing]')).toBeVisible()
  await page.locator('[data-phase=danach]').click()
  await expect(page).toHaveURL(/phase=danach/)
  await expect(page.locator('[data-now-card=journal]')).toBeVisible()

  // Vergangene Reise: „danach“ und archivieren
  await page.goto('/#/trip/t2')
  await expect(page.locator('[data-phase=danach]')).toHaveAttribute('aria-pressed', 'true')
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

test('Reiseseite 2.0: jede Funktion genau einmal in einer Gruppe, Zurück, Suche, Anheften, Effekte', async ({ page }) => {
  await seed(page, { trips: [trip({ startDate: '2099-07-01', endDate: '2099-07-05' })] })
  await page.goto('/#/trip/t1')
  await expect(page.locator('html')).toHaveAttribute('data-nww-fx', 'stark')
  await expect(page.locator('[data-group]')).toHaveCount(8)

  // Alle Gruppen öffnen: zusammen 26 Einträge (24 Bereiche + Notfall-Seite + Mit Mitreisenden teilen), keiner doppelt
  const seen: string[] = []
  for (const g of await page.locator('[data-group]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-group'), e.tagName]))) {
    if (g[1] === 'A') {
      seen.push(`direkt:${g[0]}`)
      continue
    }
    await page.locator(`[data-group=${g[0]}]`).click()
    const panel = page.locator(`[data-open-group=${g[0]}]`)
    await expect(panel).toBeVisible()
    seen.push(...(await panel.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')!))))
    await page.goBack() // „Zurück“ im Browser schließt die Gruppe
    await expect(panel).toHaveCount(0)
  }
  expect(seen).toHaveLength(26)
  expect(new Set(seen).size).toBe(26)

  // Eine Gruppe öffnen und einen Bereich aufrufen; Zurück landet wieder in der Gruppe
  await page.locator('[data-group=packen]').click()
  await page.locator('[data-open-group=packen] [data-section=packing] a').click()
  await expect(page).toHaveURL(/packliste/)
  await page.goBack()
  await expect(page.locator('[data-open-group=packen]')).toBeVisible()
  await page.locator('[data-group-close]').click()
  await expect(page.locator('[data-open-group]')).toHaveCount(0)

  // Suche: Suchwort statt Name, Enter öffnet den ersten Treffer
  await page.locator('[data-trip-search]').fill('impfung')
  await expect(page.locator('[data-search-results] [data-section=meds]')).toBeVisible()
  await page.locator('[data-trip-search]').fill('hotel')
  await page.locator('[data-trip-search]').press('Enter')
  await expect(page).toHaveURL(/unterkuenfte/)

  // Anheften mit dem Stern → oben auf der Reiseseite, bleibt nach dem Neuladen
  await page.goto('/#/trip/t1')
  await page.locator('[data-group=land]').click()
  await page.locator('[data-open-group=land] [data-section=sprachfuehrer] [data-pin]').click()
  await expect(page.locator('[data-open-group=land] [data-section=sprachfuehrer] [data-pin]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-group-close]').click()
  await page.reload()
  await page.locator('[data-pinned-item=sprachfuehrer]').click()
  await expect(page).toHaveURL(/sprachfuehrer/)

  // Unter Aussehen: Angeheftetes lösen, Effekte ausschalten
  await page.goto('/#/einstellungen/aussehen?teil=reiseseite')
  await page.getByRole('button', { name: 'Sprachführer lösen' }).click()
  await page.locator('[data-effects=aus]').click()
  await expect(page.locator('html')).toHaveAttribute('data-nww-fx', 'aus')
  await page.goto('/#/trip/t1')
  await expect(page.locator('[data-pinned]')).toHaveCount(0)
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
