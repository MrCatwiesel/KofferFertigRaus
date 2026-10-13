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

// ---------------------------------------------------------------- Länderdaten für Packliste und Währungen

/** Länder mit Euro (Stand 2026, inkl. Bulgarien seit 1.1.2026 und Länder, die den Euro ohne EU nutzen) */
const EURO = new Set('AT BE BG HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK'.split(' '))

/** EU-Roaming („Roam like at home“): EU + Island, Liechtenstein, Norwegen */
const EU_ROAMING = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO'.split(' '))

const CURRENCY: Record<string, string> = {
  CH: 'CHF', LI: 'CHF', GB: 'GBP', CZ: 'CZK', PL: 'PLN', HU: 'HUF', DK: 'DKK', SE: 'SEK', NO: 'NOK', IS: 'ISK', RO: 'RON',
  RS: 'RSD', BA: 'BAM', AL: 'ALL', MK: 'MKD', MD: 'MDL', UA: 'UAH', TR: 'TRY', GE: 'GEL', AM: 'AMD', AZ: 'AZN', RU: 'RUB',
  US: 'USD', CA: 'CAD', MX: 'MXN', CU: 'CUP', DO: 'DOP', CR: 'CRC', PA: 'PAB', CO: 'COP', PE: 'PEN', CL: 'CLP', AR: 'ARS', BR: 'BRL',
  MA: 'MAD', TN: 'TND', EG: 'EGP', ZA: 'ZAR', KE: 'KES', TZ: 'TZS', NA: 'NAD', MU: 'MUR', SC: 'SCR', CV: 'CVE',
  AE: 'AED', OM: 'OMR', QA: 'QAR', JO: 'JOD', IL: 'ILS', SA: 'SAR', IN: 'INR', LK: 'LKR', MV: 'MVR', NP: 'NPR', TH: 'THB', VN: 'VND',
  KH: 'KHR', LA: 'LAK', MY: 'MYR', SG: 'SGD', ID: 'IDR', PH: 'PHP', CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW',
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD'
}

/** Währung eines Landes (ISO 4217) – Euro-Länder „EUR“, unbekannt null */
export function currencyOf(country: string): string | null {
  return EURO.has(country) ? 'EUR' : (CURRENCY[country] ?? null)
}

/** Deutscher Name einer Währung, z. B. "CHF" → "Schweizer Franken" */
export function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames(['de'], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

export const inEuRoaming = (country: string) => EU_ROAMING.has(country)

/** Steckdosen, in die deutsche Stecker (Typ C/F) nicht oder nur teilweise passen */
const PLUGS: Record<string, string> = {}
for (const [type, list] of Object.entries({
  'G (britisch)': 'GB IE MT CY AE SG MY HK KE TZ UG QA BH KW OM SA NG GH ZM ZW BW MU SC',
  'A/B (amerikanisch)': 'US CA MX JP CU DO CR PA GT HN NI SV TW PH CO VE EC',
  'I (australisch/chinesisch)': 'AU NZ CN AR FJ PG',
  'J (Schweiz – flache Eurostecker passen)': 'CH LI',
  'L (Italien – flache Eurostecker passen)': 'IT SM VA',
  'D/M (indisch/südafrikanisch)': 'IN ZA NP LK NA',
  'H (Israel)': 'IL'
}))
  for (const c of list.split(' ')) PLUGS[c] = type

export function plugTypeFor(country: string): string | null {
  return PLUGS[country] ?? null
}

/** Länder mit Vignettenpflicht für Autobahnen (Pkw) */
const VIGNETTE: Record<string, string> = {
  AT: 'digitale Vignette (asfinag.at)', CH: 'Vignette (auch als E-Vignette)', SI: 'e-Vinjeta', CZ: 'elektronische Vignette',
  SK: 'elektronische Vignette', HU: 'e-Vignette (Matrica)', RO: 'Rovinieta', BG: 'elektronische Vignette', MD: 'Vignette'
}
export const vignetteFor = (country: string): string | null => VIGNETTE[country] ?? null
