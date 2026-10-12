import { describe, expect, it } from 'vitest'
import { formatDecimal, formatGarmin, parseCoordinates } from '../coordinates'

const near = (r: { lat: number; lon: number } | null, lat: number, lon: number) =>
  !!r && Math.abs(r.lat - lat) < 1e-4 && Math.abs(r.lon - lon) < 1e-4

describe('GPS-Koordinaten lesen', () => {
  it('Dezimalgrad in vielen Schreibweisen', () => {
    expect(near(parseCoordinates('47.0751, 12.7530'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('47.0751 12.7530'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('47,0751; 12,7530'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('47,0751 12,7530'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('-33.8568, 151.2153'), -33.8568, 151.2153)).toBe(true)
    expect(near(parseCoordinates('N 47.0751 E 12.7530'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('47.0751N 12.7530O'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('S 33.8568 W 70.5'), -33.8568, -70.5)).toBe(true)
    expect(near(parseCoordinates('E 12.7530 N 47.0751'), 47.0751, 12.753)).toBe(true)
  })

  it('Garmin-Format (Grad + Dezimalminuten) und Grad/Minuten/Sekunden', () => {
    expect(near(parseCoordinates("N 47° 04.507' E 012° 45.180'"), 47.07512, 12.753)).toBe(true)
    expect(near(parseCoordinates('N47 04.507 E012 45.180'), 47.07512, 12.753)).toBe(true)
    expect(near(parseCoordinates('47°04\'30.4"N 12°45\'10.8"E'), 47.07511, 12.753)).toBe(true)
    expect(near(parseCoordinates('47°04′30.4″N 12°45′10.8″E'), 47.07511, 12.753)).toBe(true)
  })

  it('Links von Google Maps und Apple Karten', () => {
    expect(near(parseCoordinates('https://www.google.com/maps/@47.0751,12.753,15z'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('https://maps.google.com/?q=47.0751,12.753'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('https://maps.apple.com/?ll=47.0751,12.753&q=Pin'), 47.0751, 12.753)).toBe(true)
    expect(near(parseCoordinates('https://www.google.com/maps/place/X/data=!3d47.0751!4d12.753'), 47.0751, 12.753)).toBe(true)
  })

  it('Adressen und Unsinn sind keine Koordinaten', () => {
    expect(parseCoordinates('Hauptstraße 12, Riva')).toBeNull()
    expect(parseCoordinates('Malcesine')).toBeNull()
    expect(parseCoordinates('12')).toBeNull()
    expect(parseCoordinates('95.0, 12.0')).toBeNull()
    expect(parseCoordinates("N 47° 64.0' E 12° 10.0'")).toBeNull()
    expect(parseCoordinates('N 47.1')).toBeNull()
    expect(parseCoordinates('')).toBeNull()
  })

  it('schreibt Koordinaten', () => {
    expect(formatDecimal(47.07512, 12.753)).toBe('47.07512, 12.75300')
    expect(formatGarmin(47.07512, 12.753)).toBe("N 47° 04.507' E 012° 45.180'")
    expect(formatGarmin(-33.8568, -70.5)).toBe("S 33° 51.408' W 070° 30.000'")
    expect(near(parseCoordinates(formatGarmin(47.07512, 12.753)), 47.07512, 12.753)).toBe(true)
  })
})
