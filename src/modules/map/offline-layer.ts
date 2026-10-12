/**
 * Zeichnet gespeicherte Offline-Karten in Leaflet (Vektor-Kacheln aus der PMTiles-Datei auf dem Gerät).
 * Die Bibliotheken werden erst geladen, wenn eine Offline-Karte gezeigt wird – der App-Start bleibt schlank.
 */
import L from 'leaflet'
import type { OfflineMap } from './offline'

export const OFFLINE_ATTRIBUTION =
  '<a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a> © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'

/** Eine Ebene je Karte, jeweils auf ihren Ausschnitt begrenzt (mehrere Karten ergänzen sich). */
export async function createOfflineLayers(maps: OfflineMap[], dark: boolean): Promise<L.Layer[]> {
  // protomaps-leaflet erwartet Leaflet als globales „L“
  ;(window as unknown as { L: typeof L }).L = L
  const [{ leafletLayer }, { PMTiles, FileSource }] = await Promise.all([import('protomaps-leaflet'), import('pmtiles')])
  const layers: L.Layer[] = []
  for (const m of maps) {
    const [w, s, e, n] = m.bbox
    const file = m.blob instanceof File ? m.blob : new File([m.blob], `${m.id}.pmtiles`)
    const archive = new PMTiles(new FileSource(file))
    // Höchste Zoomstufe aus der Datei selbst – darüber werden die Kacheln vergrößert
    const header = await archive.getHeader()
    const layer = leafletLayer({
      url: archive,
      flavor: dark ? 'dark' : 'light',
      lang: 'de',
      maxDataZoom: header.maxZoom || m.maxzoom,
      maxZoom: 19,
      bounds: L.latLngBounds([s, w], [n, e]),
      attribution: OFFLINE_ATTRIBUTION
    }) as unknown as L.Layer
    layers.push(layer)
  }
  return layers
}
