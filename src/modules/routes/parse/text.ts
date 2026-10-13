/**
 * Text aus Routendateien lesen – auch wenn sie nicht als UTF-8 gespeichert sind.
 * Manche Programme schreiben GPX/KML als ISO-8859-1 bzw. Windows-1252 („Großglockner“ würde sonst zu „Gro�glockner“).
 * Reihenfolge: Byte-Order-Mark → Angabe im XML-Kopf (encoding="…") → UTF-8, wenn gültig → Windows-1252.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  // XML-Kopf ist immer ASCII-lesbar
  const head = String.fromCharCode(...bytes.subarray(0, 200))
  const declared = /^\s*<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/i.exec(head)?.[1]
  if (declared && !/^utf-?8$/i.test(declared)) {
    try {
      return new TextDecoder(declared.toLowerCase()).decode(bytes)
    } catch {
      /* unbekannte Angabe – weiter unten raten */
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Kein gültiges UTF-8 (z. B. trotz falscher Angabe im Kopf) → westeuropäische Kodierung
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Kaputt eingelesener Name (mit �) passt zu einem richtig gelesenen? Jedes � steht für ein oder mehrere Zeichen. */
export function matchesGarbled(garbled: string, candidate: string): boolean {
  if (!garbled.includes('�')) return false
  const re = new RegExp(`^${garbled.split('�').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.{1,2}')}$`, 's')
  return re.test(candidate)
}
