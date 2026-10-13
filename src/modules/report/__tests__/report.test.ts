import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, buildDays, photoColumns, pickCover, reportStats, type InEntry, type InPhoto, type InRoute } from '../logic'
import { routesSvg } from '@/services/tracks'

const trip = { startDate: '2026-10-04', endDate: '2026-10-09' }
const entry = (id: string, date: string, over: Partial<InEntry> = {}): InEntry => ({ id, date, title: id, text: 'Text', mood: 5, location: '', highlight: false, photoIds: [], createdAt: `${date}T10:00:00Z`, ...over })
const photo = (id: string, entryId: string, w = 4, h = 3): InPhoto => ({ id, entryId, takenAt: `2026-10-05T${id.padStart(2, '0')}:00:00Z`, caption: '', width: w, height: h })
const route = (id: string, date: string, distance = 1000): InRoute => ({ id, name: id, date, color: '#e11d48', showInShare: true, stats: { distance, ascent: 100, descent: 100, duration: null } })

describe('Reisebericht', () => {
  const entries = [entry('b', '2026-10-05', { highlight: true, photoIds: ['2', '1'] }), entry('a', '2026-10-04'), entry('c', '2026-10-06')]
  const photos = [photo('1', 'b'), photo('2', 'b', 3, 4), photo('3', 'b'), photo('4', 'b'), photo('5', 'b')]
  const routes = [route('Klamm', '2026-10-05'), route('Alt', '')]

  it('Tage chronologisch, Tag der Reise, Touren am Tag und ohne Tag getrennt', () => {
    const { days, otherRoutes } = buildDays(trip, entries, photos, routes, DEFAULT_OPTIONS)
    expect(days.map((d) => [d.date, d.dayNo])).toEqual([['2026-10-04', 1], ['2026-10-05', 2], ['2026-10-06', 3]])
    expect(days[1].routes.map((r) => r.name)).toEqual(['Klamm'])
    expect(otherRoutes.map((r) => r.name)).toEqual(['Alt'])
    // Fotos in der Reihenfolge des Tagebuchs
    expect(days[1].entries[0].photos.map((p) => p.id)).toEqual(['2', '1', '3', '4', '5'])
  })
  it('Optionen: nur Höhepunkte, höchstens vier Fotos, ohne Touren', () => {
    const { days, otherRoutes } = buildDays(trip, entries, photos, routes, { ...DEFAULT_OPTIONS, onlyHighlights: true, photos: 'vier', routes: false })
    expect(days.map((d) => d.date)).toEqual(['2026-10-05'])
    expect(days[0].entries[0].photos).toHaveLength(4)
    expect(days[0].routes).toEqual([])
    expect(otherRoutes).toEqual([])
    expect(buildDays(trip, entries, photos, routes, { ...DEFAULT_OPTIONS, photos: 'keine' }).days[1].entries[0].photos).toEqual([])
  })
  it('Zahlen, Titelfoto, Spalten', () => {
    expect(reportStats(trip, entries, 5, routes)).toEqual({ days: 6, entries: 3, photos: 5, routes: 2, distance: 2000, ascent: 200 })
    expect(pickCover(entries, photos)?.id).toBe('1') // Höhepunkt, Querformat
    expect(photoColumns(1, 'bericht')).toBe(1)
    expect(photoColumns(3, 'bericht')).toBe(3)
    expect(photoColumns(5, 'fotobuch')).toBe(2)
  })
  it('Übersichtskarte aller Touren', () => {
    const svg = routesSvg([{ points: [[47, 12, null], [47.1, 12.1, null]], color: '#ff0000' }, { points: [[47.2, 12.2, null], [47.3, 12.25, null]], color: '#00ff00' }])
    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#00ff00')
    expect(routesSvg([])).toBe('')
  })
})
