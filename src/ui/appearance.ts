/**
 * Aussehen der App: Design, hell/dunkel, Schrift, Ecken, Hintergrund und Aufteilung der Reiseseite.
 *
 * - Alle Einstellungen gelten je Gerät (jeder richtet sich sein Gerät ein) – gespeichert in localStorage,
 *   damit das Design schon beim Start ohne Flackern feststeht.
 * - Eigene Hintergrundbilder liegen in der Tabelle `appearance` und werden mit abgeglichen –
 *   ein Bild, das Marco aufs iPad lädt, sieht Birgit auch auf ihrem Handy. Je Design ("bg:<design>")
 *   oder für alle Designs ("bg:alle").
 * - Mitgelieferte Hintergründe (DEFAULT_BACKGROUNDS) gelten, solange kein eigenes Bild gewählt ist.
 */
import { reactive, watch } from 'vue'
import { liveQuery } from 'dexie'
import { db, now } from '@/core/db'
import { DEFAULT_LAYOUT, normalizeLayout, type TripLayout } from '@/core/trip-layout'
import { resizeBlob } from '@/services/images'
import { DEFAULT_THEME, THEMES, getTheme, themeVars } from './themes'
import { t } from '@/i18n'

export type ColorMode = 'auto' | 'hell' | 'dunkel'
export type TextSize = 'klein' | 'normal' | 'gross' | 'sehrgross'
export type Corners = 'stil' | 'eckig' | 'rund' | 'sehrrund'
export type Veil = 'auto' | 'hell' | 'dunkel'

/** Ein eigenes Hintergrundbild (abgeglichen) */
export interface AppearanceRow {
  /** "bg:<design>" oder "bg:alle" */
  id: string
  image: Blob | null
  updatedAt: string
}

/**
 * Mitgelieferte Hintergründe je Design. Leer = gezeichnetes Muster des Designs.
 * Neue Bilder: nach src/ui/hintergrund/ legen und hier eintragen (import … from './hintergrund/x.webp').
 */
export const DEFAULT_BACKGROUNDS: Partial<Record<string, string>> = {}

export interface AppearanceSettings {
  theme: string
  mode: ColorMode
  /** Hintergrund (Foto oder Muster) zeigen */
  background: boolean
  /** Schleier über dem Foto in % (0 = Foto pur) */
  cover: number
  /** Farbe des Schleiers: Hintergrundfarbe des Designs, Weiß oder Schwarz */
  veil: Veil
  /** Unschärfe des Fotos in px */
  blur: number
  /** Farbsättigung des Fotos in % (100 = unverändert) */
  saturate: number
  /** Durchsichtigkeit der Karten in % (0 = deckend) */
  cards: number
  /** Stärke des gezeichneten Musters in % */
  pattern: number
  textSize: TextSize
  corners: Corners
  layout: TripLayout
}

export const DEFAULT_SETTINGS: AppearanceSettings = {
  theme: DEFAULT_THEME,
  mode: 'auto',
  background: true,
  cover: 30,
  veil: 'auto',
  blur: 0,
  saturate: 100,
  cards: 0,
  pattern: 100,
  textSize: 'normal',
  corners: 'stil',
  layout: DEFAULT_LAYOUT
}

export const TEXT_SIZES: Record<TextSize, { label: string; percent: number }> = {
  klein: { label: t('Klein'), percent: 93.75 },
  normal: { label: t('Normal'), percent: 100 },
  gross: { label: t('Groß'), percent: 112.5 },
  sehrgross: { label: t('Sehr groß'), percent: 125 }
}

export const CORNERS: Record<Corners, { label: string; rem: number | null }> = {
  stil: { label: t('Wie das Design'), rem: null },
  eckig: { label: t('Eckig'), rem: 0.15 },
  rund: { label: t('Rund'), rem: 0.9 },
  sehrrund: { label: t('Sehr rund'), rem: 1.5 }
}

const KEY = 'nww-aussehen'
const clamp = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d)
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)

/** Gespeicherte Einstellungen prüfen (auch die von Version 1.15 mit `style`) */
export function normalizeSettings(raw: unknown): AppearanceSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  const theme = String(s.theme ?? s.style ?? d.theme)
  return {
    theme: THEMES.some((t) => t.id === theme) ? theme : d.theme,
    mode: oneOf(s.mode, ['auto', 'hell', 'dunkel'] as const, d.mode),
    background: typeof s.background === 'boolean' ? s.background : d.background,
    cover: clamp(s.cover, 0, 90, d.cover),
    veil: oneOf(s.veil, ['auto', 'hell', 'dunkel'] as const, d.veil),
    blur: clamp(s.blur, 0, 20, d.blur),
    saturate: clamp(s.saturate, 0, 200, d.saturate),
    cards: clamp(s.cards, 0, 60, d.cards),
    pattern: clamp(s.pattern, 0, 200, d.pattern),
    textSize: oneOf(s.textSize, Object.keys(TEXT_SIZES) as TextSize[], d.textSize),
    corners: oneOf(s.corners, Object.keys(CORNERS) as Corners[], d.corners),
    layout: normalizeLayout(s.layout)
  }
}

function load(): AppearanceSettings {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? '{}'))
  } catch {
    return normalizeSettings({})
  }
}

export const appearance = reactive<AppearanceSettings & { dark: boolean; customBackground: '' | 'design' | 'alle' }>({
  ...load(),
  dark: false,
  customBackground: ''
})

/** Nur die gespeicherten Felder */
export function currentSettings(): AppearanceSettings {
  const { dark: _d, customBackground: _c, ...s } = appearance
  return JSON.parse(JSON.stringify(s)) as AppearanceSettings
}

/** Ein Teil zurück auf Standard */
export function resetSettings(part: 'design' | 'hintergrund' | 'reiseseite'): void {
  const d = DEFAULT_SETTINGS
  if (part === 'design') Object.assign(appearance, { theme: d.theme, mode: d.mode, textSize: d.textSize, corners: d.corners })
  if (part === 'hintergrund') Object.assign(appearance, { background: d.background, cover: d.cover, veil: d.veil, blur: d.blur, saturate: d.saturate, cards: d.cards, pattern: d.pattern })
  if (part === 'reiseseite') appearance.layout = JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
let bgUrl: string | null = null

function apply() {
  appearance.dark = appearance.mode === 'dunkel' || (appearance.mode === 'auto' && !!media?.matches)
  const t = getTheme(appearance.theme)
  const p = appearance.dark ? t.dark : t.light
  const html = document.documentElement
  const vars = themeVars(t, appearance.dark, { radius: CORNERS[appearance.corners].rem ?? undefined, pattern: appearance.pattern / 100 })
  for (const [k, v] of Object.entries(vars)) html.style.setProperty(k, v)
  // Hintergrund-Regler
  html.style.setProperty('--nww-veil', appearance.veil === 'hell' ? '#ffffff' : appearance.veil === 'dunkel' ? '#000000' : p.bg)
  html.style.setProperty('--nww-veil-opacity', String(appearance.cover / 100))
  html.style.setProperty('--nww-bg-blur', `${appearance.blur}px`)
  html.style.setProperty('--nww-bg-saturate', `${appearance.saturate}%`)
  html.style.setProperty('--nww-card-opacity', `${100 - appearance.cards}%`)
  html.style.fontSize = `${TEXT_SIZES[appearance.textSize].percent * (t.scale ?? 1)}%`
  html.setAttribute('data-bs-theme', appearance.dark ? 'dark' : 'light')
  html.setAttribute('data-nww-style', t.id)
  html.setAttribute('data-nww-tile', t.tile)
  html.setAttribute('data-nww-shadow', t.shadow)
  html.toggleAttribute('data-nww-upper', !!t.heading.upper)
  html.toggleAttribute('data-nww-gradient', !!t.gradient)
  html.toggleAttribute('data-nww-bg', appearance.background)
  html.toggleAttribute('data-nww-glass', appearance.cards > 0)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--nww-chrome'])
}

/** Hintergrundbild setzen (eigenes Bild des Designs → eigenes für alle → mitgeliefertes → Muster) */
export async function applyBackground(): Promise<void> {
  const [own, all] = await Promise.all([
    db.appearance.get(`bg:${appearance.theme}`).catch(() => undefined),
    db.appearance.get('bg:alle').catch(() => undefined)
  ])
  if (bgUrl) URL.revokeObjectURL(bgUrl)
  const img = own?.image ?? all?.image ?? null
  bgUrl = img ? URL.createObjectURL(img) : null
  appearance.customBackground = own?.image ? 'design' : all?.image ? 'alle' : ''
  const url = bgUrl ?? DEFAULT_BACKGROUNDS[appearance.theme] ?? null
  document.documentElement.style.setProperty('--nww-bg-image', url ? `url("${url}")` : 'none')
  document.documentElement.toggleAttribute('data-nww-photo', !!url)
}

export function startAppearance(): void {
  apply()
  void applyBackground()
  media?.addEventListener('change', apply)
  watch(
    () => currentSettings(),
    (s, old) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(s))
      } catch {
        /* privater Modus: gilt dann nur bis zum Neustart */
      }
      apply()
      if (s.theme !== old?.theme) void applyBackground()
    },
    { deep: true }
  )
  // Bild kam per Abgleich von einem anderen Gerät (oder wurde hier geändert)
  liveQuery(() => db.appearance.toArray()).subscribe({ next: () => void applyBackground(), error: () => undefined })
}

/** Eigenes Hintergrundbild (verkleinert auf 2000 px) – für das aktuelle Design oder für alle; null = entfernen */
export async function setBackground(file: Blob | null, scope: 'design' | 'alle' = 'design'): Promise<void> {
  const image = file ? (await resizeBlob(file, 2000, 0.82)).blob : null
  await db.appearance.put({ id: scope === 'alle' ? 'bg:alle' : `bg:${appearance.theme}`, image, updatedAt: now() })
  await applyBackground()
}
