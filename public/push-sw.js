/* Nix wie weg – Push-Benachrichtigungen im Service Worker (per importScripts in den Workbox-Service-Worker geladen).
 * Der Server schickt verschlüsselt { title, body, url, tag }; der Browser entschlüsselt, hier wird nur angezeigt. */

self.addEventListener('push', (event) => {
  let msg = {}
  try {
    msg = event.data ? event.data.json() : {}
  } catch {
    msg = { body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Nix wie weg', {
      body: msg.body || '',
      tag: msg.tag || undefined,
      icon: `${scope}icon.svg`,
      badge: `${scope}icon.svg`,
      lang: 'de',
      data: { url: typeof msg.url === 'string' && msg.url.startsWith('#/') ? msg.url : '#/' }
    })
  )
})

// Antippen: offene App nach vorn holen und an die passende Stelle springen – sonst App öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '#/', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      const win = list.find((c) => c.url.startsWith(self.registration.scope))
      if (win) {
        // Die App wechselt selbst an die Stelle (ohne neu zu laden)
        win.postMessage({ type: 'nww-open', url: event.notification.data?.url || '#/' })
        return win.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
