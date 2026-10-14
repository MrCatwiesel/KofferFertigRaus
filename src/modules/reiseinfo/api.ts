/**
 * Reise- und Sicherheitshinweise vom Auswärtigen Amt (OpenData-Schnittstelle, frei nutzbar).
 * Über den eigenen Server (zwischengespeichert, kein CORS-Problem) – sonst direkt.
 */
import { ServerClient } from '@/core/sync/client'
import { t } from '@/core/i18n'

const ROOT = 'https://www.auswaertiges-amt.de/opendata'
const AA = `${ROOT}/travelwarning`

async function getJson(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(navigator.onLine ? t('Auswärtiges Amt nicht erreichbar.') : t('Für die Reisehinweise wird Internet benötigt.'))
  }
  if (!res.ok) throw new Error(t('Auswärtiges Amt antwortet mit Fehler {0}.', [res.status]))
  return res.json()
}

/** Rohdaten (/opendata/travelwarning/<id>) für ein Land */
export async function fetchTravelWarning(country: string): Promise<unknown> {
  const client = await ServerClient.fromSync()
  if (client) return client.json(`/api/reiseinfo/${encodeURIComponent(country)}`)
  const list = (await getJson(AA)) as { response?: Record<string, { countryCode?: string }> & { contentList?: string[] } }
  const id = list.response?.contentList?.find((k) => list.response?.[k]?.countryCode?.toUpperCase() === country)
  if (!id) throw new Error(t('Für dieses Land gibt es keine Reisehinweise.'))
  return getJson(`${AA}/${id}`)
}

const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')

/** Deutsche Auslandsvertretungen im Land (Rohdaten eines Landes aus /opendata/representativesInCountry) oder null */
export async function fetchMissions(country: string, countryName: string): Promise<unknown> {
  const client = await ServerClient.fromSync()
  if (client) return (await client.json<{ missions: unknown }>(`/api/reiseinfo/${encodeURIComponent(country)}/vertretungen`)).missions
  const all = ((await getJson(`${ROOT}/representativesInCountry`)) as { response?: Record<string, { country?: string }> }).response ?? {}
  const key = Object.keys(all).find((k) => /^\d+$/.test(k) && norm(all[k]?.country) === norm(countryName))
  return key ? all[key] : null
}
