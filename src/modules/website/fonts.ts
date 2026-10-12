/**
 * Mitgelieferte Schriften (Open Font License, über @fontsource, nur Zeichensatz „latin“ inkl. Umlaute).
 * Je Schrift normal (400) und fett (700). Im Export werden die Dateien in die HTML-Datei eingebettet.
 */
import { blobToDataUrl } from '@/services/images'
import type { FontChoice } from './types'
import lora400 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import lora700 from '@fontsource/lora/files/lora-latin-700-normal.woff2?url'
import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import playfair700 from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url'
import merri400 from '@fontsource/merriweather/files/merriweather-latin-400-normal.woff2?url'
import merri700 from '@fontsource/merriweather/files/merriweather-latin-700-normal.woff2?url'
import slab400 from '@fontsource/roboto-slab/files/roboto-slab-latin-400-normal.woff2?url'
import slab700 from '@fontsource/roboto-slab/files/roboto-slab-latin-700-normal.woff2?url'
import nunito400 from '@fontsource/nunito/files/nunito-latin-400-normal.woff2?url'
import nunito700 from '@fontsource/nunito/files/nunito-latin-700-normal.woff2?url'
import mont400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url'
import mont700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url'
import raleway400 from '@fontsource/raleway/files/raleway-latin-400-normal.woff2?url'
import raleway700 from '@fontsource/raleway/files/raleway-latin-700-normal.woff2?url'
import caveat400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url'
import caveat700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url'

interface FontFiles {
  family: string
  regular: string
  bold: string
}

const FILES: Partial<Record<FontChoice, FontFiles>> = {
  lora: { family: 'Lora', regular: lora400, bold: lora700 },
  playfair: { family: 'Playfair Display', regular: playfair400, bold: playfair700 },
  merriweather: { family: 'Merriweather', regular: merri400, bold: merri700 },
  robotoslab: { family: 'Roboto Slab', regular: slab400, bold: slab700 },
  nunito: { family: 'Nunito', regular: nunito400, bold: nunito700 },
  montserrat: { family: 'Montserrat', regular: mont400, bold: mont700 },
  raleway: { family: 'Raleway', regular: raleway400, bold: raleway700 },
  caveat: { family: 'Caveat', regular: caveat400, bold: caveat700 }
}

function faces(f: FontFiles, regular: string, bold: string): string {
  const face = (src: string, weight: number) =>
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${JSON.stringify(src)}) format('woff2');}`
  return face(regular, 400) + face(bold, 700)
}

/** @font-face mit Verweis auf die Dateien der App (Vorschau, Lese-Link). Leer für Geräteschriften. */
export function fontFaceCss(choice: FontChoice): string {
  const f = FILES[choice]
  return f ? faces(f, new URL(f.regular, document.baseURI).href, new URL(f.bold, document.baseURI).href) : ''
}

const cache = new Map<FontChoice, Promise<string>>()

/** @font-face mit eingebetteten Dateien – für die eigenständige HTML-Datei. */
export function embeddedFontCss(choice: FontChoice): Promise<string> {
  const f = FILES[choice]
  if (!f) return Promise.resolve('')
  if (!cache.has(choice)) {
    const load = async (url: string) => blobToDataUrl(await (await fetch(url)).blob())
    const p = Promise.all([load(f.regular), load(f.bold)])
      .then(([r, b]) => faces(f, r, b))
      .catch(() => {
        cache.delete(choice)
        return '' // offline und nicht im Speicher: Ersatzschrift aus der CSS-Liste
      })
    cache.set(choice, p)
  }
  return cache.get(choice)!
}
