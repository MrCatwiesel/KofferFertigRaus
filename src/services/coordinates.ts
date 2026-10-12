/**
 * GPS-Koordinaten lesen und schreiben – ohne Internet.
 *
 * Verstanden werden u. a.:
 *   47.0751, 12.7530            47,0751; 12,7530          -33.8568 151.2153
 *   N 47.0751 E 12.7530         47.0751N 12.7530E         (O = Ost geht auch)
 *   N 47° 04.507' E 012° 45.180'                          (Garmin-Anzeige, Grad + Dezimalminuten)
 *   47°04'30.4"N 12°45'10.8"E                             (Grad, Minuten, Sekunden)
 *   Links von Google Maps (…/@47.07,12.75,15z oder ?q=47.07,12.75) und Apple Karten (?ll=…)
 */

export interface LatLon {
  lat: number
  lon: number
}

const valid = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180

function fromUrl(text: string): LatLon | null {
  const m =
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/.exec(text) ??
    /[?&](?:q|ll|query|daddr|destination|sll)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i.exec(text) ??
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(text)
  if (!m) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  return valid(lat, lon) ? { lat, lon } : null
}

/** Koordinaten aus Text – oder null, wenn es keine sind. */
export function parseCoordinates(input: string): LatLon | null {
  if (!input) return null
  const raw = input.trim()
  if (/https?:\/\/|maps\./i.test(raw)) return fromUrl(raw)

  let text = raw
    .toUpperCase()
    .replace(/[″“”]/g, '"')
    .replace(/[′’‘`´]/g, "'")
    .replace(/º|˚/g, '°')
    .replace(/''/g, '"')

  // Nur Zahlen, Himmelsrichtungen und Trennzeichen erlaubt – sonst ist es eine Adresse
  if (/[A-DF-MP-RT-VX-Z]/.test(text.replace(/\b(GRAD|NORD|SÜD|SUED|OST|WEST)\b/g, ''))) return null
  text = text.replace(/\bNORD\b/g, 'N').replace(/\bS(Ü|UE)D\b/g, 'S').replace(/\bOST\b/g, 'E').replace(/\bWEST\b/g, 'W').replace(/\bGRAD\b/g, '°')

  // Dezimalkomma erkennen: "47,0751; 12,7530" oder "47,0751 12,7530"
  const commaDecimals = !text.includes('.') && (text.match(/\d,\d/g) ?? []).length >= 2
  if (commaDecimals) text = text.replace(/(\d),(\d)/g, '$1.$2')

  const hemis = [...text.matchAll(/(?<![A-Z])([NSEWO])(?![A-Z])/g)].map((m) => (m[1] === 'O' ? 'E' : m[1]))
  const nums = [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => m[0])
  if (!nums.length || hemis.length > 2 || hemis.length === 1) return null

  const toDeg = (parts: string[]): number | null => {
    const [d, m = '0', s = '0'] = parts
    const deg = Number(d)
    const min = Number(m)
    const sec = Number(s)
    if (parts.length > 1 && (min >= 60 || min < 0 || sec >= 60 || sec < 0 || d.includes('.') || (parts.length > 2 && m.includes('.')))) return null
    const v = Math.abs(deg) + min / 60 + sec / 3600
    return d.startsWith('-') ? -v : v
  }

  if (nums.length % 2 !== 0 || nums.length > 6) return null
  const half = nums.length / 2
  let a = toDeg(nums.slice(0, half))
  let b = toDeg(nums.slice(half))
  if (a === null || b === null) return null

  if (hemis.length === 2) {
    let [h1, h2] = hemis
    // Länge zuerst angegeben? ("E 12.75 N 47.07")
    if ((h1 === 'E' || h1 === 'W') && (h2 === 'N' || h2 === 'S')) {
      ;[a, b] = [b, a]
      ;[h1, h2] = [h2, h1]
    }
    if (!(h1 === 'N' || h1 === 'S') || !(h2 === 'E' || h2 === 'W')) return null
    if (h1 === 'S') a = -Math.abs(a)
    if (h2 === 'W') b = -Math.abs(b)
  }
  return valid(a, b) ? { lat: a, lon: b } : null
}

/** "47.07510, 12.75300" – zum Kopieren in jede App. */
export function formatDecimal(lat: number, lon: number, digits = 5): string {
  return `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`
}

/** "N 47° 04.506' E 012° 45.180'" – wie auf Garmin-Geräten. */
export function formatGarmin(lat: number, lon: number): string {
  const part = (v: number, pos: string, neg: string, degDigits: number) => {
    const abs = Math.abs(v)
    let d = Math.floor(abs)
    let m = Math.round((abs - d) * 60 * 1000) / 1000
    if (m >= 60) {
      d += 1
      m = 0
    }
    return `${v < 0 ? neg : pos} ${String(d).padStart(degDigits, '0')}° ${m.toFixed(3).padStart(6, '0')}'`
  }
  return `${part(lat, 'N', 'S', 2)} ${part(lon, 'E', 'W', 3)}`
}
