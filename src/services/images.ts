/**
 * Bildverarbeitung im Browser: Fotos verkleinern, bevor sie gespeichert werden.
 * Spart Speicher auf dem Gerät (ein Handyfoto hat oft 3–6 MB, verkleinert ca. 0,3–0,6 MB).
 */

/** Große Fassung (lange Kante) – reicht für Vollbild und Webseite. */
export const FULL_EDGE = 2048
/** Vorschaubild (lange Kante). */
export const THUMB_EDGE = 480

/** Neue Größe, die in eine Kantenlänge passt (nie vergrößern). */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) return { width, height }
  const f = maxEdge / longest
  return { width: Math.round(width * f), height: Math.round(height * f) }
}

export interface ProcessedImage {
  full: Blob
  thumb: Blob
  width: number
  height: number
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  // createImageBitmap berücksichtigt die EXIF-Drehung (Hochformat-Fotos vom Handy)
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      /* Fallback unten */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw new Error('Dieses Bild kann nicht gelesen werden.')
  }
}

function render(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Zeichnen nicht möglich.'))
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht gespeichert werden.'))), 'image/jpeg', quality)
  )
}

/** Liest ein Foto, verkleinert es und erzeugt ein Vorschaubild (beides JPEG). */
export async function processImage(file: Blob): Promise<ProcessedImage> {
  const img = await decode(file)
  try {
    const full = fitWithin(img.width, img.height, FULL_EDGE)
    const thumb = fitWithin(img.width, img.height, THUMB_EDGE)
    const [fullBlob, thumbBlob] = await Promise.all([
      render(img.source, full.width, full.height, 0.85),
      render(img.source, thumb.width, thumb.height, 0.75)
    ])
    return { full: fullBlob, thumb: thumbBlob, width: full.width, height: full.height }
  } finally {
    img.close()
  }
}

/**
 * Verkleinert ein bereits gespeichertes Bild weiter (z. B. für die Webseite).
 * Ist es schon klein genug, wird es unverändert zurückgegeben.
 */
export async function resizeBlob(blob: Blob, maxEdge: number, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }> {
  const img = await decode(blob)
  try {
    const size = fitWithin(img.width, img.height, maxEdge)
    if (size.width === img.width && size.height === img.height && blob.type === 'image/jpeg') {
      return { blob, width: img.width, height: img.height }
    }
    return { blob: await render(img.source, size.width, size.height, quality), ...size }
  } finally {
    img.close()
  }
}

/**
 * Bild auf eine Größe bringen: mit `crop` genau auf das Seitenverhältnis w:h zuschneiden (Mitte, senkrecht nach `focusY`
 * 0 = oben … 100 = unten), sonst nur einpassen. Nie größer als das Original. Ergebnis JPEG.
 */
export async function fitBlob(blob: Blob, target: { w: number; h: number; crop: boolean; focusY?: number }, quality = 0.85): Promise<Blob> {
  const img = await decode(blob)
  try {
    let sx = 0
    let sy = 0
    let sw = img.width
    let sh = img.height
    if (target.crop) {
      const aspect = target.w / target.h
      if (sw / sh > aspect) {
        sw = sh * aspect
        sx = (img.width - sw) / 2
      } else {
        sh = sw / aspect
        sy = (img.height - sh) * Math.min(1, Math.max(0, (target.focusY ?? 50) / 100))
      }
    }
    const k = Math.min(1, target.w / sw, target.h / sh)
    const w = Math.max(1, Math.round(sw * k))
    const h = Math.max(1, Math.round(sh * k))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Zeichnen nicht möglich.')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.source, sx, sy, sw, sh, 0, 0, w, h)
    const out = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht gespeichert werden.'))), 'image/jpeg', quality)
    )
    canvas.width = canvas.height = 0 // Speicher sofort freigeben (iPad)
    return out
  } finally {
    img.close()
  }
}

/** Blob → data:-URL (zum Einbetten in eine HTML-Datei). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
