import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { NOW, activity, seed, trip } from './helpers'

// Ernstfall-Übung für die App-Sicherung: exportieren (mit Fotos) → alles löschen → einlesen → vergleichen
test('App-Sicherung: Export mit Fotos, Daten weg, Einlesen stellt alles wieder her', async ({ page }) => {
  await seed(page, { trips: [trip()], activities: [activity()] })
  // Foto mit echten Binärdaten (geht nicht über seed, weil Blobs nicht serialisierbar sind)
  await page.evaluate(
    (now) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open('nix-wie-weg')
        r.onsuccess = () => {
          const tx = r.result.transaction('photos', 'readwrite')
          const bytes = new Uint8Array(256).map((_, i) => i)
          tx.objectStore('photos').put({
            id: 'p1', tripId: 't1', entryId: '', full: new Blob([bytes], { type: 'image/jpeg' }), thumb: new Blob([bytes.slice(0, 16)], { type: 'image/jpeg' }),
            width: 16, height: 16, caption: 'Am Pass', takenAt: now, createdAt: now, updatedAt: now
          })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    NOW
  )

  // 1. Exportieren (mit Fotos)
  await page.goto('/#/einstellungen')
  await page.locator('#photos').check()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Backup exportieren' }).click()])
  const path = await download.path()
  const file = readFileSync(path, 'utf8')
  expect(download.suggestedFilename()).toMatch(/-mit-fotos\.json$/)

  // 2. Unglück: Datenbank komplett weg
  await page.evaluate(() => new Promise<void>((resolve) => {
    const r = indexedDB.open('nix-wie-weg')
    r.onsuccess = () => {
      const names = Array.from(r.result.objectStoreNames)
      const tx = r.result.transaction(names, 'readwrite')
      for (const n of names) tx.objectStore(n).clear()
      tx.oncomplete = () => resolve()
    }
  }))
  await page.goto('/#/trip')
  await page.reload()
  await expect(page.getByText('Großglockner')).toHaveCount(0)

  // 3. Einlesen
  await page.goto('/#/einstellungen')
  await page.locator('input[type=file][accept="application/json"]').setInputFiles({ name: 'sicherung.json', mimeType: 'application/json', buffer: Buffer.from(file) })
  await expect(page.getByText(/Backup eingelesen/)).toBeVisible()

  // 4. Vergleichen: Reise, Aktivität und Foto (Byte für Byte) sind zurück
  const restored = await page.evaluate(() => new Promise<{ trip?: string; act?: string; caption?: string; bytes: number[]; type: string }>((resolve) => {
    const r = indexedDB.open('nix-wie-weg')
    r.onsuccess = () => {
      const tx = r.result.transaction(['trips', 'activities', 'photos'])
      const t = tx.objectStore('trips').get('t1')
      const a = tx.objectStore('activities').get('x1')
      const p = tx.objectStore('photos').get('p1')
      tx.oncomplete = async () => {
        const blob = p.result?.full as Blob | undefined
        resolve({
          trip: t.result?.title, act: a.result?.title, caption: p.result?.caption,
          bytes: blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : [], type: blob?.type ?? ''
        })
      }
    }
  }))
  expect(restored.trip).toBe('Großglockner')
  expect(restored.act).toBe('Hochalpenstraße')
  expect(restored.caption).toBe('Am Pass')
  expect(restored.type).toBe('image/jpeg')
  expect(restored.bytes).toEqual(Array.from({ length: 256 }, (_, i) => i))

  await page.goto('/#/trip')
  await expect(page.getByText('Großglockner').first()).toBeVisible()
})
