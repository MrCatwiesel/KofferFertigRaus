import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { NOW, accommodation, activity, route, seed, trip } from './helpers'

test('Webseite: Auswahlknöpfe, Unterkünfte ohne Preise und Buchungsnummern', async ({ page }) => {
  await seed(page, {
    trips: [trip()],
    accommodations: [accommodation(), accommodation({ id: 'a2', name: 'Alpenhof Idee', status: 'idee' })],
    activities: [activity({ status: 'erledigt' })],
    journalEntries: [{ id: 'j1', tripId: 't1', date: '2026-07-02', title: 'Auf den Glockner', text: 'Traumhaft.', mood: 5, location: 'Franz-Josefs-Höhe', highlight: true, photoIds: [], createdAt: NOW, updatedAt: NOW }]
  })
  await page.goto('/#/trip/t1/webseite')
  const preview = page.frameLocator('iframe.preview')
  await expect(preview.locator('body')).toContainText('Hotel Lampenhäusl')
  await expect(preview.locator('body')).toContainText('3 Nächte')
  await expect(preview.locator('body')).not.toContainText('Alpenhof Idee')
  await expect(preview.locator('body')).not.toContainText('BK-4711')
  await expect(preview.locator('body')).not.toContainText('777')
  await expect(preview.locator('body')).not.toContainText('Fusch 12')
  await expect(preview.locator('body')).not.toContainText('Hochalpenstraße')

  await page.locator('label[for=sec-showActivities]').click()
  await page.getByLabel('Adresse und Link der Unterkünfte zeigen').check()
  await page.locator('label[for=sec-showParticipants]').click()
  await expect(preview.locator('body')).toContainText('Hochalpenstraße')
  await expect(preview.locator('body')).toContainText('Fusch 12')
  await expect(preview.locator('body')).not.toContainText('Birgit')

  await page.locator('label[for=sec-showStays]').click()
  await expect(preview.locator('body')).not.toContainText('Hotel Lampenhäusl')
})

test('Webseite: Routen mit Kartenhintergrund und Übersichtskarte, nicht freigegebene Routen', async ({ page }) => {
  const tile = readFileSync('e2e/fixtures/kachel.png')
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, body: tile, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }))
  await seed(page, {
    trips: [trip()],
    routes: [
      route({ showInShare: true, date: '2026-07-02' }),
      route({ id: 'r2', name: 'Zweite Runde', color: '#2563eb', showInShare: true, date: '' }),
      route({ id: 'r3', name: 'Geheime Runde', showInShare: false })
    ],
    journalEntries: [{ id: 'j1', tripId: 't1', date: '2026-07-02', title: 'Auf den Glockner', text: 'Traumhaft.', mood: 5, location: '', highlight: true, photoIds: [], createdAt: NOW, updatedAt: NOW }]
  })
  await page.goto('/#/trip/t1/webseite')
  const preview = page.frameLocator('iframe.preview')
  await expect(page.locator('[data-map-state]')).toContainText('Routen mit Karte')
  await expect(preview.locator('img.route-map')).toHaveCount(3) // Übersicht + 2 Routen
  await expect(preview.locator('.route-overview img')).toHaveCount(1)
  await expect(preview.locator('body')).not.toContainText('Geheime Runde')

  // Nicht freigegebene Route: Hinweis, „Alle zeigen“ gibt sie frei
  await expect(page.locator('[data-hidden-routes]')).toContainText('Geheime Runde')
  await page.locator('[data-hidden-routes]').getByRole('button', { name: 'Alle zeigen' }).click()
  await expect(preview.locator('body')).toContainText('Geheime Runde')
  await expect(preview.locator('img.route-map')).toHaveCount(4)

  // Datei: Kartenbilder eingebettet
  await page.getByRole('button', { name: 'Datei erstellen' }).click()
  const href = await page.getByRole('link', { name: 'Herunterladen' }).getAttribute('href')
  const html = await page.evaluate(async (u) => (await fetch(u!)).text(), href)
  expect(html.match(/class="route-map" src="data:image\/jpeg;base64,/g)?.length).toBe(4)
})

test('Webseite: ohne Kartenbilder (offline) nur die Strecke', async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort())
  await seed(page, {
    trips: [trip()],
    routes: [route({ showInShare: true, date: '2026-07-02' })],
    journalEntries: [{ id: 'j1', tripId: 't1', date: '2026-07-02', title: 'Tag', text: 'x', mood: 5, location: '', highlight: true, photoIds: [], createdAt: NOW, updatedAt: NOW }]
  })
  await page.goto('/#/trip/t1/webseite')
  await expect(page.locator('[data-map-state]')).toContainText('brauchen Internet')
  const preview = page.frameLocator('iframe.preview')
  await expect(preview.locator('.route-track svg')).toHaveCount(1)
  await expect(preview.locator('img.route-map')).toHaveCount(0)
})
