/** Hilfen für das gezeichnete Titelbild (ohne DOM, testbar). */

export type CoverMotif = 'berge' | 'meer' | 'stadt'

const SEA = /meer|see\b|strand|küste|kueste|insel|bucht|lagune|ostsee|nordsee|adria|riviera|algarve|beach|sylt|rügen|ruegen|usedom|mallorca|kreta|korsika|sardinien|sizilien|malediven|kanaren|teneriffa|gran canaria|rhodos|zypern|bornholm|fehmarn/i
const CITY = /stadt|city|berlin|hamburg|münchen|muenchen|köln|wien|paris|rom\b|london|prag|amsterdam|barcelona|madrid|lissabon|budapest|kopenhagen|stockholm|new york|venedig|florenz|dresden|leipzig|brüssel|dublin|edinburgh|krakau|istanbul|athen/i

/** Motiv aus dem Reiseziel: Meer/See, Stadt oder (Standard) Berge */
export function coverMotif(destination: string): CoverMotif {
  if (SEA.test(destination)) return 'meer'
  if (CITY.test(destination)) return 'stadt'
  return 'berge'
}

/** Kleiner Zufallsgenerator mit festem Startwert (mulberry32) – gleiche Reise, gleiches Bild */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Bergkette als SVG-Pfad (Breite 800, unten bei 300): `base` = mittlere Höhe, `amp` = Ausschlag, `peaks` = Anzahl Gipfel */
export function ridge(rnd: () => number, base: number, amp: number, peaks: number): string {
  const step = 800 / peaks
  let d = `M0 300 L0 ${Math.round(base + (rnd() - 0.5) * amp)}`
  for (let i = 0; i < peaks; i++) {
    const x1 = Math.round(i * step + step * (0.35 + rnd() * 0.3))
    const y1 = Math.round(base - amp * (0.4 + rnd() * 0.6))
    const x2 = Math.round((i + 1) * step)
    const y2 = Math.round(base + (rnd() - 0.3) * amp * 0.5)
    d += ` L${x1} ${y1} L${x2} ${y2}`
  }
  return `${d} L800 300 Z`
}
