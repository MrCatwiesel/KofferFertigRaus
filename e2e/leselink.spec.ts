import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { KEY, NOW, route, trip } from './helpers'

/** Lese-Link über die Schnittstelle anlegen (Daten direkt an den Server) */
async function createShare(baseURL: string, routes: object[]) {
  const auth = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
  const id = `lt-${Date.now()}`
  const changes = [
    { tbl: 'trips', id, stamp: NOW, deleted: false, data: trip({ id, title: 'Leselink-Reise' }) },
    { tbl: 'journalEntries', id: `${id}-j`, stamp: NOW, deleted: false, data: { id: `${id}-j`, tripId: id, date: '2026-07-02', title: 'Glockner', text: 'Schön.', mood: 5, location: '', highlight: true, photoIds: [], createdAt: NOW, updatedAt: NOW } },
    ...routes.map((r, i) => ({ tbl: 'routes', id: `${id}-r${i}`, stamp: NOW, deleted: false, data: { ...r, id: `${id}-r${i}`, tripId: id } }))
  ]
  let res = await fetch(`${baseURL}/api/push`, { method: 'POST', headers: auth, body: JSON.stringify({ changes }) })
  expect(res.ok).toBe(true)
  res = await fetch(`${baseURL}/api/shares`, { method: 'POST', headers: auth, body: JSON.stringify({ tripId: id, mode: 'highlights', photos: true, routes: true }) })
  expect(res.ok).toBe(true)
  return (await res.json()).token as string
}

test('Lese-Link: Routen mit Kartenbild und Übersichtskarte', async ({ page, baseURL }) => {
  const tile = readFileSync('e2e/fixtures/kachel.png')
  await page.route(/tile\.openstreetmap\.org/, (r) => r.fulfill({ status: 200, body: tile, headers: { 'Content-Type': 'image/png', 'Access-Control-Allow-Origin': '*' } }))
  const token = await createShare(baseURL!, [route({ showInShare: true, date: '2026-07-02' }), route({ name: 'Zweite Runde', color: '#2563eb', showInShare: true, date: '' })])
  await page.goto(`/s/${token}`)
  await expect(page.locator('body')).toContainText('Glockner')
  await expect(page.locator('img.route-map')).toHaveCount(3) // Übersicht + 2 Routen
  await expect(page.locator('.route-overview img')).toHaveCount(1)
  expect(await page.locator('img.route-map').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
})

test('Lese-Link: ohne Kartenkacheln die Strecke als Linie', async ({ page, baseURL }) => {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort())
  const token = await createShare(baseURL!, [route({ showInShare: true, date: '2026-07-02' })])
  await page.goto(`/s/${token}`)
  await expect(page.locator('body')).toContainText('Testrunde')
  await expect(page.locator('.route-track svg')).toHaveCount(1)
  await expect(page.locator('img.route-map')).toHaveCount(0)
})
