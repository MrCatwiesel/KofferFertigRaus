/**
 * Text aus einer PDF-Datei (Buchungsbestätigung, Fahrkarte) – mit pdf.js auf dem Gerät, ohne Upload.
 * Wird erst geladen, wenn eine PDF eingelesen wird (eigene Datei, ca. 1 MB, offline verfügbar).
 * „legacy“-Fassung: läuft auch auf etwas älteren iPads/Browsern.
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface Item {
  str: string
  transform: number[]
  hasEOL?: boolean
}

/** Textstücke einer Seite zu Zeilen zusammensetzen (nach Höhe, dann von links nach rechts) */
export function itemsToLines(items: Item[]): string[] {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = []
  for (const it of items) {
    if (!it.str.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) < 3)
    if (row) row.parts.push({ x, s: it.str })
    else rows.push({ y, parts: [{ x, s: it.str }] })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.s)
        .join(' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
    )
}

export async function pdfToText(bytes: Uint8Array, maxPages = 8): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise
  const pages: string[] = []
  try {
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      pages.push(itemsToLines(content.items as Item[]).join('\n'))
    }
  } finally {
    void doc.destroy()
  }
  const text = pages.join('\n\n').trim()
  if (!text) throw new Error('Die PDF enthält keinen lesbaren Text (vermutlich ein eingescanntes Bild).')
  return text
}
