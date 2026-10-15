import { expect, test, type Page } from '@playwright/test'
import { NOW, seed, trip } from './helpers'
import { readFileSync } from 'node:fs'

const VERSION = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
/** Erste Neuerung der neuesten Version laut CHANGELOG („### Neu: …“) – der Hinweis zeigt nur die jüngsten */
const LATEST = /^### Neu: (.+)$/m.exec(readFileSync('CHANGELOG.md', 'utf8'))![1].trim()

/** Kein echtes Internet für Wetter und Kartenkacheln (in CI wären sie erreichbar) */
async function offlineServices(page: Page) {
  await page.route('https://api.open-meteo.com/**', (r) => r.abort())
  await page.route('https://*.tile.openstreetmap.org/**', (r) => r.abort())
  await page.route('https://tile.openstreetmap.org/**', (r) => r.abort())
}

/** Anzahl Datensätze einer Tabelle direkt aus der App-Datenbank */
async function count(page: Page, table: string): Promise<number> {
  return page.evaluate(
    (t) =>
      new Promise<number>((resolve, reject) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const req = r.result.transaction(t, 'readonly').objectStore(t).count()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        }
      }),
    table
  )
}

test('Willkommen: Beispielreise anlegen, ansehen und wieder löschen', async ({ page }) => {
  await offlineServices(page)
  await page.goto('/#/trip')
  const welcome = page.locator('[data-welcome]')
  await expect(welcome).toBeVisible()
  await expect(page.locator('[data-whats-new]')).toHaveCount(0) // erster Start: nichts nachzuholen

  await welcome.locator('[data-welcome-sample]').click()
  await expect(page).toHaveURL(/#\/trip\/[^/]+$/)
  await expect(page.locator('[data-sample-note]')).toBeVisible()
  await expect(page.locator('body')).toContainText('Beispiel: Gardasee')
  const tripId = page.url().split('/').pop()!

  // Alle Module haben ihren Teil beigesteuert
  expect(await count(page, 'travelLegs')).toBe(2)
  expect(await count(page, 'accommodations')).toBe(1)
  expect(await count(page, 'activities')).toBe(7)
  expect(await count(page, 'places')).toBe(8)
  expect(await count(page, 'expenses')).toBe(6)
  expect(await count(page, 'journalEntries')).toBe(2)
  expect(await count(page, 'polls')).toBe(1)
  expect(await count(page, 'packingItems')).toBeGreaterThan(20)
  expect(await count(page, 'checklistItems')).toBeGreaterThan(14) // zu Hause + Auschecken aus der Ferienwohnung

  // Stichproben in den Bereichen
  await page.goto(`/#/trip/${tripId}/karte`)
  await expect(page.locator('body')).toContainText('Auf der Karte (8)')
  await page.goto(`/#/trip/${tripId}/ausgaben`)
  await expect(page.locator('body')).toContainText('Seilbahn Monte Baldo')
  await page.goto(`/#/trip/${tripId}/abstimmungen`)
  await expect(page.locator('body')).toContainText('Wo essen wir heute Abend?')
  await page.goto(`/#/trip/${tripId}/tagebuch`)
  await expect(page.locator('body')).toContainText('Auf den Monte Baldo')

  // „Heute“ öffnet den Tag der laufenden Beispielreise
  await page.goto('/#/heute')
  await expect(page).toHaveURL(new RegExp(`#/trip/${tripId}/tagesplan`))
  await expect(page.locator('body')).not.toContainText('NaN')

  // Löschen räumt alles weg
  await page.goto(`/#/trip/${tripId}`)
  page.once('dialog', (d) => void d.accept())
  await page.locator('[data-sample-note]').getByRole('button', { name: 'Beispielreise löschen' }).click()
  await expect(page).toHaveURL(/#\/trip$/)
  await expect(page.locator('[data-welcome]')).toBeVisible()
  for (const t of ['trips', 'travelLegs', 'accommodations', 'activities', 'places', 'expenses', 'journalEntries', 'polls', 'pollVotes', 'packingItems', 'checklistItems', 'documents', 'emergencyContacts', 'weather'])
    expect(await count(page, t), t).toBe(0)
})

test('Hilfe: „?“ führt zum passenden Thema, Verweise, Suche, Was ist neu', async ({ page }) => {
  await seed(page, { trips: [trip()] })
  await page.goto('/#/trip/t1/packliste')
  await page.locator('[data-help-link]').click()
  await expect(page).toHaveURL(/#\/hilfe\/packliste$/)
  const topic = page.locator('[data-help-topic]')
  await expect(topic.locator('h1')).toHaveText('Packliste')

  // Verweis im Text auf ein anderes Thema, dann zurück
  await topic.getByRole('link', { name: 'Personen & Rechte' }).first().click()
  await expect(page).toHaveURL(/#\/hilfe\/personen$/)
  await expect(page.locator('[data-help-topic] h1')).toHaveText('Personen & Rechte')
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page).toHaveURL(/#\/hilfe\/packliste$/)
  await page.getByRole('button', { name: 'Zurück' }).click()
  await expect(page).toHaveURL(/#\/trip\/t1\/packliste$/)

  // Übersicht und Suche
  await page.goto('/#/hilfe')
  await expect(page.locator('[data-help-group="unterwegs"]')).toContainText('Karte und Offline-Karten')
  await expect(page.locator('[data-help-link]')).toHaveCount(0) // auf der Hilfe selbst kein „?“
  await page.locator('[data-help-search]').fill('stornofrist')
  const hits = page.locator('[data-help-hits] a')
  await expect(hits.first()).toContainText('Unterkünfte')
  await page.locator('[data-help-search]').fill('xyzunbekannt')
  await expect(page.locator('body')).toContainText('Nichts gefunden')

  // Was ist neu
  await page.goto('/#/hilfe/neu')
  await expect(page.locator('[data-release]').first()).toContainText(`Version ${VERSION}`)
  await expect(page.locator('[data-release]').filter({ hasText: 'Hilfe & Einführung' })).toHaveCount(1)

  // Einstellungen → Hilfe
  await page.goto('/#/einstellungen')
  await page.locator('[data-settings-help]').click()
  await expect(page).toHaveURL(/#\/hilfe$/)
})

test('Einführung: durch alle Schritte zur ersten Reise', async ({ page }) => {
  await page.goto('/#/trip')
  await page.locator('[data-welcome-intro]').click()
  await expect(page).toHaveURL(/#\/willkommen$/)
  await expect(page.locator('[data-intro-title]')).toHaveText('Willkommen bei KofferFertigRaus')
  for (let i = 0; i < 6; i++) await page.locator('[data-intro-next]').click()
  await expect(page.locator('[data-intro-title]')).toHaveText('Los geht’s')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('[data-intro-title]')).toHaveText('Als App nutzen')
  await page.keyboard.press('ArrowRight')
  await page.locator('[data-intro-new]').click()
  await expect(page).toHaveURL(/#\/trip\/neu$/)
})

/** Gemerkte Version setzen (undefined = entfernen) – erst nachdem die App beim ersten Öffnen ihre eigene gemerkt hat */
async function setSeen(page: Page, value: string | undefined) {
  const read = () =>
    page.evaluate(
      () =>
        new Promise<unknown>((resolve) => {
          const r = indexedDB.open('nix-wie-weg')
          r.onsuccess = () => {
            const req = r.result.transaction('meta', 'readonly').objectStore('meta').get('help.seenVersion')
            req.onsuccess = () => resolve(req.result?.value ?? null)
          }
        })
    )
  await expect.poll(read).not.toBeNull()
  await page.evaluate(
    (v) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite')
          if (v === undefined) tx.objectStore('meta').delete('help.seenVersion')
          else tx.objectStore('meta').put({ key: 'help.seenVersion', value: v })
          tx.oncomplete = () => resolve()
        }
      }),
    value
  )
}

test('Nach einem Update: Hinweis „Was ist neu“ einmal auf der Startseite', async ({ page }) => {
  await seed(page, { trips: [trip()] })
  await setSeen(page, '1.35.0')
  await page.reload()
  const hint = page.locator('[data-whats-new]')
  await expect(hint).toContainText(`Neu in Version ${VERSION}`)
  await expect(hint).toContainText(LATEST)
  await hint.getByRole('button', { name: 'Hinweis schließen' }).click()
  await expect(hint).toHaveCount(0)
  await page.reload()
  await expect(page.locator('body')).toContainText('Großglockner')
  await expect(page.locator('[data-whats-new]')).toHaveCount(0)
})

test('Bestehende Daten ohne gemerkte Version: Neuerungen seit 1.35 werden gezeigt', async ({ page }) => {
  await seed(page, { trips: [trip({ updatedAt: NOW })] })
  await setSeen(page, undefined)
  await page.reload()
  await expect(page.locator('[data-whats-new]')).toContainText(LATEST)
})
