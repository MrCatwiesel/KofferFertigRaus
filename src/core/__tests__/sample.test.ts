import { describe, expect, it } from 'vitest'
import { sampleFrame } from '../sample'

describe('Beispielreise – Rahmen', () => {
  it('läuft gerade: vorgestern bis in vier Tagen', () => {
    const s = sampleFrame('2026-10-15', 't1')
    expect(s.startDate).toBe('2026-10-13')
    expect(s.endDate).toBe('2026-10-19')
    expect(s.day(2)).toBe(s.today)
    expect(s.tripId).toBe('t1')
  })

  it('über den Monatswechsel', () => {
    const s = sampleFrame('2026-03-01')
    expect(s.startDate).toBe('2026-02-27')
    expect(s.day(6)).toBe('2026-03-05')
  })

  it('Arbeit für danach wird gesammelt', async () => {
    const later: (() => Promise<void>)[] = []
    const s = sampleFrame('2026-10-15', 't1', later)
    let ran = false
    s.after(async () => void (ran = true))
    expect(later).toHaveLength(1)
    await later[0]()
    expect(ran).toBe(true)
  })
})
