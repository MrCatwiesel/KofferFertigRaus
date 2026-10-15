import type { HelpContent } from './types'

/**
 * Hilfetexte auf Englisch – gleiche Themen wie topics.de.ts (`id`, `group`, `icon`, `routes` unverändert).
 * Ein Test prüft, dass Themen, Bereiche und Seiten mit der deutschen Fassung übereinstimmen.
 */
export const help: HelpContent = {
  groups: [
    { id: 'start', title: 'Getting started', icon: 'flag' },
    { id: 'planen', title: 'Plan', icon: 'map' },
    { id: 'vorbereiten', title: 'Prepare', icon: 'list-check' },
    { id: 'unterwegs', title: 'On the road', icon: 'compass' },
    { id: 'erinnern', title: 'Remember & share', icon: 'journal-richtext' },
    { id: 'gemeinsam', title: 'Several devices & people', icon: 'people' },
    { id: 'einstellungen', title: 'Settings & data', icon: 'gear' },
    { id: 'fragen', title: 'FAQ', icon: 'question-circle' }
  ],
  topics: [
    // ───────────────────────── Getting started ─────────────────────────
    {
      id: 'erste-schritte',
      title: 'How the app works',
      icon: 'signpost-split',
      group: 'start',
      summary: 'Create a trip, the trip page and its tabs, the sample trip.',
      routes: ['help', 'help-topic', 'intro'],
      keywords: 'start beginning overview tour sample example first steps',
      body: `
KofferFertigRaus accompanies a trip from the first idea to the memories: plan, prepare, organise on the road, record and share. Everything is stored on your device and works offline too.

## Get going in three steps
1. Under **Trips**, tap **New trip** and enter a name, destination and dates. Everything else is optional.
2. Open the trip. The **trip page** shows all areas as tiles – getting there, accommodation, activities, packing list and so on.
3. Just tap an area and get started. Each area works on its own; nothing has to be filled in completely.

## The tabs of the trip page
- **Planning** – everything before the trip: getting there, accommodation, ideas, packing list, documents, medicine kit, dates.
- **On the road** – the essentials for the day: big **Today** and **Emergency** buttons, map, expenses, journal.
- **Afterwards** – finish the journal, settle expenses, trip report and photo book.
- **Share** – trip website, read-only links for friends, photos in Piwigo.

The app automatically opens the matching tab: “Planning” before the trip, “On the road” during it, “Afterwards” after it. You can choose which areas go where under [Appearance](#/hilfe/aussehen).

## To try things out: the sample trip
As long as you haven't created a trip yet, the start page offers a **sample trip** to Lake Garda – with getting there, accommodation, activities, packing list, expenses and two journal entries. It shows how everything fits together. Delete it again with one tap at the top of its trip page.

> The **?** at the top right takes you from any page straight to the matching help.
`
    },
    {
      id: 'installieren',
      title: 'Add to the home screen',
      icon: 'phone',
      group: 'start',
      summary: 'Start the app like a normal app – on iPad, iPhone, Android and PC.',
      keywords: 'install installation app icon home screen safari chrome pwa offline update',
      body: `
KofferFertigRaus is a web app: it comes from the browser but can be put on the home screen like a normal app. It then starts without an address bar, runs offline and keeps its data reliably.

## iPad and iPhone (Safari)
1. Open the app in **Safari**.
2. Tap **Share** (square with an arrow pointing up).
3. Choose **Add to Home Screen** and confirm.
4. From now on, open the app via the new icon.

> Important on iPad and iPhone: Safari may delete the data of websites you haven't opened for a while. That doesn't apply on the home screen. Notifications and Face ID are also only available there.

The data in the Safari tab and in the app on the home screen are **separate**. If you have already started in the browser, move the data over with a [backup](#/hilfe/sicherung) or [device sync](#/hilfe/abgleich).

## Android (Chrome)
Menu (three dots) → **Install app** or **Add to Home screen**.

## Computer (Chrome, Edge)
Click the **Install** icon in the address bar – or simply use it in the browser.

## Updates
The app loads new versions by itself as soon as there is internet. What's new is listed under [What's new](#/hilfe/neu).
`
    },
    {
      id: 'daten',
      title: 'Where is my data?',
      icon: 'shield-lock',
      group: 'start',
      summary: 'Everything stays on your device – or on your own server.',
      keywords: 'privacy private storage local cloud account offline security data protection',
      body: `
All trips, photos and notes are stored **only on your device** – in the storage of the browser or the app. There is no account, no advertising and no third-party server.

## What the app fetches from the internet
Only when there is internet and you use the feature:
- Weather and elevation data (Open-Meteo), maps and address search (OpenStreetMap)
- Travel and safety advice (German Federal Foreign Office), exchange rates (ECB)
- Route planning (BRouter) and hiking trails (OpenStreetMap)

Only the request is sent (e.g. a place), never your trip.

## Several devices
If you want the trip on several devices or with travel companions, there are two ways:
- [Device sync](#/hilfe/abgleich) via your **own server** – automatic.
- [Share the trip as a file](#/hilfe/mitreisende) – without a server, by hand.

## Don't lose your data
- Create a [backup](#/hilfe/sicherung) regularly.
- Under Settings → Storage, **Request permanent storage** – then the browser may not delete the data when space runs low.
- On iPad and iPhone, [put the app on the home screen](#/hilfe/installieren).
`
    },

    // ───────────────────────── Plan ─────────────────────────
    {
      id: 'reise',
      title: 'Create and edit a trip',
      icon: 'suitcase2',
      group: 'planen',
      summary: 'Destination, dates, travel companions, budget, cover picture, archive.',
      routes: ['trip-list', 'trip-new', 'trip-edit', 'trip-detail', 'trip-cover'],
      keywords: 'new trip destination dates participants travel companions people budget cover picture archive delete countries',
      body: `
## New trip
Under **Trips** → **New trip**. Only name, destination and dates are required.

- **Destination countries** – with these the app fetches [travel advice](#/hilfe/reisehinweise) from the German Federal Foreign Office, emergency numbers and [severe weather warnings](#/hilfe/unwetter).
- **Who's coming?** – names of your travel companions. This lets you separate packing list, medicines and documents per person and split expenses. With [People & permissions](#/hilfe/personen), each name can be linked to an account.
- **Getting there** and **Total budget** – for suggestions and the budget comparison under [Expenses](#/hilfe/ausgaben).

## The trip page
At the top the cover picture, dates and key facts, below that the areas as tiles – sorted into the tabs **Planning**, **On the road**, **Afterwards** and **Share**. Each tile shows a short summary, e.g. “12 of 30 packed”.

The menu at the top (three dots) gives you **Edit**, **Change cover picture**, **Share with travel companions**, **Put in archive** and **Delete**.

## Cover picture
Without your own photo, the app draws a landscape matching the destination. You can upload a photo or take one from the journal and move the crop.

## Archive and delete
- **Put in archive**: the trip moves down into “Archive” in the trip list – all data is kept.
- **Delete** removes the trip with everything that belongs to it (packing list, photos, journal …). This can't be undone.

The trip list is sorted into **On the road now**, **Planned** and **Memories**.
`
    },
    {
      id: 'anreise',
      title: 'Getting there & back',
      icon: 'car-front',
      group: 'planen',
      summary: 'Legs by car, train, plane, bus or ferry – with times and costs.',
      routes: ['travel-list', 'travel-new', 'travel-edit'],
      keywords: 'leg car train flight bus ferry travel costs fuel toll vignette outbound return journey',
      body: `
The journey there and back consists of **legs** – e.g. car to the airport, flight, rental car.

- Add a **leg**: means of transport, from, to, date, departure and arrival.
- For the **car**, the app works out the travel costs from distance, consumption and fuel price; toll and vignette are added.
- **Booking number** and **link** keep the paperwork at hand.
- **Copy the return journey from the outbound journey** creates the legs in reverse order – just adjust date and times.
- Start navigation for a leg with **Apple Maps** or **Google Maps**.

Departure times appear under [Dates & deadlines](#/hilfe/termine) and in the day plan. No need to type out confirmation emails: [Import booking](#/hilfe/buchung).
`
    },
    {
      id: 'unterkuenfte',
      title: 'Accommodation',
      icon: 'house-door',
      group: 'planen',
      summary: 'Compare ideas, keep bookings and cancellation deadlines in view.',
      routes: ['accommodation-list', 'accommodation-new', 'accommodation-edit'],
      keywords: 'hotel holiday flat apartment camping hostel booking cancellation deadline check-in check-out nights',
      body: `
Add accommodation as an **idea** first – that way you keep comparisons in view. The status then moves on to **Requested** and **Booked** (or **Cancelled**).

- **Arrival / departure** – the app shows which nights are still open (“Still open: …” or “All nights booked”).
- **Free cancellation until** – the deadline appears under [Dates & deadlines](#/hilfe/termine) and, if you like, as a reminder.
- **Address** – lets you quickly place the accommodation on the [map](#/hilfe/karte); the severe weather warnings use it too.
- **Total price** goes into the trip's planned costs.

Confirmation email from the hotel or booking site? With [Import booking](#/hilfe/buchung) the app fills in the form itself.
`
    },
    {
      id: 'buchung',
      title: 'Import booking',
      icon: 'envelope-paper',
      group: 'planen',
      summary: 'Take over confirmations from an email, PDF or calendar entry.',
      routes: ['booking-import'],
      keywords: 'confirmation mail email pdf ics calendar recognise automatically hotel flight train',
      body: `
Instead of typing out bookings, give the app the confirmation:

1. **Choose file** (PDF, saved email, calendar entry .ics) – or copy the text from the email or PDF and paste it with **From clipboard**.
2. The app recognises accommodation or a journey with dates, times, price, booking number and cancellation deadline.
3. Fill in anything missing in the form below and save.

The confirmation is also filed under [Documents](#/hilfe/dokumente) as a “Booking” – with the booking number and an excerpt of the text. Choose **Only as a record** if that's all you want.

> Everything is read **right here on the device** – nothing is uploaded. The app understands German and English confirmations.
`
    },
    {
      id: 'unternehmungen',
      title: 'Activities',
      icon: 'star',
      group: 'planen',
      summary: 'Collect ideas – sights, outings, restaurants.',
      routes: ['activity-list', 'activity-new', 'activity-edit'],
      keywords: 'ideas activities outing sight restaurant opening hours indoors outdoors priority reservation',
      body: `
Collect everything you want to experience here. The more you enter, the better the [day planner](#/hilfe/heute) can help later.

- **Indoors / outdoors** – when it rains, the day planner suggests indoor ideas.
- **How important?** – Must, Would like or Maybe.
- **Opening hours** as text, e.g. “Tue–Sun 10–18” – the app recognises closed days.
- **Reservation / ticket required** – appears as a note in the list.
- **Planned day** – leave empty while it's still open.
- **Place / address** – lets you quickly place the activity on the [map](#/hilfe/karte).

Can't agree on what to do? Let the group decide with a [poll](#/hilfe/abstimmungen).
`
    },
    {
      id: 'abstimmungen',
      title: 'Polls',
      icon: 'hand-thumbs-up',
      group: 'planen',
      summary: 'Questions for the group – everyone votes on their own device.',
      routes: ['polls', 'poll-new', 'poll-edit'],
      keywords: 'poll vote voting group decide find a day date survey',
      body: `
Where to on Sunday? Which day for the glacier tour? Ask the question – everyone votes.

## Three types
- **Free answers** – e.g. restaurant or destination.
- **Find a day** – the days of the trip are already filled in, multiple answers are possible.
- **Choose an activity** – from the ideas under [Activities](#/hilfe/unternehmungen).

## Voting
Choose your name at the top under **I'm voting as** and tap. You can change or withdraw your vote as long as the poll is running. “still missing: …” shows who hasn't voted yet.

**Vote until** sets a deadline – it appears under [Dates & deadlines](#/hilfe/termine).

## Taking over the result
For a day for an activity, one tap adds the chosen day there. With “Choose an activity”, the winner is marked as planned.

> For the votes from all devices to come together, you need [device sync](#/hilfe/abgleich). With [People & permissions](#/hilfe/personen), everyone only votes for themselves.
`
    },

    // ───────────────────────── Prepare ─────────────────────────
    {
      id: 'packliste',
      title: 'Packing list',
      icon: 'backpack',
      group: 'vorbereiten',
      summary: 'Start with templates, pack per person, tick things off.',
      routes: ['packing-list', 'packing-templates', 'packing-edit'],
      keywords: 'packing suitcase template tick packed important children beach hiking weather suggestions',
      body: `
## Start with a template
**Choose templates** – e.g. basics, beach, hiking, children. Quantities are calculated from the length of the trip and the number of people (socks per day, toothbrush per person). Several templates can be combined; duplicates are merged.

Personal items (clothes, charging cables …) are added for each selected person, shared items once. For this, enter names on the trip under **Who's coming?**.

Also handy: **Take over from another trip**.

## Packing
- Tap to tick off. **Open only** hides what's packed.
- **Important – must not be forgotten** marks essentials; the trip page shows when some of them are still missing. Two days before departure, the app reminds you of everything still open.
- Filter by person at the top – everyone packs their own list.
- **Suggestions for this trip** look at the weather at the destination (rain jacket, sun cream …).
- **Remove all ticks** for the return journey.

> With [People & permissions](#/hilfe/personen), your own packing list is private – the others don't see it.
`
    },
    {
      id: 'checklisten',
      title: 'Departure checklists',
      icon: 'clipboard-check',
      group: 'vorbereiten',
      summary: 'At home before leaving, online check-in and checking out of your accommodation – tick off.',
      routes: ['checklists'],
      keywords: 'checklist departure leaving home hob windows plants post check-out accommodation key safe online check-in flight boarding pass forget',
      body: `
Three lists so nothing is forgotten at the last minute:

- **Before you go** – at home: hob off, windows closed, plants, post … The first time, tap **Use suggestions**, add your own items and remove anything that doesn't fit with the **×**. For your next trip you can **copy** the list with one tap – including your own items.
- **Online check-in** – for every flight from [Getting there & back](#/hilfe/anreise), to tick off.
- **Check-out** – a list for every booked [accommodation](#/hilfe/unterkuenfte), with suggestions to suit the type: safe and minibar in a hotel, rubbish and dishes in a holiday flat, electricity and gas bottle at the campsite.

**More suggestions** shows what else the app offers; **Remove all ticks** resets a list.

## Reminders
Open items appear under [Today](#/hilfe/heute) and in the [dates list](#/hilfe/termine) – also as notifications and in the calendar subscription:
- home the day before departure,
- online check-in the day before the flight,
- check-out on the day you leave the accommodation.

Once everything is ticked off, the reminder disappears.
`
    },
    {
      id: 'apotheke',
      title: 'Medicine kit and vaccinations',
      icon: 'capsule',
      group: 'vorbereiten',
      summary: 'Medicines with intake schedule and stock, vaccinations.',
      routes: ['meds-overview', 'med-new', 'med-edit', 'vacc-new', 'vacc-edit'],
      keywords: 'medicines tablets intake stock prescription hand luggage keep cool vaccination expiry date allergy pharmacy',
      body: `
## Medicines
For each medicine: for whom, dose, units per dose, **stock** and **times of intake**. The app works out whether the stock is enough for the trip and shows an **intake schedule** for everyone.

Markers such as **Prescription only**, **In hand luggage** and **Keep cool** help with packing; **Use by** warns about expired medicines.

## Vaccinations
Enter vaccinations with **Protection valid until**. If protection ends before the end of the trip, the app points it out. If destination countries are entered, the recommendations of the German Federal Foreign Office are shown alongside – **Add** puts them on the list.

## Sharing with travel companions
With [People & permissions](#/hilfe/personen), medicines are private. Use **Who may see this?** to share individual ones – e.g. an allergy card with the whole group.

> The medicine kit helps you get organised and doesn't replace advice from a doctor or pharmacist.
`
    },
    {
      id: 'dokumente',
      title: 'Documents and emergency numbers',
      icon: 'passport',
      group: 'vorbereiten',
      summary: 'IDs, insurance, tickets – with expiry dates. Emergency numbers.',
      routes: ['docs-overview', 'doc-new', 'doc-edit', 'contact-new', 'contact-edit'],
      keywords: 'id passport identity card driving licence visa insurance ticket expiry emergency number embassy phone',
      body: `
## Documents
**Suggestions** adds the usual documents to match the trip (ID, driving licence when travelling by car, insurance …). For each: status (missing, applied for, available), number, **Valid until** and whether a copy is filed.

If a document expires before or shortly after the trip, the app warns you – in good time, since issuing can take weeks.

## Emergency numbers
- The German Federal Foreign Office's numbers (emergency, police, embassy) are added automatically when destination countries are entered.
- **Own numbers**: travel health insurance emergency line, breakdown service, accommodation, family doctor …

Tap to call directly. Always enter numbers with the country code. **Open emergency page** shows everything important at a glance – see [Health & emergency](#/hilfe/gesundheit).

## Health
The **Health** tab lists the allergies, conditions and blood types of your fellow travellers – more under [Health & emergency](#/hilfe/gesundheit).

> With [People & permissions](#/hilfe/personen), documents are private; use **Who may see this?** to share them.
`
    },
    {
      id: 'gesundheit',
      title: 'Health & emergency',
      icon: 'heart-pulse',
      group: 'vorbereiten',
      summary: 'Allergies, conditions and blood type per person – emergency page in the local language, emergency card as a PDF.',
      routes: ['health-edit', 'emergency'],
      keywords: 'allergy allergies condition illness blood type diabetes asthma pacemaker blood thinner emergency emergency number emergency card medical id pdf sos doctor hospital',
      body: `
## Details per person
Under **Documents & emergency → Health** (or via the **Allergies & health** tile on the trip page) you enter for each person:
- **Allergies** – about 30 known ones plus your own. If the app knows a word you type (e.g. “hazelnuts”), it ticks the matching allergen; unknown ones (e.g. “coriander”) go on a separate list with a field for the translation in each language of the trip.
- **Conditions**: blood thinners, diabetes, asthma, pacemaker – the app translates these into all languages. Other conditions and **Notes for helpers** appear as you write them.
- **Blood type**.

The details belong to the trip and are synced with your other devices. On your next trip, **Copy** brings them over from the last one.

## Who sees this?
By default all fellow travellers – in an emergency they should be able to help. If a traveller is linked to an account via [People & permissions](#/hilfe/personen), only that person decides who sees their details, and only they can change them.

## Emergency page
During the trip a red **heart** appears in the header – it opens the emergency page:
- The country's **emergency numbers** (from the [Country cheat sheet](#/hilfe/laender)) – tap to call. With several countries, choose at the top.
- The large **Emergency** button in the “On the road” tab of the trip page also leads here.
- For each person the allergies, conditions and blood type **in the local language**, with a translation underneath, plus regular and emergency medication from the [travel pharmacy](#/hilfe/apotheke).
- **Show large** to hold up, **Read aloud**, and your own emergency numbers.

In the day plan, restaurants show a link to the **allergy card** in the [phrasebook](#/hilfe/sprachfuehrer).

## Emergency card as a PDF
**Create PDF** makes one credit-card-sized card per person: the local language on the front, your language on the back. Print, cut out, fold and keep with your ID.

## Your phone's Medical ID
If the app is locked, helpers cannot reach the emergency page. So also add the essentials to your phone's Medical ID (iPhone: *Health* app → *Medical ID*) – it can be opened on a locked phone. **Copy for Medical ID** puts the matching text on the clipboard.

> The app is no substitute for medical advice. Translations without guarantee – ideally have important details confirmed by a doctor.
`
    },
    {
      id: 'reisehinweise',
      title: 'Travel advice',
      icon: 'globe2',
      group: 'vorbereiten',
      summary: 'Safety, entry and vaccinations from the German Federal Foreign Office.',
      routes: ['reiseinfo'],
      keywords: 'foreign office safety travel warning entry visa vaccinations embassy consulate',
      body: `
If **destination countries** are entered for the trip, the app fetches the travel and safety advice of the German Federal Foreign Office (Auswärtiges Amt): safety situation, entry requirements, vaccinations and the German missions abroad.

- The app checks daily when you open the trip and marks changes as **changed**.
- **Update now** fetches the latest version immediately – ideally shortly before you leave.
- Emergency numbers and vaccination recommendations are added automatically to [Documents](#/hilfe/dokumente) and the [Medicine kit](#/hilfe/apotheke).

> The advice is aimed at German citizens and is only available in German. No guarantee. Travellers from other countries should also check their own government's advice.
`
    },
    {
      id: 'laender',
      title: 'Country cheat sheet',
      icon: 'card-checklist',
      group: 'vorbereiten',
      summary: 'Sockets, emergency numbers, local time, tipping, tap water and traffic rules for each country – offline.',
      routes: ['laender'],
      keywords: 'socket plug adapter power voltage emergency number time zone time difference tipping tap water drinking water speed limit alcohol limit toll vignette drive on the left transit roaming dialling code',
      body: `
For every **destination country** of the trip, the cheat sheet shows what you need to know on the spot – without internet:

- **Emergency numbers** for police, ambulance and fire – tap to call
- **Sockets**: type, voltage and whether German plugs fit
- **Local time** and the difference from home
- **Money & tipping**, **Phone** (country code, EU roaming), **Tap water**
- **By car**: which side of the road, speed limits, alcohol limit, tolls and daytime headlights – opened straight away for trips by car
- **Good to know**: specifics such as vignette deadlines, low-emission zones or entry authorisations

## Transit countries
If you drive through other countries (e.g. Austria on the way to Italy), add them at the bottom as **transit countries**. They get a cheat sheet too, and the [packing list](#/hilfe/packliste) suggests the vignette you need.

> The information is as of October 2026 and comes without guarantee – local signs always apply. Entry, safety and vaccinations are under [Travel advice](#/hilfe/reisehinweise).
`
    },
    {
      id: 'sprachfuehrer',
      title: 'Phrasebook',
      icon: 'translate',
      group: 'vorbereiten',
      summary: 'Key phrases in the local language – offline, to read aloud and hold up, with an allergy card.',
      routes: ['phrasebook'],
      keywords: 'language phrases translate vocabulary local language restaurant emergency doctor allergy allergy card intolerance own allergy read aloud pronunciation greek italian french spanish croatian german',
      body: `
For the trip's **destination countries** (including transit countries), the phrasebook shows about 40 key phrases in the local language – **Essentials**, **At the restaurant**, **On the road** and **Emergency**. Everything is stored in the app and works without internet.

- You can choose any other language at the top via **Other language**: German, English, French, Italian, Spanish, Portuguese, Dutch, Danish, Swedish, Norwegian, Polish, Czech, Hungarian, Croatian, Slovenian, Greek and Turkish.
- **Read aloud** (speaker) speaks the phrase with the device's voice – if a language is missing, you can download it on iPad/iPhone under *Accessibility → Spoken Content → Voices*.
- **Show large** fills the screen with the phrase – to hold up at the counter. Tap to close.
- Greek is also shown in Latin transliteration.

## Allergy card
Allergies are entered for each person under [Health & emergency](#/hilfe/gesundheit) – **Add allergies** or **Change** takes you there. This creates a sentence in the local language: “I am allergic to: … Please make it without these – they are dangerous for me.” – best used with **Show large**. If several travellers have allergies, choose the person at the top.

Your own allergies that the app doesn't know (e.g. “coriander”) appear on the card as they were entered. If the translation for the selected language is missing, you can enter it right below the card.

> For emergencies: the [emergency page](#/hilfe/gesundheit) shows emergency numbers, allergies, conditions and medication of all travellers in the local language.
`
    },
    {
      id: 'termine',
      title: 'Dates & deadlines',
      icon: 'calendar-event',
      group: 'vorbereiten',
      summary: 'All of the trip’s deadlines in one place – in your own calendar too.',
      routes: ['termine'],
      keywords: 'deadlines reminder calendar subscription ics cancellation departure outlook',
      body: `
The app collects dates from all areas: cancellation deadlines of the accommodation, departures, reservations, expiring documents, vaccination appointments, open packing list items, poll deadlines. Tapping an entry takes you to where you can change it.

## Into the calendar
- **Calendar subscription** (recommended) – the calendar on iPad/iPhone, Android or Outlook fetches the dates of all current and upcoming trips itself and reminds you in good time: cancellation deadlines 2 days before, departures 2 hours before, travel days the evening before. Needs [device sync](#/hilfe/abgleich).
- **As a notification** – the app notifies you itself, even when it is closed: [Notifications](#/hilfe/benachrichtigungen).
- **Once as a file** (.ics) – only this trip, as it is now.
`
    },

    // ───────────────────────── On the road ─────────────────────────
    {
      id: 'heute',
      title: 'Today and the day planner',
      icon: 'sun',
      group: 'unterwegs',
      summary: "What's on today? Suggestions to match the weather and opening hours.",
      routes: ['today', 'dayplanner'],
      keywords: 'day plan day weather forecast rain suggestion schedule opening hours today',
      body: `
**Today** in the menu opens the current day of the trip that's underway – or shows how long it is until the next one.

## The day plan
- At the top, the **weather** for the day. The first time, choose the **place for the weather forecast**.
- Below that, what's planned for the day – journeys, activities, tours.
- **Suggestions for this day** come from your [activities](#/hilfe/unternehmungen): when it rains, indoor ideas are preferred, closed ones hidden, “Must” before “Maybe”. **Schedule** puts them on the day.
- **Move to** another day, **swap** for an alternative, **Back to the ideas**.

If a [severe weather warning](#/hilfe/unwetter) applies to the day, it is shown at the top.

> Without internet, the day plan shows the last weather loaded.
`
    },
    {
      id: 'unwetter',
      title: 'Severe weather warnings',
      icon: 'cloud-lightning-rain',
      group: 'unterwegs',
      summary: 'Official warnings from the weather services for your places.',
      routes: ['unwetter'],
      keywords: 'weather warning storm thunderstorm heavy rain snow heat forest fire avalanche meteoalarm warning',
      body: `
The app shows official warnings from the weather services of 38 European countries (MeteoAlarm): wind, thunderstorms, heavy rain, snow and ice, heat, forest fire risk, avalanches.

- **Warnings for** your places (accommodation, activities, weather place, destination), the **whole country** or **off**.
- Each warning with its level (yellow, orange, red), area, period and the weather service's recommendation.
- Missing a region you're interested in? **Watch** it – then warnings there always count.
- As a [notification](#/hilfe/benachrichtigungen) from the day before the trip, level adjustable.

> Needs [device sync](#/hilfe/abgleich) with your own server and destination countries entered. On site, the authorities' instructions apply. The warning texts come from the weather services, usually in German or English.
`
    },
    {
      id: 'karte',
      title: 'Map and offline maps',
      icon: 'map',
      group: 'unterwegs',
      summary: 'Accommodation, activities, routes and photos on one map.',
      routes: ['map'],
      keywords: 'map places location coordinates gps offline navigation apple google photos locate',
      body: `
The map shows accommodation, activities, [routes](#/hilfe/routen) and photos from the journal. Filter by day at the top; **My location** shows where you are right now.

## Putting places on the map
Below the map, **Not on the map yet** lists all accommodation and activities without a position. Tap **Locate** and then
- search – address or name; GPS coordinates (e.g. from a Garmin) or a shared link from Google Maps / Apple Maps work too,
- or **Tap on the map**.

Tapping a place offers **Route in Apple Maps** or **Google Maps** for navigation.

## Photos
Photos with GPS data appear by themselves. If the location is missing, the app estimates it from a recorded tour at the time the photo was taken – or you set it by hand under **Photos without a location**.

## Offline maps
Without a connection, the map only shows areas you have viewed before. With **Offline maps** you save the whole area on the device – ideal for mountains and abroad. They are created by your own server ([device sync](#/hilfe/abgleich)).
`
    },
    {
      id: 'routen',
      title: 'Routes & tours',
      icon: 'signpost-2',
      group: 'unterwegs',
      summary: 'Import GPX and Garmin tours, plan routes, find hiking trails.',
      routes: ['routes', 'route-planner', 'route'],
      keywords: 'gpx fit garmin komoot outdooractive tour hiking bike ride elevation profile ascent route planning trail kml',
      body: `
## Import
**Import file**: GPX, FIT (Garmin), TCX, KML/KMZ (Google My Maps) and GeoJSON. The app shows the track, length, metres of ascent and elevation profile.

Where from? Garmin Connect (activity → gear icon → “Export to GPX”), directly from the Garmin device via USB, ready-made tours from Outdooractive, Komoot or Bergfex. On iPad and iPhone, downloaded files are in the Files app.

## Plan and search
- **Plan a route**: tap points on the map – first A, then B, more as stopovers. The route follows paths and roads (BRouter).
- **Search hiking trails**: zoom to the area, then **Search in this area**.
Both need internet.

## Afterwards
Each route can be assigned to a **day of the trip** and appears on the [map](#/hilfe/karte), in the journal and in the trip report. **As GPX (for Garmin)** puts it on your navigation device. **Show on trip website and in read-only links** decides whether friends see it.

If the file has no elevations, **Add elevations** adds them from a terrain model.
`
    },
    {
      id: 'ausgaben',
      title: 'Expenses and budget',
      icon: 'wallet2',
      group: 'unterwegs',
      summary: 'Record quickly, foreign currency, who owes whom what.',
      routes: ['expenses', 'expense-new', 'expense-edit'],
      keywords: 'money costs budget currency exchange rate receipt split settle up debts',
      body: `
## Record quickly
Type the amount and a keyword, tap a category – done. **With receipt, foreign currency or split …** opens all fields.

- **Foreign currency**: the app converts into the trip currency with the ECB reference rates (needs internet once).
- **Receipt**: attach a photo of the receipt.
- **Paid by** and **For whom?** – none selected means: for everyone.

## Budget
If a budget is entered for the trip, the app shows **Spent** in comparison at the top – and warns you when your pace would blow the budget. The planned costs from accommodation, getting there and activities are shown on the trip page.

## Settle up
Under **Settle up**, the app works out who pays whom how much so that everyone is even – with as few transfers as possible.
`
    },

    // ───────────────────────── Remember & share ─────────────────────────
    {
      id: 'tagebuch',
      title: 'Travel journal',
      icon: 'journal-richtext',
      group: 'erinnern',
      summary: 'One entry per day with photos, voice notes and mood.',
      routes: ['journal-list', 'journal-new', 'journal-edit'],
      keywords: 'journal diary entry photos pictures voice note recording mood highlight draft memory',
      body: `
One entry per day: heading, place, text, mood, photos and voice notes.

## Draft from the day
No time to write? **Draft from the day** puts together a text from what the app already knows: getting there, weather, activities, tours with kilometres and metres of ascent, accommodation, expenses. You only add what you experienced. Empty fields are filled, what you've written stays.

## Photos
**Add photos** – they are saved reduced in size (at most 2048 pixels), which saves space. Where and when the photo was taken is kept, and the photo appears on the [map](#/hilfe/karte). A photo can be used as the trip's cover picture.

## Voice notes
**Record voice note** – ideal on the road. The first time, the device asks for microphone access. At most 15 minutes at a time.

## Highlights
The **star** marks the best entries – they go on the [trip website](#/hilfe/webseite) and into the [trip report](#/hilfe/bericht). **Empty days** shows where something is still missing.
`
    },
    {
      id: 'bericht',
      title: 'Trip report and photo book',
      icon: 'book',
      group: 'erinnern',
      summary: 'The trip as a PDF – to send or as a photo book to print.',
      routes: ['report'],
      keywords: 'pdf report photo book print printer album summary file',
      body: `
The journal, photos, tours, accommodation and expenses turn into a finished report.

- **Type**: **Report** (text with photos) or **Photo book** (large photos, little text).
- Choose what goes in: photos (all, at most 4 per entry, highlights only), tours with map, overview, accommodation, expenses.
- **Create PDF file**: **small file** for sharing or **print quality (300 dpi)**.

For the photo book: choose the page format and **photos per page**; for printers, turn on **3 mm bleed**. The file can be uploaded to many photo book services.

> Map images need internet. Without it, tours appear as a line – **Try again** as soon as you have a connection.
`
    },
    {
      id: 'webseite',
      title: 'Trip website',
      icon: 'window',
      group: 'erinnern',
      summary: 'A nice page with photos – as a single file, without a server.',
      routes: ['website'],
      keywords: 'website homepage html blog publish github pages template design show friends',
      body: `
Your journal becomes a website – as **a single HTML file** with all photos. It works without internet and in any browser.

1. Choose a **template**, accent colour, font and light/dark.
2. **Texts**: title, subtitle, introduction – or **take from trip**.
3. **What should go on the page?** Journal (all or highlights only), routes with maps, accommodation, activities.
4. **Create website** → **Share**, **Download** or **Open**.

Prices, booking numbers and notes never go on the page.

## Putting it on the internet
The easiest way is to send it via AirDrop, email or messenger. For a fixed address, **How do I put the page on the internet?** describes the way via GitHub Pages (free of charge).

With your own server it's even easier: [read-only links](#/hilfe/lese-links).
`
    },
    {
      id: 'lese-links',
      title: 'Share with friends (read-only links)',
      icon: 'link-45deg',
      group: 'erinnern',
      summary: 'A link that lets friends see your experiences – without the app.',
      routes: ['share-links'],
      keywords: 'link share friends family password view read only',
      body: `
A **read-only link** shows your experiences as a nice page. Friends need neither the app nor a key and can't change anything. New journal entries appear there by themselves.

- **What should friends see?** Highlights only or the whole journal, photos, routes, accommodation, activities.
- Optionally a **password** and how long it is **valid**.
- **For whom?** – just a note for you so you can tell the links apart.
- Deleting ends the link immediately.

**Never included:** planning, budget, expenses, medicine kit, documents, emergency numbers, travel companions, the locations of photos and voice notes.

The page appears in the viewer's language (German or English).

> Read-only links run via your own server – set up [device sync](#/hilfe/abgleich) first.
`
    },
    {
      id: 'mitreisende',
      title: 'Share the trip as a file',
      icon: 'send',
      group: 'erinnern',
      summary: 'Send the whole trip to travel companions – without a server.',
      routes: ['share-trip'],
      keywords: 'travel companions file airdrop share transfer other device without server',
      body: `
Without your own server, you share a trip as a file. It contains everything: planning, packing list, medicine kit, documents, journal, expenses and map – including the photos if you like.

1. In the menu on the trip page, **Share with travel companions** → **Create file** → **Share** (e.g. via AirDrop).
2. On the other device: Settings → **Import backup or shared trip**.

Importing merges: new things are added, and where there are differences the more recent change wins.

> Deletions are not transferred. Best to take turns: A sends to B, B imports and sends back. It's more convenient and automatic with [device sync](#/hilfe/abgleich).
`
    },
    {
      id: 'statistik',
      title: 'Statistics',
      icon: 'bar-chart',
      group: 'erinnern',
      summary: 'Your trips in numbers – countries, travel days, records.',
      routes: ['stats'],
      keywords: 'numbers countries records travel days kilometres ascent statistics',
      body: `
Under **Trips** → **Statistics**: where you've been (countries on the map), travel days per month and records – longest trip, longest tour, most metres of ascent, expenses. Filter by year at the top.
`
    },
    {
      id: 'piwigo',
      title: 'Photos in Piwigo',
      icon: 'images',
      group: 'erinnern',
      summary: 'Upload original photos to your own Piwigo gallery and get them from there.',
      routes: ['piwigo-trip', 'piwigo-settings'],
      keywords: 'piwigo gallery photos original upload album address api key setup public address',
      body: `
If you run your own **Piwigo** gallery, you can connect it to the trip:

- Create an **album for this trip** or connect an existing one.
- **Automatically upload new photos from the journal** – in full size (original), while the journal keeps a reduced version.
- In the journal, take photos from the gallery with **From Piwigo**.

Photos deleted in the journal stay in Piwigo.

## Setting up (server owner)
Under **Settings → Device sync → Piwigo gallery**:
- **Piwigo address** – how the server reaches Piwigo, usually on your home network (e.g. \`http://192.168.5.15\`).
- **Public address** (optional) – for the “Open in Piwigo” links, so they also work on the road.
- **API key** – create it in Piwigo as an administrator under *Profile → API keys*; enter the ID and secret. When only changing the address, simply leave the secret empty.

**Check and save** signs in to Piwigo as a test – nothing is saved unless that works. The values apply immediately, without a restart, and take precedence over those in the server file. Which travel groups may use Piwigo is set under **Travel groups**.

> Runs via your own server (version 1.22 or later); Piwigo must be enabled for the travel group.
`
    },

    // ───────────────────────── Several devices & people ─────────────────────────
    {
      id: 'abgleich',
      title: 'Device sync',
      icon: 'cloud-arrow-up',
      group: 'gemeinsam',
      summary: 'iPad, phone and PC automatically on the same page – via your own server.',
      routes: ['sync', 'groups'],
      keywords: 'sync synchronisation server several devices pair invitation key travel group cloud',
      body: `
With device sync, all devices – yours and your travel companions' – have the same data. It runs via your **own server** (e.g. at home); there is a guide in the source code under \`server/README.md\`.

## Connect a device
- **Invitation**: on a connected device, **Add device** or **Share pairing link** – send the link via AirDrop or message or scan the QR code.
- **Name and password**: for [people](#/hilfe/personen) who have already been invited.
- On iPad and iPhone, if the app is already on the home screen: open it there and enter the **invitation code** (otherwise the link only opens Safari).

## How it works
- Every device remembers its changes – even offline – and sends them as soon as there is internet.
- Syncing happens when the app is opened, a few seconds after a change and every 5 minutes.
- If two devices change the same entry, the more recent change wins. Deletions are transferred.
- Photos are transferred in full size.

The cloud icon at the top shows the status: tick = everything synced, arrow = syncing right now, number = changes waiting.

## Travel groups
Friends who want to use the app for their **own** trips get their own travel group with its own key – they only see their trips.

## What else the server can do
[Read-only links](#/hilfe/lese-links), [notifications](#/hilfe/benachrichtigungen), [calendar subscription](#/hilfe/termine), [offline maps](#/hilfe/karte), [severe weather warnings](#/hilfe/unwetter), [Piwigo](#/hilfe/piwigo) and a [backup every night](#/hilfe/sicherung).
`
    },
    {
      id: 'personen',
      title: 'People & permissions',
      icon: 'person-lock',
      group: 'gemeinsam',
      summary: 'Who may do what – and what stays private.',
      routes: ['people'],
      keywords: 'roles permissions admin member read only invite password private account user link access',
      body: `
Without people, every connected device sees and changes everything. With people, everyone gets their own account with permissions.

## Set up
1. **First: who are you?** – enter your name and password, **That's me**. The first person becomes admin.
2. **Invite person** – with a role. The invitation (link or QR code) is valid once; the person sets their password while accepting it.
3. Assign **devices without a person** to a person – then that person's permissions apply.

## Roles
- **Admins** invite people, assign roles and permissions per trip.
- **Members** edit all trips.
- **Read only** sees everything, changes nothing (voting still works).
This can be set differently per trip – down to **No access**: then the trip never even reaches that person's devices.

## Private
On the trip, under **Who's coming?**, **link** each name **to an account**. Then that person's **packing list, medicines, vaccinations and documents** are private – only they can see them, not even admins. Individual documents or medicines can be shared via **Who may see this?** (e.g. the allergy card). The details under [Health & emergency](#/hilfe/gesundheit) (allergies, conditions) are protected the same way but shared with everyone from the start – for emergencies.

Names that aren't linked (e.g. children) are visible to the whole group.
`
    },
    {
      id: 'benachrichtigungen',
      title: 'Notifications',
      icon: 'bell',
      group: 'gemeinsam',
      summary: 'Reminders, news from travel companions and severe weather – even when the app is closed.',
      routes: ['push'],
      keywords: 'push notification reminder alert sound',
      body: `
Under Device sync → **Notifications**, tap **Turn on** once – the device asks for permission. The setting applies per device.

- **Reminders of appointments and deadlines** – cancellation deadline, check-in, departure, vaccination appointment, start of the trip.
- **News from your travel companions** – e.g. “Birgit – New: a journal entry, 5 photos”, bundled, at most every 15 minutes per trip. Never other people's private entries.
- **Severe weather warnings** – from level yellow, orange or red.

**Send test message** shows whether everything arrives. Tapping a notification opens the matching place in the app. The messages come in the language of the app (with server version 1.21 or later).

> On iPad and iPhone only for the app [on the home screen](#/hilfe/installieren) (iOS 16.4 or later). To change the permission later: Settings → Notifications → KofferFertigRaus. Needs [device sync](#/hilfe/abgleich) with its own device access.
`
    },

    // ───────────────────────── Settings & data ─────────────────────────
    {
      id: 'sicherung',
      title: 'Data backup',
      icon: 'download',
      group: 'einstellungen',
      summary: 'Backup as a file, importing, backup on the server.',
      routes: ['settings', 'backup-targets'],
      keywords: 'backup save export import restore file storage nas destination',
      body: `
## Backup as a file
Settings → **Export backup**. With **Include photos** the file gets much larger, but then contains everything. Keep the file somewhere safe (Files app, computer, cloud).

**Import backup or shared trip** merges: new things are added, and where there are differences the more recent change wins. Nothing newer is overwritten.

This is also how the data gets onto a new device – or from the Safari tab into the app on the home screen.

## Storage
Under **Storage** you can see how much space is used. **Request permanent storage** asks the browser not to delete the data when space runs low.

## Backup on the server
With [device sync](#/hilfe/abgleich), your server backs up all trips and photos every night. Under Device sync → **Server backup** you can add more destinations: drive or NAS folder, SMB share, SSH/rsync or WebDAV.
`
    },
    {
      id: 'aussehen',
      title: 'Appearance and trip page',
      icon: 'palette',
      group: 'einstellungen',
      summary: 'Themes, background, font size and the layout of the trip page.',
      routes: ['appearance'],
      keywords: 'theme design colour dark light font size background photo tiles tabs layout',
      body: `
Settings → **Appearance**. Everything takes effect immediately and applies to this device.

- **Theme** – 18 styles with their own colours and fonts; light, dark or same as the device.
- **Font size** and **corners**.
- **Background** – your own photo or a pattern, with veil, blur and saturation.

## Trip page
- Areas as **tiles**, **large tiles** or **compact list**.
- Cover picture large, medium, small or none.
- **Tabs** on or off, matching tab by date.
- **Which areas go where?** – move areas between Planning, On the road, Afterwards and Share. Areas that are in no tab remain reachable under “More areas”.

The **language** is set under Settings → **Language** (per device).
`
    },
    {
      id: 'sperre',
      title: 'App lock',
      icon: 'shield-lock',
      group: 'einstellungen',
      summary: 'Protect the app with a code or Face ID.',
      routes: ['lock'],
      keywords: 'code pin face id touch id lock protect password forgotten',
      body: `
Settings → **App lock**: a code with 4–8 digits, on iPad and iPhone also **Face ID / Touch ID**. Applies to this device only.

The lock protects against prying eyes if someone gets hold of the device. The data itself is not encrypted – if the device is lost, the device lock protects it.

> Nobody can recover the code. Way out: delete the app's data on the device; with [device sync](#/hilfe/abgleich), all trips come back from the server afterwards.

Face ID is only available when the app is [on the home screen](#/hilfe/installieren).
`
    },
    {
      id: 'neu',
      title: "What's new?",
      icon: 'stars',
      group: 'einstellungen',
      summary: 'The changes in the latest versions (in German).',
      keywords: 'version update news changes changelog',
      // Inhalt kommt aus dem Änderungsprotokoll (CHANGELOG.md, deutsch)
      body: ''
    },

    // ───────────────────────── FAQ ─────────────────────────
    {
      id: 'fragen',
      title: 'FAQ',
      icon: 'chat-square-text',
      group: 'fragen',
      summary: 'Offline, lost data, costs, travel companions without the app …',
      keywords: 'faq question problem help error costs offline deleted gone missing language german english',
      body: `
## Which language does the app use?
The language of the device – currently German or English (other device languages: English). Change it under Settings → **Language**; this applies per device. Your own entries (trip names, packing list, journal) stay as you wrote them. The travel advice of the German Federal Foreign Office and the list of changes are only available in German.

## Does the app work without internet?
Yes. Everything you have entered is available offline. Only weather, map areas, address search, route planning, travel advice and exchange rates need a connection. For the road: save [offline maps](#/hilfe/karte) and open the day plan once with internet.

## My data is gone – what now?
On iPad and iPhone, every environment has its own data: the Safari tab, the app on the home screen and every other browser. Check whether you opened the app differently. Otherwise: [import a backup](#/hilfe/sicherung) or connect [device sync](#/hilfe/abgleich) – then everything comes back from the server.

## Does the app cost anything?
No. KofferFertigRaus is free software (AGPL-3.0), without ads and without an account. If you like, you can support its development under Settings → **Support**.

## Do travel companions need the app?
Not necessarily. To plan together, yes (with [device sync](#/hilfe/abgleich) or [as a file](#/hilfe/mitreisende)). Just to look, a [read-only link](#/hilfe/lese-links) or the [trip website](#/hilfe/webseite) is enough.

## Can the others see my packing list?
Without [People & permissions](#/hilfe/personen): yes, all connected devices see everything. With people and a linked name, the packing list, medicines and documents are private.

## I deleted something – can I get it back?
Not in the app. An older [backup](#/hilfe/sicherung) can help: importing brings back what was deleted without overwriting anything newer. With your own server there is also the nightly server backup.

## Why doesn't the map show anything?
Without internet, only areas you have already viewed – or saved [offline maps](#/hilfe/karte). For accommodation and activities to appear, they need a location (search for the address or tap on the map).

## How do I get the latest version?
Automatically: with internet, the app loads updates in the background, and they're there the next time you open it. The version is shown under Settings → About.

## Where do I report a bug?
In the source code project on GitHub (Settings → About → **Source code**) under “Issues”.
`
    }
  ]
}
