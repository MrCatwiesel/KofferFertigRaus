import { missionName, partText, warningLabel } from './parse'
import { SOURCE_URL, type CountryInfo } from './types'
import { t, intlLocale } from '@/i18n'

const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString(intlLocale()) : '')
const clip = (s: string, n = 1500) => (s.length > n ? `${s.slice(0, n).trimEnd()} …` : s)

/** Eintrag für die Dokumentenliste (wie ein TravelDocumentDraft, plus Kennung für spätere Aktualisierung) */
export interface InfoDocument {
  source: string
  type: 'visum' | 'gesundheit' | 'sonstiges'
  title: string
  status: 'fehlt' | 'vorhanden'
  notes: string
}

/**
 * Aus den Reisehinweisen eines Landes drei Einträge für die Dokumentenliste:
 * Einreise/Reisedokumente, Impfschutz und Sicherheitslage – jeweils mit Stand und Quelle.
 */
export function infoDocuments(i: CountryInfo): InfoDocument[] {
  const name = i.countryName || i.country
  const stand = t('Quelle: Auswärtiges Amt, Stand {date} – {url}', { date: date(i.lastModified), url: SOURCE_URL })
  const docs = partText(i.sections, /einreise/i, /reisedokument/i)
  const visa = partText(i.sections, /einreise/i, /visum|visa/i)
  const entryOther = partText(i.sections, /einreise/i, /einreise|elektronisch|registrier/i)
  const vacc = partText(i.sections, /gesundheit/i, /impf/i)
  const w = warningLabel(i)
  const security = i.sections.find((s) => /sicherheit/i.test(s.title))
  const securityText = security?.parts.map((p) => (p.title ? `${p.title}:\n${p.text}` : p.text)).join('\n\n') ?? ''
  const visaNeeded = /visum[^.]{0,60}(erforderlich|benötigt|notwendig)/i.test(visa) && !/(kein|ohne)[^.]{0,30}visum/i.test(visa)
  const requiredVacc = i.vaccines.filter((v) => v.required).map((v) => v.name)
  return [
    {
      source: `aa:${i.country}:einreise`,
      type: 'visum',
      title: visaNeeded ? t('Einreise {country} – Visum nötig', { country: name }) : t('Einreise {country}', { country: name }),
      status: visaNeeded ? 'fehlt' : 'vorhanden',
      notes: [
        docs && `${t('Reisedokumente:')}\n${clip(docs)}`,
        visa && `${t('Visum:')}\n${clip(visa, 800)}`,
        entryOther && `${t('Einreise:')}\n${clip(entryOther, 800)}`,
        stand
      ]
        .filter(Boolean)
        .join('\n\n')
    },
    {
      source: `aa:${i.country}:impfschutz`,
      type: 'gesundheit',
      title: requiredVacc.length
        ? t('Impfschutz {country} – Pflicht: {vaccines}', { country: name, vaccines: requiredVacc.join(', ') })
        : t('Impfschutz {country}', { country: name }),
      status: requiredVacc.length ? 'fehlt' : 'vorhanden',
      notes: [
        i.vaccines.length ? t('Genannte Impfungen: {list}', { list: i.vaccines.map((v) => v.name + (v.required ? ' ' + t('(Pflicht)') : '')).join(', ') }) : '',
        vacc && clip(vacc),
        stand
      ]
        .filter(Boolean)
        .join('\n\n')
    },
    {
      source: `aa:${i.country}:sicherheit`,
      type: 'sonstiges',
      title: t('Sicherheitslage {country}: {text}', { country: name, text: w.text }),
      status: 'vorhanden',
      notes: [w.text, securityText && clip(securityText, 1200), stand].filter(Boolean).join('\n\n')
    }
  ]
}

/** Eintrag für die Notfallnummern (wie ein EmergencyContactDraft, plus Kennung) */
export interface InfoContact {
  source: string
  label: string
  phone: string
  notes: string
}

const normPlace = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')

/**
 * Notfallnummern aus den Auslandsvertretungen: Botschaft/Konsulate (Telefon und – falls genannt – Bereitschaftsdienst
 * für Notfälle), dazu Honorarkonsuln, deren Ort im Reiseziel vorkommt.
 */
export function missionContacts(i: CountryInfo, destination = ''): InfoContact[] {
  const dest = normPlace(destination)
  const out: InfoContact[] = []
  for (const m of i.missions ?? []) {
    const near = !!m.city && dest.includes(normPlace(m.city))
    if (!m.main && !near) continue
    const name = missionName(m)
    const src = `aa:${i.country}:vertretung:${m.id}`
    const extra = [m.address, m.mail && t('E-Mail: {mail}', { mail: m.mail }), m.website].filter(Boolean).join(' · ')
    if (m.phone) out.push({ source: src, label: name, phone: m.phone, notes: [extra, m.open && clip(m.open, 300), t('Quelle: Auswärtiges Amt')].filter(Boolean).join('\n') })
    if (m.emergency && m.emergency !== m.phone)
      out.push({
        source: `${src}:notfall`,
        label: t('{name} – Notfall-Bereitschaft', { name }),
        phone: m.emergency,
        notes: t('Außerhalb der Öffnungszeiten, nur in dringenden Notfällen (z. B. Pass verloren, Festnahme, schwerer Unfall). Quelle: Auswärtiges Amt')
      })
  }
  return out
}
