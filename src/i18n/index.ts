/**
 * Mehrsprachigkeit – bewusst klein und ohne Paket.
 *
 * - Der deutsche Text im Code ist zugleich der Schlüssel: `t('Neue Reise')`.
 *   Deutsch braucht deshalb keine eigene Datei.
 * - Jede weitere Sprache ist genau eine Datei `src/i18n/locales/<code>.ts`
 *   (Standard-Export: Wörterbuch Deutsch → Sprache). Fehlt ein Eintrag, erscheint der deutsche Text.
 * - Platzhalter in geschweiften Klammern: `t('Noch {n} Tage', { n: 3 })`.
 * - Einzahl/Mehrzahl: `tn(n, 'ein Tag', '{n} Tage')`.
 * - Texte, die erst später übersetzt angezeigt werden (z. B. Titel in Listen), mit `tk('…')` markieren
 *   und bei der Anzeige `t(text)` aufrufen – so findet der Test sie trotzdem.
 * - Die Sprache wird einmal beim Start geladen (`loadLanguage`, vor allen anderen Modulen);
 *   ein Wechsel lädt die App neu. Deshalb darf `t()` auch in Konstanten auf Modulebene stehen.
 * - `npx vitest run i18n` zeigt fehlende und überflüssige Einträge.
 */

export type Messages = Record<string, string>
export type Params = Record<string, string | number | null | undefined>

/** Aufbau einer Sprachdatei */
export interface LanguageFile {
  default: Messages
  /** Sprach-Kennung für Datum, Zahlen und Geld (Intl), z. B. 'en-GB' */
  intl?: string
}

const STORAGE_KEY = 'nww-sprache'
export const BASE_LANGUAGE = 'de'

/** Alle Sprachdateien (werden erst bei Bedarf geladen) */
const files = import.meta.glob<LanguageFile>('./locales/*.ts')

function codeOf(path: string): string {
  return path.replace(/^.*\/([^/]+)\.ts$/, '$1')
}

/** Verfügbare Sprachen (Deutsch + alle Dateien in locales/) */
export const LANGUAGES: readonly string[] = [BASE_LANGUAGE, ...Object.keys(files).map(codeOf).sort()]

let lang = BASE_LANGUAGE
let intl = 'de-DE'
let messages: Messages = {}

/** Aktuelle Sprache, z. B. 'de' oder 'en' */
export function language(): string {
  return lang
}

/** Kennung für Intl (Datum, Zahlen, Geld) */
export function intlLocale(): string {
  return intl
}

/** Name einer Sprache in ihr selbst („Deutsch“, „English“, „Ελληνικά“) */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
  } catch {
    return code
  }
}

/** Gewählte Sprache dieses Geräts oder passend zur Gerätesprache (sonst Englisch) */
export function preferredLanguage(
  stored: string | null = readStored(),
  device: readonly string[] = globalThis.navigator?.languages ?? []
): string {
  if (stored && LANGUAGES.includes(stored)) return stored
  for (const l of device) {
    const code = l.toLowerCase().split('-')[0]
    if (LANGUAGES.includes(code)) return code
  }
  return device.length ? (LANGUAGES.includes('en') ? 'en' : BASE_LANGUAGE) : BASE_LANGUAGE
}

function readStored(): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

/** Ob auf diesem Gerät ausdrücklich eine Sprache gewählt wurde */
export function hasChosenLanguage(): boolean {
  return readStored() !== null
}

/** Sprache laden – einmal beim Start, bevor die übrigen Module ausgeführt werden. */
export async function loadLanguage(code: string = preferredLanguage()): Promise<void> {
  const loader = files[`./locales/${code}.ts`]
  if (code === BASE_LANGUAGE || !loader) {
    useMessages(BASE_LANGUAGE, {}, 'de-DE')
    return
  }
  try {
    const file = await loader()
    useMessages(code, file.default, file.intl ?? code)
  } catch {
    useMessages(BASE_LANGUAGE, {}, 'de-DE')
  }
}

/** Wörterbuch direkt setzen (Tests, Betrachter-Seite) */
export function useMessages(code: string, dict: Messages, intlCode = code): void {
  lang = code
  messages = dict
  intl = intlCode
  if (globalThis.document) document.documentElement.lang = code
}

/** Sprache wählen und die App neu laden (`null` = wie das Gerät) */
export function chooseLanguage(code: string | null): void {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* privates Fenster: gilt dann nur bis zum Neuladen */
  }
  location.reload()
}

function fill(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name] ?? '') : all))
}

/** Übersetzen. Der deutsche Text ist der Schlüssel. */
export function t(text: string, params?: Params): string {
  return fill(messages[text] || text, params)
}

/** Einzahl/Mehrzahl: `tn(3, 'ein Foto', '{n} Fotos')`; `{n}` ist immer gesetzt. */
export function tn(n: number, one: string, other: string, params?: Params): string {
  const form = new Intl.PluralRules(intl).select(n) === 'one' ? one : other
  return t(form, { n: formatCount(n), ...params })
}

/** Markiert einen Text zum Übersetzen, ohne ihn schon zu übersetzen (Anzeige später mit `t(text)`). */
export function tk<T extends string>(text: T): T {
  return text
}

/** Ganze Zahl im Format der Sprache */
function formatCount(n: number): string {
  return Number.isInteger(n) ? new Intl.NumberFormat(intl).format(n) : String(n)
}

/** „A, B und C“ / „A, B and C“ */
export function joinList(items: readonly string[]): string {
  const list = items.filter(Boolean)
  if (list.length <= 1) return list[0] ?? ''
  try {
    return new Intl.ListFormat(intl, { type: 'conjunction' }).format(list)
  } catch {
    return `${list.slice(0, -1).join(', ')} ${t('und')} ${list[list.length - 1]}`
  }
}
