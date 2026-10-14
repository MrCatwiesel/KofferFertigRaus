/** Help and introduction in English – same ids as inhalt.ts (texts, steps and link labels per topic). */
import type { IntroSlide } from './inhalt'

export const HELP_GROUPS_EN: Record<string, string> = {
  'Erste Schritte': 'First steps',
  Planen: 'Planning',
  Unterwegs: 'On the road',
  'Erinnern & teilen': 'Remember & share',
  'Zusammen reisen': 'Travel together',
  'Daten & Sicherheit': 'Data & security'
}

export const HELP_TOPICS_EN: Record<string, { title: string; keywords?: string; text: string[]; steps?: string[]; links?: string[] }> = {
  ueberblick: {
    title: 'The app at a glance',
    keywords: 'start overview phases planning on the road afterwards trip page tiles',
    text: [
      '“Nix wie weg” accompanies a trip from the first idea to the finished trip website. Everything is stored **on your device** and works **without internet** – only weather, maps, travel advice and sync need a connection.',
      'Every trip has three tabs: **Planning** (travel, accommodation, packing list …), **On the road** (day plan, map, expenses …) and **Afterwards** (journal, photos, report, website). The app picks the right tab based on the date.',
      'Which tiles appear on the trip page and in which order is up to you: *Settings → Appearance → Customise trip page*.'
    ],
    links: ['Watch the short introduction', 'Customise trip page']
  },
  installieren: {
    title: 'Install as an app',
    keywords: 'home screen install icon ipad iphone android pwa',
    text: [
      'This is a web app: once added to the home screen it starts like any other app – without the browser bar and offline too.',
      'On **iPad and iPhone** this only works with Safari. Push notifications there also only work for the installed app (iOS 16.4 or later).'
    ],
    steps: [
      'iPad/iPhone: in Safari tap “Share” → “Add to Home Screen”',
      'Android: in the Chrome menu (⋮) → “Install app” or “Add to Home screen”',
      'PC/Mac: in Chrome or Edge click the install icon on the right of the address bar'
    ]
  },
  'reise-anlegen': {
    title: 'Create a trip',
    keywords: 'new trip destination country participants budget cover dates',
    text: [
      'A trip only needs a title, destination and dates. **Destination countries** automatically fetch travel and safety advice, **participants** are used for packing lists, expenses and polls.',
      'The cover is a drawn landscape – you can choose your own photo or later use one from the journal.'
    ],
    links: ['New trip']
  },
  anreise: {
    title: 'Outbound and return journey',
    keywords: 'train flight car ferry leg departure arrival change',
    text: ['Enter each leg – train, flight, car, ferry – with departure, arrival and booking number. The times appear in the day plan, in the calendar and as a reminder (two hours before departure).']
  },
  unterkuenfte: {
    title: 'Accommodation and bookings',
    keywords: 'hotel holiday flat camping cancellation check-in booking confirmation pdf email import',
    text: [
      'Accommodation with dates, price and **cancellation deadline** – the deadline appears as a reminder two days before. Place the address on the map: then the app knows the location for the map, routes and weather warnings.',
      'With *Import booking* the app reads a **booking confirmation** (PDF or copied email text) and fills in name, dates, price and booking number – all on the device, nothing is uploaded.'
    ]
  },
  unternehmungen: {
    title: 'Activities',
    keywords: 'excursion sight restaurant idea indoors outdoors opening hours priority',
    text: ['Collect ideas for excursions, sights and restaurants. With **indoors/outdoors** the day plan suggests suitable activities when it rains; opening hours are recognised from the text (e.g. “Tue–Sun 10–18”).']
  },
  abstimmungen: {
    title: 'Polls',
    keywords: 'vote decide choose majority survey',
    text: [
      'Ask a question – “What shall we do on Saturday?” – with answers, one per line, or with ideas from the activities. Everyone votes **on their own device**, and all see the result after syncing.',
      'With people & permissions everyone automatically votes as themselves. Without people you choose “I vote as …” on the device – so parents can vote for their children too.',
      'After “Close”, a winning activity can be scheduled with one tap.'
    ]
  },
  packliste: {
    title: 'Packing list',
    keywords: 'pack template person tick suggestions weather',
    text: [
      'The packing list exists for everyone together and **per person**. Templates (e.g. hiking, beach, baby) fill it quickly; suggestions take weather, accommodation and activities into account.',
      "With people & permissions a linked person's list is private – only they can see it."
    ]
  },
  apotheke: {
    title: 'First aid kit and vaccinations',
    keywords: 'medication schedule vaccination vaccination record health',
    text: ['Medication with schedule and supply, plus vaccinations with appointments. Recommended vaccinations from the travel advice can be taken over directly.']
  },
  dokumente: {
    title: 'Documents and emergency numbers',
    keywords: 'passport id card visa insurance emergency embassy phone',
    text: [
      'Travel documents with expiry date (passport, visa, insurance …) and emergency numbers. The app enters the German embassy and honorary consuls at the destination from the travel advice by itself.',
      'Your own documents can be shared specifically, e.g. an allergy card for your travel companions.'
    ]
  },
  reisehinweise: {
    title: 'Travel and safety advice',
    keywords: 'foreign office travel warning entry visa vaccination safety',
    text: ['For every destination country the app fetches the advice of the German Federal Foreign Office: safety, entry, vaccinations. It is checked daily when you open the trip – changes are highlighted. The advice is in German.']
  },
  termine: {
    title: 'Appointments, deadlines and calendar',
    keywords: 'reminder calendar subscription ics cancellation deadline',
    text: ['All appointments of the trip in one place: cancellation deadlines, check-in, departures, vaccinations. With the **calendar subscription** (own server) they appear in the calendar of your iPad, iPhone or Outlook and stay up to date.']
  },
  tagesplan: {
    title: 'Day plan and weather',
    keywords: 'today weather forecast rain plan suggestions',
    text: [
      'The day plan shows weather, plans and suitable suggestions for every day – more indoor ideas when it rains. **“Today”** in the bottom bar jumps straight into the current day of the running trip.',
      'The forecast covers about 16 days and stays stored for offline use.'
    ]
  },
  unwetter: {
    title: 'Severe weather warnings',
    keywords: 'thunderstorm storm heat warning meteoalarm severe weather',
    text: [
      "Official warnings of Europe's weather services (MeteoAlarm) for the trip locations: accommodation with a location on the map, the weather location of the day plan or otherwise the destination. Levels yellow, orange and red.",
      'From 7 days before the trip the app checks by itself. With notifications new warnings (orange and red) reach your device – even when the app is closed. Needs your own server.'
    ],
    links: ['Notifications']
  },
  karte: {
    title: 'Map and offline maps',
    keywords: 'map offline openstreetmap set location photos',
    text: [
      'The map shows accommodation, activities, routes and photos of the trip. Set locations via the address search or by tapping on the map.',
      "With your own server you can save the trip's map area **for offline use** – handy in the mountains or abroad without data."
    ]
  },
  routen: {
    title: 'Routes and tours',
    keywords: 'gpx fit kml garmin komoot hiking elevation profile plan track',
    text: ['Load tours as **GPX, Garmin FIT, TCX, KML/KMZ or GeoJSON** – with elevation profile, distance and ascent. With your own server you can search hiking trails and plan routes.']
  },
  ausgaben: {
    title: 'Expenses and settling up',
    keywords: 'money costs budget split settle currency exchange rate',
    text: ['Who paid what for whom? The app works out who owes whom how much – with as few transfers as possible. Foreign currencies are converted at the daily rate.']
  },
  tagebuch: {
    title: 'Travel journal, photos and voice notes',
    keywords: 'journal photos voice note draft highlight recording',
    text: [
      'Write a few lines every day and add photos – the app reads location and time from the photo. **“Draft from the day”** writes an outline from travel, weather, activities and tours.',
      "Quicker on the road: **record a voice note** or use the keyboard's dictation."
    ]
  },
  bericht: {
    title: 'Travel report and photo book (PDF)',
    keywords: 'pdf print photo book report',
    text: ['Journal, photos and tours become a report or a photo book as a PDF file – to share, or in print quality for a photo book service.']
  },
  webseite: {
    title: 'Trip website',
    keywords: 'website html template share',
    text: ['A single HTML file with texts, photos and maps – works without internet and can be sent or uploaded. Template, colours and font are selectable.']
  },
  leselinks: {
    title: 'Read-only links and inviting companions',
    keywords: 'share friends link password invite companions',
    text: ['A **read-only link** shows friends the journal (all or only highlights) – without the app, optionally with a password. Travel companions who should plan along are invited via *Share with travel companions* instead.']
  },
  piwigo: {
    title: 'Photos in Piwigo',
    keywords: 'piwigo gallery album upload',
    text: ['If a Piwigo gallery is connected to your own server, the app uploads the original photos into an album per trip; the journal keeps a smaller copy.']
  },
  abgleich: {
    title: 'Device sync (own server)',
    keywords: 'server sync phone tablet pc key group invite',
    text: [
      'For phones, tablet and PC to share the same data you need a small **own server** (e.g. on a Raspberry Pi or in a Proxmox container). The guide is in the project under *server/README.md*.',
      'Devices are connected with the group key or an invitation (code/QR). Sync then runs by itself: on start, after changes and every 5 minutes.',
      'Without a server, trips can also be exchanged **as a file** (Settings → Backup → export trip).'
    ],
    links: ['Device sync']
  },
  personen: {
    title: 'People and permissions',
    keywords: 'person role administrator member read only private password sign in',
    text: [
      'With people everyone signs in with name and password. Roles: **administrator**, **member** (edits everything) and **read only**; per trip also different, down to “no access”.',
      'If a participant of the trip is linked to an account, their packing list, medication, vaccinations and documents are private.'
    ],
    links: ['People & permissions']
  },
  benachrichtigungen: {
    title: 'Notifications',
    keywords: 'push notification reminder severe weather companions test message',
    text: [
      'Via your own server you get reminders of deadlines and appointments, severe weather warnings and, if you like, news from your travel companions – even when the app is closed. Turn on per device.',
      'On iPad and iPhone only for the installed app (home screen). Nothing arrives? “Send test message” and check the notification settings of the device for the app.'
    ],
    links: ['Notifications']
  },
  sicherung: {
    title: 'Backup and moving',
    keywords: 'backup restore export import new device move',
    text: [
      "The data belongs to the app's address in the browser. If you clear the browser storage or open the app at another address, you start empty – so **back up** now and then: *Settings → Backup* (with or without photos).",
      'With your own server every device has all the data, and the server can back itself up (backup targets).'
    ],
    links: ['Settings']
  },
  sperre: {
    title: 'App lock',
    keywords: 'code pin face id touch id lock',
    text: ['Protects the app with a code and optionally Face ID or Touch ID – sensible when passport and health data is stored.']
  },
  datenschutz: {
    title: 'Privacy',
    keywords: 'private data services advertising tracking',
    text: [
      'No sign-up, no ads, no tracking. Your data lives on your devices and – if you want – on your own server.',
      'For weather (Open-Meteo), maps (OpenStreetMap), travel advice (German Federal Foreign Office) and severe weather (MeteoAlarm) the app or your server only asks the free services for a location or country.'
    ]
  },
  aussehen: {
    title: 'Appearance and statistics',
    keywords: 'design colour font background dark statistics countries',
    text: ['Set design, background and font under *Settings → Appearance*. **Statistics** counts trips, countries, kilometres and records per year.']
  }
}

export const INTRO_SLIDES_EN: IntroSlide[] = [
  { icon: 'globe-europe-africa', title: 'Welcome to “Nix wie weg”', text: 'Your trip from the first idea via packing list and day plan to the journal and finished trip website – in one app.' },
  { icon: 'phone', title: 'Everything on your device', text: 'No sign-up, no ads. Your data stays with you and the app works without internet too – ideal on the road.' },
  { icon: 'signpost-2', title: 'Planning · On the road · Afterwards', text: 'Every trip has three tabs. The app always shows what matters right now: accommodation and packing list before, day plan, map and weather on the road, journal and photo book afterwards.' },
  { icon: 'people', title: 'Travel together', text: 'With a small server of your own, all travel companions share the same data, vote together and get reminders and weather warnings on their phones. Entirely optional – on your own everything works without.' },
  { icon: 'house-heart', title: 'Install as an app – and back up', text: 'Add the app to your home screen (Safari: Share → “Add to Home Screen”). And remember to back up now and then under Settings.' }
]
