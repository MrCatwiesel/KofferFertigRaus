/**
 * Erzeugt server/daten/meteoalarm-regionen.json.gz aus den Warnregionen (EMMA_ID) von MeteoAlarm.
 * Die Umrisse werden vereinfacht (Douglas-Peucker, ~400 m) und auf 3 Nachkommastellen gerundet – das reicht,
 * um einen Ort seiner Warnregion zuzuordnen, und hält die Datei klein (~350 KB statt 31 MB).
 *
 *   node werkzeuge/meteoalarm-regionen.mjs <geocodes.json>
 *
 * Quelle der geocodes.json: MeteoAlarm (EUMETNET), z. B. im Paket „meteoalarm“ (assets/geocodes.json).
 * Ergebnis: { "<EMMA_ID>": ["<Land>", "<Name>", [[lon,lat,lon,lat,…], …]] } – alle Ringe (auch Löcher) flach,
 * Punkt-in-Fläche nach der Gerade-Ungerade-Regel.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const TOL = 0.005
const r3 = (v) => Math.round(v * 1000) / 1000

function simplify(pts) {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0]
  const [bx, by] = pts.at(-1)
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  let idx = 0
  let max = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i]
    const d = len ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len : Math.hypot(px - ax, py - ay)
    if (d > max) [idx, max] = [i, d]
  }
  if (max <= TOL) return [pts[0], pts.at(-1)]
  return [...simplify(pts.slice(0, idx + 1)).slice(0, -1), ...simplify(pts.slice(idx))]
}

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const out = {}
for (const f of src.features) {
  const p = f.properties
  if (p.type !== 'EMMA_ID') continue
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const rings = []
  for (const poly of polys) {
    for (const ring of poly) {
      // Geschlossener Ring: an der weitesten Stelle teilen, sonst fällt er auf eine Linie zusammen
      const pts = ring.map(([x, y]) => [r3(x), r3(y)])
      const far = pts.reduce((b, q, i) => (Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) > Math.hypot(pts[b][0] - pts[0][0], pts[b][1] - pts[0][1]) ? i : b), 0)
      const s = far > 0 ? [...simplify(pts.slice(0, far + 1)).slice(0, -1), ...simplify(pts.slice(far))] : pts
      if (s.length >= 4) rings.push(s.flat())
    }
  }
  if (!rings.length) rings.push(polys[0][0].flatMap(([x, y]) => [r3(x), r3(y)]))
  out[p.code] = [p.country, p.name, rings]
}
const json = JSON.stringify(out)
const target = new URL('../daten/meteoalarm-regionen.json.gz', import.meta.url)
writeFileSync(target, gzipSync(json, { level: 9 }))
console.log(`${Object.keys(out).length} Regionen, ${Math.round(json.length / 1024)} KB, gepackt ${Math.round(gzipSync(json, { level: 9 }).length / 1024)} KB`)
