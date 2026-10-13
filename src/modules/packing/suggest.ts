/**
 * Packvorschläge für eine Reise – aus Wetter, Zielland, Anreise, Unternehmungen, Routen, Unterkunft und Reisehinweisen.
 * Reine Regeln ohne Datenbank (testbar); die Daten sammelt suggest-context.ts.
 */
import { countryName, currencyName, currencyOf, flag, inEuRoaming, plugTypeFor, vignetteFor } from '@/core/countries'
import type { WeatherOutlook } from '@/services/weather'
import { normName } from './logic'
import type { PackingCategory, PackingDraft, PackingItem } from './types'

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
  const when = o ? (o.source === 'vorhersage' ? 'laut Vorhersage' : `in den Vorjahren ${o.years.join('/')}`) : ''

  // --- Wetter
  if (o) {
    if (o.rainShare >= 0.3) {
      add('regenjacke', 'Regenjacke', 'kleidung', `Regen an ${pct(o.rainShare)} der Tage ${when}`, { personal: true })
      add('schirm', 'Regenschirm', 'unterwegs', `Regen an ${pct(o.rainShare)} der Tage ${when}`)
    }
    if (o.rainShare >= 0.5) add('wasserdicht', 'Wasserdichte Schuhe', 'kleidung', 'viel Regen erwartet', { personal: true })
    if (o.minTemp <= 3) {
      add('muetze', 'Mütze', 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
      add('handschuhe', 'Handschuhe', 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
      add('winterjacke', 'Warme Jacke', 'kleidung', `bis ${o.minTemp} °C ${when}`, { personal: true })
    } else if (o.minTemp < 12) add('pullover', 'Pullover oder Fleecejacke', 'kleidung', `abends bis ${o.minTemp} °C ${when}`, { personal: true })
    if (o.minTemp <= -5) add('thermo', 'Thermounterwäsche', 'kleidung', `Frost bis ${o.minTemp} °C`, { personal: true })
    if (o.maxTemp >= 25) {
      add('sonnencreme', 'Sonnencreme', 'hygiene', `bis ${o.maxTemp} °C ${when}`)
      add('sonnenhut', 'Sonnenhut oder Kappe', 'kleidung', `bis ${o.maxTemp} °C ${when}`, { personal: true })
      add('sonnenbrille', 'Sonnenbrille', 'freizeit', `bis ${o.maxTemp} °C ${when}`, { personal: true })
    }
    if (o.maxTemp >= 28) {
      add('trinkflasche', 'Trinkflasche', 'unterwegs', `Hitze bis ${o.maxTemp} °C`, { personal: true })
      add('kurz', 'Kurze Hosen / leichte Kleidung', 'kleidung', `Hitze bis ${o.maxTemp} °C`, { personal: true })
    }
    if (o.windy) add('windjacke', 'Windjacke', 'kleidung', 'stürmische Tage möglich', { personal: true })
  }

  // --- Zielland
  for (const cc of c.countries) {
    const land = `${flag(cc)} ${countryName(cc)}`
    const plug = plugTypeFor(cc)
    if (plug) add(`stecker-${cc}`, `Reisestecker-Adapter Typ ${plug.split(' ')[0]}`, 'technik', `${land}: Steckdosen Typ ${plug}`)
    const cur = currencyOf(cc)
    if (cur && cur !== 'EUR') add(`geld-${cc}`, `Bargeld/Karte in ${currencyName(cur)} (${cur})`, 'dokumente', `${land}: kein Euro`, { essential: true })
    if (!inEuRoaming(cc)) add(`roaming-${cc}`, 'Datenpaket oder eSIM fürs Handy', 'technik', `${land}: kein EU-Roaming – sonst teuer`)
    if (c.transport === 'auto' || c.legModes.includes('auto')) {
      const v = vignetteFor(cc)
      if (v) add(`vignette-${cc}`, `Vignette ${countryName(cc)}`, 'dokumente', `${land}: ${v} – vor der ersten Autobahn kaufen`, { essential: true })
      if (cc === 'FR') add('critair', "Crit'Air-Umweltplakette", 'dokumente', `${land}: in vielen Städten Pflicht`, { essential: true })
    }
  }
  const foreign = c.countries.some((cc) => cc !== 'DE')
  if (foreign && (c.transport === 'auto' || c.legModes.includes('auto')))
    add('warnweste', 'Warnwesten für alle im Auto', 'unterwegs', 'im Ausland oft für jede Person Pflicht', { quantity: Math.max(1, c.travelers) })

  // --- Anreise
  if (c.transport === 'flug' || c.legModes.includes('flug')) {
    add('fluessig', 'Klarsichtbeutel für Flüssigkeiten (je max. 100 ml)', 'unterwegs', 'Handgepäck im Flugzeug')
    add('powerbank', 'Powerbank (ins Handgepäck)', 'technik', 'Flug – Akkus nicht ins aufgegebene Gepäck')
  }

  // --- Unternehmungen, Routen
  const act = c.activityText.toLowerCase()
  const hiking = c.hasRoutes || c.activityCategories.includes('natur') || /wander|tour|gipfel|klamm|alm|berg/.test(act)
  if (hiking) {
    add('wanderschuhe', 'Wanderschuhe', 'kleidung', c.hasRoutes ? 'Routen geplant' : 'Natur-Unternehmungen', { personal: true })
    add('rucksack', 'Tagesrucksack', 'unterwegs', 'für Ausflüge')
    add('blasenpflaster', 'Blasenpflaster', 'gesundheit', 'für Wanderungen')
  }
  if ((c.maxElevation ?? 0) >= 1500) {
    add('stoecke', 'Wanderstöcke', 'freizeit', `Routen bis ${Math.round(c.maxElevation!)} m Höhe`, { personal: true })
    add('funktionsjacke', 'Funktionsjacke (wind- und wasserdicht)', 'kleidung', `oben kann es kalt werden (bis ${Math.round(c.maxElevation!)} m)`, { personal: true })
    add('sonnenbrille', 'Sonnenbrille', 'freizeit', 'starke Sonne in den Bergen', { personal: true })
  }
  const water = c.seaside || /baden|strand|schwimm|therme|see\b|bad\b/.test(act)
  if (water) {
    add('badesachen', 'Badesachen', 'kleidung', c.seaside ? 'Reiseziel am Wasser' : 'Baden geplant', { personal: true })
    add('badetuch', 'Strand- oder Badetuch', 'freizeit', 'zum Baden', { personal: true })
  }
  if (c.activityCategories.includes('entspannung') || /therme|spa|sauna|wellness/.test(act))
    add('badeschlappen', 'Badeschlappen', 'kleidung', 'Therme/Wellness', { personal: true })
  if (c.activityCategories.includes('aktiv') && /rad|bike|fahrrad/.test(act)) add('radhelm', 'Fahrradhelm', 'freizeit', 'Radtour geplant', { personal: true })

  // --- Unterkunft
  if (c.accommodationTypes.includes('camping')) {
    add('stirnlampe', 'Stirnlampe', 'technik', 'Camping', { personal: true })
    add('schlafsack', 'Schlafsack', 'sonstiges', 'Camping', { personal: true })
    add('campinggeschirr', 'Campinggeschirr & Spülzeug', 'sonstiges', 'Camping')
  }
  if (c.accommodationTypes.includes('hostel')) {
    add('schloss', 'Vorhängeschloss für den Spind', 'unterwegs', 'Hostel')
    add('ohrstoepsel', 'Ohrstöpsel', 'hygiene', 'Hostel', { personal: true })
  }
  if (c.accommodationTypes.includes('ferienwohnung')) add('kueche', 'Spültabs, Geschirrtuch, Grundgewürze', 'sonstiges', 'Ferienwohnung mit Küche')

  // --- Gesundheit laut Reisehinweisen
  const health = c.healthText.toLowerCase()
  if (/malaria/.test(health)) {
    add('muecken', 'Mückenschutz (tropentauglich, DEET/Icaridin)', 'gesundheit', 'Malaria-Gebiet laut Auswärtigem Amt')
    add('moskitonetz', 'Moskitonetz', 'gesundheit', 'Malaria-Gebiet laut Auswärtigem Amt')
  } else if (/dengue|zika|chikungunya|mücke/.test(health)) add('muecken', 'Mückenschutz', 'gesundheit', 'Mücken übertragen Krankheiten (Reisehinweise)')

  // --- Dauer
  if (c.days > 7) add('waschmittel', 'Reisewaschmittel', 'hygiene', `${c.days} Tage unterwegs`)

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
