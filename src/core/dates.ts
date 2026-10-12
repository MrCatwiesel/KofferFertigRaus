/** Datums-Hilfen. Daten werden als ISO-String YYYY-MM-DD gespeichert. */

export const DAY_MS = 24 * 60 * 60 * 1000

/** Datum YYYY-MM-DD als UTC-Mitternacht, damit Zeitzonen und Zeitumstellung nicht stören. */
export function toUtcDay(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Differenz in Tagen: b - a. */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcDay(b) - toUtcDay(a)) / DAY_MS)
}

/** Heutiges Datum als YYYY-MM-DD (lokale Zeit). */
export function todayIso(today: Date = new Date()): string {
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Datum + n Tage als YYYY-MM-DD. */
export function addDays(isoDate: string, n: number): string {
  return new Date(toUtcDay(isoDate) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Alle Tage von start bis end (einschließlich), höchstens ein Jahr. */
export function eachDay(start: string, end: string): string[] {
  const n = diffDays(start, end)
  if (!Number.isFinite(n) || n < 0 || n > 366) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i))
}
