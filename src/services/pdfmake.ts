/**
 * pdfmake mit Schriften laden (erst bei Bedarf – liegt trotzdem im Offline-Speicher).
 * Roboto enthält auch griechische und osteuropäische Zeichen; Lora nur lateinische.
 */
import loraRegular from '@fontsource/lora/files/lora-latin-400-normal.woff?inline'
import loraBold from '@fontsource/lora/files/lora-latin-700-normal.woff?inline'

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

export async function loadPdfMake() {
  const [{ default: pdfMake }, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  const vfs = { ...((fonts as unknown as { default?: Record<string, string> }).default ?? (fonts as unknown as Record<string, string>)) }
  vfs['Lora-Regular.woff'] = base64(loraRegular)
  vfs['Lora-Bold.woff'] = base64(loraBold)
  const fontDefs = {
    Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
    Lora: { normal: 'Lora-Regular.woff', bold: 'Lora-Bold.woff', italics: 'Lora-Regular.woff', bolditalics: 'Lora-Bold.woff' }
  }
  return { pdfMake, vfs, fontDefs }
}
