import { t } from '@/i18n'
/**
 * Designs der App – reine Daten, ohne DOM (testbar, z. B. Kontrast aller Farben).
 *
 * Jedes Design hat eine helle und eine dunkle Farbpalette, Schriften, Formen, ein Hintergrundmuster und ein Logo.
 * `themeVars()` macht daraus CSS-Variablen, die app-weit gelten (siehe theme.css).
 * Neues Design: unten in THEMES eintragen – der Test prüft automatisch, ob alle Texte gut lesbar sind.
 */

export interface Palette {
  primary: string
  /** Schrift auf der Hauptfarbe (Knöpfe) */
  onPrimary: string
  accent: string
  /** Sonne im gezeichneten Titelbild (Standard: accent) */
  sun?: string
  bg: string
  surface: string
  surface2: string
  text: string
  muted: string
  border: string
  /** Gezeichnete Landschaft: Himmel unten/oben, Bergketten fern → nah */
  sky1: string
  sky2: string
  far: string
  mid: string
  near: string
}

export type PatternKind = 'topo' | 'blobs' | 'sunburst' | 'waves' | 'dots' | 'paper' | 'grid' | 'stars' | 'aurora' | 'none'
export type LogoKind = 'berg' | 'pin' | 'stempel' | 'kompass'
export type TileKind = 'soft' | 'gradient' | 'solid' | 'outline'
export type ShadowKind = 'soft' | 'float' | 'hard' | 'none'

export interface ThemeDef {
  id: string
  label: string
  hint: string
  /** adjust: Höhe der Kleinbuchstaben angleichen (font-size-adjust), z. B. für Handschrift */
  heading: { font: string; weight: number; upper?: boolean; adjust?: number }
  body: { font: string }
  radius: number
  border: 1 | 2
  shadow: ShadowKind
  pattern: PatternKind
  logo: LogoKind
  tile: TileKind
  /** Verlauf auf Reitern, Logo und Kachel-Symbolen */
  gradient?: boolean
  /** Grundschriftgröße (1 = normal) – z. B. größer für „Kontrastreich“ */
  scale?: number
  light: Palette
  dark: Palette
}

const SERIF = 'Georgia, serif'
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const F = {
  lora: `'Lora', ${SERIF}`,
  merri: `'Merriweather', ${SERIF}`,
  playfair: `'Playfair Display', ${SERIF}`,
  slab: `'Roboto Slab', Rockwell, ${SERIF}`,
  caveat: `'Caveat', 'Bradley Hand', cursive`,
  nunito: `'Nunito', ${SANS}`,
  montserrat: `'Montserrat', ${SANS}`,
  system: SANS
}

export const THEMES: ThemeDef[] = [
  {
    id: 'alpin', label: t('Alpin & natürlich'), hint: t('Tannengrün, Sand und Abendrot'),
    heading: { font: F.lora, weight: 700 }, body: { font: F.nunito }, radius: 0.85, border: 1, shadow: 'soft', pattern: 'topo', logo: 'berg', tile: 'soft',
    light: { primary: '#2f5d50', onPrimary: '#ffffff', accent: '#c4703a', bg: '#f4efe4', surface: '#fffdf8', surface2: '#f7f2e8', text: '#26302b', muted: '#5f645b', border: '#e2d9c7', sky1: '#f6d7a7', sky2: '#e9a46a', far: '#8aa597', mid: '#4f7a68', near: '#2f5d50' },
    dark: { primary: '#86bba5', onPrimary: '#10201a', accent: '#e39b63', bg: '#121815', surface: '#1b231f', surface2: '#222c27', text: '#e9e5db', muted: '#a7aaa0', border: '#2f3a34', sky1: '#3b3550', sky2: '#7a4d4a', far: '#3d5248', mid: '#2c4038', near: '#1d2c26' }
  },
  {
    id: 'modern', label: t('Frisch & modern'), hint: t('Kräftiges Blau und Türkis, runde Formen'),
    heading: { font: F.montserrat, weight: 700 }, body: { font: F.montserrat }, radius: 1.15, border: 1, shadow: 'float', pattern: 'blobs', logo: 'pin', tile: 'gradient', gradient: true,
    light: { primary: '#1463ff', onPrimary: '#ffffff', accent: '#0e9e90', sun: '#ffd166', bg: '#eef3fb', surface: '#ffffff', surface2: '#f4f7fd', text: '#162036', muted: '#56637b', border: '#dde5f2', sky1: '#8fd3ff', sky2: '#3c7bff', far: '#7fb8e8', mid: '#2f8fd8', near: '#1463ff' },
    dark: { primary: '#6d9bff', onPrimary: '#0b1430', accent: '#2dd4bf', sun: '#ffd166', bg: '#0b1120', surface: '#131b2e', surface2: '#1a2339', text: '#e6ebf5', muted: '#9aa6bd', border: '#26314a', sky1: '#233a7a', sky2: '#4c2f80', far: '#1f3466', mid: '#1a2b55', near: '#131f40' }
  },
  {
    id: 'retro', label: 'Retro-Reiseplakat', hint: t('Petrol, Orange und Creme, Stempel-Optik'),
    heading: { font: F.slab, weight: 700, upper: true }, body: { font: F.nunito }, radius: 0.45, border: 2, shadow: 'hard', pattern: 'sunburst', logo: 'stempel', tile: 'solid',
    light: { primary: '#1f6f78', onPrimary: '#fbf5e6', accent: '#e2603a', bg: '#f1e5c9', surface: '#fbf4e3', surface2: '#f5ead0', text: '#2b2620', muted: '#665a4b', border: '#2b2620', sky1: '#f4c869', sky2: '#e2603a', far: '#e9b44c', mid: '#1f6f78', near: '#133f45' },
    dark: { primary: '#5cbcc7', onPrimary: '#14262a', accent: '#f08a5d', bg: '#1c1914', surface: '#26221b', surface2: '#2e2920', text: '#f2e7d0', muted: '#b6a88f', border: '#8a7b62', sky1: '#6b3f2a', sky2: '#2c4a50', far: '#7a5a2a', mid: '#1f4f55', near: '#12302f' }
  },
  {
    id: 'mittelmeer', label: t('Mittelmeer'), hint: t('Azurblau, Terrakotta und Kalkweiß'),
    heading: { font: F.playfair, weight: 700 }, body: { font: F.nunito }, radius: 0.9, border: 1, shadow: 'soft', pattern: 'waves', logo: 'pin', tile: 'soft',
    light: { primary: '#1d5fa6', onPrimary: '#ffffff', accent: '#c75d2c', sun: '#f6c453', bg: '#f6f2ea', surface: '#fffdf9', surface2: '#f2ece1', text: '#1d2a3a', muted: '#566174', border: '#e3dccf', sky1: '#ffe2b8', sky2: '#7fb6e6', far: '#9cc3e0', mid: '#3f86c4', near: '#1d5fa6' },
    dark: { primary: '#79b0ec', onPrimary: '#0c1b2c', accent: '#f08d5c', sun: '#f6c453', bg: '#0e1620', surface: '#16212d', surface2: '#1d2a38', text: '#e8edf3', muted: '#a3afbf', border: '#2a3a4c', sky1: '#523a52', sky2: '#1c3554', far: '#2a4560', mid: '#1f3a55', near: '#142a40' }
  },
  {
    id: 'nordisch', label: t('Nordisch klar'), hint: t('Schiefer, Senf und viel Ruhe – schlicht und flach'),
    heading: { font: F.montserrat, weight: 600 }, body: { font: F.nunito }, radius: 0.35, border: 1, shadow: 'none', pattern: 'grid', logo: 'kompass', tile: 'outline',
    light: { primary: '#3d5a6c', onPrimary: '#ffffff', accent: '#a8711f', sun: '#e8b64c', bg: '#f3f4f2', surface: '#ffffff', surface2: '#eceeeb', text: '#1f2629', muted: '#576166', border: '#d4d9d7', sky1: '#e8eef0', sky2: '#b9cbd4', far: '#a9bcc6', mid: '#6f8a99', near: '#3d5a6c' },
    dark: { primary: '#9cb8c9', onPrimary: '#142026', accent: '#e0ab55', bg: '#121618', surface: '#1a2023', surface2: '#20282c', text: '#e6eaec', muted: '#9fa9ae', border: '#2c3539', sky1: '#2a3640', sky2: '#18222a', far: '#2b3a43', mid: '#223038', near: '#18242b' }
  },
  {
    id: 'toskana', label: t('Toskana'), hint: t('Olive, Terrakotta und warmes Licht'),
    heading: { font: F.merri, weight: 700 }, body: { font: F.nunito }, radius: 0.6, border: 1, shadow: 'soft', pattern: 'dots', logo: 'berg', tile: 'soft',
    light: { primary: '#56662a', onPrimary: '#ffffff', accent: '#a94a22', sun: '#e9a03b', bg: '#f4ebdc', surface: '#fffaf1', surface2: '#f3e8d6', text: '#2e2a22', muted: '#665e50', border: '#e2d4bc', sky1: '#f7d9a8', sky2: '#e3a467', far: '#b8b77d', mid: '#7d8a45', near: '#4f5b25' },
    dark: { primary: '#b5c47a', onPrimary: '#1b2009', accent: '#e08355', bg: '#17150f', surface: '#211e16', surface2: '#29251b', text: '#efe7d8', muted: '#b3a990', border: '#3a3426', sky1: '#5a3b2a', sky2: '#2f2a3f', far: '#46492c', mid: '#343a20', near: '#232815' }
  },
  {
    id: 'tropen', label: t('Tropen'), hint: t('Dschungelgrün, Koralle und Sonne'),
    heading: { font: F.montserrat, weight: 700 }, body: { font: F.nunito }, radius: 1.2, border: 1, shadow: 'float', pattern: 'blobs', logo: 'pin', tile: 'gradient', gradient: true,
    light: { primary: '#0b7259', onPrimary: '#ffffff', accent: '#d9472f', sun: '#ffc94a', bg: '#eef8f3', surface: '#ffffff', surface2: '#f1faf6', text: '#10291f', muted: '#4b665a', border: '#d4ebe1', sky1: '#ffe08a', sky2: '#ff9f7a', far: '#7cc9a8', mid: '#1f9e78', near: '#0b6b53' },
    dark: { primary: '#4fd1a9', onPrimary: '#062019', accent: '#ff8a73', sun: '#ffc94a', bg: '#07150f', surface: '#0f2219', surface2: '#142b20', text: '#e3f4ec', muted: '#9cbcae', border: '#1f3a2e', sky1: '#5a2f3c', sky2: '#1f3b4a', far: '#1d4a3a', mid: '#15382c', near: '#0d2a20' }
  },
  {
    id: 'wueste', label: t('Wüste & Oase'), hint: t('Ocker, Sand und Oasen-Türkis'),
    heading: { font: F.playfair, weight: 700 }, body: { font: F.nunito }, radius: 0.5, border: 1, shadow: 'soft', pattern: 'waves', logo: 'stempel', tile: 'soft',
    light: { primary: '#8c4718', onPrimary: '#ffffff', accent: '#1f6d73', sun: '#f2b134', bg: '#f5e9d3', surface: '#fffaf0', surface2: '#f2e3c7', text: '#33241a', muted: '#6a5543', border: '#e4cfa9', sky1: '#f9dca0', sky2: '#ef9e5b', far: '#e2b77a', mid: '#c98a4b', near: '#9a5a2a' },
    dark: { primary: '#e3a26b', onPrimary: '#2a1607', accent: '#5cc2c9', sun: '#f2b134', bg: '#18120c', surface: '#221a12', surface2: '#2b2117', text: '#f2e6d3', muted: '#bba68b', border: '#3d2f20', sky1: '#5c3420', sky2: '#2a2240', far: '#5b3d22', mid: '#43301b', near: '#2e2113' }
  },
  {
    id: 'polarlicht', label: t('Polarlicht'), hint: t('Nordlicht-Grün und Violett, am schönsten dunkel'),
    heading: { font: F.montserrat, weight: 700 }, body: { font: F.montserrat }, radius: 1, border: 1, shadow: 'float', pattern: 'aurora', logo: 'kompass', tile: 'gradient', gradient: true,
    light: { primary: '#1d6884', onPrimary: '#ffffff', accent: '#6a3fc9', sun: '#d7f5ec', bg: '#eef3f8', surface: '#ffffff', surface2: '#f2f6fa', text: '#14202b', muted: '#52627a', border: '#d9e3ec', sky1: '#8fe3c9', sky2: '#3a3f8f', far: '#6f8fb5', mid: '#3d5a85', near: '#1e3155' },
    dark: { primary: '#3fe0b5', onPrimary: '#04201a', accent: '#a782ff', sun: '#d7f5ec', bg: '#070d1a', surface: '#0f1729', surface2: '#152036', text: '#e4ecf7', muted: '#9aa8c0', border: '#22304a', sky1: '#1fbf95', sky2: '#1b1446', far: '#1d2a4d', mid: '#151f3b', near: '#0c1428' }
  },
  {
    id: 'urban', label: t('Großstadt'), hint: t('Anthrazit und Signalgelb, kantig'),
    heading: { font: F.montserrat, weight: 700, upper: true }, body: { font: F.montserrat }, radius: 0.15, border: 2, shadow: 'none', pattern: 'grid', logo: 'kompass', tile: 'solid',
    light: { primary: '#1d1d1f', onPrimary: '#ffd400', accent: '#b38f00', sun: '#ffcc00', bg: '#ececec', surface: '#ffffff', surface2: '#f4f4f4', text: '#111111', muted: '#4f4f4f', border: '#1d1d1f', sky1: '#ffd84d', sky2: '#f2994a', far: '#9a9a9a', mid: '#5c5c5c', near: '#2a2a2a' },
    dark: { primary: '#ffd400', onPrimary: '#111111', accent: '#ffd400', sun: '#ffd400', bg: '#0f0f10', surface: '#1a1a1c', surface2: '#222225', text: '#f2f2f2', muted: '#a8a8a8', border: '#5a5a5a', sky1: '#f2994a', sky2: '#2b1f3d', far: '#3a3a3a', mid: '#262626', near: '#151515' }
  },
  {
    id: 'tagebuch', label: t('Reisetagebuch'), hint: t('Tinte auf Papier, handschriftliche Überschriften'),
    heading: { font: F.caveat, weight: 700, adjust: 0.55 }, body: { font: F.nunito }, radius: 0.3, border: 1, shadow: 'soft', pattern: 'paper', logo: 'stempel', tile: 'outline',
    light: { primary: '#2c4a7a', onPrimary: '#ffffff', accent: '#b03628', sun: '#e8a33d', bg: '#f6efe0', surface: '#fffbf2', surface2: '#f3ead6', text: '#2a2622', muted: '#655c52', border: '#e0d3b8', sky1: '#f7deb0', sky2: '#a8c4dc', far: '#9fb3a5', mid: '#6b8a7a', near: '#3f5a4d' },
    dark: { primary: '#8fb1e8', onPrimary: '#0f1c33', accent: '#e57367', sun: '#e8a33d', bg: '#191712', surface: '#221f19', surface2: '#2a261f', text: '#efe6d2', muted: '#b2a68f', border: '#3b352a', sky1: '#4a3a2a', sky2: '#232c3d', far: '#34403a', mid: '#28322c', near: '#1b231f' }
  },
  {
    id: 'provence', label: t('Provence'), hint: t('Lavendel, Rosé und Sommerlicht'),
    heading: { font: F.lora, weight: 700 }, body: { font: F.nunito }, radius: 1, border: 1, shadow: 'soft', pattern: 'dots', logo: 'pin', tile: 'soft',
    light: { primary: '#5e4b8b', onPrimary: '#ffffff', accent: '#a8455f', sun: '#f2c45a', bg: '#f5f1f7', surface: '#fffdff', surface2: '#f1ebf5', text: '#262033', muted: '#5e566e', border: '#e2d9ea', sky1: '#f7d6c9', sky2: '#b9a6dc', far: '#b7a8d1', mid: '#8a76b5', near: '#5e4b8b' },
    dark: { primary: '#b9a6ef', onPrimary: '#1d1530', accent: '#f08da3', sun: '#f2c45a', bg: '#13101a', surface: '#1c1826', surface2: '#231e30', text: '#ece6f5', muted: '#aaa0bd', border: '#332c44', sky1: '#4b2f45', sky2: '#221c3d', far: '#3a3054', mid: '#2b2440', near: '#1e192e' }
  },
  {
    id: 'herbst', label: t('Herbstwald'), hint: t('Kastanie, Bernstein und Laub'),
    heading: { font: F.merri, weight: 700 }, body: { font: F.nunito }, radius: 0.7, border: 1, shadow: 'soft', pattern: 'topo', logo: 'berg', tile: 'soft',
    light: { primary: '#7a3e1d', onPrimary: '#ffffff', accent: '#9a6512', sun: '#f0b33c', bg: '#f3ebe1', surface: '#fffaf4', surface2: '#f1e6d8', text: '#2d221b', muted: '#665850', border: '#e3d4c3', sky1: '#f6cf8f', sky2: '#d9774a', far: '#b98a5a', mid: '#8a5a32', near: '#5a3a22' },
    dark: { primary: '#e59a6a', onPrimary: '#2a1205', accent: '#e7aa45', sun: '#f0b33c', bg: '#16110d', surface: '#1f1914', surface2: '#271f19', text: '#f1e5d9', muted: '#b8a594', border: '#3b2f25', sky1: '#5e3420', sky2: '#2a1f2c', far: '#4a3424', mid: '#36271b', near: '#241a12' }
  },
  {
    id: 'kueste', label: t('Küste & Ostsee'), hint: t('Marineblau, Dünen und Leuchtturm-Orange'),
    heading: { font: F.montserrat, weight: 600 }, body: { font: F.nunito }, radius: 0.8, border: 1, shadow: 'soft', pattern: 'waves', logo: 'pin', tile: 'soft',
    light: { primary: '#1c4e74', onPrimary: '#ffffff', accent: '#b8611a', sun: '#f5c451', bg: '#edf3f6', surface: '#ffffff', surface2: '#eef4f7', text: '#15283a', muted: '#526474', border: '#d6e2ea', sky1: '#fde3b3', sky2: '#8ec3e6', far: '#b8d3e6', mid: '#4a86b4', near: '#1c4e74' },
    dark: { primary: '#86bde6', onPrimary: '#0b1d2c', accent: '#f2a65a', sun: '#f5c451', bg: '#0b141c', surface: '#121e29', surface2: '#182633', text: '#e5eef5', muted: '#9db0c1', border: '#253747', sky1: '#4b3a4a', sky2: '#13263a', far: '#1e3449', mid: '#172a3c', near: '#0f1e2c' }
  },
  {
    id: 'sommer', label: t('Sommerfrische'), hint: t('Türkis, Mango und Zitronengelb – verspielt rund'),
    heading: { font: F.nunito, weight: 800 }, body: { font: F.nunito }, radius: 1.4, border: 1, shadow: 'float', pattern: 'dots', logo: 'pin', tile: 'gradient', gradient: true,
    light: { primary: '#0b6b78', onPrimary: '#ffffff', accent: '#c45a12', sun: '#ffd23f', bg: '#fffaf0', surface: '#ffffff', surface2: '#fff4e0', text: '#1d2b2f', muted: '#52636a', border: '#f1e3c8', sky1: '#fff1b8', sky2: '#7fd6e0', far: '#9fe0d0', mid: '#2bb3a3', near: '#0f7c8c' },
    dark: { primary: '#5fd6e0', onPrimary: '#062a2f', accent: '#ffa66b', sun: '#ffd23f', bg: '#0b1719', surface: '#122326', surface2: '#182c30', text: '#e6f4f5', muted: '#a1bcc0', border: '#24393d', sky1: '#6b4a1f', sky2: '#12303a', far: '#1c3f3f', mid: '#163233', near: '#0f2426' }
  },
  {
    id: 'nachtzug', label: t('Nachtzug'), hint: t('Mitternachtsblau und Gold, elegant'),
    heading: { font: F.playfair, weight: 700 }, body: { font: F.nunito }, radius: 0.5, border: 1, shadow: 'soft', pattern: 'stars', logo: 'stempel', tile: 'solid',
    light: { primary: '#1f2a4d', onPrimary: '#f5d27a', accent: '#8a6416', sun: '#f5d27a', bg: '#f2efe8', surface: '#fffdf8', surface2: '#ebe6da', text: '#1b2033', muted: '#565b6f', border: '#dcd5c4', sky1: '#f3d58f', sky2: '#34406e', far: '#6b7398', mid: '#3b4670', near: '#1f2a4d' },
    dark: { primary: '#e8c46a', onPrimary: '#1a1405', accent: '#e8c46a', sun: '#f5d27a', bg: '#0c1020', surface: '#141a30', surface2: '#1a2140', text: '#ece8dc', muted: '#a9adbf', border: '#2a3254', sky1: '#3a3466', sky2: '#0a0f24', far: '#232b50', mid: '#1a2140', near: '#10162e' }
  },
  {
    id: 'kontrast', label: t('Kontrastreich'), hint: t('Sehr gut lesbar: kräftige Farben, größere Schrift'),
    heading: { font: F.system, weight: 800 }, body: { font: F.system }, radius: 0.4, border: 2, shadow: 'none', pattern: 'none', logo: 'berg', tile: 'solid', scale: 1.08,
    light: { primary: '#003a8c', onPrimary: '#ffffff', accent: '#b00020', sun: '#ffb000', bg: '#ffffff', surface: '#ffffff', surface2: '#f2f2f2', text: '#000000', muted: '#2b2b2b', border: '#000000', sky1: '#ffe08a', sky2: '#6aa6ff', far: '#6b7c99', mid: '#34507a', near: '#0c2244' },
    dark: { primary: '#ffd400', onPrimary: '#000000', accent: '#ff6b6b', sun: '#ffb000', bg: '#000000', surface: '#0a0a0a', surface2: '#161616', text: '#ffffff', muted: '#e0e0e0', border: '#ffffff', sky1: '#5a4a10', sky2: '#0a1a3a', far: '#2a3a5a', mid: '#1a2a44', near: '#0a1428' }
  },
  {
    id: 'klassisch', label: t('Klassisch'), hint: t('Das ursprüngliche Blau, Systemschrift'),
    heading: { font: F.system, weight: 600 }, body: { font: F.system }, radius: 0.75, border: 1, shadow: 'soft', pattern: 'none', logo: 'pin', tile: 'soft',
    light: { primary: '#0b5ed7', onPrimary: '#ffffff', accent: '#b07d00', sun: '#ffd43b', bg: '#f5f7fa', surface: '#ffffff', surface2: '#f1f3f5', text: '#212529', muted: '#5a6168', border: '#dee2e6', sky1: '#cfe2ff', sky2: '#6ea8fe', far: '#9ec5fe', mid: '#3d8bfd', near: '#0a58ca' },
    dark: { primary: '#6ea8fe', onPrimary: '#031633', accent: '#ffda6a', sun: '#ffd43b', bg: '#121416', surface: '#1b1e21', surface2: '#212529', text: '#dee2e6', muted: '#a7acb1', border: '#343a40', sky1: '#2b3a55', sky2: '#121c2c', far: '#1f2c40', mid: '#172233', near: '#0f1824' }
  }
]

export const DEFAULT_THEME = 'alpin'

export function getTheme(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// ---------------------------------------------------------------- Farb-Hilfen

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mischung zweier Farben (t = Anteil von b) */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

/** Kontrastverhältnis nach WCAG (1–21) */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const rgb = (hex: string) => hexToRgb(hex).join(', ')
const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** Gezeichnetes Hintergrundmuster; `strength` 0–2 (1 = normal) */
export function patternCss(kind: PatternKind, p: Palette, strength = 1, dark = false): string {
  const s = Math.max(0, Math.min(2, strength)) * (dark ? 0.8 : 1)
  if (s === 0 || kind === 'none') return 'none'
  const a = (v: number) => Math.min(1, v * s).toFixed(3)
  switch (kind) {
    case 'topo':
      return svgUrl(
        `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' fill='none' stroke='${p.primary}' stroke-opacity='${a(0.1)}' stroke-width='1.4'>` +
          `<path d='M-20 120c80-40 140 30 220-10s120-70 200-20 140 40 220-10'/><path d='M-20 170c90-30 150 40 230 0s120-60 190-15 140 45 220 0'/>` +
          `<path d='M-20 220c100-20 160 50 240 10s110-50 180-10 140 50 220 5'/><path d='M-20 400c70-50 150 10 230-30s140-40 210 10 130 30 200-20'/>` +
          `<path d='M-20 450c80-40 150 20 230-20s140-30 200 15 130 30 210-15'/><path d='M-20 500c90-30 150 30 230-10s130-20 190 20 130 30 220-10'/>` +
          `<ellipse cx='430' cy='300' rx='70' ry='40'/><ellipse cx='430' cy='300' rx='120' ry='70'/><ellipse cx='150' cy='310' rx='50' ry='28'/></svg>`
      )
    case 'waves':
      return svgUrl(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='60' fill='none' stroke='${p.primary}' stroke-opacity='${a(0.12)}' stroke-width='1.5'>` +
          `<path d='M0 15q30-12 60 0t60 0 60 0 60 0'/><path d='M0 45q30-12 60 0t60 0 60 0 60 0'/></svg>`
      )
    case 'stars':
      return svgUrl(
        `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220' fill='${p.sun ?? p.accent}' fill-opacity='${a(0.35)}'>` +
          `<circle cx='20' cy='30' r='1.4'/><circle cx='120' cy='18' r='1'/><circle cx='190' cy='70' r='1.6'/><circle cx='70' cy='110' r='1'/>` +
          `<circle cx='160' cy='150' r='1.2'/><circle cx='30' cy='190' r='1.6'/><circle cx='110' cy='200' r='1'/><circle cx='200' cy='205' r='1.1'/>` +
          `<path d='M95 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z'/></svg>`
      )
    case 'dots':
      return `radial-gradient(rgba(${rgb(p.primary)}, ${a(0.14)}) 1.4px, transparent 1.6px) 0 0 / 22px 22px`
    case 'paper':
      return `linear-gradient(90deg, transparent 54px, rgba(${rgb(p.accent)}, ${a(0.18)}) 54px 55.5px, transparent 55.5px), repeating-linear-gradient(transparent 0 27px, rgba(${rgb(p.primary)}, ${a(0.1)}) 27px 28px)`
    case 'grid':
      return `linear-gradient(rgba(${rgb(p.text)}, ${a(0.05)}) 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, rgba(${rgb(p.text)}, ${a(0.05)}) 1px, transparent 1px) 0 0 / 32px 32px`
    case 'sunburst':
      return `repeating-conic-gradient(from 0deg at 50% 115%, rgba(${rgb(p.accent)}, ${a(0.06)}) 0deg 6deg, transparent 6deg 12deg)`
    case 'blobs':
      return `radial-gradient(40rem 30rem at 95% -5%, rgba(${rgb(p.primary)}, ${a(0.16)}), transparent 70%), radial-gradient(36rem 28rem at -10% 35%, rgba(${rgb(p.accent)}, ${a(0.14)}), transparent 70%), radial-gradient(30rem 24rem at 70% 110%, rgba(${rgb(p.sun ?? p.accent)}, ${a(0.12)}), transparent 70%)`
    case 'aurora':
      return `radial-gradient(60rem 22rem at 20% -6%, rgba(${rgb(p.sky1)}, ${a(0.28)}), transparent 70%), radial-gradient(50rem 20rem at 85% 4%, rgba(${rgb(p.accent)}, ${a(0.22)}), transparent 70%)`
  }
}

const SHADOWS: Record<ShadowKind, (p: Palette, dark: boolean) => string> = {
  soft: (_, d) => (d ? '0 1px 2px rgba(0,0,0,.4)' : '0 1px 2px rgba(0,0,0,.05), 0 4px 14px rgba(0,0,0,.06)'),
  float: (_, d) => (d ? '0 2px 10px rgba(0,0,0,.45)' : '0 2px 6px rgba(22,32,54,.05), 0 10px 30px rgba(22,32,54,.08)'),
  hard: (p, d) => `4px 4px 0 ${d ? 'rgba(0,0,0,.6)' : p.text}`,
  none: () => 'none'
}

/** CSS-Variablen eines Designs (ohne Hintergrund-Regler) */
export function themeVars(t: ThemeDef, dark: boolean, opts: { radius?: number; pattern?: number } = {}): Record<string, string> {
  const p = dark ? t.dark : t.light
  const hover = mix(p.primary, dark ? '#ffffff' : '#000000', 0.18)
  const radius = opts.radius ?? t.radius
  return {
    '--nww-primary': p.primary,
    '--nww-primary-rgb': rgb(p.primary),
    '--nww-primary-hover': hover,
    '--nww-on-primary': p.onPrimary,
    '--nww-accent': p.accent,
    '--nww-accent-rgb': rgb(p.accent),
    '--nww-sun': p.sun ?? p.accent,
    '--nww-bg': p.bg,
    '--nww-surface': p.surface,
    '--nww-surface-2': p.surface2,
    '--nww-text': p.text,
    '--nww-text-rgb': rgb(p.text),
    '--nww-muted': p.muted,
    '--nww-border': p.border,
    '--nww-chrome': dark ? p.bg : p.primary,
    '--nww-heading-font': t.heading.font,
    '--nww-heading-weight': String(t.heading.weight),
    '--nww-heading-adjust': t.heading.adjust ? String(t.heading.adjust) : 'none',
    '--nww-body-font': t.body.font,
    '--nww-radius': `${radius}rem`,
    '--nww-shadow': SHADOWS[t.shadow](p, dark),
    '--nww-border-width': `${t.border}px`,
    '--nww-sky-1': p.sky1,
    '--nww-sky-2': p.sky2,
    '--nww-far': p.far,
    '--nww-mid': p.mid,
    '--nww-near': p.near,
    '--nww-pattern': patternCss(t.pattern, p, opts.pattern ?? 1, dark)
  }
}
