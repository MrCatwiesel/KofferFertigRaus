/**
 * PDF-Datei im Browser erzeugen (pdfmake, erst bei Bedarf geladen – liegt trotzdem im Offline-Speicher).
 * Fotos werden einzeln zugeschnitten und verkleinert, damit auch ein Fotobuch mit 150 Fotos auf dem iPad gelingt.
 */
import { blobToDataUrl, fitBlob } from '@/services/images'
import { buildPdfDoc, collectImages, type ImageRequest, type PdfInput } from './pdf-doc'
import { pixelsFor } from './pdf-layout'
import { loadPdfMake } from '@/services/pdfmake'

export interface PdfProgress {
  step: 'fotos' | 'pdf'
  done: number
  total: number
}

/**
 * Erzeugt die PDF-Datei. `photoBlob(id)` liefert das Foto in voller Größe (bzw. „cover“ das Titelbild der Reise).
 */
export async function createPdf(input: PdfInput, photoBlob: (id: string) => Blob | null | undefined, onProgress?: (p: PdfProgress) => void): Promise<Blob> {
  const lib = loadPdfMake()
  const dpi = input.options.quality === 'druck' ? 300 : 150
  const requests = collectImages(input)
  const images = new Map<string, string>()
  let done = 0
  onProgress?.({ step: 'fotos', done, total: requests.length })
  for (const r of requests) {
    images.set(r.key, await prepare(r, photoBlob(r.id), dpi))
    onProgress?.({ step: 'fotos', done: ++done, total: requests.length })
  }
  onProgress?.({ step: 'pdf', done: 0, total: 1 })
  const { pdfMake, vfs, fontDefs } = await lib
  const def = buildPdfDoc(input, (r) => images.get(r.key) ?? WHITE)
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(def, undefined, fontDefs, vfs).getBlob(resolve)
    } catch (e) {
      reject(e)
    }
  })
  onProgress?.({ step: 'pdf', done: 1, total: 1 })
  return blob
}

/** Weiß, falls ein Foto fehlt (z. B. nur in Piwigo) – das PDF entsteht trotzdem */
const WHITE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

async function prepare(r: ImageRequest, blob: Blob | null | undefined, dpi: number): Promise<string> {
  if (!blob) return WHITE
  const px = pixelsFor(r, dpi, r.source)
  try {
    return await blobToDataUrl(await fitBlob(blob, { w: px.w, h: px.h, crop: r.crop, focusY: r.focusY }, dpi >= 300 ? 0.9 : 0.82))
  } catch {
    return WHITE
  }
}
