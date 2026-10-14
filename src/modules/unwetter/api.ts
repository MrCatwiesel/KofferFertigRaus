/**
 * Unwetterwarnungen von MeteoAlarm – nur über den eigenen Server (er ordnet die Orte den Warnregionen zu,
 * hält die Feeds zwischengespeichert und schickt Warnungen als Push).
 */
import { ServerClient } from '@/core/sync/client'
import type { UnwetterStand } from './types'
import { t } from '@/core/i18n'

export type Antwort = Pick<UnwetterStand, 'warnungen' | 'ohneDaten' | 'fehler'> & { stand: string; orte: { regionen: UnwetterStand['orte'][number]['regionen'] }[] }

export async function fetchUnwetter(orte: { lat: number; lon: number }[], laender: string[]): Promise<Antwort> {
  const client = await ServerClient.fromSync()
  if (!client) throw new Error(t('Unwetterwarnungen kommen über den eigenen Server – erst den Geräte-Abgleich einrichten.'))
  const q = new URLSearchParams({
    orte: orte.map((o) => `${o.lat.toFixed(4)},${o.lon.toFixed(4)}`).join(';'),
    laender: laender.join(',')
  })
  try {
    return await client.json<Antwort>(`/api/unwetter?${q}`)
  } catch (e) {
    if ((e as { status?: number }).status === 404) throw new Error(t('Der Server kennt noch keine Unwetterwarnungen – bitte auf Version 1.18 aktualisieren.'))
    throw e
  }
}
