import { t } from '@/i18n'

/** Sätze des Sprachführers – Ausgangstext in der Sprache der App (deutscher Text als Schlüssel) */
export const PHRASE_IDS = [
  'hello', 'morning', 'evening', 'bye', 'please', 'thanks', 'thanksMuch', 'yes', 'no', 'sorry', 'english', 'notUnderstand', 'price', 'toilet',
  'table', 'menu', 'water', 'beer', 'coffee', 'bill', 'card', 'vegetarian', 'delicious',
  'station', 'ticket', 'open', 'left', 'right', 'straight',
  'help', 'ambulance', 'doctor', 'hospital', 'pharmacy', 'police', 'bloodThinner',
  'allergic', 'without', 'contains'
] as const
export type PhraseId = (typeof PHRASE_IDS)[number]

export const ALLERGEN_IDS = ['peanuts', 'nuts', 'gluten', 'milk', 'eggs', 'fish', 'shellfish', 'soy', 'sesame', 'celery', 'mustard', 'penicillin'] as const
export type AllergenId = (typeof ALLERGEN_IDS)[number]

/** Ausgangstexte */
export const SOURCE: Record<PhraseId, string> = {
  hello: t('Hallo / Guten Tag'),
  morning: t('Guten Morgen'),
  evening: t('Guten Abend'),
  bye: t('Auf Wiedersehen'),
  please: t('Bitte'),
  thanks: t('Danke'),
  thanksMuch: t('Vielen Dank'),
  yes: t('Ja'),
  no: t('Nein'),
  sorry: t('Entschuldigung'),
  english: t('Sprechen Sie Englisch?'),
  notUnderstand: t('Ich verstehe nicht.'),
  price: t('Wie viel kostet das?'),
  toilet: t('Wo ist die Toilette?'),
  table: t('Einen Tisch für zwei, bitte.'),
  menu: t('Die Speisekarte, bitte.'),
  water: t('Ein Glas Wasser, bitte.'),
  beer: t('Ein Bier, bitte.'),
  coffee: t('Einen Kaffee, bitte.'),
  bill: t('Die Rechnung, bitte.'),
  card: t('Kann ich mit Karte zahlen?'),
  vegetarian: t('Haben Sie etwas Vegetarisches?'),
  delicious: t('Es war sehr lecker!'),
  station: t('Wo ist der Bahnhof?'),
  ticket: t('Eine Fahrkarte nach …, bitte.'),
  open: t('Wann haben Sie geöffnet?'),
  left: t('links'),
  right: t('rechts'),
  straight: t('geradeaus'),
  help: t('Hilfe!'),
  ambulance: t('Rufen Sie einen Krankenwagen!'),
  doctor: t('Ich brauche einen Arzt.'),
  hospital: t('Wo ist das Krankenhaus?'),
  pharmacy: t('Wo ist eine Apotheke?'),
  police: t('Rufen Sie die Polizei!'),
  bloodThinner: t('Ich nehme Blutverdünner.'),
  allergic: t('Ich habe eine Allergie gegen:'),
  without: t('Bitte ohne diese Zutaten – das ist für mich gefährlich.'),
  contains: t('Ist davon etwas enthalten?')
}

export const ALLERGEN_SOURCE: Record<AllergenId, string> = {
  peanuts: t('Erdnüsse'),
  nuts: t('Schalenfrüchte (Nüsse)'),
  gluten: t('Gluten'),
  milk: t('Milch'),
  eggs: t('Eier'),
  fish: t('Fisch'),
  shellfish: t('Meeresfrüchte'),
  soy: t('Soja'),
  sesame: t('Sesam'),
  celery: t('Sellerie'),
  mustard: t('Senf'),
  penicillin: t('Penicillin')
}

export interface PhraseGroup {
  id: string
  title: string
  icon: string
  phrases: PhraseId[]
}

export const GROUPS: PhraseGroup[] = [
  { id: 'grundlagen', title: t('Das Wichtigste'), icon: 'chat-heart', phrases: ['hello', 'morning', 'evening', 'bye', 'please', 'thanks', 'thanksMuch', 'yes', 'no', 'sorry', 'english', 'notUnderstand', 'price', 'toilet'] },
  { id: 'essen', title: t('Im Restaurant'), icon: 'cup-hot', phrases: ['table', 'menu', 'water', 'beer', 'coffee', 'bill', 'card', 'vegetarian', 'delicious'] },
  { id: 'unterwegs', title: t('Unterwegs'), icon: 'signpost-split', phrases: ['station', 'ticket', 'open', 'left', 'right', 'straight'] },
  { id: 'notfall', title: t('Notfall'), icon: 'heart-pulse', phrases: ['help', 'ambulance', 'doctor', 'hospital', 'pharmacy', 'police', 'bloodThinner'] }
]
