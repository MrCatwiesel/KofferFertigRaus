import { t } from '@/i18n'
import type { CountryFacts, Emergency } from './types'

/**
 * Länder-Spickzettel: feste Angaben je Land (ISO 3166-1 alpha-2), offline in der App.
 * Stand Oktober 2026, ohne Gewähr. Quellen u. a. ADAC, ÖAMTC, Auswärtiges Amt, Bußgeldkataloge.
 * Unsichere Werte lieber weglassen als raten – die Ansicht zeigt nur, was hier steht.
 *
 * speed: [innerorts, außerorts, Autobahn] in km/h (bei `mph` in Meilen/h); '' = nach Beschilderung, '–' = keine Autobahn
 * alcohol / alcoholNew: Promillegrenze allgemein / für Fahranfänger
 */

const all = (n: string, more: Omit<Emergency, 'all'> = {}): Emergency => ({ all: n, ...more })

export const FACTS: Record<string, CountryFacts> = {
  // ───────────────────────── Mitteleuropa & Alpen
  AT: {
    plugs: 'C F', volt: 230, dial: '43', tz: 'Europe/Vienna', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '133', ambulance: '144', fire: '122' }),
    speed: ['50', '100', '130'], alcohol: 0.5, alcoholNew: 0.1, toll: 'vignette',
    tollNote: t('Vignette (digital oder Klebevignette); dazu Sondermaut z. B. Brenner, Tauern, Karawanken, Arlberg'),
    notes: [
      t('Online gekaufte digitale Jahres- und 2-Monats-Vignette gilt erst ab dem 18. Tag nach dem Kauf – rechtzeitig kaufen'),
      t('Winterausrüstung vom 1. November bis 15. April bei winterlichen Straßenverhältnissen Pflicht'),
      t('Rettungsgasse bei Stau bilden')
    ]
  },
  CH: {
    plugs: 'C J', volt: 230, dial: '41', tz: 'Europe/Zurich', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '117', ambulance: '144', fire: '118' }),
    speed: ['50', '80', '120'], alcohol: 0.5, alcoholNew: 0.1, toll: 'vignette',
    tollNote: t('Jahresvignette (auch als E-Vignette); Anhänger brauchen eine eigene'),
    notes: [t('Radarwarner und Blitzer-Apps sind verboten'), t('Bußgelder sind sehr hoch und richten sich teils nach dem Einkommen')]
  },
  LI: {
    plugs: 'C J', volt: 230, dial: '423', tz: 'Europe/Vaduz', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '117', ambulance: '144', fire: '118' }),
    speed: ['50', '80', '–'], toll: 'keine'
  },
  IT: {
    plugs: 'C F L', volt: 230, dial: '39', tz: 'Europe/Rome', tip: 'inklusive', water: 'ja',
    emergency: all('112', { police: '113', ambulance: '118', fire: '115' }),
    speed: ['50', '90', '130'], alcohol: 0.5, alcoholNew: 0, toll: 'strecke',
    tollNote: t('Streckenmaut an Mautstellen; rund um Mailand teils schrankenlos (online nachzahlen)'),
    lights: 'ausserorts',
    notes: [
      t('ZTL (Zona a traffico limitato): Altstädte mit Kameras – Durchfahrt ohne Genehmigung kostet, der Bescheid kommt oft Monate später per Post'),
      t('Außerorts bei Nässe auf der Autobahn nur 110 km/h'),
      t('Warnweste beim Aussteigen außerorts Pflicht'),
      t('„Coperto“ (Gedeck) steht oft extra auf der Rechnung')
    ]
  },
  SM: { plugs: 'C F L', volt: 230, dial: '378', tz: 'Europe/San_Marino', tip: 'inklusive', water: 'ja', emergency: all('112', { police: '113', ambulance: '118', fire: '115' }) },
  VA: { plugs: 'C F L', volt: 230, dial: '39', tz: 'Europe/Vatican', tip: 'inklusive', water: 'ja', emergency: all('112') },
  FR: {
    plugs: 'C E', volt: 230, dial: '33', tz: 'Europe/Paris', tip: 'inklusive', water: 'ja',
    emergency: all('112', { police: '17', ambulance: '15', fire: '18' }),
    speed: ['50', '80', '130'], alcohol: 0.5, alcoholNew: 0.2, toll: 'strecke',
    tollNote: t('Streckenmaut auf fast allen Autobahnen; einige Abschnitte schrankenlos (online nachzahlen)'),
    notes: [
      t('Außerorts vielerorts wieder 90 km/h – auf die Schilder achten'),
      t('Bei Regen: Autobahn 110, Schnellstraße 100 km/h'),
      t('Crit’Air-Umweltplakette für Umweltzonen mancher Städte und bei Smogalarm'),
      t('Blitzer-Warner sind verboten'),
      t('Warnweste griffbereit im Innenraum, nicht im Kofferraum')
    ]
  },
  MC: { plugs: 'C E F', volt: 230, dial: '377', tz: 'Europe/Monaco', tip: 'inklusive', water: 'ja', emergency: all('112', { police: '17', ambulance: '15', fire: '18' }), speed: ['50', '', '–'] },
  NL: {
    plugs: 'C F', volt: 230, dial: '31', tz: 'Europe/Amsterdam', tip: 'aufrunden', water: 'ja',
    emergency: all('112'),
    speed: ['50', '80', '100'], alcohol: 0.5, alcoholNew: 0.2, toll: 'keine',
    tollNote: t('Keine Pkw-Maut; einzelne Tunnel kosten, die A24 bei Rotterdam ist schrankenlos mautpflichtig'),
    notes: [t('Autobahn tagsüber (6–19 Uhr) 100 km/h, nachts teils 130 km/h nach Beschilderung'), t('Radfahrer überall – beim Abbiegen besonders aufpassen')]
  },
  BE: {
    plugs: 'C E', volt: 230, dial: '32', tz: 'Europe/Brussels', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '101' }),
    speed: ['50', '70–90', '120'], alcohol: 0.5, toll: 'keine',
    tollNote: t('Keine Pkw-Maut; der Liefkenshoektunnel in Antwerpen kostet'),
    notes: [t('Außerorts in Flandern 70, in der Wallonie 90 km/h'), t('Umweltzonen in Antwerpen, Gent und Brüssel – ausländische Autos teils vorher registrieren')]
  },
  LU: {
    plugs: 'C F', volt: 230, dial: '352', tz: 'Europe/Luxembourg', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '113' }),
    speed: ['50', '90', '130'], alcohol: 0.5, alcoholNew: 0.2, toll: 'keine',
    notes: [t('Bei Regen auf der Autobahn nur 110 km/h')]
  },

  // ───────────────────────── Nordeuropa
  DK: {
    plugs: 'C E F K', volt: 230, dial: '45', tz: 'Europe/Copenhagen', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '80', '130'], alcohol: 0.5, toll: 'keine', lights: 'immer',
    tollNote: t('Keine Autobahnmaut; Storebælt-Brücke und Øresundbrücke kosten')
  },
  SE: {
    plugs: 'C F', volt: 230, dial: '46', tz: 'Europe/Stockholm', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '70–100', '110–120'], alcohol: 0.2, toll: 'keine', lights: 'immer',
    tollNote: t('Keine Autobahnmaut; Øresundbrücke und einige Brücken kosten, City-Maut in Stockholm und Göteborg auch für ausländische Autos (Rechnung kommt nach Hause)'),
    notes: [t('Winterreifen 1. Dezember bis 31. März bei winterlichen Straßenverhältnissen Pflicht'), t('Bezahlt wird fast überall mit Karte – Bargeld wird teils nicht angenommen')]
  },
  NO: {
    plugs: 'C F', volt: 230, dial: '47', tz: 'Europe/Oslo', tip: 'inklusive', water: 'ja',
    emergency: { police: '112', ambulance: '113', fire: '110' },
    speed: ['50', '80', '90–110'], alcohol: 0.2, toll: 'strecke', lights: 'immer',
    tollNote: t('Maut wird automatisch per Kamera erfasst (AutoPASS) – ohne Anmeldung kommt die Rechnung nach Hause, auch für Fähren'),
    notes: [t('Bußgelder für zu schnelles Fahren sind sehr hoch'), t('Bezahlt wird fast überall mit Karte')]
  },
  FI: {
    plugs: 'C F', volt: 230, dial: '358', tz: 'Europe/Helsinki', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '80–100', '100–120'], alcohol: 0.5, toll: 'keine', lights: 'immer',
    notes: [t('Wildwechsel (Elche, Rentiere) – besonders in der Dämmerung'), t('Winterreifen bei winterlichen Verhältnissen Pflicht, im Winter Autobahn meist 100 km/h')]
  },
  IS: {
    plugs: 'C F', volt: 230, dial: '354', tz: 'Atlantic/Reykjavik', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '80–90', '–'], alcohol: 0.2, toll: 'keine', lights: 'immer',
    notes: [t('Hochlandpisten (F-Straßen) nur mit Allrad und nur im Sommer'), t('Fahren abseits der Straßen ist streng verboten'), t('Wetter und Straßenzustand vor jeder Etappe prüfen')]
  },
  EE: {
    plugs: 'C F', volt: 230, dial: '372', tz: 'Europe/Tallinn', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '90', '–'], alcohol: 0.2, toll: 'keine', lights: 'immer',
    notes: [t('Winterreifen im Winter Pflicht (meist Dezember bis Februar)')]
  },
  LV: {
    plugs: 'C F', volt: 230, dial: '371', tz: 'Europe/Riga', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '90', '–'], alcohol: 0.5, alcoholNew: 0.2, toll: 'keine', lights: 'immer',
    notes: [t('Winterreifen im Winter Pflicht (meist Dezember bis Februar)')]
  },
  LT: {
    plugs: 'C F', volt: 230, dial: '370', tz: 'Europe/Vilnius', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '90', '130'], alcohol: 0.4, alcoholNew: 0, toll: 'keine', lights: 'immer',
    notes: [t('Autobahn im Winterhalbjahr nur 110 km/h'), t('Winterreifen im Winter Pflicht (meist Dezember bis Februar)')]
  },

  // ───────────────────────── Britische Inseln
  GB: {
    plugs: 'G', volt: 230, dial: '44', tz: 'Europe/London', tip: 'zehn', water: 'ja', drive: 'L',
    emergency: all('999', { other: '112' }),
    speed: ['30', '60', '70'], mph: true, alcohol: 0.8, toll: 'keine',
    tollNote: t('Kaum Maut; London (Congestion Charge, ULEZ) und Dartford Crossing online bezahlen'),
    notes: [
      t('Einreise nur mit Reisepass und vorher beantragter ETA (elektronische Einreisegenehmigung)'),
      t('In Schottland gilt 0,5 Promille'),
      t('Im Restaurant steht der Service (10–12,5 %) oft schon auf der Rechnung')
    ]
  },
  IE: {
    plugs: 'G', volt: 230, dial: '353', tz: 'Europe/Dublin', tip: 'zehn', water: 'ja', drive: 'L',
    emergency: all('112', { other: '999' }),
    speed: ['50', '80–100', '120'], alcohol: 0.5, alcoholNew: 0.2, toll: 'strecke',
    tollNote: t('Einige Autobahnen mit Mautstellen; die M50 bei Dublin ist schrankenlos – bis 20 Uhr am Folgetag online bezahlen')
  },

  // ───────────────────────── Osteuropa
  PL: {
    plugs: 'C E', volt: 230, dial: '48', tz: 'Europe/Warsaw', tip: 'zehn', water: 'ja',
    emergency: all('112', { police: '997', ambulance: '999', fire: '998' }),
    speed: ['50', '90', '140'], alcohol: 0.2, toll: 'strecke', lights: 'immer',
    tollNote: t('Staatliche Autobahnen frei, einzelne private Abschnitte (z. B. A1, A2, A4) mautpflichtig'),
    notes: [t('Innerorts nachts (23–5 Uhr) 60 km/h')]
  },
  CZ: {
    plugs: 'C E', volt: 230, dial: '420', tz: 'Europe/Prague', tip: 'zehn', water: 'ja',
    emergency: all('112', { police: '158', ambulance: '155', fire: '150' }),
    speed: ['50', '90', '130'], alcohol: 0, toll: 'vignette', lights: 'immer',
    tollNote: t('Elektronische Vignette (auch 10 Tage) – vor der ersten Autobahn online kaufen'),
    notes: [t('Winterreifen 1. November bis 31. März bei winterlichen Verhältnissen Pflicht')]
  },
  SK: {
    plugs: 'C E', volt: 230, dial: '421', tz: 'Europe/Bratislava', tip: 'zehn', water: 'ja',
    emergency: all('112', { police: '158', ambulance: '155', fire: '150' }),
    speed: ['50', '90', '130'], alcohol: 0, toll: 'vignette', lights: 'immer',
    tollNote: t('Elektronische Vignette – vor der ersten Autobahn online kaufen')
  },
  HU: {
    plugs: 'C F', volt: 230, dial: '36', tz: 'Europe/Budapest', tip: 'zehn', water: 'ja',
    emergency: all('112', { police: '107', ambulance: '104', fire: '105' }),
    speed: ['50', '90', '130'], alcohol: 0, toll: 'vignette', lights: 'ausserorts',
    tollNote: t('Elektronische Vignette (Matrica) – vor der ersten Autobahn kaufen'),
    notes: [t('Auf Restaurantrechnungen steht oft schon ein Service-Aufschlag')]
  },
  SI: {
    plugs: 'C F', volt: 230, dial: '386', tz: 'Europe/Ljubljana', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '113' }),
    speed: ['50', '90', '130'], alcohol: 0.5, alcoholNew: 0, toll: 'vignette', lights: 'immer',
    tollNote: t('Elektronische Vignette (e-Vinjeta); Karawankentunnel kostet extra'),
    notes: [t('Die Wochenvignette gilt genau 7 Tage ab dem gewählten Startdatum')]
  },
  HR: {
    plugs: 'C F', volt: 230, dial: '385', tz: 'Europe/Zagreb', tip: 'aufrunden', water: 'ja',
    emergency: all('112', { police: '192', ambulance: '194', fire: '193' }),
    speed: ['50', '90', '130'], alcohol: 0.5, alcoholNew: 0, toll: 'strecke', lights: 'winter',
    tollNote: t('Streckenmaut; Umstellung auf rein elektronische Erfassung ohne Schranken bis 2027'),
    notes: [t('0,0 Promille für Fahranfänger und alle unter 25 Jahren'), t('Pannenhilfe HAK: 1987')]
  },
  RO: {
    plugs: 'C F', volt: 230, dial: '40', tz: 'Europe/Bucharest', tip: 'zehn', water: 'teils',
    emergency: all('112'),
    speed: ['50', '90', '130'], alcohol: 0, toll: 'vignette', lights: 'ausserorts',
    tollNote: t('Elektronische Vignette (Rovinieta) für alle Nationalstraßen, nicht nur Autobahnen')
  },
  BG: {
    plugs: 'C F', volt: 230, dial: '359', tz: 'Europe/Sofia', tip: 'zehn', water: 'teils',
    emergency: all('112'),
    speed: ['50', '90', '140'], alcohol: 0.5, toll: 'vignette',
    tollNote: t('Elektronische Vignette für Autobahnen und viele Landstraßen')
  },

  // ───────────────────────── Westbalkan
  BA: {
    plugs: 'C F', volt: 230, dial: '387', tz: 'Europe/Sarajevo', tip: 'aufrunden', water: 'teils',
    emergency: { police: '122', ambulance: '124', fire: '123' },
    speed: ['50', '80', '130'], alcohol: 0.3, toll: 'strecke', lights: 'immer',
    notes: [t('Grüne Versicherungskarte mitnehmen und Deckung für das Land bei der Versicherung prüfen')]
  },
  RS: {
    plugs: 'C F', volt: 230, dial: '381', tz: 'Europe/Belgrade', tip: 'aufrunden', water: 'teils',
    emergency: { police: '192', ambulance: '194', fire: '193' },
    speed: ['50', '80', '120–130'], alcohol: 0.3, toll: 'strecke', lights: 'immer',
    notes: [t('Grüne Versicherungskarte mitnehmen und Deckung für das Land bei der Versicherung prüfen')]
  },
  ME: {
    plugs: 'C F', volt: 230, dial: '382', tz: 'Europe/Podgorica', tip: 'aufrunden', water: 'teils',
    emergency: all('112', { police: '122', ambulance: '124', fire: '123' }),
    speed: ['50', '80', ''], alcohol: 0.3, toll: 'strecke', lights: 'immer',
    notes: [t('Grüne Versicherungskarte mitnehmen und Deckung für das Land bei der Versicherung prüfen')]
  },
  AL: {
    plugs: 'C F', volt: 230, dial: '355', tz: 'Europe/Tirane', tip: 'aufrunden', water: 'nein',
    emergency: { police: '129', ambulance: '127', fire: '128' },
    speed: ['40', '80', '110'], toll: 'strecke',
    notes: [t('Grüne Versicherungskarte mitnehmen und Deckung für das Land bei der Versicherung prüfen'), t('Straßen außerhalb der Hauptachsen oft schlecht – mehr Zeit einplanen')]
  },
  MK: {
    plugs: 'C F', volt: 230, dial: '389', tz: 'Europe/Skopje', tip: 'aufrunden', water: 'teils',
    emergency: all('112', { police: '192', ambulance: '194', fire: '193' }),
    speed: ['50', '80', '120'], alcohol: 0.5, toll: 'strecke', lights: 'immer',
    notes: [t('Grüne Versicherungskarte mitnehmen und Deckung für das Land bei der Versicherung prüfen')]
  },

  // ───────────────────────── Südeuropa & Mittelmeer
  ES: {
    plugs: 'C F', volt: 230, dial: '34', tz: 'Europe/Madrid', tip: 'inklusive', water: 'teils',
    emergency: all('112', { police: '091' }),
    speed: ['50', '90', '120'], alcohol: 0.5, alcoholNew: 0.3, toll: 'strecke',
    tollNote: t('Autobahnen mit „AP“ kosten Maut, „A“-Autobahnen (Autovías) sind meist frei'),
    notes: [
      t('Umweltzonen (ZBE) in vielen Städten – ausländische Autos teils vorher registrieren (z. B. Barcelona)'),
      t('Kanarische Inseln: eine Stunde früher als auf dem Festland'),
      t('Läden schließen oft mittags, Abendessen meist ab etwa 21 Uhr')
    ]
  },
  AD: { plugs: 'C F', volt: 230, dial: '376', tz: 'Europe/Andorra', tip: 'inklusive', water: 'ja', emergency: all('112', { police: '110', ambulance: '118', fire: '118' }), toll: 'keine' },
  PT: {
    plugs: 'C F', volt: 230, dial: '351', tz: 'Europe/Lisbon', tip: 'inklusive', water: 'ja',
    emergency: all('112'),
    speed: ['50', '90', '120'], alcohol: 0.5, alcoholNew: 0.2, toll: 'strecke',
    tollNote: t('Streckenmaut; manche Autobahnen nur elektronisch – an der Grenze Kennzeichen mit Kreditkarte registrieren (EASYToll)'),
    notes: [t('Azoren: eine Stunde früher als auf dem Festland')]
  },
  GR: {
    plugs: 'C F', volt: 230, dial: '30', tz: 'Europe/Athens', tip: 'aufrunden', water: 'teils',
    emergency: all('112', { police: '100', ambulance: '166', fire: '199' }),
    speed: ['50', '90', '130'], alcohol: 0.5, toll: 'strecke',
    notes: [t('Auf vielen Inseln ist das Leitungswasser nicht trinkbar'), t('Toilettenpapier meist in den Eimer, nicht in die Toilette (enge Rohre)'), t('Touristenpolizei: 1571')]
  },
  CY: {
    plugs: 'G', volt: 230, dial: '357', tz: 'Asia/Nicosia', tip: 'zehn', water: 'teils', drive: 'L',
    emergency: all('112'),
    speed: ['50', '80', '100'], alcohol: 0.5, toll: 'keine',
    notes: [t('Im Norden (nicht von der EU kontrolliert) gilt die Mietwagen-Versicherung oft nicht')]
  },
  MT: {
    plugs: 'G', volt: 230, dial: '356', tz: 'Europe/Malta', tip: 'zehn', water: 'teils', drive: 'L',
    emergency: all('112'),
    speed: ['50', '80', '–'], alcohol: 0.5, toll: 'keine'
  },
  TR: {
    plugs: 'C F', volt: 230, dial: '90', tz: 'Europe/Istanbul', tip: 'zehn', water: 'nein',
    emergency: all('112'),
    speed: ['50', '90', '120'], alcohol: 0.5, toll: 'strecke',
    tollNote: t('Maut nur elektronisch (HGS) – Mietwagen haben meist schon eine Plakette'),
    notes: [t('Toilettenpapier meist in den Eimer, nicht in die Toilette (enge Rohre)')]
  },

  // ───────────────────────── Nordafrika & Naher Osten
  MA: { plugs: 'C E', volt: 220, dial: '212', tz: 'Africa/Casablanca', tip: 'zehn', water: 'nein', emergency: { police: '19', ambulance: '15', fire: '15' }, notes: [t('Außerhalb der Städte Polizei-Gendarmerie: 177')] },
  TN: { plugs: 'C E', volt: 230, dial: '216', tz: 'Africa/Tunis', tip: 'zehn', water: 'nein', emergency: { police: '197', ambulance: '190', fire: '198' } },
  EG: { plugs: 'C F', volt: 220, dial: '20', tz: 'Africa/Cairo', tip: 'zehn', water: 'nein', emergency: { police: '122', ambulance: '123', fire: '180' }, notes: [t('Touristenpolizei: 126'), t('Kleines Trinkgeld (Bakschisch) für viele Dienste üblich – Kleingeld bereithalten')] },
  AE: { plugs: 'G', volt: 230, dial: '971', tz: 'Asia/Dubai', tip: 'zehn', water: 'teils', emergency: { police: '999', ambulance: '998', fire: '997' }, alcohol: 0, notes: [t('Alkohol am Steuer: absolute Null-Toleranz'), t('In der Öffentlichkeit Schultern und Knie bedecken, im Ramadan tagsüber nicht öffentlich essen oder trinken')] },
  IL: { plugs: 'C H', volt: 230, dial: '972', tz: 'Asia/Jerusalem', tip: 'zehn', water: 'ja', emergency: { police: '100', ambulance: '101', fire: '102' }, notes: [t('Am Sabbat (Freitagabend bis Samstagabend) fahren kaum Busse und Bahnen')] },
  JO: { plugs: 'C D F G J', volt: 230, dial: '962', tz: 'Asia/Amman', tip: 'zehn', water: 'nein', emergency: all('911') },

  // ───────────────────────── Amerika
  US: {
    plugs: 'A B', volt: 120, dial: '1', tip: 'usa', water: 'ja',
    emergency: all('911'),
    notes: [
      t('Vor der Einreise ESTA beantragen'),
      t('Rechts abbiegen bei Rot meist erlaubt – nach vollständigem Halt'),
      t('Haltenden Schulbus mit ausgeklapptem Stoppschild nie überholen, auch nicht im Gegenverkehr'),
      t('Preise meist ohne Steuer – sie kommt erst an der Kasse dazu'),
      t('Tempolimits je Bundesstaat und in Meilen/h'),
      t('Mehrere Zeitzonen')
    ]
  },
  CA: {
    plugs: 'A B', volt: 120, dial: '1', tip: 'usa', water: 'ja',
    emergency: all('911'),
    notes: [t('Bei Anreise mit dem Flugzeug vorher eTA beantragen'), t('Haltenden Schulbus mit ausgeklapptem Stoppschild nie überholen, auch nicht im Gegenverkehr'), t('Preise meist ohne Steuer – sie kommt erst an der Kasse dazu'), t('Mehrere Zeitzonen')]
  },
  MX: { plugs: 'A B', volt: 127, dial: '52', tip: 'zehn', water: 'nein', emergency: all('911'), notes: [t('„Topes“ – hohe Bodenschwellen, auch auf Landstraßen'), t('Mehrere Zeitzonen')] },
  CU: {
    plugs: 'A B C L', volt: 110, dial: '53', tz: 'America/Havana', tip: 'zehn', water: 'nein',
    emergency: { police: '106', ambulance: '104', fire: '105' },
    notes: [t('Genug Bargeld in Euro mitnehmen – Karten werden oft nicht angenommen, Geldautomaten sind unzuverlässig')]
  },
  DO: { plugs: 'A B', volt: 120, dial: '1', tz: 'America/Santo_Domingo', tip: 'zehn', water: 'nein', emergency: all('911') },
  CR: { plugs: 'A B', volt: 120, dial: '506', tz: 'America/Costa_Rica', tip: 'inklusive', water: 'teils', emergency: all('911') },
  BR: { plugs: 'C N', volt: 220, dial: '55', tip: 'inklusive', water: 'nein', emergency: { police: '190', ambulance: '192', fire: '193' }, notes: [t('Spannung je nach Region 127 oder 220 Volt'), t('Mehrere Zeitzonen')] },

  // ───────────────────────── Asien
  TH: {
    plugs: 'A B C O', volt: 230, dial: '66', tz: 'Asia/Bangkok', tip: 'aufrunden', water: 'nein', drive: 'L',
    emergency: { police: '191', ambulance: '1669', fire: '199' },
    notes: [t('Touristenpolizei: 1155'), t('Im Tempel Schultern und Knie bedecken, Schuhe ausziehen')]
  },
  VN: { plugs: 'A C', volt: 220, dial: '84', tz: 'Asia/Ho_Chi_Minh', tip: 'aufrunden', water: 'nein', emergency: { police: '113', ambulance: '115', fire: '114' } },
  ID: { plugs: 'C F', volt: 230, dial: '62', tip: 'aufrunden', water: 'nein', drive: 'L', emergency: all('112', { police: '110', ambulance: '118' }), notes: [t('Im Tempel Schultern und Knie bedecken, Schuhe ausziehen'), t('Mehrere Zeitzonen')] },
  MY: { plugs: 'G', volt: 240, dial: '60', tz: 'Asia/Kuala_Lumpur', tip: 'inklusive', water: 'nein', drive: 'L', emergency: all('999') },
  SG: {
    plugs: 'G', volt: 230, dial: '65', tz: 'Asia/Singapore', tip: 'inklusive', water: 'ja', drive: 'L',
    emergency: { police: '999', ambulance: '995', fire: '995' },
    notes: [t('Strenge Regeln mit hohen Bußgeldern – z. B. Müll wegwerfen, Essen und Trinken in der U-Bahn; Kaugummi darf nicht eingeführt werden')]
  },
  JP: {
    plugs: 'A B', volt: 100, dial: '81', tz: 'Asia/Tokyo', tip: 'unueblich', water: 'ja', drive: 'L',
    emergency: { police: '110', ambulance: '119', fire: '119' },
    notes: [t('Steckdosen oft ohne Schutzkontakt (Typ A) – Adapter für zweipolige Stecker'), t('Bargeld wird noch oft gebraucht'), t('Für Bahn, Bus und kleine Einkäufe eine IC-Karte (z. B. Suica) aufs Handy laden')]
  },
  CN: {
    plugs: 'A C I', volt: 220, dial: '86', tz: 'Asia/Shanghai', tip: 'unueblich', water: 'nein',
    emergency: { police: '110', ambulance: '120', fire: '119' },
    notes: [t('Google, WhatsApp und viele westliche Dienste sind gesperrt – vorher Alternativen einrichten'), t('Bezahlt wird meist mit Alipay oder WeChat Pay – vor der Reise einrichten')]
  },
  IN: { plugs: 'C D M', volt: 230, dial: '91', tz: 'Asia/Kolkata', tip: 'zehn', water: 'nein', drive: 'L', emergency: all('112') },
  LK: { plugs: 'D G M', volt: 230, dial: '94', tz: 'Asia/Colombo', tip: 'zehn', water: 'nein', drive: 'L', emergency: { police: '119', ambulance: '1990', fire: '110' } },
  MV: { plugs: 'D G', volt: 230, dial: '960', tz: 'Indian/Maldives', tip: 'zehn', water: 'nein', emergency: { police: '119', ambulance: '102', fire: '118' }, notes: [t('Alkohol gibt es nur in Resorts und auf Hotelinseln')] },

  // ───────────────────────── Ozeanien
  AU: {
    plugs: 'I', volt: 230, dial: '61', tip: 'inklusive', water: 'ja', drive: 'L',
    emergency: all('000'),
    alcohol: 0.5,
    notes: [t('Vom Handy aus funktioniert auch 112'), t('Lebensmittel, Pflanzen und Holz bei der Einreise angeben – hohe Strafen'), t('Kängurus und Wildtiere in der Dämmerung auf der Straße'), t('Mehrere Zeitzonen')]
  },
  NZ: {
    plugs: 'I', volt: 230, dial: '64', tz: 'Pacific/Auckland', tip: 'inklusive', water: 'ja', drive: 'L',
    emergency: all('111'),
    speed: ['50', '100', '100–110'],
    notes: [t('Vor der Einreise NZeTA beantragen'), t('Lebensmittel, Pflanzen und Holz bei der Einreise angeben – hohe Strafen')]
  },

  // ───────────────────────── Afrika südlich der Sahara
  ZA: {
    plugs: 'C D M N', volt: 230, dial: '27', tz: 'Africa/Johannesburg', tip: 'zehn', water: 'teils', drive: 'L',
    emergency: { all: '112', police: '10111', ambulance: '10177' },
    notes: [t('An Kreuzungen mit vier Stoppschildern fährt, wer zuerst angehalten hat'), t('Stromabschaltungen („Load Shedding“) möglich')]
  },
  KE: { plugs: 'G', volt: 240, dial: '254', tz: 'Africa/Nairobi', tip: 'zehn', water: 'nein', drive: 'L', emergency: all('999') },
  TZ: { plugs: 'D G', volt: 230, dial: '255', tz: 'Africa/Dar_es_Salaam', tip: 'zehn', water: 'nein', drive: 'L', emergency: all('112') },
  NA: { plugs: 'D M', volt: 220, dial: '264', tz: 'Africa/Windhoek', tip: 'zehn', water: 'teils', drive: 'L', emergency: { police: '10111' }, notes: [t('Schotterpisten: langsam fahren, Reifen und Ersatzrad prüfen'), t('Tankstellen liegen weit auseinander – volltanken, wo es geht')] },
  MU: { plugs: 'C G', volt: 230, dial: '230', tz: 'Indian/Mauritius', tip: 'aufrunden', water: 'teils', drive: 'L', emergency: { police: '999', ambulance: '114', fire: '115' } }
}
