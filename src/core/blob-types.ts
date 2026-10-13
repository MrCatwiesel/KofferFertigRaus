/**
 * Erlaubte Dateiarten für Dateien, die von anderen Geräten oder aus Sicherungen kommen.
 * Alles andere wird zu „application/octet-stream“ – so kann keine eingeschleuste „Datei“ als Webseite
 * mit Skript unter der Adresse der App geöffnet werden.
 */
const SAFE = /^(image\/(jpeg|png|webp|gif|avif|heic|heif)|audio\/(mp4|mpeg|webm|ogg|aac|x-m4a|wav)|video\/(mp4|quicktime|webm)|application\/(pdf|gpx\+xml|vnd\.google-earth\.kml\+xml|vnd\.google-earth\.kmz|geo\+json|json|octet-stream)|text\/(plain|calendar|csv))$/

export function safeBlobType(t: string | undefined | null): string {
  const type = String(t ?? '').split(';')[0].trim().toLowerCase()
  return SAFE.test(type) ? type : 'application/octet-stream'
}

/** Darf direkt im Browser angezeigt werden (Bild, PDF) – sonst nur herunterladen */
export function isViewable(t: string): boolean {
  return /^image\//.test(t) || t === 'application/pdf'
}
