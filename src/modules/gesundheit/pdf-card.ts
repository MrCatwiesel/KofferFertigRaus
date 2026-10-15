import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { t } from '@/i18n'

/**
 * Notfallkarte zum Ausschneiden und Falten: je Person zwei Felder im Scheckkartenformat (85,6 × 54 mm) nebeneinander –
 * vorne die Landessprache, hinten die Sprache der App. Ohne Browser baubar (Test).
 */
export interface CardSide {
  /** BCP-47-Code (für die Überschrift „Deutsch“ usw.) */
  languageLabel: string
  rows: { text: string; strong: boolean }[]
  /** Kleiner Text unten (z. B. Medikamente, Hinweise) */
  extra: string[]
}
export interface PersonCard {
  name: string
  front: CardSide
  back: CardSide | null
}

const MM = 72 / 25.4
export const CARD_W = 85.6 * MM
export const CARD_H = 54 * MM
const PAD = 7

/** Größte Schrift, mit der der Text ins Feld passt (Schätzung über die mittlere Zeichenbreite) */
export function fitFontSize(texts: string[], width = CARD_W - 2 * PAD, height = CARD_H - 2 * PAD - 14): number {
  for (const s of [11, 10, 9, 8, 7.5, 7, 6.5, 6, 5.5]) {
    const perLine = Math.max(8, Math.floor(width / (s * 0.52)))
    const lines = texts.reduce((n, x) => n + Math.max(1, Math.ceil(x.length / perLine)), 0)
    if (lines * s * 1.22 <= height) return s
  }
  return 5
}

function side(name: string, s: CardSide): Content {
  const texts = [...s.rows.map((r) => r.text), ...s.extra]
  const size = fitFontSize(texts)
  return {
    stack: [
      {
        columns: [
          { text: name, bold: true, fontSize: 9, color: '#b02a37' },
          { text: s.languageLabel, fontSize: 6.5, color: '#6c757d', alignment: 'right' }
        ],
        margin: [0, 0, 0, 4]
      },
      ...s.rows.map((r): Content => ({ text: r.text, bold: r.strong, color: r.strong ? '#b02a37' : '#212529', fontSize: size, lineHeight: 1.1 })),
      ...s.extra.map((x): Content => ({ text: x, fontSize: Math.min(size, 7), color: '#495057', margin: [0, 2, 0, 0] }))
    ],
    margin: [PAD - 4, PAD - 4, PAD - 4, PAD - 4]
  }
}

export function buildCardDoc(cards: PersonCard[], title: string): TDocumentDefinitions {
  const blocks: Content[] = cards.map((c) => ({
    table: {
      widths: c.back ? [CARD_W - 8, CARD_W - 8] : [CARD_W - 8],
      heights: [CARD_H - 8],
      body: [c.back ? [side(c.name, c.front), side(c.name, c.back)] : [side(c.name, c.front)]]
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => '#adb5bd',
      vLineColor: () => '#adb5bd',
      hLineStyle: () => ({ dash: { length: 3, space: 2 } }),
      vLineStyle: () => ({ dash: { length: 3, space: 2 } }),
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0
    },
    unbreakable: true,
    margin: [0, 0, 0, 18]
  }))
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    info: { title },
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: title, fontSize: 14, bold: true, margin: [0, 0, 0, 4] },
      {
        text: t('Ausschneiden, in der Mitte falten und zum Ausweis stecken. Vorne die Landessprache, hinten zum Nachlesen.'),
        fontSize: 8.5,
        color: '#6c757d',
        margin: [0, 0, 0, 16]
      },
      ...blocks
    ]
  }
}

/** PDF im Browser erzeugen */
export async function createCardPdf(cards: PersonCard[], title: string): Promise<Blob> {
  const { loadPdfMake } = await import('@/services/pdfmake')
  const { pdfMake, vfs, fontDefs } = await loadPdfMake()
  const def = buildCardDoc(cards, title)
  return new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(def, undefined, fontDefs, vfs).getBlob(resolve)
    } catch (e) {
      reject(e)
    }
  })
}
