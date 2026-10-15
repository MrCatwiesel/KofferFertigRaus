import { joinList, language, t, tn } from '@/i18n'
import { ALLERGEN_IDS, ALLERGEN_SOURCE, ALLERGEN_SYNONYMS, PHRASE_IDS, type AllergenId, type PhraseId } from './phrases'
import type { CustomAllergen } from './settings'
import type { PhraseLanguage } from './languages'

/** Landessprachen je Land (nur Sprachen, die der Sprachführer kennt; mehrere = alle anbieten) */
export const LANGUAGE_OF_COUNTRY: Record<string, string[]> = {
  AT: ['de'], CH: ['de', 'fr', 'it'], LI: ['de'], DE: ['de'], LU: ['fr', 'de'],
  FR: ['fr'], MC: ['fr'], BE: ['nl', 'fr'], MA: ['fr'], TN: ['fr'],
  IT: ['it'], SM: ['it'], VA: ['it'],
  ES: ['es'], AD: ['es'], MX: ['es'], CU: ['es'], DO: ['es'], CR: ['es'], AR: ['es'], CL: ['es'], CO: ['es'], PE: ['es'], EC: ['es'], UY: ['es'], PA: ['es'], GT: ['es'],
  PT: ['pt'], BR: ['pt'], CV: ['pt'],
  NL: ['nl'], DK: ['da'], SE: ['sv'], NO: ['no'],
  PL: ['pl'], CZ: ['cs'], SK: ['cs'], HU: ['hu'],
  HR: ['hr'], BA: ['hr'], ME: ['hr'], RS: ['hr'], SI: ['sl'],
  GR: ['el'], CY: ['el'], TR: ['tr'],
  GB: ['en'], IE: ['en'], MT: ['en'], US: ['en'], CA: ['en'], AU: ['en'], NZ: ['en'], ZA: ['en'], SG: ['en'], IN: ['en'], KE: ['en'], TZ: ['en'], NA: ['en'], MU: ['en'], JM: ['en'], BS: ['en']
}

/** Hinweis, wenn die Sprache im Land nicht Amtssprache ist, aber verstanden wird */
export function nearbyNote(country: string, lang: string): string | null {
  if (lang === 'cs' && country === 'SK') return t('Tschechisch wird in der Slowakei gut verstanden.')
  if (lang === 'hr' && ['BA', 'ME', 'RS'].includes(country)) return t('Kroatisch wird in Bosnien, Montenegro und Serbien verstanden.')
  if (lang === 'fr' && ['MA', 'TN'].includes(country)) return t('Französisch ist dort weit verbreitet.')
  return null
}

/** Sprachen für die Länder einer Reise – ohne die Sprache der App, ohne doppelte, nur bekannte */
export function tripLanguages(countries: string[], known: Record<string, PhraseLanguage>, ui = language()): { lang: string; countries: string[] }[] {
  const out: { lang: string; countries: string[] }[] = []
  for (const c of countries)
    for (const lang of LANGUAGE_OF_COUNTRY[c] ?? []) {
      if (lang === ui || !known[lang]) continue
      const hit = out.find((x) => x.lang === lang)
      if (hit) {
        if (!hit.countries.includes(c)) hit.countries.push(c)
      } else out.push({ lang, countries: [c] })
    }
  return out
}

export function languageName(code: string, ui = language()): string {
  try {
    return new Intl.DisplayNames([ui], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Sätze einer Gruppe, die es in der Sprache gibt */
export function phrasesIn(lang: PhraseLanguage, ids: readonly PhraseId[]): PhraseId[] {
  return ids.filter((id) => !!lang.phrases[id])
}

/** Allergie-Karte in der Zielsprache (null ohne Allergien). Eigene Einträge ohne Übersetzung erscheinen wie eingegeben */
export function allergyCard(lang: PhraseLanguage, code: string, allergens: AllergenId[], custom: CustomAllergen[] = []): { lines: string[]; pron: string[]; untranslated: string[] } | null {
  if (!allergens.length && !custom.length) return null
  const own = custom.map((c) => c.tr[code]?.trim() || c.text)
  const list = [...allergens.map((a) => lang.allergens[a]), ...own].join(', ')
  const lines = [lang.phrases.allergic ?? '', list, lang.phrases.without ?? ''].filter(Boolean)
  const pron = lang.pron ? [lang.pron.phrases.allergic ?? '', [...allergens.map((a) => lang.pron!.allergens[a]), ...own].join(', '), lang.pron.phrases.without ?? ''].filter(Boolean) : []
  return { lines, pron, untranslated: custom.filter((c) => !c.tr[code]?.trim()).map((c) => c.text) }
}

const fold = (s: string) => s.trim().toLocaleLowerCase()

/** Eingetipptes Wort → bekanntes Allergen (Name in der Sprache der App, deutsche/englische Synonyme), sonst null */
export function matchAllergen(text: string): AllergenId | null {
  const x = fold(text)
  if (!x) return null
  const byName = ALLERGEN_IDS.find((a) => {
    const name = fold(ALLERGEN_SOURCE[a])
    return name === x || name.replace(/\s*\(.*\)$/, '') === x
  })
  return byName ?? ALLERGEN_SYNONYMS[x] ?? null
}

/** Kurzfassung für die Reiseseite */
export function phrasebookSummary(langs: { lang: string }[], hasCountries: boolean): string {
  if (!hasCountries) return t('Zielland angeben → wichtige Sätze in der Landessprache')
  if (!langs.length) return t('Landessprache wie die App – andere Sprachen im Sprachführer')
  const names = joinList(langs.map((l) => languageName(l.lang)))
  return t('{names} – {count}, auch offline', { names, count: tn(PHRASE_IDS.length, '1 Satz', '{n} Sätze') })
}
