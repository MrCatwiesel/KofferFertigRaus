import { t } from '@/i18n'

/** Sätze des Sprachführers – Ausgangstext in der Sprache der App (deutscher Text als Schlüssel) */
export const PHRASE_IDS = [
  'hello', 'morning', 'evening', 'bye', 'please', 'thanks', 'thanksMuch', 'yes', 'no', 'sorry', 'english', 'notUnderstand', 'price', 'toilet',
  'table', 'menu', 'water', 'beer', 'coffee', 'bill', 'card', 'vegetarian', 'delicious',
  'station', 'ticket', 'open', 'left', 'right', 'straight',
  'help', 'ambulance', 'doctor', 'hospital', 'pharmacy', 'police', 'bloodThinner', 'diabetes', 'asthma', 'pacemaker',
  'allergic', 'without', 'contains', 'bloodType'
] as const
export type PhraseId = (typeof PHRASE_IDS)[number]

export const ALLERGEN_IDS = [
  // Lebensmittel (die 14 EU-Hauptallergene und weitere häufige)
  'peanuts', 'nuts', 'gluten', 'milk', 'lactose', 'eggs', 'fish', 'shellfish', 'molluscs', 'soy', 'sesame', 'celery', 'mustard', 'lupin', 'sulphites',
  'kiwi', 'strawberries', 'tomatoes', 'peach', 'garlic', 'onions', 'corn', 'coconut',
  // Medikamente und Sonstiges
  'penicillin', 'aspirin', 'ibuprofen', 'iodine', 'latex'
] as const
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
  diabetes: t('Ich habe Diabetes.'),
  asthma: t('Ich habe Asthma.'),
  pacemaker: t('Ich habe einen Herzschrittmacher.'),
  allergic: t('Ich habe eine Allergie gegen:'),
  without: t('Bitte ohne diese Zutaten – das ist für mich gefährlich.'),
  contains: t('Ist davon etwas enthalten?'),
  bloodType: t('Blutgruppe:')
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
  penicillin: t('Penicillin'),
  lactose: t('Laktose'),
  molluscs: t('Weichtiere (Muscheln, Tintenfisch)'),
  lupin: t('Lupinen'),
  sulphites: t('Sulfite'),
  kiwi: t('Kiwi'),
  strawberries: t('Erdbeeren'),
  tomatoes: t('Tomaten'),
  peach: t('Pfirsich'),
  garlic: t('Knoblauch'),
  onions: t('Zwiebeln'),
  corn: t('Mais'),
  coconut: t('Kokosnuss'),
  aspirin: t('Aspirin (Acetylsalicylsäure)'),
  ibuprofen: t('Ibuprofen'),
  iodine: t('Jod (auch Kontrastmittel)'),
  latex: t('Latex')
}

/** Gruppen in der Auswahl */
export const ALLERGEN_GROUPS: { title: string; ids: AllergenId[] }[] = [
  { title: t('Lebensmittel'), ids: ['peanuts', 'nuts', 'gluten', 'milk', 'lactose', 'eggs', 'fish', 'shellfish', 'molluscs', 'soy', 'sesame', 'celery', 'mustard', 'lupin', 'sulphites', 'kiwi', 'strawberries', 'tomatoes', 'peach', 'garlic', 'onions', 'corn', 'coconut'] },
  { title: t('Medikamente und Sonstiges'), ids: ['penicillin', 'aspirin', 'ibuprofen', 'iodine', 'latex'] }
]

/** Weitere Wörter (deutsch und englisch, klein), die beim Eintippen auf ein bekanntes Allergen führen */
export const ALLERGEN_SYNONYMS: Record<string, AllergenId> = {
  erdnuss: 'peanuts', erdnüsse: 'peanuts', peanut: 'peanuts', peanuts: 'peanuts',
  nuss: 'nuts', nüsse: 'nuts', haselnuss: 'nuts', haselnüsse: 'nuts', walnuss: 'nuts', walnüsse: 'nuts', mandeln: 'nuts', mandel: 'nuts', cashew: 'nuts', pistazien: 'nuts', nuts: 'nuts', 'tree nuts': 'nuts', almonds: 'nuts', hazelnuts: 'nuts',
  weizen: 'gluten', glutenunverträglichkeit: 'gluten', zöliakie: 'gluten', wheat: 'gluten', coeliac: 'gluten', celiac: 'gluten',
  milchprodukte: 'milk', milcheiweiß: 'milk', dairy: 'milk', milk: 'milk',
  laktoseintoleranz: 'lactose', lactose: 'lactose', milchzucker: 'lactose',
  ei: 'eggs', hühnerei: 'eggs', egg: 'eggs', eggs: 'eggs',
  fische: 'fish', fish: 'fish',
  krebstiere: 'shellfish', garnelen: 'shellfish', shrimps: 'shellfish', krabben: 'shellfish', hummer: 'shellfish', shellfish: 'shellfish', prawns: 'shellfish', shrimp: 'shellfish', crustaceans: 'shellfish',
  weichtiere: 'molluscs', muscheln: 'molluscs', tintenfisch: 'molluscs', calamari: 'molluscs', schnecken: 'molluscs', molluscs: 'molluscs', mussels: 'molluscs', squid: 'molluscs',
  sojabohnen: 'soy', soy: 'soy', soya: 'soy',
  sesame: 'sesame', lupine: 'lupin', lupin: 'lupin', schwefel: 'sulphites', sulfit: 'sulphites', sulphites: 'sulphites', sulfites: 'sulphites',
  celery: 'celery', mustard: 'mustard', erdbeere: 'strawberries', strawberries: 'strawberries', tomate: 'tomatoes', tomatoes: 'tomatoes',
  pfirsiche: 'peach', peach: 'peach', garlic: 'garlic', zwiebel: 'onions', onion: 'onions', onions: 'onions', corn: 'corn', maize: 'corn',
  kokos: 'coconut', coconut: 'coconut', penicillin: 'penicillin', penizillin: 'penicillin',
  ass: 'aspirin', acetylsalicylsäure: 'aspirin', aspirin: 'aspirin', ibuprofen: 'ibuprofen', jod: 'iodine', kontrastmittel: 'iodine', iodine: 'iodine', latex: 'latex'
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
  { id: 'notfall', title: t('Notfall'), icon: 'heart-pulse', phrases: ['help', 'ambulance', 'doctor', 'hospital', 'pharmacy', 'police', 'bloodThinner', 'diabetes', 'asthma', 'pacemaker'] }
]
