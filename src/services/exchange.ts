/**
 * Wechselkurse der Europäischen Zentralbank über Frankfurter (https://frankfurter.dev) – kostenlos, ohne Schlüssel.
 * Kurse gibt es für Bankarbeitstage; für Wochenende/Feiertage liefert der Dienst den letzten Kurs davor.
 * Abgerufene Kurse bleiben auf dem Gerät gespeichert (offline nutzbar).
 */
import { getMeta, setMeta } from '@/core/meta'

/** Währungen mit EZB-Referenzkurs */
export const ECB_CURRENCIES = new Set('EUR USD JPY BGN CZK DKK GBP HUF PLN RON SEK CHF ISK NOK TRY AUD BRL CAD CNY HKD IDR ILS INR KRW MXN MYR NZD PHP SGD THB ZAR'.split(' '))

export interface Rate {
  /** 1 `from` = rate `to` */
  rate: number
  /** Datum des EZB-Kurses */
  date: string
  /** aus dem Speicher (offline) statt frisch abgerufen */
  cached: boolean
}

const URLS = [
  (from: string, to: string, date: string) => `https://api.frankfurter.dev/v1/${date}?base=${from}&symbols=${to}`,
  (from: string, to: string, date: string) => `https://api.frankfurter.app/${date}?from=${from}&to=${to}`
]

export function parseRate(json: unknown, to: string): { rate: number; date: string } | null {
  const j = json as { rates?: Record<string, unknown>; date?: unknown }
  const rate = j?.rates?.[to]
  return typeof rate === 'number' && rate > 0 && typeof j.date === 'string' ? { rate, date: j.date } : null
}

const key = (from: string, to: string) => `kurs.${from}.${to}`

/**
 * Kurs für ein Datum (künftige Daten → neuester Kurs). Ohne Netz: zuletzt gespeicherter Kurs des Währungspaars.
 * null, wenn es keinen Kurs gibt (Währung ohne EZB-Kurs und nichts gespeichert).
 */
export async function getRate(from: string, to: string, date: string, today: string): Promise<Rate | null> {
  if (from === to) return { rate: 1, date, cached: false }
  const store = await getMeta<Record<string, { rate: number; date: string }>>(key(from, to), {})
  const wanted = date > today ? 'latest' : date
  if (store[wanted] && wanted !== 'latest') return { ...store[wanted], cached: true }
  if (ECB_CURRENCIES.has(from) && ECB_CURRENCIES.has(to) && navigator.onLine) {
    for (const url of URLS) {
      try {
        const res = await fetch(url(from, to, wanted))
        if (!res.ok) continue
        const r = parseRate(await res.json(), to)
        if (!r) continue
        await setMeta(key(from, to), { ...store, [wanted]: r, latest: wanted === 'latest' || r.date >= (store.latest?.date ?? '') ? r : store.latest })
        return { ...r, cached: false }
      } catch {
        /* nächste Adresse */
      }
    }
  }
  // offline oder Dienst nicht erreichbar: nächstliegender gespeicherter Kurs
  const known = Object.values(store).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(date)) - Math.abs(Date.parse(b.date) - Date.parse(date)))[0]
  return known ? { ...known, cached: true } : null
}
