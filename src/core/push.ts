/**
 * Push-Benachrichtigungen über den eigenen Server (Web Push).
 * Dieses Gerät abonniert beim Push-Dienst des Browsers (Apple, Google, Mozilla) und meldet das Abo beim Server an.
 * Der Server schickt dann Erinnerungen (Fristen, Termine) und – wenn gewünscht – Änderungen anderer.
 * Den Zeitplan der Erinnerungen lädt das Modul „Termine“ hoch (es kennt die Termine aller Module).
 */
import { reactive } from 'vue'
import { getMeta, setMeta } from './meta'
import { ServerClient } from './sync/client'

export interface PushPrefs {
  erinnerungen: boolean
  aenderungen: boolean
  /** Unwetterwarnungen (ab Server 1.19) */
  unwetter?: boolean
  /** ab Stufe 2 gelb, 3 orange, 4 rot */
  unwetterStufe?: 2 | 3 | 4
}

/** Antwort von GET /api/benachrichtigungen */
export interface PushStatus {
  publicKey: string
  abo: { endpointHost: string; prefs: PushPrefs; created: string; lastOk: string | null; lastError: string | null } | null
  geplant: number
  naechste: string | null
  /** Geräte dieser Person mit eingeschalteten Erinnerungen */
  geraete: number
}

export type PushSupport = 'ok' | 'ios-installieren' | 'browser' | 'unsicher'

const META_ACTIVE = 'push.aktiv'

export const pushState = reactive({
  /** Auf diesem Gerät eingeschaltet (und beim Server angemeldet) */
  active: false,
  /** Die Person hat irgendwo Erinnerungen eingeschaltet → Zeitplan aktuell halten */
  scheduleWanted: false,
  status: null as PushStatus | null
})

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Kann dieses Gerät Push-Benachrichtigungen bekommen? */
export function pushSupport(): PushSupport {
  if (!globalThis.isSecureContext) return 'unsicher'
  // iPad/iPhone: nur als installierte App (Home-Bildschirm), ab iOS 16.4
  if (isIos() && !standalone()) return 'ios-installieren'
  if (!('serviceWorker' in navigator) || !('PushManager' in globalThis) || !('Notification' in globalThis)) return 'browser'
  return 'ok'
}

export const permission = (): NotificationPermission | 'unbekannt' => ('Notification' in globalThis ? Notification.permission : 'unbekannt')

/** Server-Schlüssel (base64url) → Bytes für pushManager.subscribe */
export function keyBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

const sameKey = (sub: PushSubscription, key: string) => {
  const k = sub.options.applicationServerKey
  if (!k) return false
  const a = new Uint8Array(k)
  const b = keyBytes(key)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function client(): Promise<ServerClient> {
  const c = await ServerClient.fromSync()
  if (!c) throw new Error('Dafür muss der Geräte-Abgleich mit dem eigenen Server eingerichtet sein.')
  return c
}

/** Stand vom Server holen; null = Server kennt keine Benachrichtigungen (älter als 1.17) */
export async function loadPushStatus(): Promise<PushStatus | null> {
  const c = await client()
  try {
    pushState.status = await c.json<PushStatus>('/api/benachrichtigungen')
  } catch (e) {
    if ((e as { status?: number }).status === 404) return (pushState.status = null)
    throw e
  }
  pushState.scheduleWanted = pushState.status.geraete > 0
  // Abo auf dem Server verschwunden (z. B. Push-Dienst meldete „weg“) → hier auch aus
  if (pushState.active && !pushState.status.abo) await setActive(false)
  return pushState.status
}

async function setActive(on: boolean) {
  pushState.active = on
  await setMeta(META_ACTIVE, on)
}

/** Service Worker der App – wartet höchstens 10 Sekunden (ohne ihn gibt es keine Benachrichtigungen) */
async function swReady(): Promise<ServiceWorkerRegistration> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Der Hintergrunddienst der App läuft noch nicht – bitte die App einmal schließen und neu öffnen.')), 10_000)
  })
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function subscribe(publicKey: string): Promise<PushSubscription> {
  const reg = await swReady()
  let sub = await reg.pushManager.getSubscription()
  // Neuer Server (anderer Schlüssel) → altes Abo kündigen
  if (sub && !sameKey(sub, publicKey)) {
    await sub.unsubscribe().catch(() => false)
    sub = null
  }
  return sub ?? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource })
}

async function register(sub: PushSubscription, prefs?: Partial<PushPrefs>) {
  const json = sub.toJSON()
  await (await client()).json('/api/benachrichtigungen/abo', 'PUT', { endpoint: json.endpoint, keys: json.keys, prefs })
}

/**
 * Einschalten – direkt im Klick aufrufen: Safari fragt nur nach der Erlaubnis, wenn das ohne Umweg aus dem Tippen kommt.
 * `publicKey` vorher mit loadPushStatus() holen.
 */
export async function enablePush(publicKey: string, prefs?: Partial<PushPrefs>): Promise<void> {
  const answer = await Notification.requestPermission()
  if (answer !== 'granted') throw new Error(answer === 'denied' ? 'Benachrichtigungen sind für die App nicht erlaubt.' : 'Keine Erlaubnis erteilt.')
  const sub = await subscribe(publicKey)
  await register(sub, prefs)
  await setActive(true)
  await loadPushStatus()
}

export async function disablePush(): Promise<void> {
  try {
    const sub = await (await swReady()).pushManager.getSubscription()
    await sub?.unsubscribe()
  } catch {
    /* Browser-Abo schon weg */
  }
  await (await client()).json('/api/benachrichtigungen/abo', 'DELETE')
  await setActive(false)
  await loadPushStatus()
}

export async function setPushPrefs(prefs: Partial<PushPrefs>): Promise<void> {
  await (await client()).json('/api/benachrichtigungen/abo', 'PATCH', { prefs })
  await loadPushStatus()
}

export async function sendTestPush(): Promise<void> {
  await (await client()).json('/api/benachrichtigungen/test', 'POST')
}

/** Beim Start: Abo prüfen (Browser kann es erneuert haben) und dem Server melden; Stand holen */
export async function startPush(): Promise<void> {
  // Antippen einer Benachrichtigung bei offener App: an die Stelle springen
  navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
    const url = e.data?.type === 'nww-open' ? String(e.data.url ?? '') : ''
    if (url.startsWith('#/')) location.hash = url.slice(1)
  })
  pushState.active = await getMeta(META_ACTIVE, false)
  if (!(await ServerClient.fromSync())) return
  try {
    const status = await loadPushStatus()
    if (!status || !pushState.active) return
    if (pushSupport() !== 'ok' || permission() !== 'granted') {
      // Erlaubnis in den Einstellungen des Geräts entzogen
      await (await client()).json('/api/benachrichtigungen/abo', 'DELETE').catch(() => null)
      await setActive(false)
      return
    }
    await register(await subscribe(status.publicKey))
  } catch {
    /* offline oder Server nicht erreichbar – beim nächsten Start wieder */
  }
}
