import type { HelpContent } from './types'

/**
 * Hilfetexte auf Deutsch.
 *
 * Neue Sprache: diese Datei kopieren (z. B. topics.en.ts), Titel und Texte übersetzen –
 * `id`, `group`, `icon` und `routes` bleiben gleich.
 * Neue Seite in der App: ihren Routen-Namen bei einem Thema unter `routes` eintragen
 * (ein Test prüft, dass jede Seite ein Thema hat).
 */
export const helpDe: HelpContent = {
  groups: [
    { id: 'start', title: 'Erste Schritte', icon: 'flag' },
    { id: 'planen', title: 'Planen', icon: 'map' },
    { id: 'vorbereiten', title: 'Vorbereiten', icon: 'list-check' },
    { id: 'unterwegs', title: 'Unterwegs', icon: 'compass' },
    { id: 'erinnern', title: 'Erinnern & Teilen', icon: 'journal-richtext' },
    { id: 'gemeinsam', title: 'Mehrere Geräte & Personen', icon: 'people' },
    { id: 'einstellungen', title: 'Einstellungen & Daten', icon: 'gear' },
    { id: 'fragen', title: 'Häufige Fragen', icon: 'question-circle' }
  ],
  topics: [
    // ───────────────────────── Erste Schritte ─────────────────────────
    {
      id: 'erste-schritte',
      title: 'So funktioniert die App',
      icon: 'signpost-split',
      group: 'start',
      summary: 'Eine Reise anlegen, die Reiseseite mit ihren Reitern, die Beispielreise.',
      routes: ['help', 'help-topic', 'intro'],
      keywords: 'anfang einstieg start überblick tour beispielreise beispiel',
      body: `
KofferFertigRaus begleitet eine Reise von der ersten Idee bis zur Erinnerung: planen, vorbereiten, unterwegs organisieren, festhalten und teilen. Alles liegt auf deinem Gerät und funktioniert auch ohne Internet.

## In drei Schritten loslegen
1. Unter **Reisen** auf **Neue Reise** tippen und Name, Reiseziel und Zeitraum eintragen. Alles andere ist freiwillig.
2. Die Reise öffnen. Die **Reiseseite** zeigt alle Bereiche als Kacheln – Anreise, Unterkünfte, Unternehmungen, Packliste und so weiter.
3. Einfach einen Bereich antippen und loslegen. Jeder Bereich funktioniert für sich; nichts muss vollständig ausgefüllt sein.

## Die Reiter der Reiseseite
- **Planung** – alles vor der Reise: Anreise, Unterkünfte, Ideen, Packliste, Dokumente, Reiseapotheke, Termine.
- **Unterwegs** – das Wichtigste für den Tag: große Knöpfe **Heute** und **Notfall**, Karte, Ausgaben, Tagebuch.
- **Danach** – Tagebuch fertig schreiben, Ausgaben abrechnen, Reisebericht und Fotobuch.
- **Teilen** – Reise-Webseite, Lese-Links für Freunde, Fotos in Piwigo.

Die App öffnet automatisch den passenden Reiter: vor der Reise „Planung“, während der Reise „Unterwegs“, danach „Danach“. Welche Bereiche wo stehen, stellst du unter [Aussehen](#/hilfe/aussehen) ein.

## Zum Ausprobieren: die Beispielreise
Solange noch keine Reise angelegt ist, bietet die Startseite eine **Beispielreise** an den Gardasee an – mit Anreise, Unterkunft, Unternehmungen, Packliste, Ausgaben und zwei Tagebuch-Einträgen. Daran siehst du, wie alles zusammenspielt. Oben auf ihrer Reiseseite löschst du sie mit einem Tipp wieder.

> Das **?** oben rechts führt von jeder Seite direkt zur passenden Hilfe.
`
    },
    {
      id: 'installieren',
      title: 'Auf den Home-Bildschirm legen',
      icon: 'phone',
      group: 'start',
      summary: 'Die App wie eine normale App starten – auf iPad, iPhone, Android und PC.',
      keywords: 'installieren installation app symbol icon homescreen home-bildschirm safari chrome pwa offline update aktualisieren',
      body: `
KofferFertigRaus ist eine Web-App: Sie kommt aus dem Browser, lässt sich aber wie eine normale App auf den Home-Bildschirm legen. Danach startet sie ohne Adressleiste, läuft offline und behält ihre Daten zuverlässig.

## iPad und iPhone (Safari)
1. Die App in **Safari** öffnen.
2. Auf **Teilen** tippen (Quadrat mit Pfeil nach oben).
3. **Zum Home-Bildschirm** wählen und bestätigen.
4. Ab jetzt die App über das neue Symbol öffnen.

> Wichtig auf iPad und iPhone: Daten von Webseiten, die man länger nicht öffnet, darf Safari löschen. Auf dem Home-Bildschirm gilt das nicht. Benachrichtigungen und Face ID gibt es ebenfalls nur dort.

Die Daten im Safari-Tab und in der App auf dem Home-Bildschirm sind **getrennt**. Hast du schon im Browser angefangen, hol die Daten mit einer [Sicherung](#/hilfe/sicherung) oder dem [Geräte-Abgleich](#/hilfe/abgleich) hinüber.

## Android (Chrome)
Menü (drei Punkte) → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.

## Computer (Chrome, Edge)
In der Adressleiste auf das Symbol **Installieren** klicken – oder einfach im Browser nutzen.

## Updates
Neue Versionen lädt die App von selbst, sobald Internet da ist. Was neu ist, steht unter [Was ist neu](#/hilfe/neu).
`
    },
    {
      id: 'daten',
      title: 'Wo liegen meine Daten?',
      icon: 'shield-lock',
      group: 'start',
      summary: 'Alles bleibt auf deinem Gerät – oder auf deinem eigenen Server.',
      keywords: 'datenschutz privat speicher lokal cloud konto offline sicherheit',
      body: `
Alle Reisen, Fotos und Notizen liegen **nur auf deinem Gerät** – im Speicher des Browsers bzw. der App. Es gibt kein Konto, keine Werbung und keinen fremden Server.

## Was die App aus dem Internet holt
Nur wenn Internet da ist und du die Funktion nutzt:
- Wetter und Höhendaten (Open-Meteo), Karten und Adresssuche (OpenStreetMap)
- Reise- und Sicherheitshinweise (Auswärtiges Amt), Wechselkurse (EZB)
- Routenplanung (BRouter) und Wanderwege (OpenStreetMap)

Dabei wird nur die Anfrage geschickt (z. B. ein Ort), nie deine Reise.

## Mehrere Geräte
Wer die Reise auf mehreren Geräten oder mit Mitreisenden haben will, hat zwei Wege:
- [Geräte-Abgleich](#/hilfe/abgleich) über deinen **eigenen Server** – automatisch.
- [Reise als Datei teilen](#/hilfe/mitreisende) – ohne Server, von Hand.

## Daten nicht verlieren
- Regelmäßig eine [Sicherung](#/hilfe/sicherung) erstellen.
- Unter Einstellungen → Speicher **Dauerhaft speichern anfragen** – dann darf der Browser die Daten nicht bei Platzmangel löschen.
- Auf iPad und iPhone die App [auf den Home-Bildschirm legen](#/hilfe/installieren).
`
    },

    // ───────────────────────── Planen ─────────────────────────
    {
      id: 'reise',
      title: 'Reise anlegen und bearbeiten',
      icon: 'suitcase2',
      group: 'planen',
      summary: 'Ziel, Zeitraum, Mitreisende, Budget, Titelbild, Archiv.',
      routes: ['trip-list', 'trip-new', 'trip-edit', 'trip-detail', 'trip-cover'],
      keywords: 'neue reise reiseziel zeitraum teilnehmer mitreisende personen budget titelbild archiv löschen zielländer länder',
      body: `
## Neue Reise
Unter **Reisen** → **Neue Reise**. Pflicht sind nur Name, Reiseziel und Zeitraum.

- **Zielländer** – damit holt die App die [Reisehinweise](#/hilfe/reisehinweise) des Auswärtigen Amts, Notfallnummern und [Unwetterwarnungen](#/hilfe/unwetter).
- **Wer reist mit?** – Namen der Mitreisenden. Damit lassen sich Packliste, Medikamente und Dokumente pro Person trennen und Ausgaben aufteilen. Mit [Personen & Rechte](#/hilfe/personen) kann jeder Name mit einem Konto verknüpft werden.
- **Anreise** und **Budget gesamt** – für Vorschläge und den Budget-Vergleich bei den [Ausgaben](#/hilfe/ausgaben).

## Die Reiseseite
Oben Titelbild, Zeitraum und die Eckdaten, darunter die Bereiche als Kacheln – sortiert in die Reiter **Planung**, **Unterwegs**, **Danach** und **Teilen**. Jede Kachel zeigt eine kurze Zusammenfassung, z. B. „12 von 30 eingepackt“.

Über das Menü oben (drei Punkte) erreichst du **Bearbeiten**, **Titelbild ändern**, **Mit Mitreisenden teilen**, **Ins Archiv legen** und **Löschen**.

## Titelbild
Ohne eigenes Foto zeichnet die App eine Landschaft passend zum Ziel. Du kannst ein Foto hochladen oder eines aus dem Tagebuch nehmen und den Ausschnitt verschieben.

## Archiv und Löschen
- **Ins Archiv legen**: Die Reise wandert in der Reiseliste nach unten in „Archiv“ – alle Daten bleiben erhalten.
- **Löschen** entfernt die Reise mit allem, was dazugehört (Packliste, Fotos, Tagebuch …). Das lässt sich nicht rückgängig machen.

Die Reiseliste ordnet nach **Gerade unterwegs**, **Geplant** und **Erinnerungen**.
`
    },
    {
      id: 'anreise',
      title: 'An- und Rückreise',
      icon: 'car-front',
      group: 'planen',
      summary: 'Etappen mit Auto, Bahn, Flug, Bus oder Fähre – mit Zeiten und Kosten.',
      routes: ['travel-list', 'travel-new', 'travel-edit'],
      keywords: 'etappe auto bahn zug flug bus fähre fahrkosten benzin maut vignette hinreise rückreise',
      body: `
Hin- und Rückreise bestehen aus **Etappen** – z. B. Auto bis zum Flughafen, Flug, Mietwagen.

- **Etappe** hinzufügen: Verkehrsmittel, von, nach, Datum, Abfahrt und Ankunft.
- Beim **Auto** rechnet die App aus Entfernung, Verbrauch und Spritpreis die Fahrtkosten aus, Maut und Vignette kommen dazu.
- **Buchungsnummer** und **Link** halten die Unterlagen griffbereit.
- **Rückreise aus der Hinreise übernehmen** legt die Etappen in umgekehrter Reihenfolge an – nur noch Datum und Zeiten anpassen.
- Mit **Apple Karten** oder **Google Maps** startest du die Navigation für eine Etappe.

Abfahrtszeiten erscheinen unter [Termine & Fristen](#/hilfe/termine) und im Tagesplan. Bestätigungsmails musst du nicht abtippen: [Buchung einlesen](#/hilfe/buchung).
`
    },
    {
      id: 'unterkuenfte',
      title: 'Unterkünfte',
      icon: 'house-door',
      group: 'planen',
      summary: 'Ideen vergleichen, Buchungen und Stornofristen im Blick.',
      routes: ['accommodation-list', 'accommodation-new', 'accommodation-edit'],
      keywords: 'hotel ferienwohnung camping hostel buchung storno stornofrist check-in check-out nächte',
      body: `
Leg Unterkünfte schon als **Idee** an – so behältst du Vergleiche im Blick. Der Status wandert dann zu **Angefragt** und **Gebucht** (oder **Storniert**).

- **Anreise / Abreise** – die App zeigt, welche Nächte noch offen sind („Noch offen: …“ bzw. „Alle Nächte gebucht“).
- **Kostenlos stornierbar bis** – die Frist erscheint unter [Termine & Fristen](#/hilfe/termine) und auf Wunsch als Erinnerung.
- **Adresse** – damit verortest du die Unterkunft schnell auf der [Karte](#/hilfe/karte); auch die Unwetterwarnungen nutzen sie.
- **Preis gesamt** fließt in die geplanten Kosten der Reise ein.

Bestätigungsmail vom Hotel oder Buchungsportal? Mit [Buchung einlesen](#/hilfe/buchung) füllt die App das Formular selbst aus.
`
    },
    {
      id: 'buchung',
      title: 'Buchung einlesen',
      icon: 'envelope-paper',
      group: 'planen',
      summary: 'Bestätigungen aus Mail, PDF oder Kalendereintrag übernehmen.',
      routes: ['booking-import'],
      keywords: 'bestätigung mail email pdf ics kalender automatisch erkennen hotel flug bahn',
      body: `
Statt Buchungen abzutippen, gibst du der App die Bestätigung:

1. **Datei wählen** (PDF, gespeicherte E-Mail, Kalendereintrag .ics) – oder den Text aus Mail oder PDF kopieren und **Aus Zwischenablage** einfügen.
2. Die App erkennt Unterkunft oder An-/Rückreise mit Daten, Zeiten, Preis, Buchungsnummer und Stornofrist.
3. Was fehlt, ergänzt du unten im Formular und speicherst.

Die Bestätigung wird zusätzlich unter [Dokumente](#/hilfe/dokumente) als „Buchung“ abgelegt – mit Buchungsnummer und einem Auszug des Textes. Wähle **Nur als Beleg**, wenn nur das gewünscht ist.

> Gelesen wird **hier auf dem Gerät** – nichts wird hochgeladen.
`
    },
    {
      id: 'unternehmungen',
      title: 'Unternehmungen',
      icon: 'star',
      group: 'planen',
      summary: 'Ideen sammeln – Sehenswürdigkeiten, Ausflüge, Restaurants.',
      routes: ['activity-list', 'activity-new', 'activity-edit'],
      keywords: 'ideen aktivitäten ausflug sehenswürdigkeit restaurant öffnungszeiten drinnen draußen priorität reservierung',
      body: `
Sammle hier alles, was ihr erleben wollt. Je mehr du einträgst, desto besser hilft später der [Tagesplaner](#/hilfe/heute).

- **Drinnen / draußen** – bei Regen schlägt der Tagesplaner Drinnen-Ideen vor.
- **Wie wichtig?** – Muss, Gern oder Vielleicht.
- **Öffnungszeiten** als Text, z. B. „Di–So 10–18“ – die App erkennt geschlossene Tage.
- **Reservierung / Ticket nötig** – erscheint als Hinweis in der Liste.
- **Geplanter Tag** – leer lassen, solange es noch offen ist.
- **Ort / Adresse** – damit verortest du die Unternehmung schnell auf der [Karte](#/hilfe/karte).

Uneinig, was ihr macht? Mit einer [Abstimmung](#/hilfe/abstimmungen) entscheidet die Gruppe.
`
    },
    {
      id: 'abstimmungen',
      title: 'Abstimmungen',
      icon: 'hand-thumbs-up',
      group: 'planen',
      summary: 'Fragen an die Gruppe – jeder stimmt auf seinem eigenen Gerät ab.',
      routes: ['polls', 'poll-new', 'poll-edit'],
      keywords: 'umfrage abstimmen stimme gruppe entscheiden tag finden termin',
      body: `
Wohin am Sonntag? Welcher Tag für die Gletschertour? Stell die Frage – alle stimmen ab.

## Drei Arten
- **Freie Antworten** – z. B. Restaurant oder Ausflugsziel.
- **Tag finden** – die Reisetage stehen schon drin, mehrere Antworten sind möglich.
- **Unternehmung wählen** – aus den Ideen unter [Unternehmungen](#/hilfe/unternehmungen).

## Abstimmen
Oben bei **Ich stimme ab als** deinen Namen wählen und antippen. Die Stimme lässt sich ändern oder zurückziehen, solange die Abstimmung läuft. „noch offen: …“ zeigt, wer noch fehlt.

**Abstimmen bis** setzt eine Frist – sie erscheint unter [Termine & Fristen](#/hilfe/termine).

## Ergebnis übernehmen
Bei einem Tag für eine Unternehmung trägt ein Tipp den gewählten Tag dort ein. Bei „Unternehmung wählen“ wird die Gewinnerin als geplant markiert.

> Damit die Stimmen auf allen Geräten zusammenkommen, braucht es den [Geräte-Abgleich](#/hilfe/abgleich). Mit [Personen & Rechte](#/hilfe/personen) stimmt jeder nur für sich selbst ab.
`
    },

    // ───────────────────────── Vorbereiten ─────────────────────────
    {
      id: 'packliste',
      title: 'Packliste',
      icon: 'backpack',
      group: 'vorbereiten',
      summary: 'Mit Vorlagen starten, pro Person packen, abhaken.',
      routes: ['packing-list', 'packing-templates', 'packing-edit'],
      keywords: 'packen koffer vorlage abhaken eingepackt wichtig kinder strand wandern wetter vorschläge',
      body: `
## Mit einer Vorlage starten
**Vorlagen auswählen** – z. B. Grundausstattung, Strand, Wandern, Kinder. Mengen werden nach Reisedauer und Personen berechnet (Socken pro Tag, Zahnbürste pro Person). Mehrere Vorlagen lassen sich kombinieren; Doppeltes wird zusammengefasst.

Persönliches (Kleidung, Ladekabel …) bekommt jede gewählte Person einzeln, Gemeinsames kommt einmal auf die Liste. Dafür bei der Reise unter **Wer reist mit?** Namen eintragen.

Auch praktisch: **Von einer anderen Reise übernehmen**.

## Packen
- Antippen hakt ab. **Nur offene** blendet Eingepacktes aus.
- **Wichtig – darf nicht fehlen** markiert Unverzichtbares; die Reiseseite zeigt, wenn davon noch etwas fehlt. Zwei Tage vor der Abreise erinnert die App an alles, was noch offen ist.
- Oben nach Person filtern – jeder packt seine eigene Liste.
- **Vorschläge für diese Reise** schaut aufs Wetter am Ziel (Regenjacke, Sonnencreme …).
- **Alle Häkchen entfernen** für die Rückreise.

> Mit [Personen & Rechte](#/hilfe/personen) ist die eigene Packliste privat – die anderen sehen sie nicht.
`
    },
    {
      id: 'apotheke',
      title: 'Reiseapotheke und Impfungen',
      icon: 'capsule',
      group: 'vorbereiten',
      summary: 'Medikamente mit Einnahmeplan und Vorrat, Impfschutz.',
      routes: ['meds-overview', 'med-new', 'med-edit', 'vacc-new', 'vacc-edit'],
      keywords: 'medikamente tabletten einnahme vorrat rezept handgepäck kühlen impfung impfschutz ablaufdatum allergie',
      body: `
## Medikamente
Für jedes Medikament: für wen, Dosis, Stück pro Einnahme, **Vorrat** und **Einnahmezeiten**. Die App rechnet aus, ob der Vorrat für die Reise reicht, und zeigt einen **Einnahmeplan** für alle.

Markierungen wie **Rezeptpflichtig**, **Ins Handgepäck** und **Kühlen** helfen beim Packen; **Haltbar bis** warnt vor abgelaufenen Mitteln.

## Impfungen
Trag Impfungen mit **Schutz gültig bis** ein. Läuft ein Schutz vor Reiseende ab, weist die App darauf hin. Sind Zielländer angegeben, stehen die Empfehlungen des Auswärtigen Amts dabei – mit **Übernehmen** kommen sie auf die Liste.

## Teilen mit Mitreisenden
Medikamente sind mit [Personen & Rechte](#/hilfe/personen) privat. Über **Wer darf das sehen?** gibst du einzelne frei – z. B. einen Allergiepass für die ganze Gruppe.

> Die Reiseapotheke hilft beim Organisieren und ersetzt keine ärztliche oder pharmazeutische Beratung.
`
    },
    {
      id: 'dokumente',
      title: 'Dokumente und Notfallnummern',
      icon: 'passport',
      group: 'vorbereiten',
      summary: 'Ausweise, Versicherungen, Tickets – mit Ablaufdaten. Notfallnummern.',
      routes: ['docs-overview', 'doc-new', 'doc-edit', 'contact-new', 'contact-edit'],
      keywords: 'ausweis reisepass personalausweis führerschein visum versicherung ticket ablaufdatum notfall notruf botschaft nummer',
      body: `
## Dokumente
**Vorschläge** legt die üblichen Dokumente passend zur Reise an (Ausweis, Führerschein bei Autofahrt, Versicherungen …). Für jedes: Status (fehlt, beantragt, vorhanden), Nummer, **Gültig bis** und ob eine Kopie abgelegt ist.

Läuft ein Dokument vor oder kurz nach der Reise ab, warnt die App – rechtzeitig, denn die Ausstellung kann Wochen dauern.

## Notfallnummern
Der Knopf **Notfall** im Reiter „Unterwegs“ führt direkt hierher.
- Die Nummern des Auswärtigen Amts (Notruf, Polizei, Botschaft) kommen automatisch, wenn Zielländer eingetragen sind.
- **Eigene Nummern**: Notruf der Auslandskrankenversicherung, Pannendienst, Unterkunft, Hausarzt …

Antippen ruft direkt an. Nummern immer mit Ländervorwahl eintragen.

> Mit [Personen & Rechte](#/hilfe/personen) sind Dokumente privat; über **Wer darf das sehen?** lassen sie sich freigeben.
`
    },
    {
      id: 'reisehinweise',
      title: 'Reisehinweise',
      icon: 'globe2',
      group: 'vorbereiten',
      summary: 'Sicherheitslage, Einreise und Impfschutz vom Auswärtigen Amt.',
      routes: ['reiseinfo'],
      keywords: 'auswärtiges amt sicherheit reisewarnung einreise visum impfschutz botschaft konsulat',
      body: `
Sind bei der Reise **Zielländer** eingetragen, holt die App die Reise- und Sicherheitshinweise des Auswärtigen Amts: Sicherheitslage, Einreisebestimmungen, Impfschutz und die deutschen Vertretungen.

- Die App prüft täglich, wenn du die Reise öffnest, und markiert Änderungen mit **geändert**.
- **Jetzt aktualisieren** holt sofort den neuesten Stand – am besten kurz vor der Abreise.
- Notfallnummern und Impfempfehlungen landen automatisch bei [Dokumente](#/hilfe/dokumente) und [Reiseapotheke](#/hilfe/apotheke).

> Die Hinweise richten sich an deutsche Staatsangehörige. Angaben ohne Gewähr.
`
    },
    {
      id: 'termine',
      title: 'Termine & Fristen',
      icon: 'calendar-event',
      group: 'vorbereiten',
      summary: 'Alle Fristen der Reise an einem Ort – auch im eigenen Kalender.',
      routes: ['termine'],
      keywords: 'fristen erinnerung kalender abo ics stornofrist abfahrt kalender-abo outlook',
      body: `
Die App sammelt Termine aus allen Bereichen: Stornofristen der Unterkünfte, Abfahrten, Reservierungen, ablaufende Dokumente, Impftermine, offene Packliste, Abstimmungsfristen. Ein Tipp auf einen Eintrag führt dorthin, wo du ihn ändern kannst.

## In den Kalender
- **Kalender-Abo** (empfohlen) – der Kalender auf iPad/iPhone, Android oder Outlook holt die Termine aller laufenden und kommenden Reisen selbst ab und erinnert rechtzeitig: Stornofristen 2 Tage vorher, Abfahrten 2 Stunden vorher, Reisetage am Vorabend. Braucht den [Geräte-Abgleich](#/hilfe/abgleich).
- **Als Benachrichtigung** – die App meldet sich selbst, auch wenn sie geschlossen ist: [Benachrichtigungen](#/hilfe/benachrichtigungen).
- **Einmalig als Datei** (.ics) – nur diese Reise, Stand jetzt.
`
    },

    // ───────────────────────── Unterwegs ─────────────────────────
    {
      id: 'heute',
      title: 'Heute und Tagesplaner',
      icon: 'sun',
      group: 'unterwegs',
      summary: 'Was steht heute an? Vorschläge passend zu Wetter und Öffnungszeiten.',
      routes: ['today', 'dayplanner'],
      keywords: 'tagesplan tag wetter vorhersage regen vorschlag einplanen öffnungszeiten heute',
      body: `
**Heute** im Menü öffnet den Tag der laufenden Reise – oder zeigt, wie lange es bis zur nächsten noch dauert.

## Der Tagesplan
- Oben das **Wetter** für den Tag. Beim ersten Mal den **Ort für die Wettervorhersage** wählen.
- Darunter, was für den Tag geplant ist – Anreise, Unternehmungen, Touren.
- **Vorschläge für diesen Tag** kommen aus deinen [Unternehmungen](#/hilfe/unternehmungen): Bei Regen werden Drinnen-Ideen bevorzugt, geschlossene ausgeblendet, „Muss“ vor „Vielleicht“. **Einplanen** setzt sie auf den Tag.
- **Verschieben auf** einen anderen Tag, **tauschen** gegen eine Alternative, **Zurück zu den Ideen**.

Gilt eine [Unwetterwarnung](#/hilfe/unwetter) für den Tag, steht sie oben.

> Ohne Internet zeigt der Tagesplan das zuletzt geladene Wetter.
`
    },
    {
      id: 'unwetter',
      title: 'Unwetterwarnungen',
      icon: 'cloud-lightning-rain',
      group: 'unterwegs',
      summary: 'Amtliche Warnungen der Wetterdienste für eure Orte.',
      routes: ['unwetter'],
      keywords: 'wetterwarnung sturm gewitter starkregen schnee hitze waldbrand lawine meteoalarm warnung',
      body: `
Die App zeigt amtliche Warnungen der Wetterdienste aus 38 Ländern Europas (MeteoAlarm): Sturm, Gewitter, Starkregen, Schnee und Glätte, Hitze, Waldbrandgefahr, Lawinen.

- **Warnungen für** eure Orte (Unterkünfte, Unternehmungen, Wetter-Ort, Reiseziel), das **ganze Land** oder **aus**.
- Jede Warnung mit Stufe (gelb, orange, rot), Gebiet, Zeitraum und der Empfehlung des Wetterdienstes.
- Fehlt eine Region, die dich interessiert? **Beobachten** – dann zählen Warnungen dort immer.
- Als [Benachrichtigung](#/hilfe/benachrichtigungen) ab dem Vortag der Reise, Stufe einstellbar.

> Braucht den [Geräte-Abgleich](#/hilfe/abgleich) mit eigenem Server und eingetragene Zielländer. Vor Ort zählen die Hinweise der Behörden.
`
    },
    {
      id: 'karte',
      title: 'Karte und Offline-Karten',
      icon: 'map',
      group: 'unterwegs',
      summary: 'Unterkünfte, Unternehmungen, Routen und Fotos auf einer Karte.',
      routes: ['map'],
      keywords: 'karte orte standort koordinaten gps offline navigation apple google fotos verorten',
      body: `
Die Karte zeigt Unterkünfte, Unternehmungen, [Routen](#/hilfe/routen) und Fotos aus dem Tagebuch. Oben nach Tag filtern, **Mein Standort** zeigt, wo du gerade bist.

## Orte auf die Karte bringen
Unter der Karte stehen bei **Noch nicht auf der Karte** alle Unterkünfte und Unternehmungen ohne Position. Auf **Verorten** tippen und dann
- suchen – Adresse oder Name; auch GPS-Koordinaten (z. B. vom Garmin) oder ein geteilter Link aus Google Maps / Apple Karten gehen,
- oder **Auf der Karte antippen**.

Ein Tipp auf einen Ort bietet **Route in Apple Karten** bzw. **Google Maps** zum Navigieren.

## Fotos
Fotos mit GPS-Angaben erscheinen von selbst. Fehlt der Ort, schätzt die App ihn aus einer aufgezeichneten Tour zur Aufnahmezeit – oder du setzt ihn unter **Fotos ohne Ort** von Hand.

## Offline-Karten
Ohne Netz zeigt die Karte nur Ausschnitte, die du schon einmal angesehen hast. Mit **Offline-Karten** speicherst du die ganze Gegend auf dem Gerät – ideal für Berge und Ausland. Erstellt werden sie von deinem eigenen Server ([Geräte-Abgleich](#/hilfe/abgleich)).
`
    },
    {
      id: 'routen',
      title: 'Routen & Touren',
      icon: 'signpost-2',
      group: 'unterwegs',
      summary: 'GPX und Garmin-Touren importieren, Strecken planen, Wanderwege finden.',
      routes: ['routes', 'route-planner', 'route'],
      keywords: 'gpx fit garmin komoot outdooractive tour wandern radtour höhenprofil höhenmeter strecke planen wanderweg kml',
      body: `
## Importieren
**Datei importieren**: GPX, FIT (Garmin), TCX, KML/KMZ (Google My Maps) und GeoJSON. Die App zeigt Strecke, Länge, Höhenmeter und Höhenprofil.

Woher? Garmin Connect (Aktivität → Zahnrad → „In GPX exportieren“), direkt vom Garmin-Gerät per USB, fertige Touren von Outdooractive, Komoot oder Bergfex. Auf iPad und iPhone liegen heruntergeladene Dateien in der Dateien-App.

## Planen und suchen
- **Strecke planen**: Punkte auf die Karte tippen – erst A, dann B, weitere als Zwischenziele. Die Strecke folgt Wegen und Straßen (BRouter).
- **Wanderwege suchen**: zur Gegend zoomen, dann **Im Ausschnitt suchen**.
Beides braucht Internet.

## Danach
Jede Route lässt sich einem **Tag der Reise** zuordnen, erscheint auf der [Karte](#/hilfe/karte), im Tagebuch und im Reisebericht. **Als GPX (für Garmin)** bringt sie aufs Navi. Mit **Auf Reise-Webseite und in Lese-Links zeigen** entscheidest du, ob Freunde sie sehen.

Fehlen Höhen in der Datei, ergänzt **Höhen ergänzen** sie aus einem Geländemodell.
`
    },
    {
      id: 'ausgaben',
      title: 'Ausgaben und Budget',
      icon: 'wallet2',
      group: 'unterwegs',
      summary: 'Schnell erfassen, Fremdwährung, wer schuldet wem was.',
      routes: ['expenses', 'expense-new', 'expense-edit'],
      keywords: 'geld kosten budget währung wechselkurs beleg quittung aufteilen ausgleich schulden abrechnung',
      body: `
## Schnell erfassen
Betrag und Stichwort eintippen, Kategorie antippen – fertig. **Mit Beleg, Fremdwährung oder Aufteilung …** öffnet alle Felder.

- **Fremdwährung**: Die App rechnet mit den Referenzkursen der EZB in die Reisewährung um (braucht einmal Internet).
- **Beleg**: Foto der Quittung anhängen.
- **Bezahlt von** und **Für wen?** – nichts gewählt heißt: für alle.

## Budget
Ist bei der Reise ein Budget eingetragen, zeigt die App oben **Ausgegeben** im Vergleich – und warnt, wenn das Tempo das Budget sprengt. Die geplanten Kosten aus Unterkünften, Anreise und Unternehmungen stehen auf der Reiseseite.

## Ausgleich
Unter **Ausgleich** rechnet die App aus, wer wem wie viel gibt, damit alle quitt sind – mit möglichst wenigen Überweisungen.
`
    },

    // ───────────────────────── Erinnern & Teilen ─────────────────────────
    {
      id: 'tagebuch',
      title: 'Reisetagebuch',
      icon: 'journal-richtext',
      group: 'erinnern',
      summary: 'Einträge pro Tag mit Fotos, Sprachnotizen und Stimmung.',
      routes: ['journal-list', 'journal-new', 'journal-edit'],
      keywords: 'tagebuch eintrag fotos bilder sprachnotiz aufnahme stimmung highlight entwurf erinnerung',
      body: `
Pro Tag ein Eintrag: Überschrift, Ort, Text, Stimmung, Fotos und Sprachnotizen.

## Entwurf aus dem Tag
Keine Zeit zum Schreiben? **Entwurf aus dem Tag** setzt einen Text aus dem zusammen, was die App schon weiß: Anreise, Wetter, Unternehmungen, Touren mit Kilometern und Höhenmetern, Unterkunft, Ausgaben. Du ergänzt nur noch das Erlebte. Leere Felder werden gefüllt, Geschriebenes bleibt.

## Fotos
**Fotos hinzufügen** – sie werden verkleinert gespeichert (höchstens 2048 Pixel), das spart Platz. Aufnahmeort und -zeit werden übernommen, das Foto erscheint auf der [Karte](#/hilfe/karte). Ein Foto lässt sich als Titelbild der Reise nehmen.

## Sprachnotizen
**Sprachnotiz aufnehmen** – ideal unterwegs. Beim ersten Mal fragt das Gerät nach dem Mikrofon. Höchstens 15 Minuten am Stück.

## Highlights
Der **Stern** markiert die schönsten Einträge – sie kommen auf die [Reise-Webseite](#/hilfe/webseite) und in den [Reisebericht](#/hilfe/bericht). **Leere Tage** zeigt, wo noch etwas fehlt.
`
    },
    {
      id: 'bericht',
      title: 'Reisebericht und Fotobuch',
      icon: 'book',
      group: 'erinnern',
      summary: 'Die Reise als PDF – zum Verschicken oder als Fotobuch zum Drucken.',
      routes: ['report'],
      keywords: 'pdf bericht fotobuch drucken druckerei album zusammenfassung datei',
      body: `
Aus Tagebuch, Fotos, Touren, Unterkünften und Ausgaben entsteht ein fertiger Bericht.

- **Art**: **Bericht** (Text mit Fotos) oder **Fotobuch** (Fotos groß, Text knapp).
- Wählen, was hinein soll: Fotos (alle, höchstens 4 je Eintrag, nur Höhepunkte), Touren mit Karte, Überblick, Unterkünfte, Ausgaben.
- **PDF-Datei erstellen**: **kleine Datei** zum Teilen oder **Druckqualität (300 dpi)**.

Fürs Fotobuch: Seitenformat und **Fotos je Seite** wählen; für Druckereien **3 mm Beschnitt** einschalten. Die Datei lässt sich bei vielen Fotobuch-Anbietern hochladen.

> Kartenbilder brauchen Internet. Ohne erscheinen Touren als Linie – **Noch einmal versuchen**, sobald wieder Netz da ist.
`
    },
    {
      id: 'webseite',
      title: 'Reise-Webseite',
      icon: 'window',
      group: 'erinnern',
      summary: 'Eine schöne Seite mit Fotos – als einzelne Datei, ohne Server.',
      routes: ['website'],
      keywords: 'webseite homepage html blog veröffentlichen github pages vorlage design freunde zeigen',
      body: `
Aus deinem Tagebuch entsteht eine Webseite – als **eine einzige HTML-Datei** mit allen Fotos. Sie funktioniert ohne Internet und in jedem Browser.

1. **Vorlage**, Akzentfarbe, Schrift und hell/dunkel wählen.
2. **Texte**: Titel, Untertitel, Einleitung – oder **aus Reise übernehmen**.
3. **Was soll auf die Seite?** Tagebuch (alle oder nur Highlights), Routen mit Karten, Unterkünfte, Unternehmungen.
4. **Webseite erstellen** → **Teilen**, **Herunterladen** oder **Öffnen**.

Preise, Buchungsnummern und Notizen kommen nie auf die Seite.

## Ins Internet bringen
Am einfachsten per AirDrop, Mail oder Messenger verschicken. Für eine feste Adresse beschreibt **Wie bringe ich die Seite ins Internet?** den Weg über GitHub Pages (kostenlos).

Mit eigenem Server geht es noch einfacher: [Lese-Links](#/hilfe/lese-links).
`
    },
    {
      id: 'lese-links',
      title: 'Für Freunde freigeben (Lese-Links)',
      icon: 'link-45deg',
      group: 'erinnern',
      summary: 'Ein Link, über den Freunde eure Erlebnisse ansehen – ohne App.',
      routes: ['share-links'],
      keywords: 'link freigabe freunde familie teilen passwort ansehen lesen',
      body: `
Ein **Lese-Link** zeigt deine Erlebnisse als schöne Seite. Freunde brauchen weder App noch Schlüssel und können nichts ändern. Neue Tagebuch-Einträge erscheinen dort von selbst.

- **Was sollen Freunde sehen?** Nur Highlights oder ganzes Tagebuch, Fotos, Routen, Unterkünfte, Unternehmungen.
- Optional **Passwort** und **Gültig** bis.
- **Für wen?** – nur eine Notiz für dich, damit du die Links auseinanderhältst.
- Löschen beendet den Link sofort.

**Nie dabei:** Planung, Budget, Ausgaben, Reiseapotheke, Dokumente, Notfallnummern, Mitreisende, Aufnahmeorte der Fotos und Sprachnotizen.

> Lese-Links laufen über deinen eigenen Server – erst den [Geräte-Abgleich](#/hilfe/abgleich) einrichten.
`
    },
    {
      id: 'mitreisende',
      title: 'Reise als Datei teilen',
      icon: 'send',
      group: 'erinnern',
      summary: 'Die ganze Reise an Mitreisende schicken – ohne Server.',
      routes: ['share-trip'],
      keywords: 'mitreisende datei airdrop teilen übertragen anderes gerät ohne server',
      body: `
Ohne eigenen Server teilst du eine Reise als Datei. Sie enthält alles: Planung, Packliste, Apotheke, Dokumente, Tagebuch, Ausgaben und Karte – auf Wunsch auch die Fotos.

1. Auf der Reiseseite im Menü **Mit Mitreisenden teilen** → **Datei erstellen** → **Teilen** (z. B. per AirDrop).
2. Auf dem anderen Gerät: Einstellungen → **Backup oder geteilte Reise einlesen**.

Beim Einlesen wird zusammengeführt: Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung.

> Gelöschtes wird nicht übertragen. Am besten abwechselnd: A schickt an B, B liest ein und schickt zurück. Bequemer und automatisch geht es mit dem [Geräte-Abgleich](#/hilfe/abgleich).
`
    },
    {
      id: 'statistik',
      title: 'Statistik',
      icon: 'bar-chart',
      group: 'erinnern',
      summary: 'Eure Reisen in Zahlen – Länder, Reisetage, Rekorde.',
      routes: ['stats'],
      keywords: 'zahlen länder rekorde reisetage kilometer höhenmeter',
      body: `
Unter **Reisen** → **Statistik**: wo ihr wart (Länder auf der Karte), Reisetage je Monat und Rekorde – längste Reise, längste Tour, meiste Höhenmeter, Ausgaben. Oben nach Jahr filtern.
`
    },
    {
      id: 'piwigo',
      title: 'Fotos in Piwigo',
      icon: 'images',
      group: 'erinnern',
      summary: 'Originalfotos in die eigene Piwigo-Galerie hochladen und von dort holen.',
      routes: ['piwigo-trip'],
      keywords: 'piwigo galerie fotos original hochladen album',
      body: `
Wer eine eigene **Piwigo**-Galerie betreibt, kann sie mit der Reise verbinden:

- **Album dieser Reise** anlegen oder ein vorhandenes verbinden.
- **Neue Fotos aus dem Tagebuch automatisch hochladen** – in voller Größe (Original), während im Tagebuch eine verkleinerte Fassung bleibt.
- Im Tagebuch über **Aus Piwigo** Fotos aus der Galerie übernehmen.

Fotos, die im Tagebuch gelöscht werden, bleiben in Piwigo.

> Läuft über deinen eigenen Server; Piwigo muss dort eingerichtet und für die Reisegruppe freigegeben sein.
`
    },

    // ───────────────────────── Mehrere Geräte & Personen ─────────────────────────
    {
      id: 'abgleich',
      title: 'Geräte-Abgleich',
      icon: 'cloud-arrow-up',
      group: 'gemeinsam',
      summary: 'iPad, Handy und PC automatisch auf demselben Stand – über deinen eigenen Server.',
      routes: ['sync', 'groups'],
      keywords: 'sync synchronisation server mehrere geräte koppeln einladung schlüssel reisegruppe abgleich cloud',
      body: `
Mit dem Geräte-Abgleich haben alle Geräte – deine und die der Mitreisenden – dieselben Daten. Er läuft über einen **eigenen Server** (z. B. zu Hause); eine Anleitung liegt im Quellcode unter \`server/README.md\`.

## Ein Gerät verbinden
- **Einladung**: Auf einem verbundenen Gerät **Gerät hinzufügen** bzw. **Kopplungs-Link teilen** – den Link per AirDrop oder Nachricht schicken oder den QR-Code scannen.
- **Name und Passwort**: für [Personen](#/hilfe/personen), die schon eingeladen wurden.
- Auf iPad und iPhone, wenn die App schon auf dem Home-Bildschirm liegt: dort öffnen und den **Einladungscode** eingeben (der Link öffnet sonst nur Safari).

## So funktioniert es
- Jedes Gerät merkt sich seine Änderungen – auch offline – und schickt sie, sobald Internet da ist.
- Abgeglichen wird beim Öffnen, wenige Sekunden nach einer Änderung und alle 5 Minuten.
- Ändern zwei Geräte denselben Eintrag, gewinnt die neuere Änderung. Löschungen werden übertragen.
- Fotos werden in voller Größe übertragen.

Das Wolken-Symbol oben zeigt den Stand: Haken = alles abgeglichen, Pfeil = es wird gerade abgeglichen, Zahl = Änderungen warten.

## Reisegruppen
Freunde, die die App für **eigene** Reisen nutzen möchten, bekommen eine eigene Reisegruppe mit eigenem Schlüssel – sie sehen nur ihre Reisen.

## Was der Server noch kann
[Lese-Links](#/hilfe/lese-links), [Benachrichtigungen](#/hilfe/benachrichtigungen), [Kalender-Abo](#/hilfe/termine), [Offline-Karten](#/hilfe/karte), [Unwetterwarnungen](#/hilfe/unwetter), [Piwigo](#/hilfe/piwigo) und eine [Sicherung jede Nacht](#/hilfe/sicherung).
`
    },
    {
      id: 'personen',
      title: 'Personen & Rechte',
      icon: 'person-lock',
      group: 'gemeinsam',
      summary: 'Wer darf was – und was bleibt privat.',
      routes: ['people'],
      keywords: 'rollen rechte verwalter mitglied lesen einladen passwort privat konto benutzer verknüpfen zugriff',
      body: `
Ohne Personen sieht und ändert jedes verbundene Gerät alles. Mit Personen bekommt jeder ein eigenes Konto mit Rechten.

## Einrichten
1. **Zuerst: Wer bist du?** – Namen und Passwort eintragen, **Das bin ich**. Die erste Person wird Verwalter.
2. **Person einladen** – mit Rolle. Die Einladung (Link oder QR-Code) gilt einmal; dabei legt die Person ihr Passwort fest.
3. **Geräte ohne Person** einer Person zuordnen – dann gelten deren Rechte.

## Rollen
- **Verwalter** laden ein, vergeben Rollen und Rechte je Reise.
- **Mitglieder** bearbeiten alle Reisen.
- **Nur lesen** sieht alles, ändert nichts (abstimmen geht trotzdem).
Je Reise lässt sich das abweichend einstellen – bis **Kein Zugriff**: Dann kommt die Reise gar nicht erst auf die Geräte der Person.

## Privat
Bei der Reise unter **Wer reist mit?** jeden Namen **mit Konto verknüpfen**. Dann sind **Packliste, Medikamente, Impfungen und Dokumente** dieser Person privat – nur sie sieht sie, auch Verwalter nicht. Einzelne Dokumente oder Medikamente gibt man über **Wer darf das sehen?** frei (z. B. den Allergiepass).

Nicht verknüpfte Namen (z. B. Kinder) sieht die ganze Gruppe.
`
    },
    {
      id: 'benachrichtigungen',
      title: 'Benachrichtigungen',
      icon: 'bell',
      group: 'gemeinsam',
      summary: 'Erinnerungen, Neues von Mitreisenden und Unwetter – auch bei geschlossener App.',
      routes: ['push'],
      keywords: 'push mitteilung erinnerung benachrichtigung ton hinweis',
      body: `
Unter Geräte-Abgleich → **Benachrichtigungen** einmal **Einschalten** – das Gerät fragt nach der Erlaubnis. Die Einstellung gilt je Gerät.

- **Erinnerungen an Termine und Fristen** – Stornofrist, Check-in, Abfahrt, Impftermin, Reisebeginn.
- **Neues von den Mitreisenden** – z. B. „Birgit – Neu: ein Tagebucheintrag, 5 Fotos“, gebündelt, höchstens alle 15 Minuten je Reise. Private Einträge anderer nie.
- **Unwetterwarnungen** – ab Stufe Gelb, Orange oder Rot.

**Testnachricht senden** zeigt, ob alles ankommt. Antippen einer Nachricht öffnet die passende Stelle in der App.

> Auf iPad und iPhone nur für die App [auf dem Home-Bildschirm](#/hilfe/installieren) (ab iOS 16.4). Erlaubnis später ändern: Einstellungen → Mitteilungen → KofferFertigRaus. Braucht den [Geräte-Abgleich](#/hilfe/abgleich) mit eigenem Gerätezugang.
`
    },

    // ───────────────────────── Einstellungen & Daten ─────────────────────────
    {
      id: 'sicherung',
      title: 'Datensicherung',
      icon: 'download',
      group: 'einstellungen',
      summary: 'Sicherung als Datei, einlesen, Sicherung auf dem Server.',
      routes: ['settings', 'backup-targets'],
      keywords: 'backup sichern exportieren importieren einlesen wiederherstellen datei speicher nas sicherungsziel',
      body: `
## Sicherung als Datei
Einstellungen → **Backup exportieren**. Mit **Fotos mitsichern** wird die Datei deutlich größer, enthält dann aber alles. Leg die Datei an einem sicheren Ort ab (Dateien-App, Computer, Cloud).

**Backup oder geteilte Reise einlesen** führt zusammen: Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung. Nichts wird überschrieben, was neuer ist.

So kommen die Daten auch auf ein neues Gerät – oder vom Safari-Tab in die App auf dem Home-Bildschirm.

## Speicher
Unter **Speicher** siehst du, wie viel Platz belegt ist. **Dauerhaft speichern anfragen** bittet den Browser, die Daten nicht bei Platzmangel zu löschen.

## Sicherung auf dem Server
Mit [Geräte-Abgleich](#/hilfe/abgleich) sichert dein Server jede Nacht alle Reisen und Fotos. Unter Geräte-Abgleich → **Server-Sicherung** kommen weitere Ziele dazu: Platte oder NAS-Ordner, SMB-Freigabe, SSH/rsync oder WebDAV.
`
    },
    {
      id: 'aussehen',
      title: 'Aussehen und Reiseseite',
      icon: 'palette',
      group: 'einstellungen',
      summary: 'Designs, Hintergrund, Schriftgröße und die Aufteilung der Reiseseite.',
      routes: ['appearance'],
      keywords: 'design farbe dunkel hell schrift schriftgröße hintergrund foto kacheln reiter layout',
      body: `
Einstellungen → **Aussehen**. Alles wirkt sofort und gilt für dieses Gerät.

- **Design** – 18 Stile mit eigenen Farben und Schriften; hell, dunkel oder wie das Gerät.
- **Schriftgröße** und **Ecken**.
- **Hintergrund** – eigenes Foto oder Muster, mit Schleier, Unschärfe und Farbsättigung.

## Reiseseite
- Bereiche als **Kacheln**, **große Kacheln** oder **kompakte Liste**.
- Titelbild groß, mittel, klein oder keines.
- **Reiter** an oder aus, passender Reiter nach Datum.
- **Welche Bereiche stehen wo?** – Bereiche zwischen Planung, Unterwegs, Danach und Teilen verschieben. Bereiche, die in keinem Reiter stehen, bleiben unter „Weitere Bereiche“ erreichbar.
`
    },
    {
      id: 'sperre',
      title: 'App-Sperre',
      icon: 'shield-lock',
      group: 'einstellungen',
      summary: 'Die App mit Code oder Face ID schützen.',
      routes: ['lock'],
      keywords: 'code pin face id touch id sperren schützen passwort vergessen',
      body: `
Einstellungen → **App-Sperre**: ein Code mit 4–8 Ziffern, auf iPad und iPhone zusätzlich **Face ID / Touch ID**. Gilt nur für dieses Gerät.

Die Sperre schützt vor neugierigen Blicken, wenn jemand das Gerät in die Hand bekommt. Die Daten selbst sind nicht verschlüsselt – bei Verlust schützt die Gerätesperre.

> Den Code kann niemand wiederherstellen. Ausweg: die Daten der App auf dem Gerät löschen; mit [Geräte-Abgleich](#/hilfe/abgleich) kommen alle Reisen danach vom Server zurück.

Face ID gibt es nur, wenn die App [auf dem Home-Bildschirm](#/hilfe/installieren) liegt.
`
    },
    {
      id: 'neu',
      title: 'Was ist neu?',
      icon: 'stars',
      group: 'einstellungen',
      summary: 'Die Neuerungen der letzten Versionen.',
      keywords: 'version update neuerungen änderungen changelog',
      // Inhalt kommt aus dem Änderungsprotokoll (CHANGELOG.md)
      body: ''
    },

    // ───────────────────────── Häufige Fragen ─────────────────────────
    {
      id: 'fragen',
      title: 'Häufige Fragen',
      icon: 'chat-square-text',
      group: 'fragen',
      summary: 'Offline, verlorene Daten, Kosten, Mitreisende ohne App …',
      keywords: 'faq frage problem hilfe fehler kosten offline gelöscht weg verschwunden',
      body: `
## Funktioniert die App ohne Internet?
Ja. Alles, was du eingetragen hast, ist offline da. Nur Wetter, Kartenausschnitte, Adresssuche, Routenplanung, Reisehinweise und Wechselkurse brauchen Netz. Für unterwegs: [Offline-Karten](#/hilfe/karte) speichern und den Tagesplan einmal mit Internet öffnen.

## Meine Daten sind weg – was tun?
Auf iPad und iPhone hat jede Umgebung eigene Daten: der Safari-Tab, die App auf dem Home-Bildschirm und jeder andere Browser. Prüfe, ob du die App anders geöffnet hast. Sonst: [Sicherung einlesen](#/hilfe/sicherung) oder den [Geräte-Abgleich](#/hilfe/abgleich) verbinden – dann kommt alles vom Server zurück.

## Kostet die App etwas?
Nein. KofferFertigRaus ist freie Software (AGPL-3.0), ohne Werbung und ohne Konto. Wer mag, kann die Entwicklung unter Einstellungen → **Unterstützen** fördern.

## Brauchen Mitreisende die App?
Nicht unbedingt. Zum Mitplanen ja (mit [Geräte-Abgleich](#/hilfe/abgleich) oder [als Datei](#/hilfe/mitreisende)). Zum Anschauen genügt ein [Lese-Link](#/hilfe/lese-links) oder die [Reise-Webseite](#/hilfe/webseite).

## Sehen die anderen meine Packliste?
Ohne [Personen & Rechte](#/hilfe/personen): ja, alle verbundenen Geräte sehen alles. Mit Personen und verknüpftem Namen sind Packliste, Medikamente und Dokumente privat.

## Ich habe etwas gelöscht – geht das zurück?
In der App nicht. Hilfe bietet eine ältere [Sicherung](#/hilfe/sicherung): Einlesen bringt Gelöschtes zurück, ohne Neueres zu überschreiben. Mit eigenem Server gibt es außerdem die nächtliche Server-Sicherung.

## Warum zeigt die Karte nichts an?
Ohne Internet nur bereits angesehene Ausschnitte – oder gespeicherte [Offline-Karten](#/hilfe/karte). Damit Unterkünfte und Unternehmungen erscheinen, brauchen sie einen Ort (Adresse suchen oder auf die Karte tippen).

## Wie bekomme ich die neueste Version?
Von selbst: Bei Internet lädt die App Updates im Hintergrund, beim nächsten Öffnen sind sie da. Die Version steht unter Einstellungen → Über.

## Wo melde ich einen Fehler?
Im Quellcode-Projekt auf GitHub (Einstellungen → Über → **Quellcode**) unter „Issues“.
`
    }
  ]
}
