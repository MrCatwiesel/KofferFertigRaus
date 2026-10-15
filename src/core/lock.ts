/**
 * App-Sperre je Gerät: Code (PIN) und optional Face ID / Touch ID / Fingerabdruck (WebAuthn, Plattform-Authentifikator).
 *
 * Schutz vor neugierigen Blicken (z. B. iPad liegt herum) – die Daten selbst sind auf dem Gerät nicht verschlüsselt.
 * Gespeichert in localStorage dieses Geräts (wird nicht abgeglichen): Salz + PBKDF2-Prüfwert des Codes, Kennung des Schlüssels.
 */
import { reactive } from 'vue'
import { t } from '@/i18n'

const KEY = 'nww-sperre'
const ITERATIONS = 150_000

export interface LockConfig {
  salt: string
  hash: string
  iterations: number
  /** Stellen des Codes (für automatisches Prüfen nach der letzten Ziffer) */
  length: number
  /** Kennung des Face-ID-/Fingerabdruck-Schlüssels (base64url) */
  credentialId: string | null
  /** Sperren nach so vielen Minuten im Hintergrund/ohne Bedienung; 0 = sofort beim Verlassen */
  timeoutMin: number
}

interface Attempts {
  count: number
  until: number
}

export const LOCK_TIMEOUTS = [
  { min: 0, label: t('Sofort beim Verlassen der App') },
  { min: 1, label: t('Nach 1 Minute') },
  { min: 5, label: t('Nach {n} Minuten', { n: 5 }) },
  { min: 15, label: t('Nach {n} Minuten', { n: 15 }) },
  { min: 60, label: t('Nach 1 Stunde') }
]

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

function readConfig(): LockConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as LockConfig | null
    return c && c.salt && c.hash ? c : null
  } catch {
    return null
  }
}
function writeConfig(c: LockConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c))
    else localStorage.removeItem(KEY)
  } catch {
    /* privater Modus */
  }
}

export const lock = reactive({
  enabled: !!readConfig(),
  /** Beim Start gesperrt, wenn eingerichtet */
  locked: !!readConfig(),
  biometric: !!readConfig()?.credentialId,
  timeoutMin: readConfig()?.timeoutMin ?? 1,
  length: readConfig()?.length ?? 4,
  /** Wartezeit nach zu vielen Fehlversuchen (ms seit 1970) */
  blockedUntil: 0
})

/** Code prüfen bzw. Prüfwert erzeugen (PBKDF2-SHA-256) */
export async function pinHash(pin: string, salt: Uint8Array, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return b64(bits)
}

export const validPin = (pin: string) => /^\d{4,8}$/.test(pin)

/** Sperre einrichten oder Code ändern */
export async function setPin(pin: string, timeoutMin = lock.timeoutMin): Promise<void> {
  if (!validPin(pin)) throw new Error(t('Der Code braucht 4 bis 8 Ziffern.'))
  const salt = random(16)
  const old = readConfig()
  writeConfig({ salt: b64(salt), hash: await pinHash(pin, salt), iterations: ITERATIONS, length: pin.length, credentialId: old?.credentialId ?? null, timeoutMin })
  Object.assign(lock, { enabled: true, locked: false, length: pin.length, timeoutMin, biometric: !!old?.credentialId })
}

function attempts(): Attempts {
  try {
    return JSON.parse(localStorage.getItem(`${KEY}.versuche`) ?? '{"count":0,"until":0}') as Attempts
  } catch {
    return { count: 0, until: 0 }
  }
}
function saveAttempts(a: Attempts) {
  try {
    localStorage.setItem(`${KEY}.versuche`, JSON.stringify(a))
  } catch {
    /* egal */
  }
  lock.blockedUntil = a.until
}

/** Wartezeit nach Fehlversuchen: ab dem 5. Fehlversuch 30 s, danach jeweils doppelt so lang (max. 1 h) */
export function backoffMs(failures: number): number {
  return failures < 5 ? 0 : Math.min(3600_000, 30_000 * 2 ** (failures - 5))
}

/** Code prüfen; bei Erfolg entsperren */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const c = readConfig()
  if (!c) return true
  const a = attempts()
  if (Date.now() < a.until) return false
  const ok = (await pinHash(pin, unb64(c.salt), c.iterations)) === c.hash
  if (ok) {
    saveAttempts({ count: 0, until: 0 })
    unlock()
  } else {
    const count = a.count + 1
    const wait = backoffMs(count)
    saveAttempts({ count, until: wait ? Date.now() + wait : 0 })
  }
  return ok
}

/** Kann dieses Gerät Face ID / Touch ID / Fingerabdruck für Webseiten? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Face ID / Touch ID einrichten (legt auf dem Gerät einen Schlüssel nur für diese App an) */
export async function enableBiometric(): Promise<void> {
  const c = readConfig()
  if (!c) throw new Error(t('Zuerst einen Code festlegen.'))
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'KofferFertigRaus', id: location.hostname },
      user: { id: random(16), name: 'koffer-fertig-raus', displayName: t('KofferFertigRaus – App-Sperre') },
      challenge: random(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none'
    }
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Abgebrochen.')
  writeConfig({ ...c, credentialId: b64(cred.rawId) })
  lock.biometric = true
}

export function disableBiometric(): void {
  const c = readConfig()
  if (c) writeConfig({ ...c, credentialId: null })
  lock.biometric = false
}

/** Mit Face ID / Touch ID entsperren (muss durch Antippen ausgelöst werden) */
export async function unlockWithBiometric(): Promise<boolean> {
  const c = readConfig()
  if (!c?.credentialId) return false
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: random(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64(c.credentialId) }],
        userVerification: 'required',
        timeout: 60_000
      }
    })
    if (!res) return false
    saveAttempts({ count: 0, until: 0 })
    unlock()
    return true
  } catch {
    return false
  }
}

export function setLockTimeout(min: number): void {
  const c = readConfig()
  if (c) writeConfig({ ...c, timeoutMin: min })
  lock.timeoutMin = min
}

/** Sperre ganz aufheben (nur mit richtigem Code) */
export async function removeLock(pin: string): Promise<boolean> {
  const c = readConfig()
  if (!c) return true
  if ((await pinHash(pin, unb64(c.salt), c.iterations)) !== c.hash) return false
  writeConfig(null)
  Object.assign(lock, { enabled: false, locked: false, biometric: false })
  return true
}

let lastActive = Date.now()
function unlock() {
  lock.locked = false
  lastActive = Date.now()
}
export function lockNow(): void {
  if (lock.enabled) lock.locked = true
}

/** Beobachtet Bedienung und Hintergrund – sperrt nach der eingestellten Zeit */
export function startLock(): void {
  lock.blockedUntil = attempts().until
  const touch = () => {
    if (!lock.locked) lastActive = Date.now()
  }
  for (const ev of ['pointerdown', 'keydown', 'scroll'] as const) window.addEventListener(ev, touch, { passive: true, capture: true })
  document.addEventListener('visibilitychange', () => {
    if (!lock.enabled) return
    if (document.visibilityState === 'hidden') {
      // „sofort“: schon beim Verlassen sperren – dann zeigt auch der App-Umschalter nur die Sperre
      if (lock.timeoutMin === 0) lock.locked = true
      else lastActive = Math.min(lastActive, Date.now())
    } else if (Date.now() - lastActive > lock.timeoutMin * 60_000) lock.locked = true
  })
  setInterval(() => {
    if (lock.enabled && !lock.locked && lock.timeoutMin > 0 && Date.now() - lastActive > lock.timeoutMin * 60_000) lock.locked = true
  }, 15_000)
}
