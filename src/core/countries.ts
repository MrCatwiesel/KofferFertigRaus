/** Länder (ISO 3166-1 alpha-2) mit deutschen Namen aus dem Browser (Intl.DisplayNames). */
const CODES =
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'.split(' ')

let names: Map<string, string> | null = null

/** Deutscher Name eines Landes, z. B. "AT" → "Österreich" */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['de'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Alle Länder, alphabetisch nach deutschem Namen (ohne Deutschland – Reiseziel im Ausland) */
export function allCountries(): { code: string; name: string }[] {
  names ??= new Map(CODES.map((c) => [c, countryName(c)]))
  return [...names]
    .filter(([c]) => c !== 'DE')
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')

/** Länder, deren Name im Reiseziel vorkommt – z. B. "Gardasee, Italien" → IT */
export function guessCountries(destination: string): string[] {
  const d = norm(destination)
  if (!d.trim()) return []
  return allCountries()
    .filter(({ name }) => name.length > 3 && new RegExp(`(^|[^a-z])${norm(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(d))
    .map((c) => c.code)
}

/** Flaggen-Emoji aus dem Ländercode */
export function flag(code: string): string {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : ''
}
