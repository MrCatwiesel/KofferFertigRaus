/** Läuft die App als installierte App (Home-Bildschirm) statt im Browser-Tab? */
export function isStandalone(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/** iPad, iPhone oder iPod (iPadOS meldet sich als Mac – dann am Touchscreen erkennen) */
export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

export type InstallHint = 'ios' | 'android' | 'desktop' | 'installiert'

/** Welche Anleitung zum Installieren passt zu diesem Gerät? */
export function installHint(): InstallHint {
  if (isStandalone()) return 'installiert'
  if (isIos()) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
}
