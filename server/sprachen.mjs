/**
 * Texte, die der Server selbst verschickt (Push-Benachrichtigungen), in der Sprache des Geräts.
 * Die App meldet ihre Sprache mit dem Abo (prefs.lang). Fehlt eine Übersetzung, gilt Deutsch.
 * Neue Sprache: unten ein weiteres Wörterbuch eintragen (Schlüssel = deutscher Text, Platzhalter {name}).
 */

/** @type {Record<string, Record<string, string>>} */
const DICT = {
  en: {
    Reise: 'Trip',
    Jemand: 'Someone',
    'Neu: {list}': 'New: {list}',
    '1 Änderung': '1 change',
    '{n} Änderungen': '{n} changes',
    'Benachrichtigungen funktionieren 👍': 'Notifications are working 👍',
    ' und {n} weitere': ' and {n} more',
    'bis {time}': 'until {time}',
    'ab {time}': 'from {time}',
    Gelb: 'Yellow',
    Orange: 'Orange',
    Rot: 'Red',
    Sturm: 'Wind',
    'Schnee und Glätte': 'Snow and ice',
    Gewitter: 'Thunderstorms',
    Nebel: 'Fog',
    Hitze: 'Heat',
    Kälte: 'Cold',
    Küstengefahren: 'Coastal hazards',
    Waldbrandgefahr: 'Forest fire risk',
    Lawinen: 'Avalanches',
    Starkregen: 'Heavy rain',
    Unwetter: 'Severe weather',
    Hochwasser: 'Flooding',
    'Regen und Hochwasser': 'Rain and flooding'
  }
}

/** Artikel, Einzahl, Mehrzahl je Tabelle – für „Neu: ein Foto, 3 Routen“ */
const CHANGE_WORDS = {
  en: {
    journalEntries: ['a', 'journal entry', 'journal entries'],
    photos: ['a', 'photo', 'photos'],
    voiceNotes: ['a', 'voice note', 'voice notes'],
    activities: ['an', 'activity', 'activities'],
    routes: ['a', 'route', 'routes'],
    accommodations: ['an', 'accommodation', 'accommodations'],
    travelLegs: ['a', 'journey leg', 'journey legs'],
    expenses: ['an', 'expense', 'expenses'],
    places: ['a', 'place', 'places'],
    documents: ['a', 'document', 'documents'],
    polls: ['a', 'poll', 'polls']
  }
}

/** Datum/Zeit-Format je Sprache (Intl) */
const INTL = { de: 'de-DE', en: 'en-GB' }

/** Sprache aus den Einstellungen eines Abos: zwei Buchstaben, sonst Deutsch */
export function cleanLang(v, fallback = 'de') {
  return typeof v === 'string' && /^[a-z]{2}$/.test(v) ? v : fallback
}

/** Übersetzen (Deutsch ist der Schlüssel) */
export function tr(lang, text, params) {
  const s = DICT[lang]?.[text] ?? text
  return params ? s.replace(/\{(\w+)\}/g, (all, k) => (k in params ? String(params[k]) : all)) : s
}

/** Wörter für eine Tabelle in der Sprache, sonst die deutschen */
export function changeWords(lang, tbl, german) {
  return CHANGE_WORDS[lang]?.[tbl] ?? german
}

export function intlOf(lang) {
  return INTL[lang] ?? lang
}
