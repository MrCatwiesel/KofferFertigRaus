import { describe, expect, it } from 'vitest'
import { accessLabel, describeShare, emptyShareDraft, shareName, shareState, shareUrl } from '../logic'

describe('Lese-Links', () => {
  it('baut die Adresse', () => {
    expect(shareUrl('https://reise.example.de/', 'AbCdEfGhIjKlMnOpQrStUv')).toBe('https://reise.example.de/s/AbCdEfGhIjKlMnOpQrStUv')
  })

  it('erkennt den Zustand', () => {
    const now = '2026-07-10T00:00:00Z'
    expect(shareState({ revoked: false, expires: null }, now)).toBe('aktiv')
    expect(shareState({ revoked: true, expires: null }, now)).toBe('zurückgezogen')
    expect(shareState({ revoked: false, expires: '2026-07-01T00:00:00Z' }, now)).toBe('abgelaufen')
    expect(shareState({ revoked: false, expires: '2026-08-01T00:00:00Z' }, now)).toBe('aktiv')
  })

  it('beschreibt Links', () => {
    expect(describeShare({ mode: 'highlights', photos: true, password: false })).toBe('Nur Highlights · mit Fotos')
    expect(describeShare({ mode: 'journal', photos: false, password: true })).toBe('Ganzes Tagebuch · ohne Fotos · Passwort')
    expect(accessLabel({ accessCount: 0 })).toBe('Noch nicht geöffnet')
    expect(accessLabel({ accessCount: 3 })).toBe('3× geöffnet')
    expect(shareName({ note: 'Familie', title: 'X', mode: 'journal' })).toBe('Familie')
    expect(shareName({ note: '', title: '', mode: 'journal' })).toBe('Ganzes Tagebuch')
  })

  it('startet mit Highlights und Fotos, ohne Passwort und Ablauf', () => {
    expect(emptyShareDraft()).toEqual({ mode: 'highlights', photos: true, routes: true, stays: true, stayDetails: false, activities: false, title: '', note: '', password: '', expiresDays: null, look: null })
  })
})
