/**
 * Sprachen der App (Deutsch, Englisch) – ohne Fremdpakete.
 *
 * Der deutsche Text ist zugleich der Schlüssel: `t('Neue Reise')` liefert auf Englisch „New trip“.
 * Fehlt eine Übersetzung, erscheint der deutsche Text. Platzhalter: `t('{n} Tage', { n: 3 })` oder `t('{0} von {1}', [a, b])`.
 * Die englischen Texte liegen in `en/*.ts` und werden nur geladen, wenn Englisch gewählt ist.
 * Prüfen, ob alles übersetzt ist: `npm test` (src/core/__tests__/i18n.test.ts).
 */
import { ref } from 'vue'

export type Lang = 'de' | 'en'
export type LangSetting = 'auto' | Lang
type Params = Record<string, unknown> | unknown[]

const STORE_KEY = 'nww.sprache'

/** Aktuelle Sprache (reaktiv – Vorlagen zeichnen sich bei Wechsel neu) */
export const lang = ref<Lang>('de')
let dict: Record<string, string> = {}

/**
 * Englisch automatisch für Geräte, die nicht Deutsch sprechen? Erst, wenn alles übersetzt ist –
 * bis dahin nur, wenn man Englisch in den Einstellungen ausdrücklich wählt.
 */
export const ENGLISH_COMPLETE = false

/** Sprache des Geräts: Deutsch nur, wenn das Gerät Deutsch spricht – sonst Englisch */
export function deviceLang(languages: readonly string[] = globalThis.navigator?.languages ?? [], complete = ENGLISH_COMPLETE): Lang {
  const first = languages[0] ?? 'de'
  return /^de\b/i.test(first) || !complete ? 'de' : 'en'
}

export function langSetting(): LangSetting {
  try {
    const v = localStorage.getItem(STORE_KEY)
    return v === 'de' || v === 'en' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Platzhalter einsetzen */
export function fill(text: string, params?: Params): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = Array.isArray(params) ? params[Number(k)] : (params as Record<string, unknown>)[k]
    return v === undefined || v === null ? (Array.isArray(params) || k in params ? '' : m) : String(v)
  })
}

/** Übersetzen (deutscher Text = Schlüssel) */
export function t(de: string, params?: Params): string {
  const out = lang.value === 'de' ? de : (dict[de] ?? de)
  return fill(out, params)
}

/** Einzahl/Mehrzahl: tn(n, '{n} Tag', '{n} Tage') – `n` steht als Platzhalter bereit */
export function tn(n: number, one: string, many: string, params?: Record<string, unknown>): string {
  return t(n === 1 ? one : many, { n: formatNumber(n), ...(params ?? {}) })
}

/** Markiert einen Text in Konstanten zum Übersetzen (gibt ihn unverändert zurück; übersetzt wird beim Lesen über `translated`) */
const MARKED = new Set<string>()
export function N_<T extends string>(de: T): T {
  MARKED.add(de)
  return de
}

const proxies = new WeakMap<object, object>()
/**
 * Konstanten mit Beschriftungen (z. B. `{ auto: N_('Auto') }` oder Listen von `{ label: N_('…') }`):
 * Beim Lesen werden mit N_ markierte Texte in der aktuellen Sprache geliefert – auch verschachtelt.
 */
export function translated<T extends object>(obj: T): T {
  const hit = proxies.get(obj)
  if (hit) return hit as T
  const p = new Proxy(obj, {
    get(target, key, recv) {
      const v = Reflect.get(target, key, recv)
      if (typeof v === 'string') return MARKED.has(v) ? t(v) : v
      if (v && typeof v === 'object' && !(v instanceof Blob) && !(v instanceof Date)) return translated(v)
      return v
    }
  })
  proxies.set(obj, p)
  return p
}

/** Sprach-Kennung für Datum und Zahlen */
export const locale = (): string => (lang.value === 'en' ? 'en-GB' : 'de-DE')

export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(locale(), opts)

/** Englische Texte laden (alle Teile zusammen) */
async function loadEnglish(): Promise<Record<string, string>> {
  const parts = import.meta.glob<{ default: Record<string, string> }>('./en/*.ts')
  const out: Record<string, string> = {}
  for (const load of Object.values(parts)) Object.assign(out, (await load()).default)
  return out
}

/** Sprache setzen (und merken); 'auto' = wie das Gerät */
export async function setLang(setting: LangSetting): Promise<void> {
  try {
    if (setting === 'auto') localStorage.removeItem(STORE_KEY)
    else localStorage.setItem(STORE_KEY, setting)
  } catch {
    /* privates Fenster – gilt dann nur bis zum Schließen */
  }
  const next = setting === 'auto' ? deviceLang() : setting
  if (next === 'en' && !Object.keys(dict).length) dict = await loadEnglish()
  lang.value = next
  if (globalThis.document) document.documentElement.lang = next
}

/** Beim Start (vor dem Anzeigen) */
export const startLang = () => setLang(langSetting())

/** Nur für Tests: Wörterbuch direkt setzen */
export function useDictForTests(next: Lang, d: Record<string, string>): void {
  dict = d
  lang.value = next
}
