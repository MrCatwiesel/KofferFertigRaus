import { describe, expect, it } from 'vitest'
import { backoffMs, pinHash, validPin } from '../lock'

describe('App-Sperre', () => {
  it('Code-Format', () => {
    expect(validPin('1234')).toBe(true)
    expect(validPin('12345678')).toBe(true)
    expect(validPin('123')).toBe(false)
    expect(validPin('12a4')).toBe(false)
  })
  it('Prüfwert: gleich bei gleichem Salz, verschieden bei anderem Code/Salz', async () => {
    const salt = new Uint8Array(16).fill(7)
    const a = await pinHash('2468', salt, 1000)
    expect(await pinHash('2468', salt, 1000)).toBe(a)
    expect(await pinHash('2469', salt, 1000)).not.toBe(a)
    expect(await pinHash('2468', new Uint8Array(16).fill(8), 1000)).not.toBe(a)
    expect(a).not.toContain('2468')
  })
  it('Wartezeit nach Fehlversuchen', () => {
    expect(backoffMs(4)).toBe(0)
    expect(backoffMs(5)).toBe(30_000)
    expect(backoffMs(6)).toBe(60_000)
    expect(backoffMs(30)).toBe(3600_000)
  })
})
