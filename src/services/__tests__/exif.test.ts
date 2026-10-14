import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { exifTime, parseExif, readExif } from '../exif'

/** Kleine TIFF-Daten in Motorola-Reihenfolge („MM“) bauen: IFD0 → GPS-IFD mit Süd/West-Position */
function bigEndianTiff(): Uint8Array {
  const b = new DataView(new ArrayBuffer(200))
  b.setUint16(0, 0x4d4d)
  b.setUint16(2, 42)
  b.setUint32(4, 8)
  // IFD0 bei 8: ein Eintrag GPS-Zeiger → 26
  b.setUint16(8, 1)
  b.setUint16(10, 0x8825); b.setUint16(12, 4); b.setUint32(14, 1); b.setUint32(18, 26)
  b.setUint32(22, 0)
  // GPS-IFD bei 26: 4 Einträge
  b.setUint16(26, 4)
  const entry = (i: number, tag: number, type: number, count: number, value: number) => {
    const e = 28 + i * 12
    b.setUint16(e, tag); b.setUint16(e + 2, type); b.setUint32(e + 4, count); b.setUint32(e + 8, value)
  }
  entry(0, 1, 2, 2, 0x53000000) // 'S'
  entry(1, 2, 5, 3, 100)
  entry(2, 3, 2, 2, 0x57000000) // 'W'
  entry(3, 4, 5, 3, 124)
  const rat = (at: number, vals: [number, number][]) => vals.forEach(([n, d], k) => { b.setUint32(at + k * 8, n); b.setUint32(at + k * 8 + 4, d) })
  rat(100, [[33, 1], [52, 1], [0, 1]]) // 33° 52' S (Sydney)
  rat(124, [[70, 1], [30, 1], [0, 1]]) // 70° 30' W
  return new Uint8Array(b.buffer)
}

describe('EXIF', () => {
  it('liest Position, Höhe und Aufnahmezeit aus einem JPEG', () => {
    const info = parseExif(new Uint8Array(readFileSync('e2e/fixtures/foto-gps.jpg')))
    expect(info?.lat).toBeCloseTo(47.425208, 5)
    expect(info?.lon).toBeCloseTo(12.9, 5)
    expect(info?.ele).toBe(1650)
    expect(info?.takenAt).toBe('2026-10-05T12:32:10.000Z') // 14:32 Ortszeit +02:00
  })
  it('auch über einen Blob (nur der Anfang der Datei wird gelesen)', async () => {
    const info = await readExif(new Blob([readFileSync('e2e/fixtures/foto-gps.jpg')]))
    expect(info?.lat).toBeCloseTo(47.4252, 3)
  })
  it('Motorola-Reihenfolge, Süd und West werden negativ', () => {
    const info = parseExif(bigEndianTiff())
    expect(info?.lat).toBeCloseTo(-33.866667, 5)
    expect(info?.lon).toBeCloseTo(-70.5, 5)
    expect(info?.takenAt).toBeUndefined()
  })
  it('EXIF mitten in einer anderen Datei (wie bei HEIC)', () => {
    const tiff = bigEndianTiff()
    const wrapped = new Uint8Array(1000 + 6 + tiff.length)
    wrapped.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], 0) // „ftyp“
    wrapped.set([0x45, 0x78, 0x69, 0x66, 0, 0], 1000)
    wrapped.set(tiff, 1006)
    expect(parseExif(wrapped)?.lon).toBeCloseTo(-70.5, 5)
  })
  it('ohne EXIF, kaputt oder Position 0/0 → nichts', async () => {
    expect(parseExif(new Uint8Array(readFileSync('e2e/fixtures/foto-ohne-gps.jpg')))).toBeNull()
    expect(parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 4, 1, 2]))).toBeNull()
    expect(parseExif(new Uint8Array(10))).toBeNull()
    expect(await readExif(new Blob(['kein Bild']))).toBeNull()
    const zero = bigEndianTiff()
    new DataView(zero.buffer).setUint32(100, 0)
    new DataView(zero.buffer).setUint32(108, 0)
    new DataView(zero.buffer).setUint32(124, 0)
    new DataView(zero.buffer).setUint32(132, 0)
    expect(parseExif(zero)).toBeNull()
  })
  it('Zeit ohne Zeitzone gilt als Ortszeit des Geräts', () => {
    expect(exifTime('2026:10:05 14:32:10')).toBe(new Date(2026, 9, 5, 14, 32, 10).toISOString())
    expect(exifTime('2026:10:05 14:32:10', '-05:00')).toBe('2026-10-05T19:32:10.000Z')
    expect(exifTime('0000:00:00 00:00:00')).toBeUndefined()
    expect(exifTime(undefined)).toBeUndefined()
  })
})
