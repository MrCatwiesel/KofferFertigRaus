import { partText, warningLabel } from './parse'
import { SOURCE_URL, type CountryInfo } from './types'

const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString('de-DE') : '')
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
  const stand = `Quelle: Auswärtiges Amt, Stand ${date(i.lastModified)} – ${SOURCE_URL}`
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
      title: `Einreise ${name}${visaNeeded ? ' – Visum nötig' : ''}`,
      status: visaNeeded ? 'fehlt' : 'vorhanden',
      notes: [docs && `Reisedokumente:\n${clip(docs)}`, visa && `Visum:\n${clip(visa, 800)}`, entryOther && `Einreise:\n${clip(entryOther, 800)}`, stand].filter(Boolean).join('\n\n')
    },
    {
      source: `aa:${i.country}:impfschutz`,
      type: 'gesundheit',
      title: `Impfschutz ${name}${requiredVacc.length ? ` – Pflicht: ${requiredVacc.join(', ')}` : ''}`,
      status: requiredVacc.length ? 'fehlt' : 'vorhanden',
      notes: [i.vaccines.length ? `Genannte Impfungen: ${i.vaccines.map((v) => v.name + (v.required ? ' (Pflicht)' : '')).join(', ')}` : '', vacc && clip(vacc), stand].filter(Boolean).join('\n\n')
    },
    {
      source: `aa:${i.country}:sicherheit`,
      type: 'sonstiges',
      title: `Sicherheitslage ${name}: ${w.text}`,
      status: 'vorhanden',
      notes: [w.text, securityText && clip(securityText, 1200), stand].filter(Boolean).join('\n\n')
    }
  ]
}
