/**
 * Eine fertige Datei weitergeben. Direkt im Klick aufrufen (ohne vorheriges Warten),
 * sonst verweigert Safari das Teilen-Menü.
 */
/** Datei teilen (iPad: AirDrop, Nachrichten, „In Dateien sichern“) – sonst herunterladen */
export async function shareOrDownload(file: File): Promise<'geteilt' | 'heruntergeladen' | 'abgebrochen'> {
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: file.name })
      return 'geteilt'
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'abgebrochen'
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'heruntergeladen'
}

/** Titel → Dateiname ohne Umlaute (Chrome verwirft Download-Namen mit ß/ä sonst ganz und nennt die Datei „download“) */
export function fileSlug(title: string, fallback = 'reise'): string {
  return (
    title
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  )
}
