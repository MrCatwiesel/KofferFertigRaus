/**
 * Betrachter-Seite für Lese-Links (/s/<code>): holt die freigegebenen Inhalte vom eigenen Server
 * und zeichnet sie mit den Vorlagen der Reise-Webseite. Keine App, kein Schlüssel, nur lesen.
 */
import bootstrapCssRaw from 'bootstrap/dist/css/bootstrap.min.css?raw'
import {
  buildSiteData,
  defaultSettings,
  esc,
  fontFaceCss,
  renderSite,
  type ActivityInput,
  type FontChoice,
  type RouteInput,
  type StayInput,
  type TemplateId
} from '@/modules/website/public'

interface PublicPhoto {
  id: string
  width: number
  height: number
  caption: string
}
interface PublicData {
  title: string
  subtitle: string
  intro: string
  author: string
  trip: { destination: string; startDate: string; endDate: string }
  look: { template: TemplateId; accent: string; font: FontChoice; dark: boolean; showMood: boolean; showLocation: boolean }
  entries: { date: string; title: string; text: string; mood: number; location: string; highlight: boolean; createdAt: string; photos: PublicPhoto[] }[]
  routes?: RouteInput[]
  stays?: StayInput[]
  activities?: ActivityInput[]
  ticket: string
}

const view = document.getElementById('view')!
const token = location.pathname.match(/\/s\/([A-Za-z0-9_-]{22})$/)?.[1] ?? ''
const api = (path = '') => new URL(`api/public/${token}${path}`, document.baseURI).href
const bootstrapCss = bootstrapCssRaw.replace(/\/\*# sourceMappingURL=.*?\*\//g, '')

function message(title: string, text: string) {
  view.innerHTML = `<h1>${esc(title)}</h1><p>${esc(text)}</p>`
}

function askPassword(wrong: boolean) {
  view.innerHTML = `
    <h1>Diese Reise ist geschützt</h1>
    <p${wrong ? ' class="err"' : ''}>${wrong ? 'Das Passwort stimmt nicht.' : 'Bitte das Passwort eingeben, das du bekommen hast.'}</p>
    <form><input type="password" autocomplete="current-password" aria-label="Passwort" required autofocus><button type="submit">Ansehen</button></form>`
  view.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault()
    const pw = view.querySelector('input')!.value
    try {
      sessionStorage.setItem(`nww-pw-${token}`, pw)
    } catch {
      /* privates Fenster */
    }
    void load(pw)
  })
}

function show(data: PublicData) {
  const photoUrl = (p: PublicPhoto) => api(`/photo/${encodeURIComponent(p.id)}${data.ticket ? `?t=${encodeURIComponent(data.ticket)}` : ''}`)
  const settings = {
    ...defaultSettings({ title: data.title, destination: data.trip.destination, startDate: data.trip.startDate, endDate: data.trip.endDate }),
    ...data.look,
    title: data.title,
    subtitle: data.subtitle,
    intro: data.intro,
    author: data.author,
    onlyHighlights: false, // Auswahl hat der Server schon getroffen
    showPhotos: true,
    showRoutes: true,
    showStays: true,
    showStayDetails: true, // Adresse/Link schickt der Server nur, wenn freigegeben
    showActivities: true,
    showParticipants: false
  }
  const site = buildSiteData(
    data.trip,
    settings,
    data.entries.map((e) => ({ ...e, photos: e.photos.map((p) => ({ src: photoUrl(p), caption: p.caption, width: p.width, height: p.height })) })),
    undefined,
    data.routes ?? [],
    { stays: data.stays ?? [], activities: data.activities ?? [] }
  )
  const html = renderSite(site, settings, bootstrapCss, fontFaceCss(settings.font))
    // Lese-Links nicht in Suchmaschinen
    .replace('<meta name="generator"', '<meta name="robots" content="noindex, nofollow">\n<meta name="generator"')
  document.open()
  document.write(html)
  document.close()
}

async function load(password = '') {
  if (!token) return message('Link unvollständig', 'Bitte den ganzen Link öffnen, so wie du ihn bekommen hast.')
  let res: Response
  try {
    res = await fetch(api(), { headers: password ? { 'X-Share-Password': password } : {}, cache: 'no-store' })
  } catch {
    return message('Keine Verbindung', 'Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.')
  }
  const body = await res.json().catch(() => ({}))
  if (res.ok) return show(body as PublicData)
  if (res.status === 401 && body.needPassword) return askPassword(!!password)
  if (res.status === 410) return message('Nicht mehr verfügbar', body.error ?? 'Dieser Link gilt nicht mehr.')
  if (res.status === 429) return message('Kurz warten', body.error ?? 'Zu viele Versuche.')
  return message('Nicht gefunden', 'Diesen Link gibt es nicht (mehr).')
}

let saved = ''
try {
  saved = sessionStorage.getItem(`nww-pw-${token}`) ?? ''
} catch {
  /* privates Fenster */
}
void load(saved)
