/**
 * Winzige XML-Hilfen ohne DOM (laufen im Browser und in Tests gleich).
 * Für GPX/KML/TCX reicht das: wir lesen nur Punkte, Namen und Zeiten.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

export function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return ENTITIES[e] ?? m
    })
    .trim()
}

/** Alle Blöcke <tag …>…</tag> (Namensraum-Präfix egal). */
export function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'gi')
  return [...xml.matchAll(re)].map((m) => m[1])
}

/** Text des ersten <tag>…</tag> oder ''. */
export function text(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i')
  const m = re.exec(xml)
  return m ? decodeXml(m[1]) : ''
}

/** Wert eines Attributs aus dem Inhalt eines Start-Tags. */
export function attr(tagContent: string, name: string): string {
  const m = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tagContent)
  return m ? decodeXml(m[2] ?? m[3] ?? '') : ''
}

/** ISO-Zeit → Sekunden seit 1970, sonst null. */
export function isoToSeconds(s: string): number | null {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? Math.round(t / 1000) : null
}

export function num(s: string): number | null {
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Nur gültige Koordinaten. */
export function validLatLon(lat: number | null, lon: number | null): boolean {
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)
}
