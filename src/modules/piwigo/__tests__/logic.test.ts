import { describe, expect, it } from 'vitest'
import {
  albumNameFor, describeQueue, externalRef, findAlbumByName, isDue, lastSegment, parseExternalRef, piwigoDate, retryDelayMs,
  sortAlbums, uploadTitle
} from '../logic'
import type { PiwigoAlbum } from '../types'

const album = (id: number, name: string, parentId: number | null = null): PiwigoAlbum => ({ id, name, parentId, images: 0, totalImages: 0, url: '' })

describe('Piwigo-Verweise', () => {
  it('erzeugt und liest Verweise', () => {
    expect(externalRef(42)).toBe('piwigo:42')
    expect(parseExternalRef('piwigo:42')).toBe(42)
    expect(parseExternalRef('piwigo:abc')).toBeNull()
    expect(parseExternalRef('flickr:1')).toBeNull()
    expect(parseExternalRef(undefined)).toBeNull()
  })
})

describe('Albumname', () => {
  it('ergänzt das Jahr, wenn es fehlt', () => {
    expect(albumNameFor({ title: 'Gardasee', startDate: '2026-07-01' })).toBe('Gardasee 2026')
    expect(albumNameFor({ title: 'Gardasee 2026', startDate: '2026-07-01' })).toBe('Gardasee 2026')
    expect(albumNameFor({ title: '', destination: 'Rom', startDate: '' })).toBe('Rom')
    expect(albumNameFor({ title: '' })).toBe('Reise')
  })

  it('findet vorhandene Alben über den letzten Namensteil und das Hauptalbum', () => {
    const list = [album(1, 'Urlaube'), album(2, 'Urlaube / Gardasee 2026', 1), album(3, 'Gardasee 2026')]
    expect(lastSegment('Urlaube / Gardasee 2026')).toBe('Gardasee 2026')
    expect(findAlbumByName(list, 'gardasee 2026', 1)?.id).toBe(2)
    expect(findAlbumByName(list, 'Gardasee 2026')?.id).toBe(3)
    expect(findAlbumByName(list, 'Rom 2026', 1)).toBeUndefined()
  })

  it('sortiert Unteralben unter ihr Hauptalbum', () => {
    const s = sortAlbums([album(2, 'Urlaube / Rom'), album(3, 'Familie'), album(1, 'Urlaube')])
    expect(s.map((a) => a.id)).toEqual([3, 1, 2])
  })
})

describe('Daten und Titel', () => {
  it('wandelt Piwigo-Datum um', () => {
    expect(piwigoDate('2025-08-01 10:15:30')).toBe('2025-08-01T10:15:30')
    expect(piwigoDate('2025-08-01 10:15')).toBe('2025-08-01T10:15:00')
    expect(piwigoDate('2025-08-01')).toBe('2025-08-01T12:00:00')
    expect(piwigoDate(null)).toBe('')
    expect(piwigoDate('unbekannt')).toBe('')
  })

  it('nimmt Bildunterschrift oder Dateinamen als Titel', () => {
    expect(uploadTitle('  Seeblick ', 'IMG_1.jpg')).toBe('Seeblick')
    expect(uploadTitle('', 'IMG_0001.HEIC')).toBe('IMG_0001')
  })
})

describe('Warteschlange', () => {
  it('wartet nach Fehlern immer länger, höchstens 6 Stunden', () => {
    expect(retryDelayMs(1)).toBe(60_000)
    expect(retryDelayMs(3)).toBe(4 * 60_000)
    expect(retryDelayMs(30)).toBe(360 * 60_000)
  })

  it('erkennt fällige Einträge', () => {
    expect(isDue({ nextTryAt: '' }, '2026-07-01T10:00:00Z')).toBe(true)
    expect(isDue({ nextTryAt: '2026-07-01T09:00:00Z' }, '2026-07-01T10:00:00Z')).toBe(true)
    expect(isDue({ nextTryAt: '2026-07-01T11:00:00Z' }, '2026-07-01T10:00:00Z')).toBe(false)
  })

  it('beschreibt die Warteschlange', () => {
    expect(describeQueue([])).toBe('')
    expect(describeQueue([{ status: 'waiting' }])).toBe('1 Foto wartet')
    expect(describeQueue([{ status: 'waiting' }, { status: 'error' }])).toBe('2 Fotos warten · 1 mit Fehler')
  })
})
