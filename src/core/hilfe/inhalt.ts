/**
 * Inhalt der Hilfe und der Einführung. Text in **fett** wird hervorgehoben, sonst reiner Text (kein HTML).
 * `routes`: Namen der Seiten (oder Anfänge davon), zu denen das Thema passt – das „?“ oben öffnet dann dieses Thema.
 */

export interface HelpTopic {
  id: string
  group: string
  title: string
  icon: string
  /** Suchbegriffe, die nicht im Text stehen */
  keywords?: string
  routes?: string[]
  text: string[]
  steps?: string[]
  links?: { label: string; to: string }[]
}

export const HELP_GROUPS = ['Erste Schritte', 'Planen', 'Unterwegs', 'Erinnern & teilen', 'Zusammen reisen', 'Daten & Sicherheit']

export const HELP_TOPICS: HelpTopic[] = [
  // ---------------------------------------------------------------- Erste Schritte
  {
    id: 'ueberblick',
    group: 'Erste Schritte',
    title: 'Die App in Kürze',
    icon: 'compass',
    keywords: 'start anfang übersicht phasen planung unterwegs danach reiseseite kacheln',
    routes: ['trip-list', 'trip-detail'],
    text: [
      '„Nix wie weg“ begleitet eine Reise von der ersten Idee bis zur fertigen Reise-Webseite. Alles liegt **auf deinem Gerät** und funktioniert auch **ohne Internet** – nur Wetter, Karten, Reisehinweise und der Abgleich brauchen eine Verbindung.',
      'Jede Reise hat drei Reiter: **Planung** (Anreise, Unterkünfte, Packliste …), **Unterwegs** (Tagesplan, Karte, Ausgaben …) und **Danach** (Tagebuch, Fotos, Bericht, Webseite). Die App wählt den passenden Reiter nach dem Datum.',
      'Welche Kacheln auf der Reiseseite stehen und in welcher Reihenfolge, legst du unter *Einstellungen → Aussehen → Reiseseite anpassen* fest.'
    ],
    links: [
      { label: 'Kurze Einführung ansehen', to: '/einfuehrung' },
      { label: 'Reiseseite anpassen', to: '/einstellungen/aussehen' }
    ]
  },
  {
    id: 'installieren',
    group: 'Erste Schritte',
    title: 'Als App installieren',
    icon: 'phone',
    keywords: 'home-bildschirm startbildschirm ipad iphone android pwa installieren symbol',
    text: [
      'Die App ist eine Web-App: Einmal auf den Home-Bildschirm gelegt, startet sie wie jede andere App – ohne Browserleiste und auch offline.',
      'Auf **iPad und iPhone** geht das nur mit Safari. Push-Benachrichtigungen gibt es dort ebenfalls nur für die installierte App (ab iOS 16.4).'
    ],
    steps: [
      'iPad/iPhone: In Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“',
      'Android: Im Chrome-Menü (⋮) → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“',
      'PC/Mac: In Chrome oder Edge rechts in der Adresszeile auf das Installieren-Symbol klicken'
    ]
  },
  {
    id: 'reise-anlegen',
    group: 'Erste Schritte',
    title: 'Reise anlegen',
    icon: 'plus-circle',
    keywords: 'neue reise ziel zielland teilnehmer budget titelbild datum',
    routes: ['trip-new', 'trip-edit', 'trip-cover'],
    text: [
      'Eine Reise braucht nur Titel, Ziel und Zeitraum. **Zielländer** holen automatisch die Reise- und Sicherheitshinweise, **Teilnehmer** werden für Packliste, Ausgaben und Abstimmungen gebraucht.',
      'Das Titelbild ist eine gezeichnete Landschaft – du kannst ein eigenes Foto wählen oder später eines aus dem Tagebuch übernehmen.'
    ],
    links: [{ label: 'Neue Reise', to: '/trip/neu' }]
  },

  // ---------------------------------------------------------------- Planen
  {
    id: 'anreise',
    group: 'Planen',
    title: 'Anreise und Rückreise',
    icon: 'train-front',
    keywords: 'zug flug auto fähre etappe abfahrt ankunft umsteigen',
    routes: ['travel'],
    text: [
      'Trage jede Etappe ein – Zug, Flug, Auto, Fähre – mit Abfahrt, Ankunft und Buchungsnummer. Die Zeiten erscheinen im Tagesplan, im Kalender und als Erinnerung (zwei Stunden vor der Abfahrt).'
    ]
  },
  {
    id: 'unterkuenfte',
    group: 'Planen',
    title: 'Unterkünfte und Buchungen',
    icon: 'house-door',
    keywords: 'hotel ferienwohnung camping stornofrist check-in buchungsbestätigung pdf mail übernehmen import',
    routes: ['accommodation', 'booking-import'],
    text: [
      'Unterkünfte mit Zeitraum, Preis und **Stornofrist** – die Frist erscheint zwei Tage vorher als Erinnerung. Setze die Adresse auf der Karte: Dann kennt die App den Ort für Karte, Routen und Unwetterwarnungen.',
      'Unter *Buchung übernehmen* liest die App eine **Buchungsbestätigung** (PDF oder kopierter Mailtext) und füllt Name, Daten, Preis und Buchungsnummer aus – alles auf dem Gerät, nichts wird hochgeladen.'
    ]
  },
  {
    id: 'unternehmungen',
    group: 'Planen',
    title: 'Unternehmungen',
    icon: 'star',
    keywords: 'ausflug sehenswürdigkeit restaurant idee drinnen draußen öffnungszeiten priorität',
    routes: ['activity'],
    text: [
      'Sammle Ideen für Ausflüge, Sehenswürdigkeiten und Restaurants. Mit **Drinnen/Draußen** schlägt der Tagesplan bei Regen passende Unternehmungen vor, Öffnungszeiten werden aus dem Text erkannt (z. B. „Di–So 10–18“).'
    ]
  },
  {
    id: 'abstimmungen',
    group: 'Planen',
    title: 'Abstimmungen',
    icon: 'check2-square',
    keywords: 'umfrage entscheiden wählen stimme mehrheit',
    routes: ['abstimmungen'],
    text: [
      'Stellt eine Frage – „Was machen wir am Samstag?“ – mit Antworten, eine pro Zeile, oder mit Ideen aus den Unternehmungen. Jede Person stimmt **auf ihrem eigenen Gerät** ab, alle sehen das Ergebnis nach dem Abgleich.',
      'Mit Personen & Rechte stimmt jede Person automatisch als sie selbst ab. Ohne Personen wählst du auf dem Gerät „Ich stimme ab als …“ – so können Eltern auch für die Kinder abstimmen.',
      'Nach „Beenden“ lässt sich eine gewonnene Unternehmung mit einem Tipp einplanen.'
    ]
  },
  {
    id: 'packliste',
    group: 'Planen',
    title: 'Packliste',
    icon: 'backpack',
    keywords: 'packen vorlage person abhaken vorschläge wetter',
    routes: ['packing'],
    text: [
      'Die Packliste gibt es für alle zusammen und **je Person**. Vorlagen (z. B. Wandern, Strand, Baby) füllen sie schnell; Vorschläge berücksichtigen Wetter, Unterkunft und Unternehmungen.',
      'Mit Personen & Rechte ist die Liste einer verknüpften Person privat – nur sie sieht sie.'
    ]
  },
  {
    id: 'apotheke',
    group: 'Planen',
    title: 'Reiseapotheke und Impfungen',
    icon: 'capsule',
    keywords: 'medikament einnahme impfung impfpass gesundheit',
    routes: ['med', 'vacc', 'meds-overview'],
    text: [
      'Medikamente mit Einnahmeplan und Vorrat, dazu Impfungen mit Termin. Empfohlene Impfungen aus den Reisehinweisen lassen sich direkt übernehmen.'
    ]
  },
  {
    id: 'dokumente',
    group: 'Planen',
    title: 'Dokumente und Notfallnummern',
    icon: 'folder2-open',
    keywords: 'pass ausweis visum versicherung notfall botschaft telefon',
    routes: ['doc', 'contact', 'docs-overview'],
    text: [
      'Reisedokumente mit Ablaufdatum (Pass, Visum, Versicherung …) und Notfallnummern. Die Nummern der deutschen Botschaft und der Honorarkonsuln am Reiseziel trägt die App aus den Reisehinweisen selbst ein.',
      'Eigene Dokumente lassen sich gezielt freigeben, z. B. ein Allergiepass für die Mitreisenden.'
    ]
  },
  {
    id: 'reisehinweise',
    group: 'Planen',
    title: 'Reise- und Sicherheitshinweise',
    icon: 'shield-exclamation',
    keywords: 'auswärtiges amt reisewarnung einreise visum impfschutz sicherheit',
    routes: ['reiseinfo'],
    text: [
      'Für jedes Zielland holt die App die Hinweise des Auswärtigen Amts: Sicherheitslage, Einreise, Impfschutz. Sie werden täglich geprüft, wenn du die Reise öffnest – Änderungen sind markiert.'
    ]
  },
  {
    id: 'termine',
    group: 'Planen',
    title: 'Termine, Fristen und Kalender',
    icon: 'calendar-check',
    keywords: 'erinnerung kalender abo ics stornofrist frist',
    routes: ['termine'],
    text: [
      'Alle Termine der Reise an einem Ort: Stornofristen, Check-in, Abfahrten, Impftermine. Mit dem **Kalender-Abo** (eigener Server) erscheinen sie im Kalender von iPad, iPhone oder Outlook und bleiben dort aktuell.'
    ]
  },

  // ---------------------------------------------------------------- Unterwegs
  {
    id: 'tagesplan',
    group: 'Unterwegs',
    title: 'Tagesplan und Wetter',
    icon: 'calendar-day',
    keywords: 'heute wetter vorhersage regen plan vorschläge',
    routes: ['dayplanner', 'today'],
    text: [
      'Der Tagesplan zeigt für jeden Tag Wetter, Geplantes und passende Vorschläge – bei Regen eher Drinnen. **„Heute“** in der unteren Leiste springt direkt in den Tag der laufenden Reise.',
      'Die Vorhersage reicht etwa 16 Tage weit und bleibt offline gespeichert.'
    ]
  },
  {
    id: 'unwetter',
    group: 'Unterwegs',
    title: 'Unwetterwarnungen',
    icon: 'cloud-lightning-rain',
    keywords: 'gewitter sturm hitze warnung meteoalarm unwetter',
    routes: ['unwetter'],
    text: [
      'Amtliche Warnungen der Wetterdienste Europas (MeteoAlarm) für die Orte der Reise: Unterkünfte mit Ort auf der Karte, der Wetter-Ort im Tagesplan oder sonst das Reiseziel. Stufen Gelb, Orange und Rot.',
      'Ab 7 Tage vor der Reise sieht die App von selbst nach. Mit Benachrichtigungen kommen neue Warnungen (Orange und Rot) aufs Gerät – auch wenn die App geschlossen ist. Braucht den eigenen Server.'
    ],
    links: [{ label: 'Benachrichtigungen', to: '/benachrichtigungen' }]
  },
  {
    id: 'karte',
    group: 'Unterwegs',
    title: 'Karte und Offline-Karten',
    icon: 'map',
    keywords: 'karte offline openstreetmap ort setzen fotos',
    routes: ['map'],
    text: [
      'Die Karte zeigt Unterkünfte, Unternehmungen, Routen und Fotos der Reise. Orte setzt du über die Adresssuche oder durch Tippen auf die Karte.',
      'Mit eigenem Server lässt sich der Kartenausschnitt der Reise **für offline** speichern – praktisch in den Bergen oder im Ausland ohne Datenvolumen.'
    ]
  },
  {
    id: 'routen',
    group: 'Unterwegs',
    title: 'Routen und Touren',
    icon: 'signpost-split',
    keywords: 'gpx fit kml garmin komoot wandern höhenprofil planen strecke',
    routes: ['route'],
    text: [
      'Lade Touren als **GPX, Garmin FIT, TCX, KML/KMZ oder GeoJSON** – mit Höhenprofil, Strecke und Höhenmetern. Mit eigenem Server kannst du Wanderwege suchen und Strecken planen.'
    ]
  },
  {
    id: 'ausgaben',
    group: 'Unterwegs',
    title: 'Ausgaben und Abrechnung',
    icon: 'wallet2',
    keywords: 'geld kosten budget teilen ausgleich währung wechselkurs',
    routes: ['expense'],
    text: [
      'Wer hat was bezahlt, für wen? Die App rechnet aus, wer wem wie viel schuldet – mit möglichst wenigen Überweisungen. Fremdwährungen werden zum Tageskurs umgerechnet.'
    ]
  },

  // ---------------------------------------------------------------- Erinnern & teilen
  {
    id: 'tagebuch',
    group: 'Erinnern & teilen',
    title: 'Reisetagebuch, Fotos und Sprachnotizen',
    icon: 'journal-richtext',
    keywords: 'tagebuch fotos sprachnotiz entwurf highlight aufnahme',
    routes: ['journal'],
    text: [
      'Schreibe jeden Tag ein paar Zeilen und füge Fotos hinzu – Aufnahmeort und -zeit liest die App aus dem Foto. **„Entwurf aus dem Tag“** schreibt ein Gerüst aus Anreise, Wetter, Unternehmungen und Touren.',
      'Unterwegs schneller: **Sprachnotiz aufnehmen** oder die Diktierfunktion der Tastatur.'
    ]
  },
  {
    id: 'bericht',
    group: 'Erinnern & teilen',
    title: 'Reisebericht und Fotobuch (PDF)',
    icon: 'file-earmark-richtext',
    keywords: 'pdf drucken fotobuch bericht',
    routes: ['report'],
    text: ['Aus Tagebuch, Fotos und Touren entsteht ein Bericht oder ein Fotobuch als PDF-Datei – zum Teilen oder in Druckqualität für einen Fotobuch-Anbieter.']
  },
  {
    id: 'webseite',
    group: 'Erinnern & teilen',
    title: 'Reise-Webseite',
    icon: 'globe2',
    keywords: 'webseite html vorlage teilen',
    routes: ['website'],
    text: ['Eine einzige HTML-Datei mit Texten, Fotos und Karten – funktioniert ohne Internet und lässt sich verschicken oder hochladen. Vorlage, Farben und Schrift sind wählbar.']
  },
  {
    id: 'leselinks',
    group: 'Erinnern & teilen',
    title: 'Lese-Links und Mitreisende einladen',
    icon: 'link-45deg',
    keywords: 'teilen freunde link passwort einladen mitreisende',
    routes: ['share-links', 'share-trip'],
    text: [
      'Ein **Lese-Link** zeigt Freunden das Tagebuch (alles oder nur Highlights) – ohne App, auf Wunsch mit Passwort. Mitreisende, die selbst mitplanen sollen, lädst du dagegen über *Mit Mitreisenden teilen* ein.'
    ]
  },
  {
    id: 'piwigo',
    group: 'Erinnern & teilen',
    title: 'Fotos in Piwigo',
    icon: 'images',
    keywords: 'piwigo galerie album hochladen',
    routes: ['piwigo'],
    text: ['Ist am eigenen Server eine Piwigo-Galerie angebunden, lädt die App die Originalfotos in ein Album je Reise hoch; im Tagebuch bleibt eine verkleinerte Kopie.']
  },

  // ---------------------------------------------------------------- Zusammen reisen
  {
    id: 'abgleich',
    group: 'Zusammen reisen',
    title: 'Geräte-Abgleich (eigener Server)',
    icon: 'cloud-arrow-up',
    keywords: 'server sync abgleich handy tablet pc schlüssel gruppe einladen',
    routes: ['sync', 'groups'],
    text: [
      'Damit Handys, Tablet und PC dieselben Daten haben, braucht es einen kleinen **eigenen Server** (z. B. auf einem Raspberry Pi oder im Proxmox-Container). Die Anleitung liegt im Projekt unter *server/README.md*.',
      'Geräte verbindest du mit dem Gruppenschlüssel oder einer Einladung (Code/QR). Der Abgleich läuft danach von selbst: beim Start, nach Änderungen und alle 5 Minuten.',
      'Ohne Server lassen sich Reisen auch **per Datei** austauschen (Einstellungen → Datensicherung → Reise exportieren).'
    ],
    links: [{ label: 'Geräte-Abgleich', to: '/abgleich' }]
  },
  {
    id: 'personen',
    group: 'Zusammen reisen',
    title: 'Personen und Rechte',
    icon: 'people',
    keywords: 'person rolle verwalter mitglied nur lesen privat passwort anmelden',
    routes: ['people'],
    text: [
      'Mit Personen meldet sich jede Person mit Name und Passwort an. Rollen: **Verwalter**, **Mitglied** (bearbeitet alles) und **Nur lesen**; je Reise auch abweichend bis „Kein Zugriff“.',
      'Ist ein Teilnehmer der Reise mit einem Konto verknüpft, sind seine Packliste, Medikamente, Impfungen und Dokumente privat.'
    ],
    links: [{ label: 'Personen & Rechte', to: '/personen' }]
  },
  {
    id: 'benachrichtigungen',
    group: 'Zusammen reisen',
    title: 'Benachrichtigungen',
    icon: 'bell',
    keywords: 'push mitteilung erinnerung unwetter mitreisende testnachricht',
    routes: ['push'],
    text: [
      'Über den eigenen Server kommen Erinnerungen an Fristen und Termine, Unwetterwarnungen und auf Wunsch Neues von den Mitreisenden – auch wenn die App geschlossen ist. Einschalten je Gerät.',
      'Auf iPad und iPhone nur für die installierte App (Home-Bildschirm). Kommt nichts an: „Testnachricht senden“ und in den Einstellungen des Geräts die Mitteilungen für die App prüfen.'
    ],
    links: [{ label: 'Benachrichtigungen', to: '/benachrichtigungen' }]
  },

  // ---------------------------------------------------------------- Daten & Sicherheit
  {
    id: 'sicherung',
    group: 'Daten & Sicherheit',
    title: 'Datensicherung und Umzug',
    icon: 'download',
    keywords: 'backup sichern wiederherstellen export import neues gerät umzug',
    routes: ['settings', 'backup-targets'],
    text: [
      'Die Daten gehören zur Adresse der App im Browser. Wer den Browser-Speicher löscht oder die App unter einer anderen Adresse öffnet, beginnt leer – deshalb gelegentlich **sichern**: *Einstellungen → Datensicherung* (mit oder ohne Fotos).',
      'Mit eigenem Server hat jedes Gerät alle Daten und der Server sichert sich auf Wunsch selbst (Sicherungsziele).'
    ],
    links: [{ label: 'Einstellungen', to: '/einstellungen' }]
  },
  {
    id: 'sperre',
    group: 'Daten & Sicherheit',
    title: 'App-Sperre',
    icon: 'shield-lock',
    keywords: 'code pin face id touch id sperren',
    routes: ['lock'],
    text: ['Schützt die App mit einem Code und auf Wunsch mit Face ID oder Touch ID – sinnvoll, wenn Pass- und Gesundheitsdaten gespeichert sind.']
  },
  {
    id: 'datenschutz',
    group: 'Daten & Sicherheit',
    title: 'Datenschutz',
    icon: 'incognito',
    keywords: 'privat daten dienste werbung tracking',
    text: [
      'Keine Anmeldung, keine Werbung, kein Tracking. Deine Daten liegen auf deinen Geräten und – wenn du willst – auf deinem eigenen Server.',
      'Für Wetter (Open-Meteo), Karten (OpenStreetMap), Reisehinweise (Auswärtiges Amt) und Unwetter (MeteoAlarm) fragt die App bzw. dein Server die freien Dienste nur nach Ort oder Land.'
    ]
  },
  {
    id: 'aussehen',
    group: 'Daten & Sicherheit',
    title: 'Aussehen und Statistik',
    icon: 'palette',
    keywords: 'design farbe schrift hintergrund dunkel statistik länder',
    routes: ['appearance', 'stats'],
    text: ['Design, Hintergrund und Schrift stellst du unter *Einstellungen → Aussehen* ein. Die **Statistik** zählt Reisen, Länder, Kilometer und Rekorde je Jahr.']
  }
]

export interface IntroSlide {
  icon: string
  title: string
  text: string
}

export const INTRO_SLIDES: IntroSlide[] = [
  { icon: 'globe-europe-africa', title: 'Willkommen bei „Nix wie weg“', text: 'Deine Reise von der ersten Idee über Packliste und Tagesplan bis zum Tagebuch und zur fertigen Reise-Webseite – in einer App.' },
  { icon: 'phone', title: 'Alles auf deinem Gerät', text: 'Keine Anmeldung, keine Werbung. Die Daten bleiben bei dir und die App funktioniert auch ohne Internet – ideal unterwegs.' },
  { icon: 'signpost-2', title: 'Planung · Unterwegs · Danach', text: 'Jede Reise hat drei Reiter. Die App zeigt jeweils, was gerade wichtig ist: vorher Unterkünfte und Packliste, unterwegs Tagesplan, Karte und Wetter, danach Tagebuch und Fotobuch.' },
  { icon: 'people', title: 'Zusammen reisen', text: 'Mit einem kleinen eigenen Server haben alle Mitreisenden dieselben Daten, stimmen gemeinsam ab und bekommen Erinnerungen und Unwetterwarnungen aufs Handy. Das ist freiwillig – allein geht alles auch ohne.' },
  { icon: 'house-heart', title: 'Als App installieren – und sichern', text: 'Leg die App auf den Home-Bildschirm (Safari: Teilen → „Zum Home-Bildschirm“). Und denk ab und zu an die Datensicherung unter Einstellungen.' }
]
