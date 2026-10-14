/** Reine Funktionen des Moduls „Unwetter“ (ohne Datenbank und Netz). */
import { addDays } from '@/core/dates'
import type { UnwetterOrt, UnwetterStand, Warnung } from './types'
import { locale, t } from '@/core/i18n'

/** So viele Tage vor der Reise werden Warnungen schon geholt */
export const VORLAUF_TAGE = 7

/** Reise jetzt interessant für Warnungen? (ab 7 Tage vorher bis zum letzten Tag) */
export function imZeitfenster(trip: { startDate: string; endDate: string }, today: string): boolean {
  return !!trip.startDate && !!trip.endDate && today >= addDays(trip.startDate, -VORLAUF_TAGE) && today <= trip.endDate
}

interface OrtQuellen {
  trip: { startDate: string; endDate: string }
  /** Unterkünfte mit Ort (nicht storniert) */
  unterkuenfte: { name: string; lat: number; lon: number; checkIn: string; checkOut: string }[]
  /** Ort der Wettervorhersage im Tagesplan */
  wetter?: { name: string; lat: number; lon: number } | null
  /** Reiseziel, als Ort gesucht */
  ziel?: { name: string; lat: number; lon: number } | null
}

/**
 * Orte der Reise: Unterkünfte (für ihren Zeitraum), dazu der Wetter-Ort für die ganze Reise;
 * nur wenn beides fehlt, das gesuchte Reiseziel. Nahe beieinander (< ~1 km) zählt einmal, höchstens 20.
 */
export function reiseOrte({ trip, unterkuenfte, wetter, ziel }: OrtQuellen): UnwetterOrt[] {
  const out: UnwetterOrt[] = []
  const add = (o: UnwetterOrt) => {
    const near = out.find((x) => Math.abs(x.lat - o.lat) < 0.01 && Math.abs(x.lon - o.lon) < 0.01)
    if (!near) return void out.push(o)
    if (o.von < near.von) near.von = o.von
    if (o.bis > near.bis) near.bis = o.bis
  }
  for (const u of unterkuenfte) {
    add({ name: u.name || t('Unterkunft'), lat: u.lat, lon: u.lon, von: u.checkIn || trip.startDate, bis: u.checkOut || trip.endDate, quelle: 'unterkunft' })
  }
  if (wetter) add({ name: wetter.name, lat: wetter.lat, lon: wetter.lon, von: trip.startDate, bis: trip.endDate, quelle: 'wetter' })
  if (!out.length && ziel) add({ name: ziel.name, lat: ziel.lat, lon: ziel.lon, von: trip.startDate, bis: trip.endDate, quelle: 'ziel' })
  return out.filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon)).slice(0, 20)
}

/** Noch gültige Warnungen (nicht abgelaufen), am Reiseort zuerst, dann nach Stufe */
export function aktuelle(stand: UnwetterStand | undefined | null, now = Date.now()): Warnung[] {
  return (stand?.warnungen ?? [])
    .filter((w) => !w.ende || Date.parse(w.ende) > now)
    .sort((a, b) => Number(a.ortlos) - Number(b.ortlos) || b.stufe - a.stufe || a.beginn.localeCompare(b.beginn))
}

/** Warnung betrifft einen Ort an einem Tag, an dem man dort ist? */
export function betrifftReise(w: Warnung, stand: UnwetterStand): boolean {
  if (w.ortlos) return true
  const tagVon = w.beginn ? w.beginn.slice(0, 10) : ''
  const tagBis = w.ende ? w.ende.slice(0, 10) : '9999-12-31'
  return w.orte.some((i) => {
    const o = stand.orte[i]
    return !!o && (!tagVon || tagVon <= o.bis) && tagBis >= o.von
  })
}

/** „Di. 14:00 – Mi. 02:00“ (lokale Zeit des Geräts) */
export function zeitraum(w: Pick<Warnung, 'beginn' | 'ende'>, now = Date.now()): string {
  const fmt = new Intl.DateTimeFormat(locale(), { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const f = (iso: string) => fmt.format(new Date(iso)).replace(',', '')
  const b = Date.parse(w.beginn)
  const von = !Number.isNaN(b) && b > now ? f(w.beginn) : t('jetzt')
  return w.ende ? `${von} – ${f(w.ende)}` : t('ab {0}', [von])
}

/** Wo? Regionen am Reiseort, sonst die Gebiete laut Wetterdienst */
export const wo = (w: Warnung) => (w.regionen.length ? w.regionen.map((r) => r.name) : w.bereiche).slice(0, 4).join(', ') + (w.bereiche.length > 4 && !w.regionen.length ? ' …' : '')

/** Kurzfassung für die Reiseseite */
export function zusammenfassung(liste: Warnung[]): string {
  const amOrt = liste.filter((w) => !w.ortlos)
  if (!amOrt.length) return liste.length ? t('Keine Warnung an den Reiseorten ({0} sonst im Land)', [liste.length]) : t('Keine Warnungen an den Reiseorten')
  const top = amOrt[0]
  const more = amOrt.length - 1
  return `${t(top.stufeName)}: ${t(top.artName)} (${wo(top)})${more ? t(' · {0} weitere', [more]) : ''}`
}
