import { describe, expect, it } from 'vitest'
import { coverMotif, ridge, seededRandom } from '../cover-art'

describe('Gezeichnetes Titelbild', () => {
  it('Motiv aus dem Reiseziel', () => {
    expect(coverMotif('Insel Rügen')).toBe('meer')
    expect(coverMotif('Gardasee, Italien')).toBe('meer')
    expect(coverMotif('Wien')).toBe('stadt')
    expect(coverMotif('Fusch, Österreich')).toBe('berge')
  })
  it('gleiche Reise, gleiches Bild – andere Reise, anderes Bild', () => {
    const a = seededRandom('t1')
    const b = seededRandom('t1')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(seededRandom('t2')()).not.toBe(seededRandom('t1')())
  })
  it('Bergkette ist ein geschlossener Pfad im Bild', () => {
    const d = ridge(seededRandom('x'), 150, 70, 6)
    expect(d.startsWith('M0 300')).toBe(true)
    expect(d.endsWith('L800 300 Z')).toBe(true)
    const ys = [...d.matchAll(/L\d+ (-?\d+)/g)].map((m) => Number(m[1]))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
  })
})
