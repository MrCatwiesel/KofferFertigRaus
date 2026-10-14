/**
 * Seitenformate und Fotoaufteilung für die PDF-Datei (Bericht und Fotobuch).
 * Reine Rechnerei in Punkt (1 pt = 1/72 Zoll) – ohne Browser, damit sie sich testen lässt.
 */
import { N_, translated } from '@/core/i18n'

export const MM = 72 / 25.4

export type PageFormat = 'a4-hoch' | 'a4-quer' | 'quadrat-21' | 'quadrat-30'

export const PAGE_FORMATS: Record<PageFormat, { label: string; w: number; h: number }> = translated({
  'a4-hoch': { label: N_('A4 hoch'), w: 210, h: 297 },
  'a4-quer': { label: N_('A4 quer'), w: 297, h: 210 },
  'quadrat-21': { label: N_('Quadrat 21 × 21 cm'), w: 210, h: 210 },
  'quadrat-30': { label: N_('Quadrat 30 × 30 cm'), w: 300, h: 300 }
})

/** Beschnittzugabe für Druckereien (rundum), in mm */
export const BLEED_MM = 3

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface PageGeometry {
  /** ganze Seite inkl. Beschnitt */
  width: number
  height: number
  /** Beschnitt je Seite (0 ohne) */
  bleed: number
  /** Ränder für Text und Fotos (innerhalb des Endformats, ab Seitenkante gemessen) */
  margin: number
  /** Inhaltsbereich innerhalb der Ränder */
  box: Rect
  /** Abstand zwischen Fotos */
  gutter: number
}

export function pageGeometry(format: PageFormat, bleed: boolean): PageGeometry {
  const f = PAGE_FORMATS[format]
  const b = bleed ? BLEED_MM * MM : 0
  const width = f.w * MM + 2 * b
  const height = f.h * MM + 2 * b
  // Rand wächst mit dem Format (A4: 15 mm, 30 × 30: ~18 mm), dazu der Beschnitt
  const margin = b + Math.max(12, Math.min(f.w, f.h) * 0.06) * MM
  return { width, height, bleed: b, margin, box: { x: margin, y: margin, w: width - 2 * margin, h: height - 2 * margin }, gutter: 4 * MM }
}

/**
 * Fotos eines Eintrags auf Fotobuch-Seiten verteilen: das erste Foto groß (ganze Seite),
 * danach Seiten mit 4, 3 oder 2 Fotos – nie ein einzelnes Foto als Rest.
 * `max` begrenzt die Fotos je Seite (1 = jedes Foto eine Seite).
 */
export function chunkPhotos(n: number, max: 1 | 2 | 3 | 4 = 4): number[] {
  if (n <= 0) return []
  if (max === 1) return Array(n).fill(1)
  if (n <= max) return [n]
  const out = [1]
  let rest = n - 1
  while (rest > 0) {
    if (rest <= max) {
      out.push(rest)
      break
    }
    // so aufteilen, dass am Ende kein Einzelfoto übrig bleibt
    const take = rest - max === 1 ? max - 1 : max
    out.push(take)
    rest -= take
  }
  return out
}

/** Plätze für 1–4 Fotos in einem Rechteck: Querformat nebeneinander, Hochformat übereinander */
export function slotRects(count: number, box: Rect, gutter: number): Rect[] {
  const { x, y, w, h } = box
  const wide = w >= h
  const half = (a: number) => (a - gutter) / 2
  switch (count) {
    case 1:
      return [{ x, y, w, h }]
    case 2:
      return wide
        ? [{ x, y, w: half(w), h }, { x: x + half(w) + gutter, y, w: half(w), h }]
        : [{ x, y, w, h: half(h) }, { x, y: y + half(h) + gutter, w, h: half(h) }]
    case 3: {
      if (wide) {
        const big = (w - gutter) * (2 / 3)
        const small = w - gutter - big
        return [
          { x, y, w: big, h },
          { x: x + big + gutter, y, w: small, h: half(h) },
          { x: x + big + gutter, y: y + half(h) + gutter, w: small, h: half(h) }
        ]
      }
      const big = (h - gutter) * (2 / 3)
      const small = h - gutter - big
      return [
        { x, y, w, h: big },
        { x, y: y + big + gutter, w: half(w), h: small },
        { x: x + half(w) + gutter, y: y + big + gutter, w: half(w), h: small }
      ]
    }
    default:
      return [
        { x, y, w: half(w), h: half(h) },
        { x: x + half(w) + gutter, y, w: half(w), h: half(h) },
        { x, y: y + half(h) + gutter, w: half(w), h: half(h) },
        { x: x + half(w) + gutter, y: y + half(h) + gutter, w: half(w), h: half(h) }
      ]
  }
}

/** Grobe Schätzung der Texthöhe (pt) – reicht, um zu entscheiden, ob neben dem Text noch Fotos auf die Seite passen */
export function estimateTextHeight(paragraphs: string[], width: number, fontSize: number, lineHeight = 1.35): number {
  const charsPerLine = Math.max(10, Math.floor(width / (fontSize * 0.5)))
  const lines = paragraphs.reduce((n, p) => n + Math.max(1, Math.ceil(p.length / charsPerLine)), 0)
  return lines * fontSize * lineHeight + paragraphs.length * fontSize * 0.6
}

/** Benötigte Bildgröße in Pixeln für einen Platz (pt) bei gegebener Auflösung, höchstens so groß wie das Original */
export function pixelsFor(slot: { w: number; h: number }, dpi: number, source?: { width: number; height: number }): { w: number; h: number } {
  let w = Math.round((slot.w / 72) * dpi)
  let h = Math.round((slot.h / 72) * dpi)
  if (source?.width && source.height) {
    // nicht vergrößern: höchstens so viele Pixel, wie der passende Ausschnitt des Originals hergibt
    const cropW = Math.min(source.width, source.height * (slot.w / slot.h))
    const f = Math.min(1, cropW / w)
    w = Math.max(1, Math.round(w * f))
    h = Math.max(1, Math.round(h * f))
  }
  return { w, h }
}
