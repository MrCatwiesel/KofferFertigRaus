/**
 * Reisebericht und Fotobuch als PDF-Datei: baut die Dokumentbeschreibung für pdfmake.
 * Ohne Browser (testbar). Bilder werden über `img()` angefordert – der Aufrufer liefert sie
 * passend zugeschnitten und verkleinert (siehe pdf.ts). Erst einmal mit einem Sammler aufrufen
 * (`collectImages`), dann mit den fertigen Bildern.
 */
import type { Content, ContentStack, TDocumentDefinitions } from 'pdfmake/interfaces'
import { MM, chunkPhotos, estimateTextHeight, pageGeometry, slotRects, type PageFormat, type PageGeometry, type Rect } from './pdf-layout'
import { photoColumns } from './logic'
import { intlLocale } from '@/i18n'

export interface PdfPhoto {
  id: string
  caption: string
  width: number
  height: number
}

/** Fertiges Kartenbild (OpenStreetMap mit Strecken), über `img()` als Bild mit dieser Kennung angefordert */
export interface PdfMap {
  id: string
  width: number
  height: number
}

export interface PdfRoute {
  id: string
  /** Karte mit Hintergrund; ohne (offline) wird nur die Strecke gezeichnet */
  map?: PdfMap
  name: string
  color: string
  statsText: string
  trackSvg: string
  profileSvg: string
}

export interface PdfEntry {
  id: string
  title: string
  text: string
  moodLabel: string
  location: string
  photos: PdfPhoto[]
}

export interface PdfDay {
  date: string
  dayNo: number
  entries: PdfEntry[]
  routes: PdfRoute[]
}

export interface PdfOptions {
  layout: 'bericht' | 'fotobuch'
  /** Seitenformat (nur Fotobuch; der Bericht ist immer A4 hoch) */
  format: PageFormat
  /** 3 mm Beschnitt rundum für Druckereien (nur Fotobuch) */
  bleed: boolean
  /** Fotos je Seite im Fotobuch */
  perPage: 1 | 2 | 3 | 4
  /** druck = 300 dpi (groß), teilen = 150 dpi (kleine Datei) */
  quality: 'druck' | 'teilen'
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = { layout: 'bericht', format: 'a4-quer', bleed: false, perPage: 4, quality: 'teilen' }

export interface PdfInput {
  options: PdfOptions
  /** Akzentfarbe (#rrggbb) aus dem Design */
  accent: string
  trip: { title: string; destination: string; countryNames: string; startDate: string; endDate: string; participants: string[] }
  /** Titelbild: Foto-Kennung (oder „cover“ für das eigene Titelbild der Reise) */
  cover: { id: string; width: number; height: number; focusY: number } | null
  stats: { value: string; label: string }[]
  overviewSvg: string
  /** Übersichtskarte aller Touren mit Hintergrund */
  overviewMap?: PdfMap
  legend: { name: string; color: string }[]
  stays: string[]
  money: string[]
  days: PdfDay[]
  otherRoutes: PdfRoute[]
}

/** Ein angefordertes Bild: Foto `id` in der Größe w×h (pt); `crop` = auf genau dieses Seitenverhältnis zuschneiden */
export interface ImageRequest {
  key: string
  id: string
  w: number
  h: number
  crop: boolean
  /** senkrechter Bildausschnitt beim Zuschneiden, 0 = oben … 100 = unten */
  focusY: number
  source: { width: number; height: number }
}

export type ImageSource = (req: ImageRequest) => string

const round = (n: number) => Math.round(n * 10) / 10

function request(id: string, w: number, h: number, crop: boolean, source: { width: number; height: number }, focusY = 50): ImageRequest {
  return { key: `${id}@${Math.round(w)}x${Math.round(h)}${crop ? 'c' : ''}`, id, w: round(w), h: round(h), crop, focusY, source }
}

const dateLong = (d: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`))
const dateShort = (d: string) => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`))
const paras = (t: string) => t.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
/** SVG aus der App fürs PDF: Farben, die sonst aus der Umgebung kämen, fest setzen */
const pdfSvg = (svg: string) => svg.replace(/currentColor/g, '#555555').replace(/font-family="[^"]*"/g, 'font-family="Roboto"')

const GRAY = '#666666'

/** Alle benötigten Bilder ermitteln (ein Probelauf mit Platzhaltern) */
export function collectImages(input: PdfInput): ImageRequest[] {
  const seen = new Map<string, ImageRequest>()
  buildPdfDoc(input, (r) => {
    seen.set(r.key, r)
    return PLACEHOLDER
  })
  return [...seen.values()]
}

/** 1×1 Pixel – nur für den Probelauf */
export const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export function buildPdfDoc(input: PdfInput, img: ImageSource): TDocumentDefinitions {
  return input.options.layout === 'fotobuch' ? photobook(input, img) : report(input, img)
}

// ——— gemeinsame Bausteine ———

function styles(accent: string) {
  return {
    title: { font: 'Lora', fontSize: 30, bold: true, color: '#1d1d1d' },
    kicker: { fontSize: 9, color: GRAY, characterSpacing: 1.2 },
    dates: { fontSize: 13, color: accent },
    h2: { font: 'Lora', fontSize: 17, bold: true, color: '#1d1d1d', margin: [0, 0, 0, 3] as [number, number, number, number] },
    h3: { font: 'Lora', fontSize: 12.5, bold: true, color: '#1d1d1d', margin: [0, 6, 0, 2] as [number, number, number, number] },
    day: { fontSize: 10, color: accent, bold: true, margin: [0, 0, 0, 2] as [number, number, number, number] },
    meta: { fontSize: 9, color: GRAY },
    text: { fontSize: 10.5, lineHeight: 1.3, margin: [0, 0, 0, 6] as [number, number, number, number] },
    caption: { fontSize: 8, color: GRAY, italics: true }
  }
}

function overview(input: PdfInput, width: number, height: number, img: ImageSource): Content[] {
  const out: Content[] = []
  if (!input.stats.length && !input.overviewSvg && !input.overviewMap && !input.stays.length && !input.money.length) return out
  out.push({ text: 'Überblick', style: 'h2' })
  if (input.stats.length)
    out.push({
      columns: input.stats.map((s) => ({ stack: [{ text: s.value, fontSize: 16, bold: true, color: input.accent }, { text: s.label, style: 'meta' }], width: '*' })),
      columnGap: 10,
      margin: [0, 4, 0, 12]
    })
  if (input.overviewMap || input.overviewSvg) {
    out.push(
      input.overviewMap
        ? { ...mapImage(input.overviewMap, width, height * 0.5, img), alignment: 'center', margin: [0, 0, 0, 4] }
        : { svg: pdfSvg(input.overviewSvg), fit: [Math.min(width, 480), height * 0.45], alignment: 'center', margin: [0, 0, 0, 4] }
    )
    if (input.legend.length)
      out.push({
        text: input.legend.flatMap((l, i) => [{ text: `${i ? '    ' : ''}■ `, color: l.color }, { text: l.name }]),
        style: 'meta',
        alignment: 'center',
        margin: [0, 0, 0, 12]
      })
  }
  if (input.stays.length) out.push({ text: 'Unterkünfte', style: 'h3' }, { ul: input.stays, fontSize: 10, margin: [0, 0, 0, 8] })
  if (input.money.length) out.push({ text: 'Ausgaben', style: 'h3' }, ...input.money.map((m) => ({ text: m, fontSize: 10 })))
  return out
}

/** Tour mit Strecke und Höhenprofil; `big` = eine Tour allein auf der Seite (Fotobuch), `height` = Höhe des Inhaltsbereichs */
/** Kartenbild in einen Rahmen einpassen (Seitenverhältnis bleibt) */
function mapImage(m: PdfMap, maxW: number, maxH: number, img: ImageSource): { image: string; width: number; height: number } {
  const k = Math.min(maxW / m.width, maxH / m.height)
  const w = m.width * k
  const h = m.height * k
  return { image: img(request(m.id, w, h, false, m)), width: w, height: h }
}

function routeBlock(r: PdfRoute, width: number, height: number, img: ImageSource, big = false): Content {
  const figs: Content[] = []
  if (r.map) {
    // Karte über die ganze Breite, Höhenprofil darunter
    figs.push({ ...mapImage(r.map, width, height * (big ? 0.55 : 0.36), img), alignment: 'center', margin: [0, 0, 0, 4] })
    if (r.profileSvg) figs.push({ svg: pdfSvg(r.profileSvg), fit: [width, height * (big ? 0.22 : 0.14)] })
    return {
      unbreakable: true,
      stack: [{ text: [{ text: '■ ', color: r.color }, r.name], style: 'h3' }, { text: r.statsText, style: 'meta', margin: [0, 0, 0, 4] }, ...figs],
      margin: [0, 4, 0, 10]
    }
  }
  if (r.trackSvg) figs.push(big ? { svg: pdfSvg(r.trackSvg), fit: [width, height * 0.55], alignment: 'center' } : { svg: pdfSvg(r.trackSvg), fit: [width * 0.42, height * 0.3] })
  if (r.profileSvg) figs.push(big ? { svg: pdfSvg(r.profileSvg), fit: [width, height * 0.22], margin: [0, 8, 0, 0] } : { svg: pdfSvg(r.profileSvg), fit: [width * 0.55, height * 0.2] })
  return {
    unbreakable: true,
    stack: [
      { text: [{ text: '■ ', color: r.color }, r.name], style: 'h3' },
      { text: r.statsText, style: 'meta', margin: [0, 0, 0, 4] },
      big ? { stack: figs } : { columns: figs, columnGap: width * 0.03 }
    ],
    margin: [0, 4, 0, 10]
  }
}

function entryHead(e: PdfEntry): Content[] {
  const meta = [e.location, e.moodLabel].filter(Boolean).join(' · ')
  return [{ text: e.title || 'Ohne Titel', style: 'h2' }, ...(meta ? [{ text: meta, style: 'meta', margin: [0, 0, 0, 6] } as Content] : [])]
}

// ——— Bericht: A4 hoch, Text im Vordergrund ———

function report(input: PdfInput, img: ImageSource): TDocumentDefinitions {
  const g = pageGeometry('a4-hoch', false)
  const W = g.box.w
  const content: Content[] = []

  // Titelseite: Foto oben, darunter Titel
  if (input.cover) {
    const h = g.box.h * 0.62
    content.push({ image: img(request(input.cover.id, W, h, true, input.cover, input.cover.focusY)), width: W, height: h, margin: [0, 0, 0, 18] })
  } else {
    content.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: W, h: 6, color: input.accent }], margin: [0, g.box.h * 0.35, 0, 18] })
  }
  content.push(...titleBlock(input))

  const ov = overview(input, W, g.box.h, img)
  if (ov.length) content.push({ stack: ov, pageBreak: 'before' })

  let first = true
  for (const d of input.days) {
    content.push({
      stack: [{ text: d.dayNo ? `TAG ${d.dayNo} · ${dateLong(d.date).toUpperCase()}` : dateLong(d.date).toUpperCase(), style: 'day' }],
      margin: [0, first ? 0 : 14, 0, 4],
      pageBreak: first ? 'before' : undefined,
      headlineLevel: 1
    })
    first = false
    for (const e of d.entries) {
      content.push(...entryHead(e))
      content.push(...paras(e.text).map((p) => ({ text: p, style: 'text' })))
      if (e.photos.length) content.push(...photoGrid(e.photos, W, g.gutter, img))
    }
    for (const r of d.routes) content.push(routeBlock(r, W, g.box.h, img))
  }
  if (input.otherRoutes.length) {
    content.push({ text: 'Weitere Touren', style: 'h2', margin: [0, 14, 0, 4], headlineLevel: 1, pageBreak: first ? 'before' : undefined })
    for (const r of input.otherRoutes) content.push(routeBlock(r, W, g.box.h, img))
  }

  return {
    info: { title: input.trip.title, author: 'KofferFertigRaus', creator: 'KofferFertigRaus' },
    pageSize: { width: g.width, height: g.height },
    pageMargins: [g.margin, g.margin, g.margin, g.margin + 6],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#222222' },
    styles: styles(input.accent),
    content,
    footer: (page, pages) =>
      page === 1
        ? ''
        : { columns: [{ text: `${input.trip.title} · Erstellt mit „KofferFertigRaus“`, style: 'meta' }, { text: `${page} / ${pages}`, style: 'meta', alignment: 'right' }], margin: [g.margin, 6, g.margin, 0] },
    // Tagesüberschrift nie allein unten auf der Seite
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0
  }
}

function titleBlock(input: PdfInput): Content[] {
  const t = input.trip
  const kicker = [t.destination, t.countryNames].filter(Boolean).join(' · ').toUpperCase()
  return [
    ...(kicker ? [{ text: kicker, style: 'kicker' } as Content] : []),
    { text: t.title, style: 'title', margin: [0, 4, 0, 4] },
    { text: `${dateShort(t.startDate)} – ${dateShort(t.endDate)}`, style: 'dates' },
    ...(t.participants.length ? [{ text: t.participants.join(' · '), style: 'meta', fontSize: 11, margin: [0, 6, 0, 0] } as Content] : [])
  ]
}

/** Fotoraster im Bericht: ab 2 Fotos einheitlich 4:3 zugeschnitten, ein Einzelfoto unbeschnitten */
function photoGrid(photos: PdfPhoto[], W: number, gutter: number, img: ImageSource): Content[] {
  const cols = photoColumns(photos.length, 'bericht')
  const cw = (W - (cols - 1) * gutter) / cols
  const rows: Content[] = []
  for (let i = 0; i < photos.length; i += cols) {
    const row = photos.slice(i, i + cols)
    rows.push({
      columns: [
        ...row.map((p) => {
          if (cols === 1) {
            // ganzes Foto, höchstens 60 % der Seitenhöhe
            const maxH = W * 0.75
            const k = Math.min(cw / p.width, maxH / p.height)
            const w = p.width * k
            const h = p.height * k
            return { stack: [{ image: img(request(p.id, w, h, false, p)), width: w, height: h, alignment: 'center' }, ...caption(p)], width: cw } as Content
          }
          const h = cw * 0.75
          return { stack: [{ image: img(request(p.id, cw, h, true, p)), width: cw, height: h }, ...caption(p)], width: cw } as Content
        }),
        ...Array.from({ length: cols - row.length }, () => ({ text: '', width: cw }) as Content)
      ],
      columnGap: gutter,
      margin: [0, 0, 0, gutter],
      unbreakable: true
    } as Content)
  }
  return rows
}

const caption = (p: PdfPhoto): Content[] => (p.caption ? [{ text: p.caption, style: 'caption', margin: [0, 2, 0, 0] }] : [])

// ——— Fotobuch: große Fotos, jeder Eintrag auf neuer Seite ———

function photobook(input: PdfInput, img: ImageSource): TDocumentDefinitions {
  const o = input.options
  const g = pageGeometry(o.format, o.bleed)
  const content: Content[] = []

  // Titelseite: Foto randlos, Titel auf hellem Band
  const band = Math.min(g.height * 0.3, 70 * MM)
  if (input.cover) {
    content.push({
      stack: [{ image: img(request(input.cover.id, g.width, g.height, true, input.cover, input.cover.focusY)), width: g.width, height: g.height, absolutePosition: { x: 0, y: 0 } }]
    })
    content.push({
      canvas: [{ type: 'rect', x: 0, y: 0, w: g.width, h: band, color: '#ffffff', fillOpacity: 0.86 }],
      absolutePosition: { x: 0, y: g.height - band - g.bleed }
    })
  } else {
    content.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: g.width, h: g.height - band, color: input.accent }], absolutePosition: { x: 0, y: 0 } })
  }
  content.push({ stack: titleBlock(input), absolutePosition: { x: g.margin, y: g.height - band - g.bleed + 16 }, width: g.box.w } as Content)

  const ov = overview(input, g.box.w, g.box.h, img)
  if (ov.length) content.push({ stack: ov, pageBreak: 'before' })

  for (const d of input.days) {
    const dayLine = d.dayNo ? `TAG ${d.dayNo} · ${dateLong(d.date).toUpperCase()}` : dateLong(d.date).toUpperCase()
    let firstOfDay = true
    for (const e of d.entries) {
      const ps = paras(e.text)
      content.push({ text: firstOfDay ? dayLine : ' ', style: 'day', pageBreak: 'before' })
      firstOfDay = false
      content.push(...entryHead(e))
      content.push(...ps.map((p) => ({ text: p, style: 'text', fontSize: 11 })))
      // Platz unter dem Text schätzen: reicht er für die erste Fotogruppe?
      const used = 60 + (e.moodLabel || e.location ? 14 : 0) + estimateTextHeight(ps, g.box.w, 11)
      const free = g.box.h - used - g.gutter
      let photos = e.photos
      const chunks = chunkPhotos(photos.length, o.perPage)
      chunks.forEach((n, i) => {
        const group = photos.slice(0, n)
        photos = photos.slice(n)
        if (i === 0 && free >= g.box.h * 0.45) {
          content.push(flowGroup(group, { x: 0, y: 0, w: g.box.w, h: free }, g, img))
        } else if (n === 1) {
          content.push(...fullBleed(group[0], g, img))
        } else {
          content.push({ ...flowGroup(group, { x: 0, y: 0, w: g.box.w, h: g.box.h }, g, img), pageBreak: 'before' } as Content)
        }
      })
    }
    if (d.routes.length) {
      content.push({ text: firstOfDay ? dayLine : 'TOUREN', style: 'day', pageBreak: 'before' })
      for (const r of d.routes) content.push(routeBlock(r, g.box.w, g.box.h, img, d.routes.length === 1))
    }
  }
  if (input.otherRoutes.length) {
    content.push({ text: 'Weitere Touren', style: 'h2', pageBreak: 'before' })
    for (const r of input.otherRoutes) content.push(routeBlock(r, g.box.w, g.box.h, img))
  }

  return {
    info: { title: `${input.trip.title} – Fotobuch`, author: 'KofferFertigRaus', creator: 'KofferFertigRaus' },
    pageSize: { width: g.width, height: g.height },
    pageMargins: g.margin,
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#222222' },
    styles: styles(input.accent),
    content
  }
}

/** Fotogruppe im Textfluss: Platz reservieren, Fotos darüberlegen (relativ zur aktuellen Stelle) */
function flowGroup(photos: PdfPhoto[], area: Rect, g: PageGeometry, img: ImageSource): ContentStack {
  const slots = slotRects(photos.length, area, g.gutter)
  const items: Content[] = []
  photos.forEach((p, i) => {
    const s = slots[i]
    items.push({ image: img(request(p.id, s.w, s.h, true, p)), width: s.w, height: s.h, relativePosition: { x: s.x, y: s.y } })
    items.push(...overlayCaption(p, s, (pos) => ({ relativePosition: pos })))
  })
  items.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: area.w, h: area.h, lineWidth: 0, lineColor: '#ffffff' }] })
  return { stack: items, unbreakable: true }
}

/** Ein Foto randlos über die ganze Seite (bis in den Beschnitt) */
function fullBleed(p: PdfPhoto, g: PageGeometry, img: ImageSource): Content[] {
  const s = { x: 0, y: 0, w: g.width, h: g.height }
  return [
    {
      stack: [
        { image: img(request(p.id, s.w, s.h, true, p)), width: s.w, height: s.h, absolutePosition: { x: 0, y: 0 } },
        ...overlayCaption(p, { x: g.bleed, y: g.bleed, w: g.width - 2 * g.bleed, h: g.height - 2 * g.bleed - g.margin / 2 }, (pos) => ({ absolutePosition: pos }))
      ],
      pageBreak: 'before'
    }
  ]
}

/** Bildunterschrift halbtransparent unten im Foto */
function overlayCaption(p: PdfPhoto, s: Rect, at: (pos: { x: number; y: number }) => object): Content[] {
  if (!p.caption) return []
  const h = 16
  return [
    { canvas: [{ type: 'rect', x: 0, y: 0, w: s.w, h, color: '#000000', fillOpacity: 0.45 }], ...at({ x: s.x, y: s.y + s.h - h }) } as Content,
    { text: p.caption, fontSize: 8, color: '#ffffff', maxHeight: h, ...at({ x: s.x + 6, y: s.y + s.h - h + 4 }) } as Content
  ]
}
