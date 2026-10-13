import { describe, expect, it } from 'vitest'
import { ECB_CURRENCIES, parseRate } from '@/services/exchange'
import { currencyName, currencyOf, inEuRoaming, plugTypeFor, vignetteFor } from '@/core/countries'

describe('Wechselkurse', () => {
  it('Antwort lesen', () => {
    expect(parseRate({ amount: 1, base: 'CHF', date: '2026-10-01', rates: { EUR: 1.0712 } }, 'EUR')).toEqual({ rate: 1.0712, date: '2026-10-01' })
    expect(parseRate({ rates: {} }, 'EUR')).toBeNull()
    expect(parseRate(null, 'EUR')).toBeNull()
  })
  it('EZB-Währungen', () => {
    expect(ECB_CURRENCIES.has('CHF')).toBe(true)
    expect(ECB_CURRENCIES.has('MAD')).toBe(false)
  })
})

describe('Länderdaten', () => {
  it('Währung', () => {
    expect(currencyOf('AT')).toBe('EUR')
    expect(currencyOf('BG')).toBe('EUR') // seit 2026
    expect(currencyOf('CH')).toBe('CHF')
    expect(currencyOf('ZZ')).toBeNull()
    expect(currencyName('CHF')).toBe('Schweizer Franken')
  })
  it('Roaming, Stecker, Vignette', () => {
    expect(inEuRoaming('NO')).toBe(true)
    expect(inEuRoaming('CH')).toBe(false)
    expect(plugTypeFor('GB')).toMatch(/^G/)
    expect(plugTypeFor('AT')).toBeNull()
    expect(vignetteFor('AT')).toContain('Vignette')
    expect(vignetteFor('IT')).toBeNull()
  })
})
