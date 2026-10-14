/**
 * Kartenbild mit Touren (für Reisebericht und PDF): OpenStreetMap-Kacheln als Hintergrund,
 * darüber die Strecken – alles in derselben Web-Mercator-Projektion wie die Karte in der App,
 * damit die Linien genau auf den Wegen liegen.
 *
 * Es werden nur die Kacheln für dieses eine Bild geladen (wie beim Ansehen der Karte) –
 * angesehene Kacheln liegen ohnehin im Zwischenspeicher der App. Ohne Internet: `null`.
 */
import { t } from '@/core/i18n'

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const mapAttribution = () => t('© OpenStreetMap-Mitwirkende')
const TILE = 256

export type LatLon = readonly [number, number, ...unknown[]]

export interface MapLine {
  points: readonly LatLon[]
  color: string
}

/** Pixelkoordinaten in der Welt bei Zoom z */
export function project(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = TILE * 2 ** z
  const la = Math.max(-85.0511, Math.min(85.0511, lat)) * (Math.PI / 180)
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n }
}

export interface MapView {
  z: number
  /** linke obere Ecke des Bildes in Weltpixeln */
  ox: number
  oy: number
  tiles: { x: number; y: number; px: number; py: number }[]
}

/** Größte Zoomstufe, bei der alle Punkte (mit Rand) ins Bild passen; Ausschnitt mittig */
export function fitView(points: readonly LatLon[], width: number, height: number, pad = 24, maxZoom = 16): MapView | null {
  if (!points.length) return null
  let z = maxZoom
  let box = { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  for (; z >= 1; z--) {
    const ps = points.map((p) => project(p[0], p[1], z))
    box = { minX: Math.min(...ps.map((p) => p.x)), maxX: Math.max(...ps.map((p) => p.x)), minY: Math.min(...ps.map((p) => p.y)), maxY: Math.max(...ps.map((p) => p.y)) }
    if (box.maxX - box.minX <= width - 2 * pad && box.maxY - box.minY <= height - 2 * pad) break
  }
  z = Math.max(1, z)
  const ox = Math.round((box.minX + box.maxX) / 2 - width / 2)
  const oy = Math.round((box.minY + box.maxY) / 2 - height / 2)
  const n = 2 ** z
  const tiles: MapView['tiles'] = []
  for (let ty = Math.floor(oy / TILE); ty * TILE < oy + height; ty++) {
    if (ty < 0 || ty >= n) continue
    for (let tx = Math.floor(ox / TILE); tx * TILE < ox + width; tx++) {
      tiles.push({ x: ((tx % n) + n) % n, y: ty, px: tx * TILE - ox, py: ty * TILE - oy })
    }
  }
  return { z, ox, oy, tiles }
}

export interface StaticMapOptions {
  width: number
  height: number
  stroke?: number
  tileUrl?: string
  /** Start- und Zielpunkt markieren (bei einer einzelnen Tour) */
  markers?: boolean
}

/**
 * Zeichnet das Kartenbild. Gibt `null` zurück, wenn die Karte nicht geladen werden kann
 * (offline und nicht im Zwischenspeicher) – dann zeigt der Aufrufer die Strecke ohne Karte.
 */
export async function renderStaticMap(lines: readonly MapLine[], o: StaticMapOptions): Promise<Blob | null> {
  const all = lines.flatMap((l) => l.points)
  const view = fitView(all, o.width, o.height)
  if (!view || typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = o.width
  canvas.height = o.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#eef0ea'
  ctx.fillRect(0, 0, o.width, o.height)

  const url = o.tileUrl ?? TILE_URL
  let failed = 0
  const queue = [...view.tiles]
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      try {
        const res = await fetch(url.replace('{z}', String(view.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y)), { mode: 'cors' })
        if (!res.ok) throw new Error(String(res.status))
        const bmp = await createImageBitmap(await res.blob())
        ctx.drawImage(bmp, t.px, t.py)
        bmp.close()
      } catch {
        failed++
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  if (failed > view.tiles.length / 3) return null

  const sw = o.stroke ?? 4
  const xy = (p: LatLon) => {
    const q = project(p[0], p[1], view.z)
    return [q.x - view.ox, q.y - view.oy] as const
  }
  const path = (pts: readonly LatLon[]) => {
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(...xy(p)) : ctx.moveTo(...xy(p))))
  }
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const l of lines) {
    if (l.points.length < 2) continue
    path(l.points)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = sw + 4
    ctx.stroke()
    path(l.points)
    ctx.strokeStyle = /^#[0-9a-f]{6}$/i.test(l.color) ? l.color : '#e11d48'
    ctx.lineWidth = sw
    ctx.stroke()
  }
  if (o.markers && lines.length === 1 && lines[0].points.length > 1) {
    const pts = lines[0].points
    for (const [p, fill] of [[pts[0], '#16a34a'], [pts[pts.length - 1], '#111827']] as const) {
      ctx.beginPath()
      ctx.arc(...xy(p), 7, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#fff'
      ctx.stroke()
    }
  }
  // Quellenangabe (Pflicht bei OpenStreetMap)
  ctx.font = '12px system-ui, sans-serif'
  const w = ctx.measureText(mapAttribution()).width + 10
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillRect(o.width - w, o.height - 18, w, 18)
  ctx.fillStyle = '#333'
  ctx.fillText(mapAttribution(), o.width - w + 5, o.height - 5)

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
  canvas.width = canvas.height = 0
  return blob
}
