import { language, t } from '@/i18n'
import { ALLERGEN_IDS, ALLERGEN_SOURCE, SOURCE, type PhraseLanguage } from '@/modules/sprachfuehrer/public'
import { CONDITION_IDS, CONDITION_LABEL, type HealthDraft, type HealthProfile } from './types'

export const profileId = (tripId: string, person: string) => `${tripId}:gesundheit:${person}`

export function emptyDraft(): HealthDraft {
  return { allergens: [], custom: [], conditions: [], bloodType: '', otherConditions: '', notes: '', sharedWith: ['*'] }
}

export const personLabel = (person: string) => person || t('Ich')

export const hasAllergies = (p: Pick<HealthProfile, 'allergens' | 'custom'> | undefined | null) => !!p && p.allergens.length + p.custom.length > 0

export function hasContent(p: HealthDraft | undefined | null): boolean {
  return !!p && (hasAllergies(p) || p.conditions.length > 0 || !!p.bloodType || !!p.otherConditions.trim() || !!p.notes.trim())
}

/** Blutgruppe in der Schreibweise einer Sprache (Deutsch: „0“ statt „O“) */
export const bloodTypeText = (bt: string, lang: string) => (lang === 'de' ? bt.replace(/^O/, '0') : bt)

/** Einträge in der Sprache der App (für Listen und Kurzfassung) */
export function allergyNames(p: Pick<HealthProfile, 'allergens' | 'custom'>): string[] {
  return [...ALLERGEN_IDS.filter((a) => p.allergens.includes(a)).map((a) => ALLERGEN_SOURCE[a]), ...p.custom.map((c) => c.text)]
}
export function conditionNames(p: Pick<HealthProfile, 'conditions' | 'otherConditions'>): string[] {
  const out = CONDITION_IDS.filter((c) => p.conditions.includes(c)).map((c) => CONDITION_LABEL[c])
  if (p.otherConditions.trim()) out.push(p.otherConditions.trim())
  return out
}

/** Personen der Reise (Teilnehmer, sonst „ich“) und Einträge zu Namen, die es nicht mehr gibt */
export function personsOf(participants: string[], profiles: HealthProfile[]): string[] {
  const base = participants.length ? [...participants] : ['']
  for (const p of profiles) if (!base.includes(p.person) && hasContent(p)) base.push(p.person)
  return base
}

/** Kurzfassung für die Reiseseite: „Anna: Erdnüsse, Penicillin · Ben: Blutverdünner“ */
export function healthSummary(profiles: HealthProfile[]): string {
  const parts = profiles
    .filter(hasContent)
    .map((p) => {
      const items = [...allergyNames(p), ...CONDITION_IDS.filter((c) => p.conditions.includes(c)).map((c) => CONDITION_LABEL[c])]
      const text = items.length > 3 ? `${items.slice(0, 3).join(', ')} …` : items.join(', ') || t('Angaben vorhanden')
      return p.person ? `${p.person}: ${text}` : text
    })
  return parts.length ? parts.join(' · ') : t('Allergien und Erkrankungen eintragen – für Notfall und Restaurant')
}

/** Eine Zeile der Notfallkarte: in der Zielsprache, Umschrift, in der Sprache der App */
export interface CardRow {
  text: string
  pron: string
  source: string
  strong: boolean
}

/**
 * Notfall- bzw. Allergie-Karte einer Person in einer Sprache. `restaurant`: mit der Bitte, ohne diese Zutaten zu kochen.
 * Ohne Zielsprache (`lang` null) nur in der Sprache der App.
 */
export function medicalCard(lang: PhraseLanguage | null, code: string, p: HealthDraft, opts: { restaurant?: boolean } = {}): { rows: CardRow[]; untranslated: string[] } {
  const rows: CardRow[] = []
  const add = (text: string, pron: string, source: string, strong = false) => rows.push({ text: lang ? text : source, pron: lang ? pron : '', source, strong })
  const allergens = ALLERGEN_IDS.filter((a) => p.allergens.includes(a))
  if (allergens.length || p.custom.length) {
    const own = p.custom.map((c) => (lang ? c.tr[code]?.trim() || c.text : c.text))
    add(lang?.phrases.allergic ?? '', lang?.pron?.phrases.allergic ?? '', SOURCE.allergic)
    add(
      [...allergens.map((a) => lang?.allergens[a] ?? ''), ...own].join(', '),
      lang?.pron ? [...allergens.map((a) => lang.pron!.allergens[a]), ...own].join(', ') : '',
      allergyNames(p).join(', '),
      true
    )
  }
  for (const c of CONDITION_IDS) if (p.conditions.includes(c)) add(lang?.phrases[c] ?? '', lang?.pron?.phrases[c] ?? '', SOURCE[c], c === 'bloodThinner')
  if (p.bloodType) {
    const bt = bloodTypeText(p.bloodType, code)
    add(`${lang?.phrases.bloodType ?? ''} ${bt}`, lang?.pron ? `${lang.pron.phrases.bloodType} ${bt}` : '', `${SOURCE.bloodType} ${bloodTypeText(p.bloodType, language())}`)
  }
  if (opts.restaurant && (allergens.length || p.custom.length)) add(lang?.phrases.without ?? '', lang?.pron?.phrases.without ?? '', SOURCE.without)
  const untranslated = lang ? p.custom.filter((c) => !c.tr[code]?.trim()).map((c) => c.text) : []
  return { rows, untranslated }
}

/** Medikamente für die Notfall-Seite: Dauer- und Notfallmedikamente der Person (oder für alle) */
export function emergencyMeds<M extends { person: string; kind: string; name: string; dose: string }>(meds: M[], person: string): M[] {
  return meds.filter((m) => (m.kind === 'dauer' || m.kind === 'notfall') && (m.person === person || (!m.person && !person)))
}

/** Text für den Notfallpass des Telefons (z. B. iPhone „Health“) – in der Sprache der App */
export function passText(p: HealthDraft, meds: { name: string; dose: string }[]): string {
  const lines: string[] = []
  const allergies = allergyNames(p)
  if (allergies.length) lines.push(t('Allergien: {list}', { list: allergies.join(', ') }))
  const cond = conditionNames(p)
  if (cond.length) lines.push(t('Erkrankungen: {list}', { list: cond.join(', ') }))
  if (meds.length) lines.push(t('Medikamente: {list}', { list: meds.map((m) => (m.dose ? `${m.name} (${m.dose})` : m.name)).join(', ') }))
  if (p.bloodType) lines.push(`${SOURCE.bloodType} ${bloodTypeText(p.bloodType, language())}`)
  if (p.notes.trim()) lines.push(p.notes.trim())
  return lines.join('\n')
}

/** Zusammenführen (Übernahme): Allergien und Erkrankungen vereinigen, Texte nur in leere Felder */
export function mergeDraft(base: HealthDraft, add: Partial<HealthDraft>): HealthDraft {
  const custom = [...base.custom]
  for (const c of add.custom ?? []) {
    const hit = custom.find((x) => x.text.toLocaleLowerCase() === c.text.toLocaleLowerCase())
    if (hit) hit.tr = { ...c.tr, ...hit.tr }
    else custom.push({ ...c, tr: { ...c.tr } })
  }
  return {
    ...base,
    allergens: ALLERGEN_IDS.filter((a) => base.allergens.includes(a) || !!add.allergens?.includes(a)),
    custom,
    conditions: CONDITION_IDS.filter((c) => base.conditions.includes(c) || !!add.conditions?.includes(c)),
    bloodType: base.bloodType || add.bloodType || '',
    otherConditions: base.otherConditions || add.otherConditions || '',
    notes: base.notes || add.notes || ''
  }
}
