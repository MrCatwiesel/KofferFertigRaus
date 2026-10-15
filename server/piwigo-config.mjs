/**
 * Piwigo-Zugang des Servers: aus den Server-Einstellungen (NWW_PIWIGO_*) oder – vorrangig –
 * in der App vom Besitzer eingetragen (Tabelle `settings`, Schlüssel `piwigo`).
 *
 * Das Geheimnis des API-Schlüssels verlässt den Server nie: die App bekommt nur `hasSecret`.
 * Neue Zugangsdaten werden erst gespeichert, wenn die Anmeldung bei Piwigo klappt.
 */
import { HttpError } from './http.mjs'
import { createPiwigoClient } from './piwigo.mjs'

const KEY = 'piwigo'
const KEY_ID_RE = /^pkid-\d{8}-[a-z0-9]{20}$/i

/** Adresse prüfen und vereinheitlichen (http/https, ohne / am Ende) – leer erlaubt, wenn optional */
export function cleanUrl(value, { optional = false } = {}) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) {
    if (optional) return ''
    throw new HttpError(400, 'Piwigo-Adresse fehlt.')
  }
  let u
  try {
    u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `http://${s}`)
  } catch {
    throw new HttpError(400, 'Die Adresse ist ungültig.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new HttpError(400, 'Die Adresse muss mit http:// oder https:// beginnen.')
  if (u.username || u.password) throw new HttpError(400, 'Die Adresse darf keinen Benutzernamen enthalten.')
  u.hash = ''
  u.search = ''
  return u.href.replace(/\/+$/, '')
}

/**
 * @param {{ getSetting: (k: string) => any, putSetting: (k: string, v: any) => void }} store
 * @param {{ url: string, keyId: string, secret: string, publicUrl?: string } | null | undefined} fromEnv
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export function createPiwigoConfig(store, fromEnv, opts = {}) {
  const env = fromEnv?.url ? { url: fromEnv.url, keyId: fromEnv.keyId ?? '', secret: fromEnv.secret ?? '', publicUrl: fromEnv.publicUrl ?? '' } : null
  const timeoutMs = opts.timeoutMs ?? 10_000
  const build = (c) => createPiwigoClient({ ...c, publicUrl: c.publicUrl || undefined, fetchImpl: opts.fetchImpl })

  /** Aktuell gültige Zugangsdaten und woher sie stammen */
  function config() {
    const saved = store.getSetting(KEY)
    if (saved?.url) return { ...saved, source: 'app' }
    if (env) return { ...env, source: 'env' }
    return null
  }

  let current = config()
  // Fest eingetragene Werte prüfen wie bisher beim Start (falscher Schlüssel → klarer Fehler)
  let client = current ? build(current) : null

  /** Mit Zeitgrenze, damit eine falsche Adresse die App nicht hängen lässt */
  async function withTimeout(promise) {
    let timer
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => (timer = setTimeout(() => reject(new HttpError(504, 'Piwigo antwortet nicht – Adresse prüfen.')), timeoutMs)))
      ])
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    /** Piwigo-Brücke (oder null ohne Einrichtung) */
    client: () => client,

    /** Für die App: ohne Geheimnis, mit Prüfung der Anmeldung */
    async describe() {
      const c = current
      const out = {
        configured: !!c,
        source: c?.source ?? 'none',
        url: c?.url ?? '',
        publicUrl: c?.publicUrl ?? '',
        keyId: c?.keyId ?? '',
        hasSecret: !!c?.secret,
        envAvailable: !!env,
        status: null,
        error: ''
      }
      if (client) {
        try {
          out.status = await withTimeout(client.status())
        } catch (e) {
          out.error = e?.message ?? String(e)
        }
      }
      return out
    },

    /** Neue Zugangsdaten: prüfen, anmelden, erst dann speichern. Leeres Geheimnis = bisheriges behalten */
    async save(body) {
      const url = cleanUrl(body?.url)
      const publicUrl = cleanUrl(body?.publicUrl, { optional: true })
      const keyId = typeof body?.keyId === 'string' ? body.keyId.trim() : ''
      if (!KEY_ID_RE.test(keyId)) throw new HttpError(400, 'Die Schlüssel-ID hat die Form pkid-JJJJMMTT-… (Piwigo → Profil → API-Schlüssel).')
      const secret = typeof body?.secret === 'string' && body.secret.trim() ? body.secret.trim() : (current?.secret ?? '')
      if (!secret) throw new HttpError(400, 'Das Geheimnis des API-Schlüssels fehlt.')
      const next = { url, publicUrl, keyId, secret }
      const candidate = build(next)
      let status
      try {
        status = await withTimeout(candidate.status())
      } catch (e) {
        throw new HttpError(400, 'Nicht gespeichert – die Anmeldung bei Piwigo klappt mit diesen Angaben nicht.', { detail: e?.message ?? String(e) })
      }
      store.putSetting(KEY, next)
      current = { ...next, source: 'app' }
      client = candidate
      return status
    },

    /** In der App eingetragene Werte löschen → wieder die aus den Server-Einstellungen (oder ohne Piwigo) */
    reset() {
      store.putSetting(KEY, null)
      current = config()
      client = current ? build(current) : null
    }
  }
}
