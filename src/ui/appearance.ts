/**
 * Aussehen der App: Stil (Alpin, Modern, Retro), hell/dunkel und Hintergrundbild.
 *
 * - Stil und Hell/Dunkel gelten je Gerät (jeder darf es sich auf seinem Gerät einrichten).
 * - Eigene Hintergrundbilder je Stil liegen in der Tabelle `appearance` und werden mit abgeglichen –
 *   ein Bild, das Marco aufs iPad lädt, sieht Birgit auch auf ihrem Handy.
 * - Mitgelieferte Hintergründe (DEFAULT_BACKGROUNDS) gelten, solange kein eigenes Bild gewählt ist.
 */
import { reactive, watch } from 'vue'
import { liveQuery } from 'dexie'
import { db, now } from '@/core/db'
import { resizeBlob } from '@/services/images'

export type AppStyle = 'alpin' | 'modern' | 'retro'
export type ColorMode = 'auto' | 'hell' | 'dunkel'

export const STYLES: Record<AppStyle, { label: string; hint: string; swatches: string[] }> = {
  alpin: { label: 'Alpin & natürlich', hint: 'Tannengrün, Sand und Abendrot – wie ein Reisetagebuch', swatches: ['#2f5d50', '#c4703a', '#efe8da'] },
  modern: { label: 'Frisch & modern', hint: 'Kräftiges Blau und Türkis, runde Formen, klare Schrift', swatches: ['#1463ff', '#12b5a6', '#eef3fb'] },
  retro: { label: 'Retro-Reiseplakat', hint: 'Petrol, Orange und Creme, Stempel-Optik', swatches: ['#1f6f78', '#e2603a', '#f3e9d2'] }
}

/** Ein eigenes Hintergrundbild je Stil (abgeglichen) */
export interface AppearanceRow {
  /** z. B. "bg:alpin" */
  id: string
  image: Blob | null
  updatedAt: string
}

/**
 * Mitgelieferte Hintergründe je Stil. Leer = gezeichnetes Muster des Stils.
 * Neue Bilder: nach src/ui/hintergrund/ legen und hier eintragen (import … from './hintergrund/x.webp').
 */
export const DEFAULT_BACKGROUNDS: Partial<Record<AppStyle, string>> = {}

const KEY = 'nww-aussehen'

interface Stored {
  style: AppStyle
  mode: ColorMode
  background: boolean
}

function load(): Stored {
  const d: Stored = { style: 'alpin', mode: 'auto', background: true }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Stored>
    if (s.style && s.style in STYLES) d.style = s.style
    if (s.mode === 'hell' || s.mode === 'dunkel' || s.mode === 'auto') d.mode = s.mode
    if (typeof s.background === 'boolean') d.background = s.background
  } catch {
    /* Standard */
  }
  return d
}

export const appearance = reactive<Stored & { dark: boolean; customBackground: boolean }>({ ...load(), dark: false, customBackground: false })

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
let bgUrl: string | null = null

function applyMode() {
  appearance.dark = appearance.mode === 'dunkel' || (appearance.mode === 'auto' && !!media?.matches)
  const html = document.documentElement
  html.setAttribute('data-bs-theme', appearance.dark ? 'dark' : 'light')
  html.setAttribute('data-nww-style', appearance.style)
  html.toggleAttribute('data-nww-bg', appearance.background)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(html).getPropertyValue('--nww-chrome').trim() || '#2f5d50')
}

/** Hintergrundbild des aktuellen Stils setzen (eigenes Bild → mitgeliefertes → Muster) */
export async function applyBackground(): Promise<void> {
  const row = await db.appearance.get(`bg:${appearance.style}`).catch(() => undefined)
  if (bgUrl) URL.revokeObjectURL(bgUrl)
  bgUrl = row?.image ? URL.createObjectURL(row.image) : null
  appearance.customBackground = !!bgUrl
  const url = bgUrl ?? DEFAULT_BACKGROUNDS[appearance.style] ?? null
  document.documentElement.style.setProperty('--nww-bg-image', url ? `url("${url}")` : 'none')
  document.documentElement.toggleAttribute('data-nww-photo', !!url)
}

export function startAppearance(): void {
  applyMode()
  void applyBackground()
  media?.addEventListener('change', applyMode)
  watch(
    () => [appearance.style, appearance.mode, appearance.background],
    () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ style: appearance.style, mode: appearance.mode, background: appearance.background }))
      } catch {
        /* privater Modus: gilt dann nur bis zum Neustart */
      }
      applyMode()
      void applyBackground()
    }
  )
  // Bild kam per Abgleich von einem anderen Gerät (oder wurde hier geändert)
  liveQuery(() => db.appearance.toArray()).subscribe({ next: () => void applyBackground(), error: () => undefined })
}

/** Eigenes Hintergrundbild für den aktuellen Stil (verkleinert auf 2000 px) */
export async function setBackground(file: Blob | null): Promise<void> {
  const image = file ? (await resizeBlob(file, 2000, 0.82)).blob : null
  await db.appearance.put({ id: `bg:${appearance.style}`, image, updatedAt: now() })
  await applyBackground()
}
