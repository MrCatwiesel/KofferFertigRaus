# Änderungsprotokoll

## 1.37.0 – 2026-10-14

### Englisch (Teil 2): Planung
- Auf Englisch jetzt auch: **An- und Rückreise, Unterkünfte, Buchung einlesen, Unternehmungen, Abstimmungen, Dokumente & Notfallnummern, Reiseapotheke und Termine & Fristen** – samt Erinnerungen, Kalender-Abo-Texten und den Sätzen im Tagebuch-Entwurf
- Vorschläge (Dokumente, Grundausstattung der Reiseapotheke) werden in der gewählten Sprache angelegt
- Noch auf Deutsch: Packliste, Reisehinweise, Unterwegs- und Danach-Bereiche – folgen als Nächstes

## 1.36.0 – 2026-10-14

### Neu: Englisch (Teil 1)
- **Sprache wählbar** unter *Einstellungen → Sprache · Language*: Deutsch, English oder „Wie das Gerät“. Gilt für dieses Gerät
- Schon auf Englisch: Reiseliste und Reiseseite, Reise anlegen und bearbeiten, Einstellungen, Geräte-Abgleich, Personen & Rechte, Benachrichtigungen, Server-Sicherung, App-Sperre, Aussehen und Designs, **Hilfe und Einführung** – dazu Datum, Zahlen, Ländernamen und Währungen im englischen Format
- Die übrigen Bereiche folgen in den nächsten Versionen; bis dahin erscheinen dort noch deutsche Texte. Deshalb stellt „Wie das Gerät“ vorerst noch nicht von selbst auf Englisch um
- Für Deutsch ändert sich nichts

## 1.35.0 – 2026-10-14

### Neu: Hilfe & Einführung
- **Hilfe** (*Einstellungen → Hilfe & Einführung*): alle Bereiche kurz erklärt – von „Reise anlegen“ über Packliste, Tagesplan und Unwetter bis zu Server, Personen, Benachrichtigungen und Datensicherung – mit **Suche** (Umlaute egal) und Links direkt an die richtige Stelle
- **„?“ oben rechts** auf jeder Seite öffnet die Hilfe genau zum Thema der Seite, auf der du gerade bist
- **Einführung** in fünf kurzen Seiten zum Durchtippen: was die App kann, „alles auf deinem Gerät“, die drei Reiter Planung · Unterwegs · Danach, Zusammen reisen, installieren und sichern. Beim ersten Start auf der leeren Reiseliste angeboten, jederzeit aus der Hilfe erneut aufrufbar
- „Als App installieren“ erklärt den Weg für iPad/iPhone, Android und PC
- Unter *Über* steht jetzt auch MeteoAlarm bei den genutzten Diensten

## 1.34.0 – 2026-10-14 (Server 1.19.0)

### Neu: Abstimmungen
- **Gemeinsam entscheiden** (*Reise → Abstimmungen*): Frage stellen, Antworten eine pro Zeile – z. B. „Was machen wir am Samstag?“. Jede Person stimmt auf ihrem eigenen Gerät ab, das Ergebnis sehen alle nach dem Abgleich
- **Unternehmungen zur Wahl stellen:** Ideen aus den Unternehmungen als Antworten übernehmen; nach dem Beenden plant „einplanen“ den Gewinner ein
- Eine oder mehrere Antworten, Frist („Abstimmen bis“), Hinweis; Antworten lassen sich nachträglich ergänzen
- Ergebnis mit Balken, Namen und Pokal für die Antwort(en) vorne; „fehlt noch: …“ zeigt, wer noch nicht abgestimmt hat
- **Wer stimmt ab?** Mit Personen & Rechte automatisch die eigene Person (auch mit „Nur lesen“ – die Stimme gehört nur dir, niemand sonst kann sie ändern). Ohne Personen wählt man auf dem Gerät „Ich stimme ab als …“ – so kann z. B. ein Elternteil auch für die Kinder abstimmen
- Die Reiseseite zeigt offene Abstimmungen und ob deine Stimme noch fehlt; mit „Neues von den Mitreisenden“ kommt eine Benachrichtigung bei neuen Abstimmungen und Stimmen
- Braucht für die Rechte-Prüfung den Server ab Version 1.19 (ältere Server gleichen Abstimmungen auch ab, prüfen aber die Stimmen nicht)

## 1.33.0 – 2026-10-14 (Server 1.18.0)

### Neu: Unwetterwarnungen
- **Amtliche Warnungen für die Orte der Reise** (*Reise → Unwetterwarnungen*): Gewitter, Sturm, Starkregen, Hitze, Schnee, Lawinen … der nationalen Wetterdienste Europas über MeteoAlarm – in den Stufen Gelb, Orange und Rot, mit Zeitraum, Text und Verhaltenstipps des Wetterdienstes (Deutsch, sonst Englisch)
- Geprüft werden die **Unterkünfte** (mit Ort auf der Karte, für ihre Nächte), der **Wetter-Ort** im Tagesplan und – wenn beides fehlt – das **Reiseziel**. Der Server ordnet jeden Ort seiner Warnregion zu (z. B. „Tirol“ und „Innsbruck (Stadt)“)
- Laufende Warnungen stehen auch **oben im Tagesplan**; die Reiseseite zeigt die wichtigste in der Kachel
- **Push-Benachrichtigung bei Unwetter** (*Benachrichtigungen → Unwetterwarnungen*, Standard an): neue Warnungen der Stufen Orange und Rot – auf Wunsch auch Gelb – ab dem Tag vor der Anreise bis zur Abreise, je Warnung einmal, auch wenn die App geschlossen ist
- Die App sieht ab 7 Tage vor der Reise von selbst nach; „Jetzt aktualisieren“ geht jederzeit
- Länder ohne genaue Warnregionen (Schweiz, Großbritannien): Warnungen des ganzen Landes zum selbst Prüfen. Außerhalb Europas gibt es keine Warnungen über MeteoAlarm
- Braucht den eigenen Server ab Version 1.18 (Geräte-Abgleich)

## 1.32.1 – 2026-10-14

### Korrigiert: Karten im Lese-Link
- Die Seite hinter einem Lese-Link zeigt Routen jetzt wie die Reise-Webseite mit **Karte (OpenStreetMap)**, Start- und Zielpunkt und ab zwei Routen mit **Übersichtskarte** – bisher nur als Linie ohne Hintergrund
- Die Karten lädt der Browser der Betrachter beim Öffnen. Klappt das nicht (keine Verbindung zu OpenStreetMap), erscheint wie bisher die Strecke als Linie

## 1.32.0 – 2026-10-14 (Server 1.17.0)

### Neu: Push-Benachrichtigungen
- **Benachrichtigungen aufs Gerät** (*Geräte-Abgleich → Benachrichtigungen*): einmal einschalten, das Gerät fragt nach der Erlaubnis. Gilt je Gerät; „Testnachricht senden“ zeigt, ob alles ankommt
- **Erinnerungen an Termine und Fristen** – Stornofrist, Check-in, Abfahrt, Impftermin, Reisebeginn – mit derselben Vorwarnung wie im Kalender (Fristen 2 Tage, Termine 2 Stunden, Reisebeginn am Vorabend 18 Uhr). Sie kommen pünktlich, auch wenn die App geschlossen ist; geplant wird bei jedem Abgleich
- **Neues von den Mitreisenden** (wahlweise): z. B. „Dolomiten: Birgit – Neu: ein Tagebucheintrag, 5 Fotos“. Gebündelt, höchstens alle 15 Minuten je Reise, nur was du auch sehen darfst – private Einträge anderer nie
- Antippen öffnet die passende Stelle in der App
- **iPad/iPhone:** nur für die App auf dem Home-Bildschirm (Safari → Teilen → „Zum Home-Bildschirm“, ab iOS 16.4). Die App erklärt das, wenn sie im Browser läuft
- Die Nachrichten sind verschlüsselt – der Push-Dienst von Apple bzw. Google kann sie nicht lesen. Der Server braucht dafür keine Einrichtung, nur das Update auf 1.17
- Bei *Termine & Fristen* steht der Weg zu den Benachrichtigungen neben dem Kalender-Abo

## 1.31.1 – 2026-10-14

### Korrigiert: Karten auf der Reise-Webseite
- Routen auf der Webseite zeigen jetzt eine **Karte (OpenStreetMap) mit der Strecke** statt nur einer Linie auf grauem Grund – mit Start- und Zielpunkt, darunter wie bisher das Höhenprofil
- Ab zwei Routen steht oben eine **Übersichtskarte** mit allen Routen der Reise
- Die Kartenbilder werden in die Datei eingebettet – die fertige Seite braucht kein Internet. Nur zum Erstellen wird Internet benötigt; ohne bleibt es bei der Linie (mit Hinweis und „Noch einmal versuchen“)
- Hinweis, wenn Routen nicht für die Webseite freigegeben sind – „Alle zeigen“ gibt sie mit einem Tipp frei

## 1.31.0 – 2026-10-14 (Server 1.16.0)

### Neu: Personen & Rechte
- **Personen in der Reisegruppe** (*Geräte-Abgleich → Personen & Rechte*): Wer bisher mit dem Gruppenschlüssel verbunden ist, trägt sich mit „Das bin ich“ als erste Person ein und wird Verwalter. Weitere Personen lädt der Verwalter per Code/QR ein – beim ersten Verbinden legen sie ihr Passwort fest
- **Anmelden mit Name und Passwort** auf weiteren Geräten (iPad, Handy, Laptop). Passwort ändern unter *Geräte-Abgleich*; vergessen → der Verwalter setzt es zurück
- **Rollen:** Verwalter, Mitglied (bearbeitet alles), Nur lesen. **Je Reise abweichend:** Bearbeiten, Nur lesen oder Kein Zugriff – dann kommt die Reise gar nicht erst auf die Geräte dieser Person
- **Private Bereiche:** Teilnehmer an der Reise mit einem Konto verknüpfen (*Reise bearbeiten → Wer reist mit? → Mit Konto verknüpfen*). Packliste, Medikamente, Impfungen und Dokumente einer verknüpften Person sieht nur sie selbst – auch der Verwalter nicht. Nicht verknüpfte Teilnehmer (z. B. Kinder) und „für alle“ bleiben für die Gruppe sichtbar
- **Freigeben:** Bei eigenen Dokumenten und Medikamenten „Wer darf das sehen?“ – nur ich, alle oder ausgewählte Personen. Z. B. Allergiepass oder INR-Ausweis für die Mitreisenden, damit sie im Notfall Bescheid wissen
- Der Server setzt die Rechte durch: Änderungen ohne Recht werden zurückgenommen (mit Hinweis), Reisen mit „Nur lesen“ zeigen einen Hinweis, Fotos und Lese-Links gibt es nur mit passendem Recht. Das Kalender-Abo ist je Person getrennt
- Geräte ohne Person (Gruppenschlüssel, ältere App-Versionen) haben weiterhin vollen Zugriff; der Verwalter kann sie einer Person zuordnen. Nichts ändert sich, solange niemand Personen anlegt

## 1.30.0 – 2026-10-14

### Neu: Sprachnotizen im Tagebuch
- **„Sprachnotiz aufnehmen“** im Tagebuch-Eintrag – unterwegs schnell etwas aufsprechen statt tippen. Laufzeit und Pegel werden angezeigt, „Fertig“ beendet; nach 15 Minuten endet die Aufnahme von selbst
- Jede Notiz lässt sich anhören, benennen (z. B. „Murmeltiere am Pass“) und löschen; gespeichert wird zusammen mit dem Eintrag
- In der Tagebuch-Liste stehen die Notizen mit Abspielknopf beim Eintrag
- Notizen werden wie Fotos zwischen den Geräten abgeglichen und mit „Fotos mitsichern“ in die Sicherung bzw. die geteilte Reise übernommen. Sie bleiben privat – Lese-Links und Reise-Webseite zeigen sie nicht
- iPad: Beim ersten Mal fragt Safari nach dem Mikrofon. Wurde das abgelehnt: Einstellungen → Safari → Mikrofon
- Zum Diktieren von Text bleibt die Diktierfunktion der iPad-Tastatur (Mikrofon-Taste) der einfachste Weg

## 1.29.0 – 2026-10-14

### Neu: Tagebuch-Entwurf aus dem Tag
- **„Entwurf aus dem Tag“** im Tagebuch-Eintrag (und direkt bei jedem leeren Tag in der Tagebuch-Liste): Die App schreibt ein Gerüst aus dem, was an diesem Tag gespeichert ist:
  - An- oder Heimreise mit Etappen und Uhrzeiten
  - Wetter (sofern der Tag in der geladenen Vorhersage steht)
  - erledigte (sonst geplante) Unternehmungen
  - Touren mit Strecke, Höhenmetern, Zeit und höchstem Punkt
  - Unterkunft (Ankunft, Übernachtung, Umzug, Abschied) und die Ausgaben des Tages
- Titel (z. B. die Tour des Tages) und Ort werden nur vorgeschlagen, wenn sie noch leer sind. Eigener Text bleibt stehen, der Entwurf kommt darunter – und zweimal antippen fügt nichts doppelt ein
- Alles auf dem Gerät, ohne Internet. Gedacht zum Weiterschreiben: Was war besonders, lustig, lecker?

## 1.28.0 – 2026-10-14

### Neu: Fotos auf der Karte
- **Aufnahmeort aus dem Foto:** Beim Hinzufügen zum Tagebuch liest die App GPS-Position und Aufnahmezeit aus der Originaldatei (EXIF, auch HEIC) – bevor das Foto verkleinert wird, denn danach sind diese Angaben weg. Die Aufnahmezeit ist dadurch auch genauer als bisher
- **Ohne GPS: Ort aus der Tour:** Fotos ohne Position werden auf die aufgezeichnete Tour gesetzt, die zur Aufnahmezeit lief (bis 15 Minuten vor Start und nach Ende). Das gilt auch für alle schon vorhandenen Fotos – im Foto steht dann „Ort aus der Tour geschätzt“
- **Karte der Reise:** Fotos als runde Vorschaubilder; nahe beieinander werden sie zu einer Gruppe mit Zahl zusammengefasst. Antippen zeigt die Fotos, ein Tipp auf ein Foto öffnet den Tagebuch-Eintrag. Knopf „Fotos (n)“ blendet sie aus und ein; der Tagesfilter gilt auch für Fotos
- **Fotos ohne Ort** stehen unter der Karte und lassen sich mit einem Tipp auf die Karte (oder auf eine Route) setzen; „Ort ändern“ bzw. „Ort entfernen“ im Foto
- Der Aufnahmeort bleibt in der App (und beim Abgleich auf deinem Server) – Lese-Links und Reise-Webseite geben ihn nicht weiter; die gespeicherten, verkleinerten Fotos enthalten keine EXIF-Daten
- Hinweis iPad: Je nach Einstellung entfernt iOS beim Auswählen den Ort aus dem Foto. Dann hilft die Tour-Zuordnung oder das Setzen von Hand

## 1.27.1 – 2026-10-14

- **Fehler behoben: Touren im Reisebericht und in der PDF-Datei ohne Karte** – es war nur die Linie zu sehen. Jetzt liegt jede Tour und die Übersicht aller Touren auf einer OpenStreetMap-Karte (mit Start- und Zielpunkt), in der Vorschau, beim Drucken und in der PDF-Datei. Die Karte ist über die ganze Breite, das Höhenprofil darunter
- Ohne Internet erscheinen die Touren wie bisher als Linie, mit Hinweis und „Noch einmal versuchen“. Schon angesehene Kartenausschnitte kommen aus dem Zwischenspeicher
- Kartenkacheln werden jetzt mit CORS geladen (nötig, um sie ins Bild zu übernehmen); der alte Kachel-Zwischenspeicher wird einmal geleert

## 1.27.0 – 2026-10-14

### Neu: Reisebericht und Fotobuch als PDF-Datei (Reise → Danach/Teilen → „Reisebericht & Fotobuch“)
- **„PDF-Datei erstellen“** macht eine fertige Datei – ohne Umweg über den Druckdialog. Danach „Teilen / Sichern“: auf dem iPad AirDrop, Nachrichten, Mail oder „In Dateien sichern“, am Rechner Download
- **Bericht:** A4 hoch – Titelseite mit Foto, Überblick (Zahlen, Übersichtskarte der Touren, Unterkünfte, Ausgaben), Tage mit Text, Fotos und Touren samt Höhenprofil, Seitenzahlen
- **Fotobuch:** große Fotos, jeder Eintrag auf neuer Seite; das erste Foto groß, danach Seiten mit 2–4 Fotos (passend zugeschnitten), Bildunterschriften im Foto, Titelbild randlos
  - Seitenformat **A4 hoch, A4 quer, Quadrat 21 cm oder 30 cm**; Fotos je Seite (1–4); auf Wunsch **3 mm Beschnitt** für Druckereien
  - **Druckqualität (300 dpi)** zum Hochladen bei einem Fotobuch-Anbieter oder **kleine Datei** zum Verschicken
- Getestet mit 150 Fotos in Druckqualität: knapp 2 Minuten auf einem gebremsten Rechner, alles auf dem Gerät, ohne Internet
- „Drucken“ gibt es weiterhin
- Dateinamen ohne Umlaute (Chrome hat Namen mit „ß“ sonst verworfen und die Datei „download“ genannt) – betrifft auch „Reise teilen“

## 1.26.0 – 2026-10-14

### Schnell auch mit vielen Daten (Lasttest)
Gemessen mit 80 Reisen, 3200 Unternehmungen, 1100 Fotos und 240 Routen auf einem 4× gebremsten Rechner (etwa ein älteres iPad):
- **Sicherung mit allen Fotos klappt jetzt:** Vorher brach sie bei so vielen Fotos ohne Meldung ab (die Datei wurde als ein einziger riesiger Text gebaut). Jetzt wird sie Stück für Stück geschrieben und gelesen – 1,1 GB in gut einer Minute, Einlesen ähnlich. Mit Fortschrittsanzeige. Ältere Sicherungsdateien lassen sich weiter einlesen, neue auch mit älteren App-Versionen
- **App-Start ohne Ruckeln:** Die Pflege der Routen (Namen reparieren, Höhen ergänzen) lud bei jedem Start alle Routen zweimal – die Oberfläche hing dabei bis zu einer Sekunde. Jetzt wird jede Route nur einmal geprüft (blockiert 1,9 s → 0,1 s)
- **Karte und Routen flotter:** Routenpunkte werden nicht mehr einzeln von Vue beobachtet (Karte 1,8 s → 1,2 s, längste Blockade 0,9 s → 0,15 s; Routenliste 1,5 s → 1,2 s)
- Lasttest zum Wiederholen: `NWW_LAST=1 npx playwright test last` (Ergebnis in test-results/last.json)

## 1.25.0 – 2026-10-14 (Server 1.15.0)

### Sicherheit und Zuverlässigkeit (unabhängige Code-Prüfung)
- **Server:** Hochgeladene Dateien werden nur noch als Bild, Ton, PDF oder Routendatei angenommen und nie als Webseite ausgeliefert (vorher hätte ein Mitglied einer anderen Reisegruppe über einen Lese-Link Code einschleusen können). Lese-Links zeigen öffentlich nur echte Bilder
- **Gesperrte oder gelöschte Reisegruppen:** Lese-Links und Kalender-Abo gelten sofort nicht mehr; beim Löschen wird das Abo entfernt
- **Schutz vor Rateversuchen hinter dem Heim-Proxy:** Absender-Adresse wird korrekt ermittelt (vorgetäuschte Angaben zählen nicht); niemand kann andere durch Falscheingaben aussperren – wer den richtigen Zugang hat, kommt immer durch. Falsche Passwörter bei Lese-Links sperren nur den Rater selbst
- **Abgleich bleibt nicht mehr hängen:** Eine zu große Datei (über 30 MB) oder eine auf dem Server fehlende Datei hält nicht mehr den ganzen Abgleich an – Hinweis unter Geräte-Abgleich, alles andere läuft weiter
- **Keine verlorenen Änderungen:** Wer genau während eines Abgleichs etwas ändert, behält die eigene Änderung (vorher konnte sie in seltenen Fällen überschrieben werden oder nicht hochgeladen werden)
- **Falsch gehende Uhren** blockieren keine späteren Änderungen mehr
- **Sicherung einlesen:** danach gleicht das Gerät einmal komplett ab – anderswo gelöschte Einträge verschwinden wieder
- Vorschau der Reise-Webseite und Belege: eingeschleuste Inhalte können nichts mehr ausführen
- Lese-Links: Ort nur, wenn er auf der Seite gezeigt wird; schneller bei vielen Fotos; Zwischenspeicher des Servers begrenzt
- **Spenden-Knopf** jetzt auch oben in den Einstellungen

## 1.24.1 – 2026-10-13

- **Spenden:** Link zu PayPal unter Einstellungen → Über und als kleiner Hinweis nach dem Erstellen einer Reise-Webseite; „Sponsor“-Knopf auf GitHub

## 1.24.0 – 2026-10-13

### Neu: Unsere Reisen in Zahlen (Meine Reisen → „Statistik“)
- **Je Jahr oder alle Jahre:** Reisen, Reisetage, Übernachtungen, Länder (mit Flaggen), Kilometer und Höhenmeter aller Touren, Fotos, Tagebuch-Einträge, Ausgaben
- **Karte „Wo wir waren“** – ein Punkt je Reise, antippen öffnet sie
- **Reisetage je Monat** als Balken – wann seid ihr am liebsten unterwegs?
- **Rekorde:** längste Reise, längste Tour, meiste Höhenmeter
- Liste aller Reisen mit Tagen, Kilometern, Höhenmetern und Fotos; geplante Reisen zählen erst, wenn sie begonnen haben

## 1.23.0 – 2026-10-13

### Neu: Reisebericht als PDF / Fotobuch (Reise → Danach → „Reisebericht (PDF)“)
- **Titelseite** mit Titelbild (eigenes oder schönstes Foto), Reiseziel, Flaggen, Zeitraum und Mitreisenden
- **Überblick:** Tage, Einträge, Fotos, Kilometer und Höhenmeter, **Übersichtskarte aller Touren** mit Legende, gebuchte Unterkünfte, auf Wunsch die Ausgaben nach Bereichen
- **Jeder Tag:** „Tag 2 · Montag, 5. Oktober 2026“, Tagebuch-Text mit Stimmung und Ort, Fotos mit Bildunterschrift, Touren mit Karte und Höhenprofil; Touren ohne Tag am Ende
- Zwei Arten: **Bericht** (kompakt) und **Fotobuch** (große Fotos, jeder Tag auf neuer Seite); Fotos alle / höchstens 4 / keine, nur Höhepunkte, Bereiche ein- und ausschaltbar
- **Drucken / als PDF sichern** – sauber auf A4 umbrochen, in den Farben und Schriften des gewählten Designs; alles auf dem Gerät, auch offline

## 1.22.0 – 2026-10-13

### Neu: Buchung einlesen
- **Bestätigungen automatisch übernehmen:** Text aus Mail oder PDF einfügen – oder die Datei wählen: **PDF**, gespeicherte **E-Mail (.eml)**, **Kalendereintrag (.ics)**, HTML. Die App erkennt (deutsch und englisch):
  - **Unterkünfte** (Hotel, Gasthof, Ferienwohnung, Booking.com-, Airbnb-, HRS-Stil): Name, Art, Adresse, An- und Abreise (auch „vom 4. bis 9. Oktober“ oder „5 Nächte“), Gesamtpreis, Buchungsnummer, kostenlose Stornofrist, Link
  - **Flüge** mit Flugnummer, Flughäfen, Datum und Uhrzeiten – Hin- und Rückflug werden automatisch zugeordnet
  - **Bahn, Bus, Fähre** („ab Nürnberg Hbf 08:12 … an München Hbf 09:15“, Zugnummer)
  - Alles andere: als **Beleg** unter Dokumente
- Vorschlag zum Prüfen und Ändern, Hinweis wenn die Daten nicht zur Reise passen; dieselbe Buchung (gleiche Nummer) wird aktualisiert statt doppelt angelegt
- Läuft **komplett auf dem Gerät** (pdf.js) – nichts wird hochgeladen; auch offline
- Zu finden unter Unterkünfte, An- und Rückreise und als Bereich in der Planung

## 1.21.0 – 2026-10-13

### Neu: App-Sperre (Einstellungen → App-Sperre)
- **Code** (4–8 Ziffern) je Gerät, optional **Face ID / Touch ID** (auf iPad/iPhone mit der installierten App)
- Sperrt **sofort beim Verlassen** der App (dann zeigt auch der App-Umschalter nur die Sperre) oder nach 1, 5, 15 oder 60 Minuten; beim Start immer gesperrt
- Nach 5 Fehlversuchen steigende Wartezeit; Code wird nur als Prüfwert (PBKDF2) gespeichert
- Ehrlicher Hinweis: Schutz vor neugierigen Blicken – die Daten auf dem Gerät sind nicht verschlüsselt

## 1.20.0 – 2026-10-13

### Neu: Fremdwährung bei Ausgaben
- **Kurs automatisch:** Bei Ausgaben in fremder Währung holt die App den offiziellen EZB-Referenzkurs für den Tag der Ausgabe (über Frankfurter, kostenlos) und rechnet sofort in die Reisewährung um. Von Hand änderbar, Knopf zum Neu-Holen
- **Offline:** Abgerufene Kurse bleiben gespeichert – ohne Netz nimmt die App den nächstliegenden bekannten Kurs (gekennzeichnet)
- **Landeswährung vorgeschlagen:** Die Währungen der Zielländer stehen oben in der Auswahl (z. B. „CHF – Schweizer Franken“); während der Reise ist sie vorausgewählt, danach die zuletzt benutzte
- Währungen ohne EZB-Kurs (z. B. Marokko, Ägypten): Hinweis, Kurs bitte von Hand eintragen
- Währungsliste aktualisiert (Kroatien und Bulgarien zahlen mit Euro)

## 1.19.0 – 2026-10-13

### Neu: Packliste denkt mit
- **Vorschläge für diese Reise** oben in der Packliste – jeweils mit Begründung, einzeln abwählbar oder dauerhaft ausblendbar, persönliche Dinge je Mitreisendem:
  - **Wetter:** Vorhersage, wenn die Reise in den nächsten 16 Tagen liegt – sonst das Wetter derselben Tage der letzten drei Jahre am Reiseziel (z. B. „-1 bis 12 °C, Regen an 67 % der Tage“): Regenjacke, Schirm, Mütze & Handschuhe, Pullover, Sonnencreme, Sonnenhut, Trinkflasche, Windjacke …
  - **Zielland:** Steckdosen-Adapter (mit Typ), Bargeld in Landeswährung, Datenpaket/eSIM außerhalb des EU-Roamings, Vignette (Österreich, Schweiz, Slowenien, Tschechien …), Crit'Air-Plakette in Frankreich, Warnwesten fürs Auto im Ausland
  - **Anreise:** Flüssigkeitenbeutel und Powerbank beim Fliegen
  - **Unternehmungen & Routen:** Wanderschuhe, Tagesrucksack, Blasenpflaster; ab 1500 m Wanderstöcke und Funktionsjacke; Badesachen am Wasser; Badeschlappen für Therme
  - **Unterkunft:** Camping (Stirnlampe, Schlafsack …), Hostel (Schloss, Ohrstöpsel), Ferienwohnung
  - **Reisehinweise:** Mückenschutz und Moskitonetz bei Malaria-/Dengue-Gebieten
- Was schon auf der Liste steht, wird nicht noch einmal vorgeschlagen

## 1.18.0 – 2026-10-13 (Server 1.14.0)

### Neu: Termine & Fristen, Kalender
- **Termine & Fristen** je Reise (neuer Bereich in Planung und Unterwegs): gesammelt aus allen Bereichen – Stornofristen und Aufenthalte (Unterkünfte), Abfahrten mit Uhrzeit und Online-Check-in bei Flügen (An-/Rückreise), geplante Unternehmungen und „noch buchen“, Ausweise/Pässe, die vor oder kurz nach der Reise ablaufen („verlängern“, 6 Wochen vorher), fehlende Dokumente, Impftermine und zu klärende Impfungen, ablaufende Medikamente, „Packen“ zwei Tage vor Abreise. Gruppiert nach Überfällig · Heute · Nächste 7 Tage · Später, ein Tipp führt zum Eintrag
- **„Heute dran“** im Tagesplaner und auf „Heute“
- **Kalender-Abo** (mit eigenem Server): Der Kalender auf iPad/iPhone, Android oder Outlook abonniert alle laufenden und kommenden Reisen über eine geheime Adresse und **erinnert rechtzeitig** (Fristen 2 Tage vorher, Abfahrten 2 Stunden vorher, Flüge 3 Stunden, Reisetage am Vorabend). Änderungen kommen nach jedem Abgleich automatisch an. Adresse erneuern oder Abo beenden jederzeit
- **Kalenderdatei (.ics)** einer Reise zum einmaligen Importieren
- Server: `/api/kalender` (Abo verwalten, hochladen) und `/api/kalender/<geheim>.ics`

### Sonstiges
- **Lizenz: GNU AGPL-3.0** (Text in LICENSE, Hinweis unter Einstellungen → Über). Spendenlink (PayPal) vorbereitet
- Einstellungen → Über nennt alle genutzten Dienste

## 1.17.0 – 2026-10-13

### Behoben (gefunden in der Reise „Maria Alm“)
- **Umlaute in Routennamen:** GPX/KML-Dateien in älterer Zeichenkodierung (ISO-8859-1/Windows-1252) wurden falsch gelesen – „Gro�glockner-Hochalpenstra�e“. Die App erkennt die Kodierung jetzt selbst. Bereits importierte Routen werden beim Start automatisch repariert (aus der gespeicherten Originaldatei)
- **Routen ohne Höhen:** Enthält eine Datei keine Höhenangaben (z. B. „Edelweißspitze“: 0 Höhenmeter, kein Profil), ergänzt die App die Höhen aus dem Geländemodell (Open-Meteo) – automatisch beim Import, für vorhandene Routen beim Start, oder per Knopf „Höhen ergänzen“. Solche Höhen sind gekennzeichnet

## 1.16.0 – 2026-10-13

### Neu: Aussehen nach Wunsch (Einstellungen → Aussehen)
- **18 Designs:** Alpin, Frisch & modern, Retro-Reiseplakat, Mittelmeer, Nordisch klar, Toskana, Tropen, Wüste & Oase, Polarlicht, Großstadt, Reisetagebuch (Handschrift), Provence, Herbstwald, Küste & Ostsee, Sommerfrische, Nachtzug, Kontrastreich (sehr gut lesbar) und Klassisch – jedes mit eigenen Farben (hell und dunkel), Schriften, Formen, Logo und Hintergrundmuster. Vorschau aller Designs zum Antippen. Alle Farben sind automatisch auf gute Lesbarkeit geprüft
- **Schriftgröße** (klein bis sehr groß) und **Ecken** (eckig bis sehr rund)
- **Hintergrund einstellbar:** Schleier über dem Foto (0–90 %), Farbe des Schleiers (Design, Weiß, Schwarz), Unschärfe, Farbsättigung, durchscheinende Karten mit Milchglas-Effekt, Stärke des Musters; Schnellwahl *Klar · Ausgewogen · Ruhig · Glas · Abend*. Standard jetzt deutlich weniger verwaschen
- Eigenes Hintergrundfoto **für ein Design oder für alle Designs**
- **Reiseseite anpassen:** Bereiche beliebigen Reitern zuordnen, Reihenfolge ändern, als Kacheln, große Kacheln oder kompakte Liste; Reiter ein/aus (dann alles untereinander), Titelbild groß/mittel/klein/aus, Eckdaten, Zusammenfassungen und Unterwegs-Knöpfe ein/aus; jederzeit zurücksetzen. Bereiche, die in keinem Reiter mehr stehen, bleiben unter „Weitere Bereiche“ erreichbar – es geht keine Funktion verloren
- „Anpassen“ direkt auf der Reiseseite

## 1.15.0 – 2026-10-13

### Neu: Übersichtlicher und schöner
- **Reiseseite in Bereiche aufgeteilt:** Planung · Unterwegs · Danach · Teilen & Archiv. Die App öffnet automatisch den Bereich, der zum Datum passt (Punkt am Reiter). Unterwegs gibt es oben die großen Knöpfe „Heute“ und „Notfall“
- **Titelbild je Reise:** eigenes Foto hochladen oder aus dem Reisetagebuch wählen, Ausschnitt verschieben. Ohne Foto zeichnet die App eine Landschaft passend zum Ziel (Berge, Meer oder Stadt) – jede Reise etwas anders
- **Archiv:** abgeschlossene Reisen ins Archiv legen – in der Reiseliste eingeklappt, nichts geht verloren
- **Reiseliste** mit Titelbildern, gruppiert nach „Gerade unterwegs“, „Geplant“, „Erinnerungen“
- **Drei Stile zur Auswahl** (Einstellungen → Aussehen): *Alpin & natürlich* (Standard), *Frisch & modern*, *Retro-Reiseplakat* – jeweils mit eigenen Farben, Schriften, Logo und Hintergrundmuster, hell oder dunkel (oder wie das Gerät)
- **Eigenes Hintergrundbild** je Stil – kommt per Abgleich auch auf die anderen Geräte
- Neues App-Symbol

### Behoben
- Wechsel direkt von einer Reise zur anderen zeigte noch die vorige Reise

## 1.14.0 – 2026-10-13 (Server 1.13.0)

### Neu
- **Deutsche Botschaft automatisch in den Notfallnummern:** Für jedes Zielland trägt die App Botschaft bzw. Generalkonsulat mit Telefon, Adresse und Öffnungszeiten ein – und, falls das Auswärtige Amt eine nennt, die **Notfall-Bereitschaft** außerhalb der Öffnungszeiten. Honorarkonsuln kommen dazu, wenn ihr Ort im Reiseziel steht (z. B. „Zell am See“). Markiert mit „Auswärtiges Amt“, aktualisiert sich mit den Reisehinweisen
- **Reisehinweise:** neuer Block „Deutsche Vertretungen“ mit Anruf-Knöpfen, Adresse (Karte), Webseite und allen Honorarkonsuln im Land
- **Reiseapotheke → Impfungen:** „Laut Reisehinweisen“ zeigt die vom Auswärtigen Amt genannten Impfungen aller Zielländer, Pflichtimpfungen zuerst, und ob ihr sie schon eingetragen habt (erkennt auch „FSME-Impfung“ oder „Tetanus/Diphtherie“). Einzeln oder alle mit einem Tipp übernehmen (Status „Prüfen“). Fehlt eine Pflichtimpfung, zeigt der Reiter ein Ausrufezeichen
- Server: `/api/reiseinfo/<Land>/vertretungen` (Auslandsvertretungen, 24 h zwischengespeichert). `NWW_AA_URL` meint jetzt die OpenData-Adresse ohne `/travelwarning`

## 1.13.0 – 2026-10-13 (Server 1.12.0)

### Neu: Zielländer und Reisehinweise
- **Zielländer** beim Anlegen/Bearbeiten einer Reise (mehrere möglich). Steht das Land schon im Reiseziel („Fusch, Österreich“), schlägt die App es mit einem Tipp vor
- **Reisehinweise** (neuer Punkt in der Planung): Reise- und Sicherheitshinweise des **Auswärtigen Amts** je Land – Warnstufe, Einreise und Zoll, Gesundheit/Impfschutz, Sicherheit, Natur und Klima, Reiseinfos; genannte Impfungen als Übersicht (Gelbfieber wird als Pflicht erkannt)
- **Automatisch in der Dokumentenliste:** je Land „Einreise …“ (mit Reisedokumenten und Visum – „fehlt“, wenn ein Visum nötig ist), „Impfschutz …“ („fehlt“ bei Pflichtimpfung) und „Sicherheitslage …“, jeweils mit Stand und Quelle. Dein Haken/Status bleibt beim Aktualisieren erhalten; entfernte Länder verschwinden wieder
- Aktualisiert sich beim Speichern der Reise und einmal täglich beim Öffnen; geänderte Hinweise sind mit „geändert“ markiert
- Server: `/api/reiseinfo/<Land>` reicht die OpenData-Schnittstelle des Auswärtigen Amts weiter (zwischengespeichert, bei Ausfall die letzte Fassung)

## 1.12.0 – 2026-10-13 (Server 1.11.0)

### Neu
- **Strecke von A nach B planen** (Routen & Touren → „Strecke planen“): Punkte auf die Karte tippen (A, B, beliebige Zwischenziele, verschiebbar), aus den Orten der Reise übernehmen oder per Adresse/GPS-Koordinaten. Profile **Wandern, Fahrrad, Rennrad, Auto, kürzester Weg**. Länge, Höhenmeter, Dauer (Wandern: Gehzeit nach DIN 33466) – speichern als Route mit Höhenprofil, GPX-Export für Garmin
- **Wanderwege suchen** (Routen & Touren → „Wanderwege suchen“): ausgeschilderte Wander-, Rad- und MTB-Routen aus OpenStreetMap im Kartenausschnitt, optional nach Name; Vorschau auf der Karte, übernehmen mit Höhen (Open-Meteo) und geschätzter Gehzeit
- Server: `/api/routing/…` reicht Suche (Overpass) und Planung (BRouter) weiter – mit Zwischenspeicher, Begrenzung und sicher gebauten Abfragen. Ohne eigenen Server fragt die App direkt
- Zwei neue Klicktests (mit nachgebauten Kartendiensten)

### Behoben
- Karte: Beim „Auf der Karte antippen“ hat die App versehentlich die Gestaltung der Karte entfernt (Steuerelemente/Ebenen verrutschten). Behoben – betraf auch das Antippen von Routen beim Verorten

## 1.11.1 – 2026-10-13

### Intern
- **Automatische Klicktests** (Playwright, Ordner `e2e/`): Geräte anmelden/einladen/abmelden, Verorten per Route und GPS-Koordinaten, Webseiten-Auswahl ohne private Daten, Server-Sicherung. Laufen bei jeder Änderung auf GitHub; nur wenn sie grün sind, geht die App an den eigenen Server und auf GitHub Pages
- Aufgeräumt: HTML-Maskierung zentral (`core/html.ts`), „nächster Routenpunkt“ in `map/logic.ts` mit Test

## 1.11.0 – 2026-10-13 (Server 1.10.0)

### Neu: Abgleich-Stand je Gerät
- *Geräte-Abgleich → Angemeldete Geräte* zeigt für jedes Gerät, ob es **auf dem neuesten Stand** ist, wie viele **Änderungen ihm noch fehlen** und wie viele es **noch nicht hochgeladen** hat – z. B. vor der Abreise prüfen, ob Birgits Handy alles hat
- Zusammenfassung oben: „Alle Geräte sind auf dem neuesten Stand“ bzw. welche nicht
- Liste aktualisiert sich nach jedem Abgleich und alle 30 Sekunden
- Symbol oben rechts zeigt ein abgemeldetes Gerät deutlich an

## 1.10.0 – 2026-10-13 (Server 1.9.0)

### Neu: mehrere Sicherungsziele
- *Geräte-Abgleich → Server-Sicherung* (nur Besitzer): beliebig viele Ziele (bis 8), je mit eigener Anzahl Stände, einzeln ein-/ausschaltbar
  - **Ordner / Platte** (auch in Proxmox eingebundene SMB-/NFS-Freigaben), Fotos als harte Verknüpfungen
  - **SMB-Freigabe direkt** (smbclient – klappt im unprivilegierten Container), nur neue Fotos werden hochgeladen
  - **SSH / rsync** mit eigenem Schlüssel (in der App angezeigt), nur Änderungen werden übertragen
  - **WebDAV** (Nextcloud, Synology, Hetzner Storage Box)
- **Testen** je Ziel und **Jetzt sichern** direkt aus der App; Ergebnis und Fehlermeldung je Ziel sichtbar
- Passwörter nur auf dem Server, nie zurück an die App, nie auf der Befehlszeile; Programme ohne Shell aufgerufen
- `update.sh` installiert smbclient, rsync und ssh und erzeugt den SSH-Schlüssel

## 1.9.0 – 2026-10-13 (Server 1.8.0)

### Neu: Geräte-Anmeldung
- **Eigener Zugang je Gerät** statt eines gemeinsamen Schlüssels für alle: Geräte-Abgleich → *Angemeldete Geräte* zeigt jedes Gerät mit Typ und „zuletzt aktiv“
- **Einzelne Geräte abmelden** (verlorenes iPad), **alle anderen abmelden**, **dieses Gerät abmelden**; Geräte umbenennen
- **Gerät hinzufügen per QR-Code / Einladungscode** (`ABCD-EFGH-JKLM`, einmal gültig, 24 Stunden) – der Gruppenschlüssel muss nicht mehr weitergegeben werden
- Abgemeldete Geräte zeigen einen klaren Hinweis und gleichen nicht mehr ab; ihre Daten bleiben auf dem Gerät
- Bestehende Geräte stellen beim nächsten Abgleich **automatisch** auf einen eigenen Zugang um – nichts neu eingeben
- Reisegruppen: Besitzer kann für eine Gruppe einen **neuen Schlüssel** erzeugen, ohne dass deren Geräte abgemeldet werden

### Sicherheit
- Nur Prüfsummen der Gerätezugänge und Einladungscodes auf dem Server
- Bremse gegen Ausprobieren: 20 Fehlversuche in 10 Minuten → 15 Minuten Pause je Adresse (echte Adresse auch hinter dem Reverse-Proxy)
- Geräte, die 180 Tage nicht da waren, werden automatisch abgemeldet (`NWW_DEVICE_IDLE_DAYS`)

## 1.8.0 – 2026-10-12 (Server 1.7.0)

### Neu
- **Offline-Karten** (Reise → Karte → „Offline-Karten“): aktuellen Kartenausschnitt mit Detailstufe Übersicht / Normal / Wandern speichern. Dein Server schneidet ihn aus der Protomaps-Weltkarte (OpenStreetMap-Daten) aus, die App lädt die Datei einmal herunter
- Ohne Internet schaltet die Karte automatisch auf die gespeicherte Karte um; Umschalter „Online | Offline“; Beschriftungen auf Deutsch; Orte, Routen und Verorten funktionieren wie gewohnt
- Karten, die ein anderes Gerät der Reisegruppe erstellt hat, lassen sich mit einem Tipp übernehmen
- Server: `/api/maps` (Bestellen, Stand, Herunterladen mit Range, Löschen), je Reisegruppe getrennt; `update.sh` und Docker-Image installieren das Werkzeug `pmtiles`

### Hinweis
- Die Bibliotheken für Offline-Karten werden erst geladen, wenn eine Offline-Karte gezeigt wird – der App-Start bleibt gleich schnell
- Die Kartendateien bleiben auf dem jeweiligen Gerät (kein Abgleich, kein Backup); die App bittet den Browser, sie dauerhaft zu behalten

## 1.7.0 – 2026-10-12 (Server 1.6.0)

### Stabilität
- **Paketversionen festgeschrieben** (`package-lock.json`, Build mit `npm ci`): Ein Update kann nichts mehr kaputtmachen, nur weil irgendwo eine neue Paketversion erschienen ist. Bewusst aktualisieren: GitHub → Actions → „Pakete“ → „aktualisieren“ (wird nur übernommen, wenn Tests, Typprüfung und Build grün sind)
- **Tägliche Datensicherung** auf dem Server (`backup.sh`, 3:30 Uhr): Datenbank, Fotos, Einstellungen; 14 Stände; Fotos als harte Verknüpfungen. Zurückspielen mit `restore.sh`
- **Update mit Rückweg** (`update.sh`): sichert vor jedem Server-Update, geht automatisch zurück, wenn der Server danach nicht startet; `update.sh zurueck` für App und Server
- Geräte erkennen eine zurückgespielte Sicherung (neue Kennung bzw. kleinerer Zähler) und gleichen dann einmal vollständig ab – nichts geht verloren

### Schneller
- Ungenutzte Bootstrap- und Icon-Regeln werden beim Bauen entfernt (`build/purge-css.mjs`, ohne Fremdpaket): App-CSS ca. 300 → 80 KB. Pixelvergleich aller Seiten (Desktop und Handy) ohne Unterschied
- Die alte Icon-Schrift (woff, 180 KB) liegt nicht mehr im Offline-Speicher; alle Geräte nutzen woff2

## 1.6.0 – 2026-10-12

### Neu
- **Reise-Webseite: Auswahlknöpfe „Was soll auf die Seite?“** – Fotos, Routen, **Unterkünfte**, **Unternehmungen**, Mitreisende, Orte, Stimmung einzeln an/aus; Highlights oder ganzes Tagebuch als Umschalter
- **Unterkünfte** auf Webseite und Lese-Links: Art, Name, Zeitraum, Nächte; Adresse und Link nur auf Wunsch. Ist eine Unterkunft als „gebucht“ markiert, werden nur gebuchte gezeigt (nie stornierte)
- **Unternehmungen** („Was wir unternommen haben“): erledigte – solange keine erledigt sind, die geplanten
- Lese-Links: neue Schalter „Unterkünfte zeigen“ (+ Adresse/Link) und „Unternehmungen zeigen“, auch nachträglich im Menü des Links

### Sicherheit
- Preise, Buchungsnummern, Storno-Fristen und Notizen gehen nie auf Webseite oder Lese-Link (Server gibt nur ausdrücklich erlaubte Felder heraus, Test prüft das). Bestehende Lese-Links zeigen Unterkünfte/Unternehmungen erst, wenn du es einschaltest.

## 1.5.1 – 2026-10-12

### Behoben
- **Verorten auf der Karte:** Routen (z. B. importierte GPX) lassen sich jetzt antippen – im Modus „Auf der Karte antippen“ wird der nächste Punkt der Route übernommen. Die Linie hat dafür eine breite, unsichtbare Tippfläche (für Finger auf dem iPad/Handy).

### Neu
- **GPS-Koordinaten eingeben** im Suchfeld beim Verorten – ohne Internet: Dezimalgrad (`47.0751, 12.7530`, auch mit Komma), Garmin-Anzeige (`N 47° 04.507' E 012° 45.180'`), Grad/Minuten/Sekunden sowie geteilte Links aus Google Maps und Apple Karten (`services/coordinates.ts`)
- Steht im Ort einer Unternehmung schon eine Koordinate, wird sie beim Verorten direkt vorgeschlagen
- Beim Verorten: **Start oder Ziel einer Route übernehmen**
- Routen-Popup zeigt die Koordinate der angetippten Stelle und bietet „… hier setzen“
- Verortete Orte zeigen ihre Koordinaten (Garmin-Format); neu im Menü: **„Koordinaten kopieren“**

## 1.5.0 – 2026-10-12

### Neu
- **Routen & Touren** (Reise → „Routen & Touren“):
  - Import von **GPX, FIT (Garmin Fenix/GPSMap), TCX, KML/KMZ (Google My Maps) und GeoJSON** – eigene Leser ohne Fremddienste; eine Datei kann mehrere Routen enthalten
  - Karte mit Start/Ziel, **Höhenprofil**, Länge, Auf-/Abstieg (geglättet), Höhe min–max, Dauer
  - Zuordnung zu einem Reisetag (automatisch aus der Aufzeichnung), Farbe, Notizen
  - **Als GPX exportieren** (für Garmin Express/Basecamp/Connect) und Originaldatei wieder herunterladen
  - Große Aufzeichnungen werden für die Anzeige vereinfacht (Douglas-Peucker), das Original bleibt erhalten
- Routen erscheinen auf der **Reisekarte** (auch im Tagesfilter) und im **Tagebuch** unter ihrem Tag
- **Reise-Webseite und Lese-Links** zeigen freigegebene Routen als Strecke mit Höhenprofil (ohne Kartenkacheln, funktioniert offline); je Lese-Link „Routen zeigen“ ein/aus
- Neue Andockpunkte für Module: `mapOverlays`, `dayLinks`

### Geändert
- Datenbank-Version 15 (Tabelle `routes`, wird abgeglichen)
- Strecken zeichnen/beschreiben zentral in `services/tracks.ts`

## 1.4.0 – 2026-10-12

### Neu
- **Lese-Links für Freunde** (Reise → „Für Freunde freigeben“): eine Reise zum Ansehen freigeben – ohne App, ohne Schlüssel, ohne Änderungsrecht
  - je Link wählbar: **nur Highlights oder ganzes Tagebuch** (jederzeit umschaltbar), Fotos ja/nein, Überschrift, Notiz „für wen“
  - optional Passwort und Ablaufdatum; zurückziehen, wieder freigeben, löschen; Anzahl und Zeit der Aufrufe
  - Aussehen wie die Reise-Webseite oder eigenes (Vorlage, Schrift, Farbe, dunkel)
  - Nie enthalten: Planung, Budget, Ausgaben, Apotheke, Dokumente, Notfallnummern, Mitreisende – der Server gibt sie gar nicht heraus
  - Betrachter-Seite unter `/s/<code>` (eigene kleine Seite, nicht in Suchmaschinen)
- **Reisegruppen** (Einstellungen → Geräte-Abgleich → Reisegruppen, nur Besitzer): Freunden eine eigene, getrennte Gruppe mit eigenem Schlüssel geben, Einladungslink, sperren, umbenennen, löschen
- **Piwigo nur für freigegebene Gruppen** – standardmäßig nur für den Besitzer (erster Schlüssel in `NWW_KEYS`)
- **8 neue Schriften** für Reise-Webseite und Lese-Links (Lora, Playfair Display, Merriweather, Roboto Slab, Nunito, Montserrat, Raleway, Caveat) – im Export eingebettet, sehen überall gleich aus

### Geändert
- Abgleich-Server 1.3.0 in Module aufgeteilt (`store`, `groups`, `shares`, `static`, `http`, `piwigo`); Docker kopiert alle Module
- App: gemeinsamer Server-Zugriff `core/sync/client.ts`, gemeinsame Geräte-Einstellungen `core/meta.ts` (Doppelungen entfernt)
- Service Worker leitet Lese-Links und `/api/` nicht mehr auf die App-Startseite um

## 1.3.0 – 2026-10-12

### Neu
- **App selbst hosten:** Der Abgleich-Server liefert die App unter seiner eigenen Adresse aus (`NWW_APP_DIR`) – mit passenden Cache-Regeln für Service Worker und Bootstrap
- GitHub baut bei jeder Änderung `nix-wie-weg-app.zip` (Release „app“); `server/proxmox/update.sh` lädt sie, täglicher Timer `nix-wie-weg-update.timer`
- Geräte-Abgleich erkennt, wenn die App vom eigenen Server kommt, und trägt die Adresse schon ein

## 1.2.1 – 2026-10-11

### Neu
- `server/proxmox/create-ct.sh`: legt auf dem Proxmox-Host den Container für den Abgleich-Server an und richtet ihn ein

## 1.2.0 – 2026-10-11

### Neu
- **Piwigo-Anbindung** (eigene Fotogalerie, ab Piwigo 16.1):
  - Neue Fotos aus dem Tagebuch werden im Hintergrund als **Original** in ein Piwigo-Album der Reise hochgeladen. Das Album wird automatisch angelegt (privat) oder kann gewählt werden.
  - Im Tagebuch **„Aus Piwigo“**: vorhandene Fotos aus Piwigo-Alben auswählen und übernehmen
  - Offline: In der App bleibt eine verkleinerte Fassung. Uploads warten, bis wieder Netz da ist, mit wachsenden Pausen nach Fehlern.
  - Reise-Seite → **Fotos in Piwigo**: Album, automatisches Hochladen ein/aus, Warteschlange und Fehler
- Abgleich-Server 1.1.0: **Piwigo-Brücke** (`/api/piwigo/…`); Einstellungen `NWW_PIWIGO_URL`, `NWW_PIWIGO_KEY_ID`, `NWW_PIWIGO_SECRET`, `NWW_PIWIGO_PUBLIC_URL`
- Neue Andockpunkte für Module: `photoSource`, `onPhotosAdded`, `onStart`

### Geändert
- Datenbank-Version 14 (Tabellen `piwigoAlbums`, `piwigoUploads`); Fotos haben `externalRef`/`externalUrl`

## 1.1.1 – 2026-10-11

### Neu
- **Proxmox-Einrichtung** (`server/proxmox/`): Installationsskript für einen Debian-LXC-Container ohne Docker
  - nur Abgleich-Server (hinter vorhandenem Reverse-Proxy) oder mit `--web <domain>` zusätzlich nginx, App und HTTPS (Let's Encrypt)
  - systemd-Dienst mit eigenem unprivilegiertem Benutzer, nginx-Konfiguration mit passenden Cache-Regeln für Bootstrap und Service Worker
- Server: Einstellung `NWW_HOST` (Bind-Adresse)

## 1.1.0 – 2026-10-04

### Neu
- **Automatischer Geräte-Abgleich** über einen eigenen Server: alle Geräte (Handys, Tablet, PC) haben dieselben Daten
  - Einstellungen → Geräte-Abgleich: Server-Adresse und Schlüssel, „Schlüssel erzeugen“, Verbindung testen
  - Weitere Geräte per **Kopplungs-Link** (AirDrop/Nachricht) verbinden
  - Abgleich beim Öffnen, nach Änderungen, wenn Internet zurückkommt und alle 5 Minuten; offline wird gesammelt
  - Neuere Änderung gewinnt, **Löschungen werden übertragen**, Fotos in voller Größe
  - Statusanzeige oben in der App (Wolke) mit Zahl wartender Änderungen
- **Abgleich-Server** (`server/`): Node.js ohne Fremdpakete, SQLite, Docker + Caddy (automatisches HTTPS), Anleitung für Mietserver und NAS

### Geändert
- Datenbank-Version 13 (Tabellen `outbox`, `meta`); Liste der Nutzertabellen zentral in `core/tables.ts`
- Bildunterschriften und Umsortieren von Etappen setzen jetzt `updatedAt`

## 1.0.1 – 2026-10-04

### Geändert
- Tagebuch: Einträge lassen sich direkt in der Übersicht über das ⋯-Menü löschen oder bearbeiten (mit Rückfrage, nennt die Zahl der Fotos)
- Alle Formulare: Löschen-Knopf zeigt jetzt den Text „Löschen“ statt nur eines Symbols

## 1.0.0 – 2026-10-04

Alle geplanten Meilensteine (M0–M6) sind umgesetzt.

### Neu
- **Ausgaben unterwegs:** Schnelleingabe („23,50 Pizza“), Kategorien, Fremdwährung mit Kurs, Belegfoto, Zahler und Aufteilung; Überblick mit Budgetanteil, Tagesdurchschnitt und Hochrechnung; Ausgleich „wer gibt wem wie viel“ mit möglichst wenigen Überweisungen
- **Karte:** OpenStreetMap mit Unterkünften und Unternehmungen; verorten per Adresssuche (Nominatim) oder Antippen; Tagesfilter; eigener Standort und „In deiner Nähe“; Route in Apple Karten/Google Maps; angesehene Kartenausschnitte bleiben offline verfügbar
- **Mit Mitreisenden teilen:** Reise als Datei verschicken (AirDrop, Nachricht) und auf dem anderen Gerät einlesen; neuere Änderungen gewinnen
- **Einlesen führt jetzt immer zusammen** (Backup und geteilte Reisen), mit Ergebnis „x neu, y aktualisiert“
- **Spenden-Bereich:** Link zentral in `src/config.ts`; Hinweis in den Einstellungen und nach dem Erstellen der Reise-Webseite (nur wenn ein Link eingetragen ist)
- Einstellungen: Über-Bereich mit Version, Quellcode-Link und Quellenangaben der Dienste

### Geändert
- Datenbank-Version 12 (neue Tabellen `expenses`, `places`), Backup enthält sie
- Versionsnummer kommt automatisch aus `package.json`
- Unterkünfte haben eine öffentliche Schnittstelle (`accommodation/public.ts`)

## 0.10.0 – 2026-10-04

### Neu
- Modul „Reise-Webseite“ (M5):
  - Drei Vorlagen: Klassisch (Titelbild, Tageskarten), Magazin (große Bilder, Reportage-Stil), Galerie (Fotoraster)
  - Anpassbar: Akzentfarbe, Schrift (Modern, Serif, Rund), Hell/Dunkel, Titel, Untertitel, Einleitung, Autor
  - Inhalt: nur Highlights oder alle Einträge, Stimmung und Orte ein-/ausblendbar, Bildgröße wählbar
  - Live-Vorschau, Einstellungen werden automatisch gespeichert
  - Export als eine einzige HTML-Datei mit allen Fotos (ohne Internet lesbar), Teilen über das iPad-Teilen-Menü, Herunterladen, Öffnen
  - Fotoansicht auf der Webseite (antippen, wischen per Klick links/rechts, Esc)
  - Anleitung zum Veröffentlichen auf GitHub Pages

### Geändert
- Datenbank-Version 10 (neue Tabelle `websites`), Backup enthält sie
- Tagebuch hat eine öffentliche Schnittstelle (`journal/public.ts`)

## 0.9.0 – 2026-10-04

### Neu
- Modul „Reisetagebuch“ (M4):
  - Einträge pro Tag mit Überschrift, Ort, Stimmung und Text; Zeitleiste über alle Reisetage, leere Tage mit „Eintrag schreiben“
  - Fotos aus Kamera oder Mediathek, mehrere auf einmal; werden auf max. 2048 px verkleinert (Hochformat wird richtig gedreht), mit Vorschaubild
  - Bildunterschriften, Reihenfolge ändern, erstes Foto = Titelbild
  - Vollbildansicht mit Wischen und Pfeiltasten
  - Highlights per Stern – Grundlage für die Reise-Webseite (M5)
- Einstellungen: Backup wahlweise mit Fotos; Speicheranzeige und „Dauerhaft speichern“ (schützt vor automatischem Löschen durch Safari)

### Geändert
- Datenbank-Version 9 (neue Tabellen `journalEntries`, `photos`)
- Backup kann Binärdaten (Fotos) einbetten

## 0.8.0 – 2026-10-04

### Neu
- Modul „Tagesplaner“ (M3):
  - Tagesleiste über die ganze Reise mit Wetter-Symbol, Temperatur und Anzahl geplanter Unternehmungen
  - Wettervorhersage über Open-Meteo (bis 16 Tage), Ort per Suche; wird gespeichert und ist offline sichtbar, automatische Aktualisierung nach 3 Stunden
  - Vorschläge je Tag aus den offenen Ideen: Priorität, Wetter (Regen → drinnen, Sonne → draußen), Öffnungszeiten, Tagesauslastung
  - Warnungen: Regen bei geplanter Draußen-Aktivität (mit Drinnen-Alternative zum Tauschen), an dem Tag geschlossen, über 8 Stunden Programm, Hitze
  - Einplanen, verschieben auf anderen Tag, zurück zu den Ideen, abhaken
- Neuer Menüpunkt „Heute“: springt direkt in den Tag der laufenden Reise
- Öffnungszeiten werden aus Freitext erkannt (z. B. „Di–So 10–18“, „Mo-Fr 9-12, 14-18; Sa 10-14“, „täglich“, „24/7“, OSM-Format)

### Geändert
- Datenbank-Version 8 (Tabelle `weather` als Zwischenspeicher)
- Unternehmungen haben eine öffentliche Schnittstelle (`activity/public.ts`)

## 0.7.0 – 2026-10-03

### Neu
- Teilnehmer pro Reise („Wer reist mit?“); die Personenzahl ergibt sich daraus
- Packliste getrennt pro Person:
  - Vorlagen legen Persönliches (Kleidung, Zahnbürste, Ladekabel, Schuhe …) je Teilnehmer an, Gemeinsames (Duschgel, Adapter, Zelt …) einmal
  - Auswahl, für wen Persönliches angelegt wird
  - Reiter „Alle“, je Person und „Gemeinsam“, jeweils mit eigenem Fortschritt und Warnung bei fehlenden wichtigen Dingen
  - Schnelleingabe ordnet neue Einträge der gewählten Person zu
- Reiseapotheke: Medikamente und Einnahmeplan nach Person filtern
- Dokumente: Vorschläge legen Ausweis, Versicherungskarte und Impfpass je Teilnehmer an
- „Für wen?“ in allen Formularen als Auswahl aus den Teilnehmern

### Geändert
- Datenbank-Version 7 (bestehende Reisen bekommen eine leere Teilnehmerliste)

## 0.6.0 – 2026-10-03

### Neu
- Modul „Dokumente & Notfall“ – Meilenstein M2 abgeschlossen
  - Dokumente mit Art, Person, Nummer (in der Übersicht teilweise verborgen), Gültigkeit, Status Fehlt/Beantragt/Vorhanden, Kopie abgelegt, eingepackt
  - Gültigkeitsprüfung: abgelaufen, endet vor Reiseende, Reisepass mit weniger als 6 Monaten Puffer
  - Dringender Hinweis, wenn Ausweis, Pass oder Visum innerhalb von 8 Wochen vor der Reise noch fehlen oder ungültig sind
  - Vorschläge passend zur Anreiseart (z. B. Führerschein und Fahrzeugschein beim Auto)
  - Notfallnummern: 112 (EU) und Sperr-Notruf immer sichtbar, eigene Nummern mit Anruf-Knopf

### Geändert
- Datenbank-Version 6 (neue Tabellen `documents`, `emergencyContacts`), Backup enthält sie

## 0.5.0 – 2026-10-03

### Neu
- Modul „Reiseapotheke“ mit drei Bereichen:
  - Medikamente: Dauermedikation, bei Bedarf, Notfall; Bedarf für Reisetage plus 3 Tage Reserve, Vorratsprüfung, Warnung bei Ablauf vor oder während der Reise; Rezept, Handgepäck, Kühlen; abhaken beim Packen
  - Einnahmeplan: alle Einnahmen eines Tages nach Uhrzeit, filterbar nach Person
  - Impfungen: Status Prüfen/Termin/Erledigt, Hinweis wenn Schutz vor Reiseende endet
- Grundausstattung Reiseapotheke mit einem Klick (ohne Dosierungen)

### Geändert
- Datenbank-Version 5 (neue Tabellen `medications`, `vaccinations`), Backup enthält sie

## 0.4.0 – 2026-10-03

### Neu
- Modul „Packliste“: abhaken mit Fortschrittsbalken, Kategorien zum Auf- und Zuklappen, Suche, Filter „nur offene“ und nach Person
- 9 Vorlagen (Grundausstattung, Strand, Wandern, Stadt, Winter, Camping, Kinder, Auto, Flug); Mengen nach Reisetagen und Personen, Doppeltes wird zusammengefasst
- Passende Vorlage zur Anreiseart wird vorausgewählt
- Packliste einer früheren Reise übernehmen
- Schnelleingabe mit Menge („3x Socken“), wichtige Dinge markieren und Warnung, wenn sie fehlen
- „Alle Häkchen entfernen“ zum Packen für die Rückreise

### Geändert
- Datenbank-Version 4 (neue Tabelle `packingItems`), Backup enthält sie

## 0.3.0 – 2026-10-03

### Neu
- Modul „An- und Rückreise“: Etappen mit Auto, Bahn, Flug, Bus, Fähre, Fahrrad; Fahrzeit (auch über Mitternacht), Kilometer, Kosten je Richtung
- Auto: Spritkosten-Rechner (Verbrauch × Preis) plus Maut/Vignette; Pausenempfehlung alle 2 Stunden
- Hinweis auf Lücken zwischen Etappen; Reihenfolge per Pfeil änderbar; Rückreise mit einem Klick aus der Hinreise erzeugen
- Route direkt in Apple Karten oder Google Maps öffnen
- Neue Etappen werden vorbelegt (Start = letztes Ziel, Datum, Verkehrsmittel, Verbrauch)
- Budgetvergleich enthält jetzt auch die Anreisekosten

### Geändert
- Datenbank-Version 3 (neue Tabelle `travelLegs`), Backup enthält sie

## 0.2.1 – 2026-10-03

### Geändert
- Läuft auf jedem einfachen Webserver und in jedem Unterordner (relative Pfade, Hash-Routing `#/trip`)
- GitHub Actions: automatischer Test, Build und Veröffentlichung auf GitHub Pages, fertige App als ZIP-Download
- Anleitung für iPad / Tiny-Server im README

## 0.2.0 – 2026-10-03

### Neu
- Modul „Unterkünfte“: Hotels, Ferienwohnungen, Camping erfassen; Status Idee/Angefragt/Gebucht/Storniert; Preis pro Nacht; Abdeckung der Reisenächte mit Lücken und Doppelbuchungen; Warnung vor ablaufenden kostenlosen Stornofristen
- Modul „Unternehmungen“: Ideen sammeln mit Kategorie, Drinnen/Draußen, Priorität, Dauer, Preis pro Person, Öffnungszeiten; Filter; Status inkl. „erledigt“ per Klick; Warnung bei über 8 Stunden Programm pro Tag
- Reise-Detailseite zeigt die Planungsbereiche der Module mit Zusammenfassung und vergleicht geplante Kosten mit dem Budget
- Kern: Module können Abschnitte auf der Reise-Seite beisteuern (`tripSection`) und beim Löschen einer Reise ihre Daten aufräumen (`onTripDelete`)
- Gemeinsame Hilfen `core/dates.ts` und `core/format.ts`

### Geändert
- Datenbank-Version 2 (neue Tabellen `accommodations`, `activities`), Backup enthält beide

## 0.1.0 – 2026-10-03

### Neu
- Projekt-Grundgerüst: Vue 3, TypeScript, Vite, Bootstrap 5.3, Bootstrap Icons
- PWA: installierbar, läuft offline (Service Worker)
- Kern: lokale Datenbank (Dexie/IndexedDB), Modul-Registry, Router, JSON-Backup (Export/Import)
- Modul „Reiseprojekt“: Reisen anlegen, bearbeiten, löschen; Zeitraum, Personen, Anreiseart, Budget pro Person und Tag
- Mobile Bedienung mit unterer Navigation, Dark Mode nach Systemeinstellung, Offline-Hinweis
- Tests für die Reise-Logik
