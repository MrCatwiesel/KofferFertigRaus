import type { PackingCategory } from './types'
import { N_, translated } from '@/core/i18n'

/**
 * Mengenregel einer Vorlage:
 *  - Zahl: feste Menge
 *  - { perDay, max }: pro Reisetag, gedeckelt (z. B. Socken)
 *  - { perPerson }: pro reisender Person
 */
export type QuantityRule = number | { perDay: number; max: number } | { perPerson: number }

export interface TemplateItem {
  name: string
  category: PackingCategory
  qty?: QuantityRule
  essential?: boolean
  /**
   * Persönlich: jeder Teilnehmer bekommt einen eigenen Eintrag.
   * Mengen "pro Tag" und "pro Person" gelten automatisch als persönlich.
   */
  personal?: boolean
}

export interface PackingTemplate {
  id: string
  title: string
  icon: string
  description: string
  items: TemplateItem[]
}

/**
 * Eingebaute Vorlagen. Neue Vorlage = neues Objekt in dieser Liste.
 * Namen gleicher Dinge in allen Vorlagen identisch schreiben – sie werden beim Zusammenführen zusammengefasst.
 */
export const TEMPLATES: PackingTemplate[] = translated([
  {
    id: 'basis',
    title: N_('Grundausstattung'),
    icon: 'check2-square',
    description: N_('Was auf fast jede Reise gehört'),
    items: [
      { name: N_('Personalausweis / Reisepass'), category: 'dokumente', qty: { perPerson: 1 }, essential: true },
      { name: N_('Führerschein'), category: 'dokumente', essential: true },
      { name: N_('Krankenversicherungskarte'), category: 'dokumente', qty: { perPerson: 1 }, essential: true },
      { name: N_('EC-/Kreditkarte'), category: 'dokumente', essential: true },
      { name: N_('Bargeld'), category: 'dokumente' },
      { name: N_('Buchungsbestätigungen'), category: 'dokumente' },
      { name: N_('Unterwäsche'), category: 'kleidung', qty: { perDay: 1, max: 8 } },
      { name: N_('Socken'), category: 'kleidung', qty: { perDay: 1, max: 8 } },
      { name: N_('T-Shirts'), category: 'kleidung', qty: { perDay: 0.7, max: 6 } },
      { name: N_('Hosen'), category: 'kleidung', qty: { perDay: 0.3, max: 3 } },
      { name: N_('Pullover / Jacke'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Schlafsachen'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Bequeme Schuhe'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Zahnbürste & Zahnpasta'), category: 'hygiene', personal: true },
      { name: N_('Duschgel & Shampoo'), category: 'hygiene' },
      { name: N_('Deo'), category: 'hygiene', personal: true },
      { name: N_('Kamm / Bürste'), category: 'hygiene', personal: true },
      { name: N_('Persönliche Medikamente'), category: 'gesundheit', essential: true, personal: true },
      { name: N_('Pflaster & Schmerzmittel'), category: 'gesundheit' },
      { name: N_('Handy & Ladekabel'), category: 'technik', essential: true, personal: true },
      { name: N_('Powerbank'), category: 'technik' },
      { name: N_('Kopfhörer'), category: 'technik', personal: true },
      { name: N_('Schlüssel (Haus)'), category: 'sonstiges', essential: true }
    ]
  },
  {
    id: 'strand',
    title: N_('Strand & Sonne'),
    icon: 'sun',
    description: N_('Badeurlaub, Pool, Meer'),
    items: [
      { name: N_('Badesachen'), category: 'kleidung', qty: 2, personal: true },
      { name: N_('Strandtuch'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Sonnencreme (LSF 30+)'), category: 'hygiene', essential: true },
      { name: N_('After-Sun'), category: 'hygiene' },
      { name: N_('Sonnenbrille'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Sonnenhut / Kappe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: N_('Flip-Flops / Badeschuhe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: N_('Shorts'), category: 'kleidung', qty: { perDay: 0.4, max: 4 } },
      { name: N_('Strandtasche'), category: 'freizeit' },
      { name: N_('Wasserdichte Handyhülle'), category: 'technik' },
      { name: N_('Insektenschutz'), category: 'gesundheit' }
    ]
  },
  {
    id: 'wandern',
    title: N_('Wandern & Berge'),
    icon: 'tree',
    description: N_('Tageswanderungen, Bergtouren'),
    items: [
      { name: N_('Wanderschuhe'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: N_('Wandersocken'), category: 'kleidung', qty: { perDay: 0.5, max: 4 } },
      { name: N_('Regenjacke'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: N_('Funktionsshirts'), category: 'kleidung', qty: 3, personal: true },
      { name: N_('Fleecejacke'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Tagesrucksack'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Trinkflasche'), category: 'unterwegs', qty: { perPerson: 1 } },
      { name: N_('Wanderkarte / Offline-Karten'), category: 'freizeit' },
      { name: N_('Blasenpflaster'), category: 'gesundheit' },
      { name: N_('Erste-Hilfe-Set'), category: 'gesundheit', essential: true },
      { name: N_('Stirnlampe'), category: 'technik' },
      { name: N_('Sonnencreme (LSF 30+)'), category: 'hygiene' },
      { name: N_('Sonnenbrille'), category: 'freizeit', qty: { perPerson: 1 } }
    ]
  },
  {
    id: 'stadt',
    title: N_('Städtereise'),
    icon: 'buildings',
    description: N_('Museen, Restaurants, viel zu Fuß'),
    items: [
      { name: N_('Bequeme Schuhe'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Schickes Outfit für abends'), category: 'kleidung', qty: 1, personal: true },
      { name: N_('Kleiner Rucksack / Umhängetasche'), category: 'freizeit' },
      { name: N_('Regenschirm'), category: 'unterwegs' },
      { name: N_('Stadtplan / Offline-Karten'), category: 'technik' },
      { name: N_('Museumspass / Tickets'), category: 'dokumente' },
      { name: N_('Reiseadapter'), category: 'technik' }
    ]
  },
  {
    id: 'winter',
    title: N_('Winter & Ski'),
    icon: 'snow',
    description: N_('Schnee, Kälte, Wintersport'),
    items: [
      { name: N_('Winterjacke'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: N_('Skihose'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: N_('Thermounterwäsche'), category: 'kleidung', qty: 2, personal: true },
      { name: N_('Mütze, Schal, Handschuhe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: N_('Skisocken'), category: 'kleidung', qty: { perDay: 0.5, max: 5 } },
      { name: N_('Winterstiefel'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: N_('Skibrille / Helm'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Lippenpflege'), category: 'hygiene' },
      { name: N_('Sonnencreme (LSF 30+)'), category: 'hygiene' },
      { name: N_('Skipass / Liftkarte'), category: 'dokumente' }
    ]
  },
  {
    id: 'camping',
    title: N_('Camping'),
    icon: 'house',
    description: N_('Zelt, Wohnmobil, draußen schlafen'),
    items: [
      { name: N_('Zelt'), category: 'freizeit', essential: true },
      { name: N_('Schlafsack'), category: 'freizeit', qty: { perPerson: 1 }, essential: true },
      { name: N_('Isomatte'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Campingkocher & Gas'), category: 'freizeit' },
      { name: N_('Geschirr & Besteck'), category: 'freizeit' },
      { name: N_('Taschenlampe / Stirnlampe'), category: 'technik' },
      { name: N_('Campingstühle'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: N_('Müllbeutel'), category: 'sonstiges' },
      { name: N_('Wäscheleine & Klammern'), category: 'sonstiges' },
      { name: N_('Insektenschutz'), category: 'gesundheit' },
      { name: N_('Campingplatz-Ausweis (ACSI o. Ä.)'), category: 'dokumente' }
    ]
  },
  {
    id: 'kinder',
    title: N_('Mit Kindern'),
    icon: 'balloon',
    description: N_('Familienurlaub mit kleinen Kindern'),
    items: [
      { name: N_('Kinderreisepass / Kinderausweis'), category: 'dokumente', essential: true },
      { name: N_('Kuscheltier'), category: 'kinder', essential: true },
      { name: N_('Wechselkleidung'), category: 'kinder', qty: 2 },
      { name: N_('Spiele & Bücher für unterwegs'), category: 'kinder' },
      { name: N_('Snacks'), category: 'unterwegs' },
      { name: N_('Kinder-Sonnencreme'), category: 'kinder' },
      { name: N_('Fieberthermometer'), category: 'gesundheit' },
      { name: N_('Fiebersaft / Zäpfchen'), category: 'gesundheit' },
      { name: N_('Feuchttücher'), category: 'kinder' },
      { name: N_('Kopfhörer für Kinder'), category: 'technik' }
    ]
  },
  {
    id: 'auto',
    title: N_('Mit dem Auto'),
    icon: 'car-front',
    description: N_('Lange Autofahrten'),
    items: [
      { name: N_('Fahrzeugschein'), category: 'dokumente', essential: true },
      { name: N_('Warnwesten'), category: 'unterwegs', qty: { perPerson: 1 } },
      { name: N_('Vignette / Mautbox'), category: 'dokumente' },
      { name: N_('Handyhalterung & Autoladekabel'), category: 'technik' },
      { name: N_('Getränke & Snacks'), category: 'unterwegs' },
      { name: N_('Kühltasche'), category: 'unterwegs' },
      { name: N_('Sonnenschutz für Autofenster'), category: 'unterwegs' }
    ]
  },
  {
    id: 'flug',
    title: N_('Flugreise'),
    icon: 'airplane',
    description: N_('Handgepäck und Flughafen'),
    items: [
      { name: N_('Bordkarten'), category: 'dokumente', essential: true },
      { name: N_('Flüssigkeitenbeutel (max. 100 ml)'), category: 'hygiene' },
      { name: N_('Nackenkissen'), category: 'unterwegs' },
      { name: N_('Kofferwaage'), category: 'sonstiges' },
      { name: N_('Gepäckanhänger'), category: 'sonstiges' },
      { name: N_('Reiseadapter'), category: 'technik' },
      { name: N_('Kopfhörer'), category: 'technik', personal: true }
    ]
  }
])
