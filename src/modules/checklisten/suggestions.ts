import { t } from '@/i18n'

/** Vorschläge für „Bevor es losgeht“ (zu Hause) */
export const HOME_SUGGESTIONS: string[] = [
  t('Herd, Backofen, Bügeleisen und Kaffeemaschine aus'),
  t('Fenster und Balkontür zu, Rollläden nach Wunsch'),
  t('Wasserzulauf von Wasch- und Spülmaschine zudrehen'),
  t('Kühlschrank: Verderbliches aufbrauchen oder mitnehmen'),
  t('Müll und Biomüll raus'),
  t('Pflanzen gießen oder Gießdienst organisieren'),
  t('Briefkasten: Nachbarn fragen oder Post lagern lassen'),
  t('Heizung herunterdrehen'),
  t('Geräte im Stand-by vom Strom nehmen'),
  t('Ersatzschlüssel bei einer Vertrauensperson'),
  t('Haustiere versorgt'),
  t('Abwesenheitsnotiz für E-Mail einrichten'),
  t('Zeitschaltuhr fürs Licht einstellen'),
  t('Haustür abschließen')
]

const CHECKOUT_COMMON: string[] = [
  t('Ladekabel und Netzteile aus den Steckdosen'),
  t('Schränke, Schubladen, Bad und unter dem Bett kontrollieren'),
  t('Ausweise, Tickets und Geld eingepackt'),
  t('Kühlschrank leeren')
]

const CHECKOUT_BY_TYPE: Record<string, string[]> = {
  hotel: [t('Safe leeren'), t('Minibar und Rechnung prüfen')],
  hostel: [t('Spind leeren und Schloss mitnehmen'), t('Bettwäsche abziehen, falls verlangt')],
  ferienwohnung: [
    t('Müll entsorgen'),
    t('Geschirr spülen und wegräumen'),
    t('Bettwäsche und Handtücher nach Absprache'),
    t('Fotos vom Zustand bei der Abreise'),
    t('Kaution: Rückzahlung klären')
  ],
  privat: [t('Müll entsorgen'), t('Geschirr spülen und wegräumen'), t('Bettwäsche abziehen'), t('Kleines Dankeschön für die Gastgeber')],
  camping: [
    t('Strom, Wasser und Abwasser abbauen'),
    t('Vorzelt, Heringe und Campingmöbel einpacken'),
    t('Gasflasche zudrehen'),
    t('Stützen hoch, Dachluken zu, Schränke verriegeln'),
    t('Toilette und Grauwasser entleeren')
  ]
}

const CHECKOUT_END: string[] = [t('Fenster schließen, Licht, Heizung und Klimaanlage aus'), t('Schlüssel oder Karte abgeben')]

/** Vorschläge zum Auschecken je nach Art der Unterkunft */
export function checkoutSuggestions(type: string): string[] {
  return [...CHECKOUT_COMMON, ...(CHECKOUT_BY_TYPE[type] ?? []), ...CHECKOUT_END]
}
