import { describe, expect, it } from 'vitest'
import { fitView, project } from '../static-map'

describe('Kartenbild', () => {
  it('Web-Mercator wie die Kartenkacheln', () => {
    expect(project(0, 0, 0)).toEqual({ x: 128, y: 128 })
    const p = project(47.0751, 12.753, 12) // Großglockner-Gebiet
    expect(Math.floor(p.x / 256)).toBe(2193)
    expect(Math.floor(p.y / 256)).toBe(1439) // Referenz: OSM-Formel mit asinh(tan(lat))
  })
  it('größte Zoomstufe, bei der die Tour hineinpasst; Kacheln decken das Bild', () => {
    const pts: [number, number][] = [[47.05, 12.7], [47.1, 12.8]]
    const v = fitView(pts, 1000, 560)!
    const span = (z: number) => {
      const a = project(47.05, 12.7, z)
      const b = project(47.1, 12.8, z)
      return { w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
    }
    expect(span(v.z).w).toBeLessThanOrEqual(1000 - 48)
    expect(span(v.z).h).toBeLessThanOrEqual(560 - 48)
    expect(span(v.z + 1).w > 1000 - 48 || span(v.z + 1).h > 560 - 48).toBe(true)
    // Kacheln überdecken das ganze Bild
    expect(Math.min(...v.tiles.map((t) => t.px))).toBeLessThanOrEqual(0)
    expect(Math.min(...v.tiles.map((t) => t.py))).toBeLessThanOrEqual(0)
    expect(Math.max(...v.tiles.map((t) => t.px + 256))).toBeGreaterThanOrEqual(1000)
    expect(Math.max(...v.tiles.map((t) => t.py + 256))).toBeGreaterThanOrEqual(560)
    expect(v.tiles.length).toBeLessThanOrEqual(5 * 4)
  })
  it('ein einzelner Punkt: höchste Zoomstufe, leer: nichts', () => {
    expect(fitView([[47, 12]], 400, 300)!.z).toBe(16)
    expect(fitView([], 400, 300)).toBeNull()
  })
})
