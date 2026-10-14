import { createECDH, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { KEY3, connect, localDate, seed, trip } from './helpers'

// Chromium im Test hat keinen echten Push-Dienst und meldet Benachrichtigungen ohne Fenster immer als „nicht erlaubt“:
// Erlaubnis und Abo des Browsers werden nachgebaut (gültige Schlüssel), der Klicktest-Server nimmt Nachrichten an „push.example“ an.
// Der Service Worker muss hier laufen (sonst gibt es kein pushManager)
test.use({ serviceWorkers: 'allow' })

test('Benachrichtigungen einschalten, Testnachricht, Erinnerungen planen, ausschalten', async ({ page }) => {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const fake = { endpoint: 'https://push.example/klicktest', p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }
  await page.addInitScript((f) => {
    let current: object | null = null
    // Erlaubnis bleibt über Neuladen hinweg bestehen (wie im echten Browser)
    Object.defineProperty(Notification, 'permission', { get: () => (sessionStorage.getItem('test-erlaubnis') ?? 'default') as NotificationPermission })
    Notification.requestPermission = async () => {
      sessionStorage.setItem('test-erlaubnis', 'granted')
      return 'granted'
    }
    const make = (key: ArrayBuffer | null) => ({
      endpoint: f.endpoint,
      options: { applicationServerKey: key, userVisibleOnly: true },
      toJSON: () => ({ endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }),
      unsubscribe: async () => ((current = null), true)
    })
    PushManager.prototype.subscribe = async function (opts?: PushSubscriptionOptionsInit) {
      const k = opts?.applicationServerKey
      current = make(k ? (new Uint8Array(k as ArrayBuffer).buffer as ArrayBuffer) : null)
      return current as PushSubscription
    }
    PushManager.prototype.getSubscription = async () => current as PushSubscription | null
  }, fake)

  // Eine Reise in 10 Tagen → Erinnerung am Vorabend
  await seed(page, { trips: [trip({ id: 'push1', title: 'Gardasee', startDate: localDate(10), endDate: localDate(14) })] })
  await connect(page, KEY3, 'Klicktest Push')

  await page.locator('[data-push-link]').getByRole('link').click()
  await expect(page.getByRole('heading', { name: 'Benachrichtigungen' })).toBeVisible()
  await expect(page.locator('[data-push-card]')).toContainText('Ausgeschaltet')
  // Nach dem Einschalten lädt die App den Zeitplan (wenige Sekunden später) hoch
  const zeitplan = page.waitForResponse((r) => r.url().endsWith('/api/benachrichtigungen/zeitplan') && r.request().method() === 'PUT', { timeout: 20_000 })
  await page.locator('[data-push-on]').click()
  await expect(page.getByText('Benachrichtigungen sind eingeschaltet')).toBeVisible()
  await expect(page.locator('[data-push-card]')).toContainText('Eingeschaltet')
  await expect(page.locator('#push-erinnerungen')).toBeChecked()
  await expect(page.locator('#push-aenderungen')).not.toBeChecked()

  await page.locator('[data-push-test]').click()
  await expect(page.getByText('Testnachricht ist unterwegs')).toBeVisible()

  await page.locator('#push-aenderungen').check()
  await expect(page.locator('#push-aenderungen')).toBeEnabled()

  expect(await (await zeitplan).json()).toMatchObject({ ok: true, geplant: 1 })
  await page.reload()
  await expect(page.locator('[data-push-card]')).toContainText('1 Erinnerung geplant')
  await expect(page.locator('#push-aenderungen')).toBeChecked()

  // Hinweis bei Termine & Fristen
  await page.goto('/#/trip/push1/termine')
  await expect(page.locator('[data-push-hint]')).toContainText('Benachrichtigungen sind an')

  await page.goto('/#/benachrichtigungen')
  await page.locator('[data-push-off]').click()
  await expect(page.locator('[data-push-card]')).toContainText('Ausgeschaltet')
  await page.goto('/#/abgleich')
  await expect(page.locator('[data-push-link]')).toContainText('Erinnerungen an Fristen und Termine')
})
