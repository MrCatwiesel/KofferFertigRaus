import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

/**
 * Ein Abschnitt auf der Reise-Detailseite, den ein Modul beisteuert
 * (z. B. "Unterkünfte · 2 gebucht"). So zeigt die Reise-Seite neue Module an,
 * ohne sie zu kennen.
 */
export interface TripSection {
  title: string
  /** Bootstrap-Icon-Name ohne "bi-" */
  icon: string
  /** Ziel-Route für eine Reise */
  to: (tripId: string) => string
  /** Kurze Zusammenfassung, z. B. "3 Nächte gebucht" */
  summary?: (tripId: string) => Promise<string>
  /** Geplante Kosten dieses Bereichs (für den Budget-Vergleich) */
  plannedCost?: (tripId: string) => Promise<number>
}

/** Ein Foto, das eine Fotoquelle liefert (schon als Bild-Datei, wird wie ein Kamerafoto verarbeitet). */
export interface PickedPhoto {
  blob: Blob
  caption: string
  /** Aufnahmezeit (ISO), sonst leer */
  takenAt: string
  /** Verweis auf die Herkunft, z. B. "piwigo:123" – solche Fotos werden nicht erneut hochgeladen */
  externalRef: string
  /** Link zum Foto in der Quelle (zum Öffnen im Browser) */
  externalUrl: string
}

/**
 * Zusätzliche Fotoquelle im Tagebuch (z. B. Piwigo). Die Komponente bekommt die Prop `tripId`
 * und meldet die Auswahl mit dem Ereignis `picked` (PickedPhoto[]) oder `close`.
 */
export interface PhotoSource {
  label: string
  /** Bootstrap-Icon-Name ohne "bi-" */
  icon: string
  /** Nur anbieten, wenn verfügbar (z. B. Server eingerichtet) */
  available: () => Promise<boolean>
  component: () => Promise<Component | { default: Component }>
}

/** Ein neu aufgenommenes Foto samt Originaldatei (vor dem Verkleinern). */
export interface AddedPhoto {
  photoId: string
  tripId: string
  entryId: string
  original: Blob
  filename: string
  caption: string
  takenAt: string
}

/** Eine Linie auf der Reisekarte (z. B. eine Route), die ein anderes Modul beisteuert. */
export interface MapOverlay {
  id: string
  name: string
  color: string
  /** [Breite, Länge] */
  points: [number, number][]
  /** Tag (YYYY-MM-DD) oder leer – für den Tagesfilter der Karte */
  date: string
  /** Detailseite in der App */
  to: string
  /** Kurzinfo, z. B. "12,3 km · ↗ 850 m" */
  info: string
}

/** Verweis, der im Tagebuch unter einem Tag erscheint (z. B. die Wanderung des Tages). */
export interface DayLink {
  date: string
  label: string
  /** Bootstrap-Icon-Name ohne "bi-" */
  icon: string
  to: string
  color?: string
}

/**
 * Vertrag, den jedes Modul erfüllt. Module kennen einander nicht –
 * sie melden sich nur hier beim Kern an.
 */
export interface AppModule {
  /** Eindeutige, kurze ID, z. B. "trip", "packing" */
  id: string
  /** Anzeigename im Menü */
  title: string
  /** Bootstrap-Icon-Name ohne "bi-", z. B. "suitcase" */
  icon: string
  /** Routen des Moduls */
  routes: RouteRecordRaw[]
  /** Ziel des Menüeintrags; ohne Angabe erscheint das Modul nicht im Menü */
  navTo?: string
  /** Reihenfolge im Menü und auf der Reise-Seite (klein = weiter vorne) */
  order?: number
  /** Abschnitt auf der Reise-Detailseite */
  tripSection?: TripSection
  /** Aufräumen, wenn eine Reise gelöscht wird (eigene Daten zur Reise entfernen) */
  onTripDelete?: (tripId: string) => Promise<void>
  /** Eine Reise wurde angelegt oder geändert (z. B. Zielländer → Reisehinweise holen) */
  onTripSaved?: (tripId: string) => Promise<void>
  /** Zusätzliche Fotoquelle im Tagebuch */
  photoSource?: PhotoSource
  /** Neue eigene Fotos wurden gespeichert (mit Original, z. B. zum Hochladen in eine Galerie) */
  onPhotosAdded?: (photos: AddedPhoto[]) => Promise<void>
  /** Wird einmal nach dem App-Start aufgerufen (z. B. Hintergrund-Aufgaben starten) */
  onStart?: () => void
  /** Linien für die Reisekarte */
  mapOverlays?: (tripId: string) => Promise<MapOverlay[]>
  /** Verweise unter den Tagen im Tagebuch */
  dayLinks?: (tripId: string) => Promise<DayLink[]>
}

const modules: AppModule[] = []

export function registerModule(mod: AppModule): void {
  if (modules.some((m) => m.id === mod.id)) {
    throw new Error(`Modul "${mod.id}" ist bereits registriert.`)
  }
  modules.push(mod)
}

export function getModules(): readonly AppModule[] {
  return [...modules].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export function getNavItems() {
  return getModules()
    .filter((m) => m.navTo)
    .map((m) => ({ id: m.id, title: m.title, icon: m.icon, to: m.navTo! }))
}

export function getTripSections(): (TripSection & { moduleId: string })[] {
  return getModules()
    .filter((m) => m.tripSection)
    .map((m) => ({ ...m.tripSection!, moduleId: m.id }))
}

/** Ruft die Aufräum-Funktionen aller Module für eine gelöschte Reise auf. */
export async function notifyTripDeleted(tripId: string): Promise<void> {
  for (const m of getModules()) {
    if (m.onTripDelete) await m.onTripDelete(tripId)
  }
}

/** Alle zusätzlichen Fotoquellen (für das Tagebuch). */
/** Nach dem Speichern einer Reise: Module benachrichtigen (Fehler einzelner Module stören nicht). */
export async function notifyTripSaved(tripId: string): Promise<void> {
  for (const m of modules) {
    if (!m.onTripSaved) continue
    try {
      await m.onTripSaved(tripId)
    } catch (e) {
      console.warn(`onTripSaved (${m.id}):`, e)
    }
  }
}

export function getPhotoSources(): (PhotoSource & { moduleId: string })[] {
  return getModules()
    .filter((m) => m.photoSource)
    .map((m) => ({ ...m.photoSource!, moduleId: m.id }))
}

/** Meldet neue eigene Fotos an alle Module (Fehler eines Moduls stören die anderen nicht). */
export async function notifyPhotosAdded(photos: AddedPhoto[]): Promise<void> {
  if (!photos.length) return
  for (const m of getModules()) {
    if (!m.onPhotosAdded) continue
    try {
      await m.onPhotosAdded(photos)
    } catch (e) {
      console.error(`[${m.id}] onPhotosAdded`, e)
    }
  }
}

/** Startet die Hintergrund-Aufgaben der Module. */
export function startModules(): void {
  for (const m of getModules()) m.onStart?.()
}

/** Linien aller Module für die Reisekarte (innerhalb einer Live-Abfrage aufrufen, dann aktualisiert sich die Karte). */
export async function getMapOverlays(tripId: string): Promise<MapOverlay[]> {
  const lists = await Promise.all(getModules().map((m) => m.mapOverlays?.(tripId) ?? Promise.resolve([])))
  return lists.flat()
}

/** Verweise aller Module unter den Tagen im Tagebuch. */
export async function getDayLinks(tripId: string): Promise<DayLink[]> {
  const lists = await Promise.all(getModules().map((m) => m.dayLinks?.(tripId) ?? Promise.resolve([])))
  return lists.flat()
}
