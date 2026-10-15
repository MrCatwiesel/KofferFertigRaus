/**
 * Packvorschläge für eine Reise – aus Wetter, Zielland, Anreise, Unternehmungen, Routen, Unterkunft und Reisehinweisen.
 * Reine Regeln ohne Datenbank (testbar); die Daten sammelt suggest-context.ts.
 */
import { countryName, currencyName, currencyOf, flag, inEuRoaming, plugTypeFor, vignetteFor } from '@/core/countries'
import type { WeatherOutlook } from '@/services/weather'
import { normName } from './logic'
import type { PackingCategory, PackingDraft, PackingItem } from './types'
import { t } from '@/i18n'

export interface SuggestContext {
  days: number
  travelers: number
  participants: string[]
  countries: string[]
  /** Hauptanreise und alle Etappen */
  transport: string
  legModes: string[]
  outlook: WeatherOutlook | null
  /** Kategorien und Titel der Unternehmungen */
  activityCategories: string[]
  activityText: string
  /** Routen vorhanden (Wandern/Rad) und höchster Punkt */
  hasRoutes: boolean
  maxElevation: number | null
  accommodationTypes: string[]
  /** Reiseziel am Wasser (Meer, See, Strand) */
  seaside: boolean
  /** Text der Reisehinweise (Gesundheit), z. B. für Mückenschutz */
  healthText: string
}

export interface Suggestion {
  /** Stabile Kennung der Regel */
  key: string
  name: string
  category: PackingCategory
  /** Einer je Person (sonst gemeinsam) */
  personal: boolean
  quantity: number
  /** Kurzer Grund, z. B. „Regen an 40 % der Tage“ */
  reason: string
  /** Wichtig (Dokumente, Pflicht) */
  essential?: boolean
}

const pct = (x: number) => `${Math.round(x * 100)} %`

/** Alle Vorschläge (ohne Abgleich mit der vorhandenen Liste) */
export function suggestItems(c: SuggestContext): Suggestion[] {
  const out: Suggestion[] = []
  const add = (key: string, name: string, category: PackingCategory, reason: string, opts: { personal?: boolean; quantity?: number; essential?: boolean } = {}) =>
    out.push({ key, name, category, reason, personal: opts.personal ?? false, quantity: opts.quantity ?? 1, essential: opts.essential })
  const o = c.outlook
  const when = o ? (o.source === 'vorhersage' ? t('laut Vorhersage') : t('in den Vorjahren {years}', { years: o.years.join('/') })) : ''

  // --- Wetter
  if (o) {
    if (o.rainShare >= 0.3) {
      add('regenjacke', t('Regenjacke'), 'kleidung', t('Regen an {share} der Tage {when}', { share: pct(o.rainShare), when }), { personal: true })
      add('schirm', t('Regenschirm'), 'unterwegs', t('Regen an {share} der Tage {when}', { share: pct(o.rainShare), when }))
    }
    if (o.rainShare >= 0.5) add('wasserdicht', t('Wasserdichte Schuhe'), 'kleidung', t('viel Regen erwartet'), { personal: true })
    if (o.minTemp <= 3) {
      add('muetze', t('Mütze'), 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
      add('handschuhe', t('Handschuhe'), 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
      add('winterjacke', t('Warme Jacke'), 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
    } else if (o.minTemp < 12) add('pullover', t('Pullover oder Fleecejacke'), 'kleidung', t('abends bis {temp} °C {when}', { temp: o.minTemp, when }), { personal: true })
    if (o.minTemp <= -5) add('thermo', t('Thermounterwäsche'), 'kleidung', t('Frost bis {minTemp} °C', { minTemp: o.minTemp }), { personal: true })
    if (o.maxTemp >= 25) {
      add('sonnencreme', t('Sonnencreme'), 'hygiene', `bis ${o.maxTemp} °C ${when}`)
      add('sonnenhut', t('Sonnenhut oder Kappe'), 'kleidung', `bis ${o.maxTemp} °C ${when}`, { personal: true })
      add('sonnenbrille', t('Sonnenbrille'), 'freizeit', `bis ${o.maxTemp} °C ${when}`, { personal: true })
    }
    if (o.maxTemp >= 28) {
      add('trinkflasche', t('Trinkflasche'), 'unterwegs', t('Hitze bis {maxTemp} °C', { maxTemp: o.maxTemp }), { personal: true })
      add('kurz', t('Kurze Hosen / leichte Kleidung'), 'kleidung', t('Hitze bis {maxTemp} °C', { maxTemp: o.maxTemp }), { personal: true })
    }
    if (o.windy) add('windjacke', t('Windjacke'), 'kleidung', t('stürmische Tage möglich'), { personal: true })
  }

  // --- Zielland
  for (const cc of c.countries) {
    const land = `${flag(cc)} ${countryName(cc)}`
    const plug = plugTypeFor(cc)
    if (plug) add(`stecker-${cc}`, t('Reisestecker-Adapter Typ {type}', { type: plug.split(' ')[0] }), 'technik', t('{country}: Steckdosen Typ {type}', { country: land, type: plug }))
    const cur = currencyOf(cc)
    if (cur && cur !== 'EUR') add(`geld-${cc}`, t('Bargeld/Karte in {currency} ({code})', { currency: currencyName(cur), code: cur }), 'dokumente', t('{country}: kein Euro', { country: land }), { essential: true })
    if (!inEuRoaming(cc)) add(`roaming-${cc}`, t('Datenpaket oder eSIM fürs Handy'), 'technik', t('{country}: kein EU-Roaming – sonst teuer', { country: land }))
    if (c.transport === 'auto' || c.legModes.includes('auto')) {
      const v = vignetteFor(cc)
      if (v) add(`vignette-${cc}`, t('Vignette {country}', { country: countryName(cc) }), 'dokumente', t('{country}: {vignette} – vor der ersten Autobahn kaufen', { country: land, vignette: v }), { essential: true })
      if (cc === 'FR') add('critair', t('Crit\'Air-Umweltplakette'), 'dokumente', t('{country}: in vielen Städten Pflicht', { country: land }), { essential: true })
    }
  }
  const foreign = c.countries.some((cc) => cc !== 'DE')
  if (foreign && (c.transport === 'auto' || c.legModes.includes('auto')))
    add('warnweste', t('Warnwesten für alle im Auto'), 'unterwegs', t('im Ausland oft für jede Person Pflicht'), { quantity: Math.max(1, c.travelers) })

  // --- Anreise
  if (c.transport === 'flug' || c.legModes.includes('flug')) {
    add('fluessig', t('Klarsichtbeutel für Flüssigkeiten (je max. 100 ml)'), 'unterwegs', t('Handgepäck im Flugzeug'))
    add('powerbank', t('Powerbank (ins Handgepäck)'), 'technik', t('Flug – Akkus nicht ins aufgegebene Gepäck'))
  }

  // --- Unternehmungen, Routen
  const act = c.activityText.toLowerCase()
  const hiking = c.hasRoutes || c.activityCategories.includes('natur') || /wander|tour|gipfel|klamm|alm|berg/.test(act)
  if (hiking) {
    add('wanderschuhe', t('Wanderschuhe'), 'kleidung', c.hasRoutes ? t('Routen geplant') : t('Natur-Unternehmungen'), { personal: true })
    add('rucksack', t('Tagesrucksack'), 'unterwegs', t('für Ausflüge'))
    add('blasenpflaster', t('Blasenpflaster'), 'gesundheit', t('für Wanderungen'))
  }
  if ((c.maxElevation ?? 0) >= 1500) {
    add('stoecke', t('Wanderstöcke'), 'freizeit', t('Routen bis {round} m Höhe', { round: Math.round(c.maxElevation!) }), { personal: true })
    add('funktionsjacke', t('Funktionsjacke (wind- und wasserdicht)'), 'kleidung', t('oben kann es kalt werden (bis {round} m)', { round: Math.round(c.maxElevation!) }), { personal: true })
    add('sonnenbrille', t('Sonnenbrille'), 'freizeit', t('starke Sonne in den Bergen'), { personal: true })
  }
  const water = c.seaside || /baden|strand|schwimm|therme|see\b|bad\b/.test(act)
  if (water) {
    add('badesachen', t('Badesachen'), 'kleidung', c.seaside ? t('Reiseziel am Wasser') : t('Baden geplant'), { personal: true })
    add('badetuch', t('Strand- oder Badetuch'), 'freizeit', t('zum Baden'), { personal: true })
  }
  if (c.activityCategories.includes('entspannung') || /therme|spa|sauna|wellness/.test(act))
    add('badeschlappen', t('Badeschlappen'), 'kleidung', 'Therme/Wellness', { personal: true })
  if (c.activityCategories.includes('aktiv') && /rad|bike|fahrrad/.test(act)) add('radhelm', t('Fahrradhelm'), 'freizeit', t('Radtour geplant'), { personal: true })

  // --- Unterkunft
  if (c.accommodationTypes.includes('camping')) {
    add('stirnlampe', t('Stirnlampe'), 'technik', t('Camping'), { personal: true })
    add('schlafsack', t('Schlafsack'), 'sonstiges', t('Camping'), { personal: true })
    add('campinggeschirr', t('Campinggeschirr & Spülzeug'), 'sonstiges', t('Camping'))
  }
  if (c.accommodationTypes.includes('hostel')) {
    add('schloss', t('Vorhängeschloss für den Spind'), 'unterwegs', t('Hostel'))
    add('ohrstoepsel', t('Ohrstöpsel'), 'hygiene', t('Hostel'), { personal: true })
  }
  if (c.accommodationTypes.includes('ferienwohnung')) add('kueche', t('Spültabs, Geschirrtuch, Grundgewürze'), 'sonstiges', t('Ferienwohnung mit Küche'))

  // --- Gesundheit laut Reisehinweisen
  const health = c.healthText.toLowerCase()
  if (/malaria/.test(health)) {
    add('muecken', t('Mückenschutz (tropentauglich, DEET/Icaridin)'), 'gesundheit', t('Malaria-Gebiet laut Auswärtigem Amt'))
    add('moskitonetz', t('Moskitonetz'), 'gesundheit', t('Malaria-Gebiet laut Auswärtigem Amt'))
  } else if (/dengue|zika|chikungunya|mücke/.test(health)) add('muecken', t('Mückenschutz'), 'gesundheit', t('Mücken übertragen Krankheiten (Reisehinweise)'))

  // --- Dauer
  if (c.days > 7) add('waschmittel', t('Reisewaschmittel'), 'hygiene', t('{days} Tage unterwegs', { days: c.days }))

  // Doppelte Regeln zusammenfassen (z. B. Sonnenbrille aus Wetter und Bergen) – erster Grund gewinnt, weitere angehängt
  const byKey = new Map<string, Suggestion>()
  for (const s of out) {
    const old = byKey.get(s.key)
    if (!old) byKey.set(s.key, s)
    else if (!old.reason.includes(s.reason)) old.reason += ` · ${s.reason}`
  }
  return [...byKey.values()]
}

/** Vorschläge ohne das, was schon auf der Liste steht (ähnlicher Name) */
export function newSuggestions(all: Suggestion[], existing: Pick<PackingItem, 'name'>[]): Suggestion[] {
  const have = existing.map((i) => normName(i.name))
  // Kernwort: das längste Wort (≥ 5 Zeichen), z. B. „Regenjacke“, „Wanderschuhe“, „Sonnencreme“
  const core = (name: string) => normName(name).split(/[\s/(),.-]+/).filter((w) => w.length >= 5).sort((a, b) => b.length - a.length)[0] ?? normName(name)
  return all.filter((s) => {
    const n = normName(s.name)
    const k = core(s.name)
    return !have.some((h) => h === n || h.includes(k) || (h.length >= 5 && n.includes(h)))
  })
}

/** Einträge für die Packliste: persönliche je Person, sonst gemeinsam */
export function draftsFromSuggestions(list: Suggestion[], participants: string[]): PackingDraft[] {
  const base = { packed: false, notes: '' }
  return list.flatMap((s) =>
    s.personal && participants.length
      ? participants.map((p) => ({ ...base, name: s.name, category: s.category, quantity: 1, person: p, essential: !!s.essential, notes: s.reason }))
      : [{ ...base, name: s.name, category: s.category, quantity: s.quantity, person: '', essential: !!s.essential, notes: s.reason }]
  )
}
