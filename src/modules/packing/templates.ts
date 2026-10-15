import type { PackingCategory } from './types'
import { t } from '@/i18n'

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
export const TEMPLATES: PackingTemplate[] = [
  {
    id: 'basis',
    title: t('Grundausstattung'),
    icon: 'check2-square',
    description: t('Was auf fast jede Reise gehört'),
    items: [
      { name: t('Personalausweis / Reisepass'), category: 'dokumente', qty: { perPerson: 1 }, essential: true },
      { name: t('Führerschein'), category: 'dokumente', essential: true },
      { name: t('Krankenversicherungskarte'), category: 'dokumente', qty: { perPerson: 1 }, essential: true },
      { name: 'EC-/Kreditkarte', category: 'dokumente', essential: true },
      { name: t('Bargeld'), category: 'dokumente' },
      { name: t('Buchungsbestätigungen'), category: 'dokumente' },
      { name: t('Unterwäsche'), category: 'kleidung', qty: { perDay: 1, max: 8 } },
      { name: t('Socken'), category: 'kleidung', qty: { perDay: 1, max: 8 } },
      { name: 'T-Shirts', category: 'kleidung', qty: { perDay: 0.7, max: 6 } },
      { name: t('Hosen'), category: 'kleidung', qty: { perDay: 0.3, max: 3 } },
      { name: t('Pullover / Jacke'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Schlafsachen'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Bequeme Schuhe'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Zahnbürste & Zahnpasta'), category: 'hygiene', personal: true },
      { name: t('Duschgel & Shampoo'), category: 'hygiene' },
      { name: t('Deo'), category: 'hygiene', personal: true },
      { name: t('Kamm / Bürste'), category: 'hygiene', personal: true },
      { name: t('Persönliche Medikamente'), category: 'gesundheit', essential: true, personal: true },
      { name: t('Pflaster & Schmerzmittel'), category: 'gesundheit' },
      { name: t('Handy & Ladekabel'), category: 'technik', essential: true, personal: true },
      { name: t('Powerbank'), category: 'technik' },
      { name: t('Kopfhörer'), category: 'technik', personal: true },
      { name: t('Schlüssel (Haus)'), category: 'sonstiges', essential: true }
    ]
  },
  {
    id: 'strand',
    title: t('Strand & Sonne'),
    icon: 'sun',
    description: t('Badeurlaub, Pool, Meer'),
    items: [
      { name: t('Badesachen'), category: 'kleidung', qty: 2, personal: true },
      { name: t('Strandtuch'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Sonnencreme (LSF 30+)'), category: 'hygiene', essential: true },
      { name: 'After-Sun', category: 'hygiene' },
      { name: t('Sonnenbrille'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Sonnenhut / Kappe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: t('Flip-Flops / Badeschuhe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: t('Shorts'), category: 'kleidung', qty: { perDay: 0.4, max: 4 } },
      { name: t('Strandtasche'), category: 'freizeit' },
      { name: t('Wasserdichte Handyhülle'), category: 'technik' },
      { name: t('Insektenschutz'), category: 'gesundheit' }
    ]
  },
  {
    id: 'wandern',
    title: t('Wandern & Berge'),
    icon: 'tree',
    description: t('Tageswanderungen, Bergtouren'),
    items: [
      { name: t('Wanderschuhe'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: t('Wandersocken'), category: 'kleidung', qty: { perDay: 0.5, max: 4 } },
      { name: t('Regenjacke'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: t('Funktionsshirts'), category: 'kleidung', qty: 3, personal: true },
      { name: t('Fleecejacke'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Tagesrucksack'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Trinkflasche'), category: 'unterwegs', qty: { perPerson: 1 } },
      { name: t('Wanderkarte / Offline-Karten'), category: 'freizeit' },
      { name: t('Blasenpflaster'), category: 'gesundheit' },
      { name: 'Erste-Hilfe-Set', category: 'gesundheit', essential: true },
      { name: t('Stirnlampe'), category: 'technik' },
      { name: t('Sonnencreme (LSF 30+)'), category: 'hygiene' },
      { name: t('Sonnenbrille'), category: 'freizeit', qty: { perPerson: 1 } }
    ]
  },
  {
    id: 'stadt',
    title: t('Städtereise'),
    icon: 'buildings',
    description: t('Museen, Restaurants, viel zu Fuß'),
    items: [
      { name: t('Bequeme Schuhe'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Schickes Outfit für abends'), category: 'kleidung', qty: 1, personal: true },
      { name: t('Kleiner Rucksack / Umhängetasche'), category: 'freizeit' },
      { name: t('Regenschirm'), category: 'unterwegs' },
      { name: t('Stadtplan / Offline-Karten'), category: 'technik' },
      { name: t('Museumspass / Tickets'), category: 'dokumente' },
      { name: t('Reiseadapter'), category: 'technik' }
    ]
  },
  {
    id: 'winter',
    title: t('Winter & Ski'),
    icon: 'snow',
    description: t('Schnee, Kälte, Wintersport'),
    items: [
      { name: t('Winterjacke'), category: 'kleidung', qty: { perPerson: 1 }, essential: true },
      { name: t('Skihose'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: t('Thermounterwäsche'), category: 'kleidung', qty: 2, personal: true },
      { name: t('Mütze, Schal, Handschuhe'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: t('Skisocken'), category: 'kleidung', qty: { perDay: 0.5, max: 5 } },
      { name: t('Winterstiefel'), category: 'kleidung', qty: { perPerson: 1 } },
      { name: t('Skibrille / Helm'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Lippenpflege'), category: 'hygiene' },
      { name: t('Sonnencreme (LSF 30+)'), category: 'hygiene' },
      { name: t('Skipass / Liftkarte'), category: 'dokumente' }
    ]
  },
  {
    id: 'camping',
    title: t('Camping'),
    icon: 'house',
    description: t('Zelt, Wohnmobil, draußen schlafen'),
    items: [
      { name: t('Zelt'), category: 'freizeit', essential: true },
      { name: t('Schlafsack'), category: 'freizeit', qty: { perPerson: 1 }, essential: true },
      { name: t('Isomatte'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Campingkocher & Gas'), category: 'freizeit' },
      { name: t('Geschirr & Besteck'), category: 'freizeit' },
      { name: t('Taschenlampe / Stirnlampe'), category: 'technik' },
      { name: t('Campingstühle'), category: 'freizeit', qty: { perPerson: 1 } },
      { name: t('Müllbeutel'), category: 'sonstiges' },
      { name: t('Wäscheleine & Klammern'), category: 'sonstiges' },
      { name: t('Insektenschutz'), category: 'gesundheit' },
      { name: t('Campingplatz-Ausweis (ACSI o. Ä.)'), category: 'dokumente' }
    ]
  },
  {
    id: 'kinder',
    title: t('Mit Kindern'),
    icon: 'balloon',
    description: t('Familienurlaub mit kleinen Kindern'),
    items: [
      { name: t('Kinderreisepass / Kinderausweis'), category: 'dokumente', essential: true },
      { name: t('Kuscheltier'), category: 'kinder', essential: true },
      { name: t('Wechselkleidung'), category: 'kinder', qty: 2 },
      { name: t('Spiele & Bücher für unterwegs'), category: 'kinder' },
      { name: t('Snacks'), category: 'unterwegs' },
      { name: 'Kinder-Sonnencreme', category: 'kinder' },
      { name: t('Fieberthermometer'), category: 'gesundheit' },
      { name: t('Fiebersaft / Zäpfchen'), category: 'gesundheit' },
      { name: t('Feuchttücher'), category: 'kinder' },
      { name: t('Kopfhörer für Kinder'), category: 'technik' }
    ]
  },
  {
    id: 'auto',
    title: t('Mit dem Auto'),
    icon: 'car-front',
    description: t('Lange Autofahrten'),
    items: [
      { name: t('Fahrzeugschein'), category: 'dokumente', essential: true },
      { name: t('Warnwesten'), category: 'unterwegs', qty: { perPerson: 1 } },
      { name: t('Vignette / Mautbox'), category: 'dokumente' },
      { name: t('Handyhalterung & Autoladekabel'), category: 'technik' },
      { name: t('Getränke & Snacks'), category: 'unterwegs' },
      { name: t('Kühltasche'), category: 'unterwegs' },
      { name: t('Sonnenschutz für Autofenster'), category: 'unterwegs' }
    ]
  },
  {
    id: 'flug',
    title: t('Flugreise'),
    icon: 'airplane',
    description: t('Handgepäck und Flughafen'),
    items: [
      { name: t('Bordkarten'), category: 'dokumente', essential: true },
      { name: t('Flüssigkeitenbeutel (max. 100 ml)'), category: 'hygiene' },
      { name: t('Nackenkissen'), category: 'unterwegs' },
      { name: t('Kofferwaage'), category: 'sonstiges' },
      { name: t('Gepäckanhänger'), category: 'sonstiges' },
      { name: t('Reiseadapter'), category: 'technik' },
      { name: t('Kopfhörer'), category: 'technik', personal: true }
    ]
  }
]
