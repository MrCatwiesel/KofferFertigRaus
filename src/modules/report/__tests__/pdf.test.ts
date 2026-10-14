import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import PdfPrinter from 'pdfmake'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { BLEED_MM, MM, chunkPhotos, pageGeometry, pixelsFor, slotRects } from '../pdf-layout'
import { DEFAULT_PDF_OPTIONS, PLACEHOLDER, buildPdfDoc, collectImages, type PdfInput, type PdfOptions } from '../pdf-doc'
import { profileSvg, trackSvg } from '@/services/tracks'

const require = createRequire(import.meta.url)

describe('PDF – Seiten und Fotoaufteilung', () => {
  it('Formate in Punkt, Beschnitt rundum', () => {
    const a4 = pageGeometry('a4-hoch', false)
    expect(Math.round(a4.width)).toBe(595)
    expect(Math.round(a4.height)).toBe(842)
    const q = pageGeometry('quadrat-21', true)
    expect(q.width).toBeCloseTo((210 + 2 * BLEED_MM) * MM)
    expect(q.box.x).toBeGreaterThan(q.bleed)
  })
  it('Fotos verteilen: erstes groß, nie ein Einzelfoto als Rest', () => {
    expect(chunkPhotos(0)).toEqual([])
    expect(chunkPhotos(1)).toEqual([1])
    expect(chunkPhotos(3)).toEqual([3])
    expect(chunkPhotos(5)).toEqual([1, 4])
    expect(chunkPhotos(6)).toEqual([1, 3, 2])
    expect(chunkPhotos(10)).toEqual([1, 4, 3, 2])
    expect(chunkPhotos(7, 2)).toEqual([1, 2, 2, 2])
    expect(chunkPhotos(3, 1)).toEqual([1, 1, 1])
    for (let n = 2; n < 30; n++) {
      const c = chunkPhotos(n, 3)
      expect(c.reduce((a, b) => a + b, 0)).toBe(n)
      expect(c.slice(1).every((k) => k >= 2 && k <= 3)).toBe(true)
    }
  })
  it('Plätze füllen das Rechteck ohne Überlappung', () => {
    const box = { x: 10, y: 20, w: 400, h: 300 }
    for (const n of [1, 2, 3, 4]) {
      const r = slotRects(n, box, 8)
      expect(r).toHaveLength(n)
      for (const s of r) {
        expect(s.x).toBeGreaterThanOrEqual(box.x - 1e-9)
        expect(s.y).toBeGreaterThanOrEqual(box.y - 1e-9)
        expect(s.x + s.w).toBeLessThanOrEqual(box.x + box.w + 1e-9)
        expect(s.y + s.h).toBeLessThanOrEqual(box.y + box.h + 1e-9)
      }
      const area = r.reduce((a, s) => a + s.w * s.h, 0)
      expect(area).toBeGreaterThan(box.w * box.h * 0.9)
    }
    // Hochformat-Fläche: übereinander
    const [a, b] = slotRects(2, { x: 0, y: 0, w: 200, h: 400 }, 0)
    expect(b.y).toBe(a.h)
  })
  it('Bildgröße nach Auflösung, nie größer als das Original', () => {
    expect(pixelsFor({ w: 72, h: 36 }, 300)).toEqual({ w: 300, h: 150 })
    // 2048×1536-Foto in eine ganze A4-Querseite (Zuschnitt 297:210) bei 300 dpi → begrenzt auf die Fotobreite
    const p = pixelsFor({ w: 842, h: 595 }, 300, { width: 2048, height: 1536 })
    expect(p.w).toBe(2048)
    expect(p.h).toBe(Math.round(2048 * (595 / 842)))
  })
})

// ——— ganze Dokumente: wirklich als PDF erzeugen ———

const svgPts: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [47.1 + i * 0.001, 12.8 + Math.sin(i / 4) * 0.002, 1500 + i * 10])
const photos = (n: number, entry: string) =>
  Array.from({ length: n }, (_, i) => ({ id: `${entry}-${i}`, caption: i === 0 ? 'Am Gipfel' : '', width: i % 3 === 2 ? 1536 : 2048, height: i % 3 === 2 ? 2048 : 1536 }))

function input(options: Partial<PdfOptions> = {}): PdfInput {
  return {
    options: { ...DEFAULT_PDF_OPTIONS, ...options },
    accent: '#0d6efd',
    trip: { title: 'Maria Alm', destination: 'Salzburger Land', countryNames: 'Österreich', startDate: '2026-10-04', endDate: '2026-10-09', participants: ['Marco', 'Birgit'] },
    cover: { id: 'e1-0', width: 2048, height: 1536, focusY: 50 },
    stats: [{ value: '6', label: 'Tage' }, { value: '12,4 km', label: 'auf 1 Tour' }],
    overviewSvg: trackSvg(svgPts, { width: 720, height: 420 }),
    legend: [{ name: 'Gipfelrunde', color: '#e11d48' }],
    stays: ['Hotel Morgenzeit · 5 Nächte'],
    money: ['1.234,00 € insgesamt'],
    days: [
      {
        date: '2026-10-05',
        dayNo: 2,
        entries: [{ id: 'e1', title: 'Auf den Hundstein', text: 'Früh los.\n\nOben Sonne, unten Nebel – herrlich! '.repeat(3), moodLabel: 'Super', location: 'Maria Alm', photos: photos(6, 'e1') }],
        routes: [{ id: 'r1', name: 'Gipfelrunde', color: '#e11d48', statsText: '12,4 km · ↑ 800 m', trackSvg: trackSvg(svgPts), profileSvg: profileSvg(svgPts) }]
      },
      { date: '2026-10-06', dayNo: 3, entries: [{ id: 'e2', title: 'Regentag', text: 'Therme.', moodLabel: '', location: '', photos: photos(1, 'e2') }], routes: [] }
    ],
    otherRoutes: []
  }
}

function fonts() {
  const vfs = require('pdfmake/build/vfs_fonts.js') as Record<string, string>
  const b = (n: string) => Buffer.from(vfs[n], 'base64')
  const lora = (w: number) => readFileSync(require.resolve(`@fontsource/lora/files/lora-latin-${w}-normal.woff`))
  return {
    Roboto: { normal: b('Roboto-Regular.ttf'), bold: b('Roboto-Medium.ttf'), italics: b('Roboto-Italic.ttf'), bolditalics: b('Roboto-MediumItalic.ttf') },
    Lora: { normal: lora(400), bold: lora(700), italics: lora(400), bolditalics: lora(700) }
  }
}

async function render(def: TDocumentDefinitions): Promise<{ pages: { w: number; h: number }[]; text: string }> {
  const doc = new PdfPrinter(fonts()).createPdfKitDocument(def, { compress: false } as object)
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise((r) => doc.on('end', r))
  doc.end()
  await done
  const raw = Buffer.concat(chunks).toString('latin1')
  const pages = [...raw.matchAll(/\/Type \/Page\n[^]*?\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => ({ w: +m[1], h: +m[2] }))
  return { pages, text: raw }
}

describe('PDF – Dokumente', () => {
  it('fordert jedes Bild einmal an, zugeschnitten auf seinen Platz', () => {
    const reqs = collectImages(input({ layout: 'fotobuch', format: 'quadrat-21' }))
    expect(new Set(reqs.map((r) => r.key)).size).toBe(reqs.length)
    expect(reqs.every((r) => r.crop && r.w > 0 && r.h > 0)).toBe(true)
    // Titelbild randlos über die ganze Seite
    const g = pageGeometry('quadrat-21', false)
    expect(reqs.some((r) => r.id === 'e1-0' && Math.abs(r.w - g.width) < 1 && Math.abs(r.h - g.height) < 1)).toBe(true)
    // alle 7 Fotos kommen vor
    expect(new Set(reqs.map((r) => r.id))).toEqual(new Set([...photos(6, 'e1'), ...photos(1, 'e2')].map((p) => p.id)))
  })

  it('Bericht: A4 hoch mit Titelseite, Überblick und Tagen', async () => {
    const { pages, text } = await render(buildPdfDoc(input(), () => PLACEHOLDER))
    expect(pages.length).toBeGreaterThanOrEqual(3)
    expect(pages.every((p) => Math.round(p.w) === 595 && Math.round(p.h) === 842)).toBe(true)
    expect(text).toContain('Maria Alm')
  })

  it('Fotobuch: Quadrat mit Beschnitt, Fotos auf eigenen Seiten', async () => {
    const def = buildPdfDoc(input({ layout: 'fotobuch', format: 'quadrat-21', bleed: true }), () => PLACEHOLDER)
    const { pages } = await render(def)
    const side = (210 + 2 * BLEED_MM) * MM
    expect(pages.every((p) => Math.abs(p.w - side) < 0.5 && Math.abs(p.h - side) < 0.5)).toBe(true)
    // Titel, Überblick, Eintrag mit Fotogruppe, 2 weitere Fotoseiten (3+2), Touren, Regentag (+ evtl. Vollbild)
    expect(pages.length).toBeGreaterThanOrEqual(6)
    expect(pages.length).toBeLessThanOrEqual(9)
  })

  it('Fotobuch ohne Fotos und ohne Überblick bleibt gültig', async () => {
    const i = input({ layout: 'fotobuch', format: 'a4-quer' })
    i.cover = null
    i.stats = []
    i.overviewSvg = ''
    i.stays = []
    i.money = []
    i.days.forEach((d) => d.entries.forEach((e) => (e.photos = [])))
    const { pages } = await render(buildPdfDoc(i, () => PLACEHOLDER))
    expect(pages.length).toBeGreaterThanOrEqual(3)
  })
})
