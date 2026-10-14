/** Fotos auf der Karte zu Gruppen zusammenfassen (ohne Leaflet, testbar). */

/**
 * Fotos, die auf der Karte übereinander lägen, zu Gruppen zusammenfassen.
 * `project` rechnet einen Ort in Bildschirm-Pixel um (bei der aktuellen Zoomstufe).
 */
export function groupByPixels<T extends { lat: number; lon: number }>(items: readonly T[], project: (lat: number, lon: number) => { x: number; y: number }, radius = 40): T[][] {
  const groups: { x: number; y: number; items: T[] }[] = []
  for (const it of items) {
    const p = project(it.lat, it.lon)
    const g = groups.find((g) => Math.abs(g.x - p.x) < radius && Math.abs(g.y - p.y) < radius)
    if (g) g.items.push(it)
    else groups.push({ x: p.x, y: p.y, items: [it] })
  }
  return groups.map((g) => g.items)
}
