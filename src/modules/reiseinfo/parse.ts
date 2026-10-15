/**
 * Reise- und Sicherheitshinweise des Auswärtigen Amts (OpenData) in Abschnitte und reinen Text zerlegen.
 * Das HTML wird nie angezeigt – nur der Text daraus (kein Einschleusen von Inhalten möglich).
 * Ohne Browser-DOM, damit es auch in Tests und auf dem Server läuft.
 */
import type { CountryInfo, InfoSection, Mission } from './types'

import { decodeEntities, htmlToText } from '@/core/html-text'
import { t } from '@/i18n'

export { decodeEntities, htmlToText }

/** In Abschnitte (h2) und Unterabschnitte (h3) zerlegen */
export function splitSections(html: string): InfoSection[] {
  const sections: InfoSection[] = []
  const h2 = html.split(/<h2[^>]*>/i).slice(1)
  for (const chunk of h2) {
    const [titleHtml, rest = ''] = chunk.split(/<\/h2>/i)
    const title = htmlToText(titleHtml)
    if (!title) continue
    const parts: InfoSection['parts'] = []
    const bits = rest.split(/<h3[^>]*>/i)
    const intro = htmlToText(bits[0])
    if (intro) parts.push({ title: '', text: intro })
    for (const b of bits.slice(1)) {
      const [t, body = ''] = b.split(/<\/h3>/i)
      const text = htmlToText(body)
      if (text) parts.push({ title: htmlToText(t), text })
    }
    sections.push({ title, parts })
  }
  return sections
}

/** Impfungen, die im Text genannt werden (Gelbfieber als Pflicht, wenn ein Nachweis vorgeschrieben ist) */
const VACCINES: [string, RegExp][] = [
  ['Gelbfieber', /gelbfieber/i],
  ['FSME', /\bfsme\b|frühsommer-meningo/i],
  ['Tetanus', /tetanus/i],
  ['Diphtherie', /diphtherie/i],
  ['Keuchhusten (Pertussis)', /pertussis|keuchhusten/i],
  ['Polio', /polio|kinderlähmung/i],
  ['Masern', /masern/i],
  ['Hepatitis A', /hepatitis\s*a\b/i],
  ['Hepatitis B', /hepatitis\s*b\b/i],
  ['Typhus', /typhus/i],
  ['Tollwut', /tollwut/i],
  ['Japanische Enzephalitis', /japanische[n]?\s+enzephalitis/i],
  ['Meningokokken', /meningokokken/i],
  ['Cholera', /cholera/i],
  ['Influenza', /influenza|grippe/i],
  ['Dengue', /dengue-impf|impfung gegen dengue|dengue[^.]{0,40}impf/i],
  ['COVID-19', /covid-19[^.]{0,40}impf|impf[^.]{0,40}covid-19/i]
]

export function findVaccines(text: string): { name: string; required: boolean }[] {
  const out: { name: string; required: boolean }[] = []
  for (const [name, re] of VACCINES) {
    if (!re.test(text)) continue
    const required =
      name === 'Gelbfieber'
        ? /gelbfieber[^.]{0,160}(vorgeschrieben|pflicht|verlangt|nachweis[^.]{0,40}erforderlich)/i.test(text) && !/keine[^.]{0,40}gelbfieber[^.]{0,80}vorgeschrieben/i.test(text)
        : false
    out.push({ name, required })
  }
  return out
}

interface AaEntry {
  title?: string
  countryCode?: string
  countryName?: string
  warning?: boolean
  partialWarning?: boolean
  situationWarning?: boolean
  situationPartWarning?: boolean
  lastModified?: number
  lastChanges?: string
  content?: string
}

/** Antwort von /opendata/travelwarning/<id> → Daten für CountryInfo (ohne Kennungen/Zeiten der App) */
export function parseTravelWarning(json: unknown): Omit<CountryInfo, 'id' | 'tripId' | 'fetchedAt' | 'unseenChange' | 'createdAt' | 'updatedAt'> {
  const resp = (json as { response?: Record<string, unknown> & { contentList?: string[] } })?.response
  const id = resp?.contentList?.[0]
  const e = (id ? resp?.[id] : null) as AaEntry | null
  if (!e?.content) throw new Error(t('Keine Reisehinweise erhalten.'))
  const sections = splitSections(e.content)
  const health = sections.find((s) => /gesundheit/i.test(s.title))
  const vaccText = health?.parts.filter((p) => /impf/i.test(p.title) || /impf/i.test(p.text.slice(0, 300))).map((p) => p.text).join('\n') ?? ''
  return {
    country: String(e.countryCode ?? '').toUpperCase(),
    countryName: e.countryName ?? '',
    title: e.title ?? '',
    warning: !!e.warning,
    partialWarning: !!e.partialWarning,
    situationWarning: !!e.situationWarning,
    situationPartWarning: !!e.situationPartWarning,
    lastModified: e.lastModified ? new Date(e.lastModified * 1000).toISOString() : '',
    lastChanges: e.lastChanges ? htmlToText(e.lastChanges) : '',
    sections,
    vaccines: findVaccines(vaccText)
  }
}

/** Kurzfassung der Warnlage */
export function warningLabel(i: Pick<CountryInfo, 'warning' | 'partialWarning' | 'situationWarning' | 'situationPartWarning'>): { level: 'danger' | 'warning' | 'ok'; text: string } {
  if (i.warning) return { level: 'danger', text: t('Reisewarnung für das ganze Land') }
  if (i.partialWarning) return { level: 'danger', text: t('Teilreisewarnung für einzelne Gebiete') }
  if (i.situationWarning) return { level: 'warning', text: t('Warnung wegen besonderer Lage') }
  if (i.situationPartWarning) return { level: 'warning', text: t('Teilweise Warnung wegen besonderer Lage') }
  return { level: 'ok', text: t('Keine Reisewarnung') }
}

/** Text eines Unterabschnitts suchen (z. B. Abschnitt „Einreise und Zoll“ → „Reisedokumente“) */
export function partText(sections: InfoSection[], section: RegExp, part: RegExp): string {
  const s = sections.find((x) => section.test(x.title))
  return s?.parts.find((p) => part.test(p.title))?.text ?? ''
}

const PHONE_RE = /\+\d[\d\s/().-]{5,}\d/g

/** Telefonnummer für Notfälle aus einem Text: die erste Nummer nach „Notfall“, „Bereitschaft“ oder „Notdienst“ */
export function findEmergencyPhone(text: string): string {
  const m = /not(fall|fälle|dienst)|bereitschaft/i.exec(text)
  if (!m) return ''
  const after = text.slice(m.index, m.index + 300)
  return after.match(PHONE_RE)?.[0].replace(/\s+/g, ' ').trim() ?? ''
}

const str = (v: unknown) => (typeof v === 'string' ? htmlToText(v) : '')

/** Eintrag aus /opendata/representativesInCountry (ein Land) → Vertretungen, Botschaft zuerst */
export function parseMissions(entry: unknown): Mission[] {
  if (!entry || typeof entry !== 'object') return []
  const e = entry as Record<string, unknown> & { contentList?: string[] }
  const ids = e.contentList ?? Object.keys(e).filter((k) => /^\d+$/.test(k))
  const out: Mission[] = []
  for (const id of ids) {
    const m = e[id] as Record<string, unknown> | undefined
    if (!m || typeof m !== 'object') continue
    const description = str(m.description)
    const open = str(m.open)
    const web = Array.isArray(m.website) ? m.website.find((w) => typeof w === 'string') : m.website
    out.push({
      id: String(id),
      description,
      main: !/honorar/i.test(description),
      city: str(m.city),
      address: str(m.address).replace(/\s*;\s*/g, ', '),
      phone: str(m.phone),
      emergency: findEmergencyPhone(`${open}\n${str(m.misc)}`),
      mail: str(m.mail),
      website: typeof web === 'string' && /^https?:\/\//i.test(web) ? web : '',
      open
    })
  }
  const rank = (m: Mission) => (/botschaft/i.test(m.description) ? 0 : m.main ? 1 : 2)
  return out.sort((a, b) => rank(a) - rank(b) || a.city.localeCompare(b.city, 'de'))
}

/** Kurzname, z. B. „Deutsche Botschaft Wien“, „Honorarkonsul Zell am See“ */
export function missionName(m: Pick<Mission, 'description' | 'city'>): string {
  const d = m.description
  const kind = /botschaft/i.test(d) && !/visastelle/i.test(d)
    ? t('Deutsche Botschaft')
    : /generalkonsulat/i.test(d)
      ? t('Deutsches Generalkonsulat')
      : /honorarkonsulin/i.test(d)
        ? t('Honorarkonsulin')
        : /honorarkonsul/i.test(d)
          ? t('Honorarkonsul')
          : d.replace(/\s*der Bundesrepublik Deutschland/i, '').trim() || t('Vertretung')
  return m.city ? `${kind} ${m.city}` : kind
}
