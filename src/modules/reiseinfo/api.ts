/**
 * Reise- und Sicherheitshinweise vom Auswärtigen Amt (OpenData-Schnittstelle, frei nutzbar).
 * Über den eigenen Server (zwischengespeichert, kein CORS-Problem) – sonst direkt.
 */
import { ServerClient } from '@/core/sync/client'

const AA = 'https://www.auswaertiges-amt.de/opendata/travelwarning'

async function getJson(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(navigator.onLine ? 'Auswärtiges Amt nicht erreichbar.' : 'Für die Reisehinweise wird Internet benötigt.')
  }
  if (!res.ok) throw new Error(`Auswärtiges Amt antwortet mit Fehler ${res.status}.`)
  return res.json()
}

/** Rohdaten (/opendata/travelwarning/<id>) für ein Land */
export async function fetchTravelWarning(country: string): Promise<unknown> {
  const client = await ServerClient.fromSync()
  if (client) return client.json(`/api/reiseinfo/${encodeURIComponent(country)}`)
  const list = (await getJson(AA)) as { response?: Record<string, { countryCode?: string }> & { contentList?: string[] } }
  const id = list.response?.contentList?.find((k) => list.response?.[k]?.countryCode?.toUpperCase() === country)
  if (!id) throw new Error('Für dieses Land gibt es keine Reisehinweise.')
  return getJson(`${AA}/${id}`)
}
