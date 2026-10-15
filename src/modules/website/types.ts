import { t, tk } from '@/i18n'
export type TemplateId = 'klassisch' | 'magazin' | 'galerie'
export type FontChoice =
  | 'modern'
  | 'serif'
  | 'rund'
  | 'lora'
  | 'playfair'
  | 'merriweather'
  | 'robotoslab'
  | 'nunito'
  | 'montserrat'
  | 'raleway'
  | 'caveat'
export type ImageSize = 'klein' | 'mittel' | 'gross'

/** Einstellungen der Reise-Webseite (eine pro Reise). */
export interface WebsiteSettings {
  tripId: string
  template: TemplateId
  /** Akzentfarbe als #rrggbb */
  accent: string
  font: FontChoice
  dark: boolean
  title: string
  subtitle: string
  /** Einleitungstext oben auf der Seite */
  intro: string
  author: string
  onlyHighlights: boolean
  showMood: boolean
  showLocation: boolean
  /** Welche Bereiche auf die Seite kommen (ältere Einstellungen haben sie noch nicht → Standardwerte) */
  showPhotos: boolean
  showRoutes: boolean
  showStays: boolean
  /** Adresse und Link der Unterkünfte */
  showStayDetails: boolean
  showActivities: boolean
  showParticipants: boolean
  imageSize: ImageSize
  updatedAt: string
}

export type WebsiteSettingsDraft = Omit<WebsiteSettings, 'tripId' | 'updatedAt'>

/** Ein Foto, wie es die Vorlage bekommt. */
export interface SitePhoto {
  src: string
  caption: string
  width: number
  height: number
}

export interface SiteEntry {
  title: string
  text: string
  mood: number
  location: string
  photos: SitePhoto[]
}

/** Eine Route, wie die Vorlage sie bekommt (Punkte schon stark vereinfacht). */
export interface SiteRoute {
  name: string
  color: string
  kind: 'track' | 'route'
  stats: { distance: number; ascent: number; descent: number; duration: number | null }
  points: [number, number, number | null][]
  /** Kartenbild mit der Strecke (OpenStreetMap-Hintergrund) – fehlt es (offline), wird nur die Linie gezeichnet */
  map?: string
}

/** Unterkunft auf der Webseite (ohne Preis, Buchungsnummer, Notizen). */
export interface SiteStay {
  name: string
  type: string
  emoji: string
  checkIn: string
  checkOut: string
  nights: number | null
  /** leer, wenn „Adresse & Link“ aus ist */
  address: string
  url: string
}

export interface SiteActivity {
  title: string
  kind: string
  emoji: string
  date: string
  place: string
}

export interface SiteDay {
  date: string
  dayNumber: number | null
  entries: SiteEntry[]
  routes: SiteRoute[]
}

/** Alles, was eine Vorlage zum Zeichnen braucht – ohne Datenbank, ohne Browser. */
export interface SiteData {
  title: string
  subtitle: string
  intro: string
  author: string
  destination: string
  startDate: string
  endDate: string
  participants: string[]
  cover: SitePhoto | null
  days: SiteDay[]
  /** Routen ohne Tag */
  routes: SiteRoute[]
  /** Übersichtskarte aller Routen (ab zwei Routen) */
  overviewMap?: string
  stays: SiteStay[]
  activities: SiteActivity[]
  stats: { days: number; entries: number; photos: number }
  generatedAt: string
}

export const TEMPLATE_INFO: Record<TemplateId, { title: string; description: string; icon: string }> = {
  klassisch: { title: t('Klassisch'), description: t('Titelbild, dann Tag für Tag als Karten'), icon: 'journal-richtext' },
  magazin: { title: t('Magazin'), description: t('Große Bilder, Text daneben – wie eine Reisereportage'), icon: 'newspaper' },
  galerie: { title: t('Galerie'), description: t('Fotos im Vordergrund, kurze Texte'), icon: 'grid-3x3-gap' }
}

/**
 * Schriften: die ersten drei nutzen Schriften des Geräts, die übrigen werden mitgeliefert
 * (Dateien in fonts.ts, beim Export in die HTML-Datei eingebettet – sehen also überall gleich aus).
 */
export const FONT_INFO: Record<FontChoice, { label: string; css: string; group: 'Gerät' | 'Serif' | 'Ohne Serifen' | 'Handschrift' }> = {
  modern: { label: t('Modern (Gerät)'), group: 'Gerät', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  serif: { label: t('Klassisch (Gerät)'), group: 'Gerät', css: "Georgia, 'Times New Roman', serif" },
  rund: { label: t('Rund (Gerät)'), group: 'Gerät', css: "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif" },
  lora: { label: t('Lora – warm, gut lesbar'), group: 'Serif', css: "'Lora', Georgia, serif" },
  playfair: { label: t('Playfair Display – elegant'), group: 'Serif', css: "'Playfair Display', Georgia, serif" },
  merriweather: { label: t('Merriweather – ruhig, für lange Texte'), group: 'Serif', css: "'Merriweather', Georgia, serif" },
  robotoslab: { label: t('Roboto Slab – kräftig'), group: 'Serif', css: "'Roboto Slab', Rockwell, Georgia, serif" },
  nunito: { label: t('Nunito – rund, freundlich'), group: 'Ohne Serifen', css: "'Nunito', ui-rounded, system-ui, sans-serif" },
  montserrat: { label: t('Montserrat – geometrisch, modern'), group: 'Ohne Serifen', css: "'Montserrat', system-ui, sans-serif" },
  raleway: { label: t('Raleway – leicht, stilvoll'), group: 'Ohne Serifen', css: "'Raleway', system-ui, sans-serif" },
  caveat: { label: t('Caveat – Handschrift'), group: 'Handschrift', css: "'Caveat', 'Bradley Hand', 'Segoe Print', cursive" }
}

/** Schriften nach Art gruppiert (für Auswahllisten). */
export const FONT_GROUPS = ([tk('Gerät'), tk('Serif'), tk('Ohne Serifen'), tk('Handschrift')] as const).map((group) => ({
  group,
  fonts: (Object.keys(FONT_INFO) as FontChoice[]).filter((id) => FONT_INFO[id].group === group).map((id) => ({ id, label: FONT_INFO[id].label }))
}))

export const IMAGE_EDGE: Record<ImageSize, { edge: number; label: string }> = {
  klein: { edge: 1024, label: t('Klein (schnell zu teilen)') },
  mittel: { edge: 1600, label: t('Mittel') },
  gross: { edge: 2048, label: t('Groß (beste Qualität)') }
}

export const ACCENT_PRESETS = ['#0d6efd', '#0f766e', '#c2410c', '#be123c', '#7c3aed', '#334155']
