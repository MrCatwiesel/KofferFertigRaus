import { describe, expect, it } from 'vitest'
import { dataUrlToBlob, readBackup, writeBackup, type BackupMeta } from '../backup-format'

describe('Backup – Binärdaten', () => {
  it('wandelt data:-URLs offline in Blobs um', async () => {
    const b = dataUrlToBlob('data:text/plain;base64,SGFsbG8=')
    expect(b.type).toBe('text/plain')
    expect(await b.text()).toBe('Hallo')
  })
  it('auch ohne base64', async () => {
    const b = dataUrlToBlob('data:text/plain,Gr%C3%BC%C3%9Fe')
    expect(await b.text()).toBe('Grüße')
  })
})

const META: BackupMeta = { app: 'nix-wie-weg', format: 1, exportedAt: '2026-10-14T00:00:00.000Z', scope: { tripId: 't1', title: 'Gro"ß' } }

async function* src(tables: Record<string, Record<string, unknown>[][]>) {
  for (const [table, chunks] of Object.entries(tables)) yield { table, rows: chunks }
}

async function readAll(blob: Blob, opts = {}) {
  const got: Record<string, Record<string, unknown>[]> = {}
  const calls: number[] = []
  const meta = await readBackup(blob, async (t, rows) => {
    calls.push(rows.length)
    ;(got[t] ??= []).push(...rows)
  }, undefined, opts)
  return { meta, got, calls }
}

describe('Backup – Dateiformat zeilenweise', () => {
  it('schreibt gültiges JSON, eine Zeile je Datensatz', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => (i * 7) & 255)
    const blob = await writeBackup(META, src({
      trips: [[{ id: 't1', title: 'A\nB' }], [{ id: 't2', title: 'C' }]],
      leer: [],
      photos: [[{ id: 'p1', full: new Blob([bytes], { type: 'image/jpeg' }) }]]
    }))
    const text = await blob.text()
    const json = JSON.parse(text) // auch ältere App-Versionen können die Datei lesen
    expect(json.scope.title).toBe('Gro"ß')
    expect(json.tables.trips.map((t: { id: string }) => t.id)).toEqual(['t1', 't2'])
    expect(json.tables.leer).toEqual([])
    expect(json.tables.photos[0].full.__blob).toMatch(/^data:image\/jpeg;base64,/)
    expect(text.split('\n').length).toBe(12) // 11 Zeilen + Zeilenende am Schluss
  })

  it('liest sie wieder, Fotos Byte für Byte', async () => {
    const bytes = new Uint8Array(70_001).map((_, i) => (i * 13) & 255)
    const blob = await writeBackup(META, src({
      trips: [[{ id: 't1', title: 'Zeile\nmit Umbruch, "Anführung" und ]' }]],
      photos: [[{ id: 'p1', tripId: 't1', full: new Blob([bytes], { type: 'image/jpeg' }) }, { id: 'p2', tripId: 't1', full: null }]]
    }))
    const { meta, got } = await readAll(blob)
    expect(meta.scope?.tripId).toBe('t1')
    expect(got.trips[0].title).toBe('Zeile\nmit Umbruch, "Anführung" und ]')
    const full = got.photos[0].full as Blob
    expect(full.type).toBe('image/jpeg')
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(bytes)
    expect(got.photos[1].full).toBeNull()
  })

  it('gibt große Mengen in Häppchen weiter', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({ id: `x${i}` }))
    const blob = await writeBackup(META, src({ activities: [rows] }))
    const { calls, got } = await readAll(blob, { maxRows: 200 })
    expect(calls).toEqual([200, 200, 50])
    expect(got.activities).toHaveLength(450)
  })

  it('liest auch ältere Dateien (alles in einer Zeile)', async () => {
    const old = JSON.stringify({ ...META, tables: { trips: [{ id: 't1' }], photos: [{ id: 'p1', full: { __blob: 'data:image/png;base64,SGFsbG8=' } }] } })
    const { got } = await readAll(new Blob([old]))
    expect(got.trips[0].id).toBe('t1')
    expect(await (got.photos[0].full as Blob).text()).toBe('Hallo')
  })

  it('lehnt fremde Dateien ab und meldet abgeschnittene', async () => {
    await expect(readAll(new Blob(['{"hallo":1}']))).rejects.toThrow('keine Datei von')
    await expect(readAll(new Blob(['kein json']))).rejects.toThrow('keine Datei von')
    const blob = await writeBackup(META, src({ trips: [[{ id: 't1' }, { id: 't2' }]] }))
    const text = await blob.text()
    const cut = text.slice(0, text.lastIndexOf(']'))
    await expect(readAll(new Blob([cut]))).rejects.toThrow('unvollständig')
  })
})
