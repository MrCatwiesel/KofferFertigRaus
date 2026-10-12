import { describe, expect, it } from 'vitest'
import {
  ago,
  applyAction,
  chunk,
  defaultDeviceName,
  generateKey,
  inviteLink,
  isBlobRef,
  isInviteCode,
  mixedContentProblem,
  normalizeInviteCode,
  normalizeServerUrl,
  pairingLink,
  uploadStamp
} from '../logic'
import { keysOf } from '../tracking'

describe('applyAction – neuere gewinnt', () => {
  const local = { id: 'a', updatedAt: '2026-07-02T00:00:00Z' }
  it('neue Daten anlegen, neuere übernehmen, ältere ignorieren', () => {
    expect(applyAction(undefined, { tbl: 't', id: 'a', stamp: '2026-07-01', deleted: false, data: { id: 'a' } })).toBe('put')
    expect(applyAction(local, { tbl: 't', id: 'a', stamp: '2026-07-03T00:00:00Z', deleted: false, data: { id: 'a' } })).toBe('put')
    expect(applyAction(local, { tbl: 't', id: 'a', stamp: '2026-07-01T00:00:00Z', deleted: false, data: { id: 'a' } })).toBe('skip')
    expect(applyAction(local, { tbl: 't', id: 'a', stamp: '2026-07-02T00:00:00Z', deleted: false, data: { id: 'a' } })).toBe('skip')
  })
  it('Löschung nur, wenn lokal nicht neuer', () => {
    expect(applyAction(local, { tbl: 't', id: 'a', stamp: '2026-07-03T00:00:00Z', deleted: true, data: null })).toBe('delete')
    expect(applyAction(local, { tbl: 't', id: 'a', stamp: '2026-07-01T00:00:00Z', deleted: true, data: null })).toBe('skip')
    expect(applyAction(undefined, { tbl: 't', id: 'a', stamp: '2026-07-03T00:00:00Z', deleted: true, data: null })).toBe('skip')
  })
  it('Zeitstempel zum Hochladen', () => {
    expect(uploadStamp({ updatedAt: 'U', createdAt: 'C' }, 'N')).toBe('U')
    expect(uploadStamp({}, 'N')).toBe('N')
  })
})

describe('Hilfen', () => {
  it('erzeugt lange, gut lesbare Schlüssel', () => {
    const k = generateKey()
    expect(k.replace(/-/g, '').length).toBe(32)
    expect(/[0O1lI]/.test(k)).toBe(false)
    expect(generateKey()).not.toBe(k)
  })
  it('Server-Adresse und https-Prüfung', () => {
    expect(normalizeServerUrl(' reise.example.de/ ')).toBe('https://reise.example.de')
    expect(normalizeServerUrl('http://192.168.1.5:8787')).toBe('http://192.168.1.5:8787')
    expect(mixedContentProblem('http://192.168.1.5:8787', 'https:')).toBe(true)
    expect(mixedContentProblem('http://localhost:8787', 'https:')).toBe(false)
    expect(mixedContentProblem('https://reise.example.de', 'https:')).toBe(false)
  })
  it('Kopplungs-Link', () => {
    expect(pairingLink('https://x.github.io/app/#/einstellungen', 'https://s.de', 'abc')).toBe('https://x.github.io/app/#/abgleich?server=https%3A%2F%2Fs.de&key=abc')
  })
  it('Stücke, Zeitangabe, Bildverweis', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(ago(null)).toBe('noch nie')
    expect(ago('2026-07-01T11:50:00Z', new Date('2026-07-01T12:00:00Z'))).toBe('vor 10 Min.')
    expect(isBlobRef({ __blobRef: 'x', type: 'image/jpeg' })).toBe(true)
    expect(isBlobRef({})).toBe(false)
  })
})

describe('Änderungsprotokoll – betroffene Schlüssel', () => {
  it('liest Schlüssel aus Anlegen, Ändern, Löschen; ohne Fehlschläge', () => {
    expect(keysOf({ type: 'add', trans: {} as IDBTransaction, values: [{ id: 'a' }, { id: 'b' }] }, 'id')).toEqual(['a', 'b'])
    expect(keysOf({ type: 'put', trans: {} as IDBTransaction, values: [{ id: 'a' }], keys: ['x'] }, 'id')).toEqual(['x'])
    expect(keysOf({ type: 'delete', trans: {} as IDBTransaction, keys: ['a', 'b'] }, 'id', { 1: new Error() })).toEqual(['a'])
    expect(keysOf({ type: 'put', trans: {} as IDBTransaction, values: [{ tripId: 't1' }] }, 'tripId')).toEqual(['t1'])
  })
})

describe('Geräte-Anmeldung: Hilfen', () => {
  it('erkennt Einladungscodes in jeder Schreibweise', () => {
    expect(isInviteCode('ABCD-EFGH-JKLM')).toBe(true)
    expect(isInviteCode('abcd efgh jklm')).toBe(true)
    expect(normalizeInviteCode('abcd-efgh-jklm')).toBe('ABCDEFGHJKLM')
    expect(isInviteCode('ABCD-EFGH-JKL0')).toBe(false)
    expect(isInviteCode('mein-langer-gruppen-schluessel')).toBe(false)
  })
  it('Einladungslink enthält Code, keinen Schlüssel', () => {
    expect(inviteLink('https://reise.example/#/abgleich', 'https://reise.example', 'ABCD-EFGH-JKLM')).toBe(
      'https://reise.example/#/abgleich?server=https%3A%2F%2Freise.example&code=ABCD-EFGH-JKLM'
    )
  })
  it('schlägt einen Gerätenamen vor', () => {
    expect(defaultDeviceName('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('iPad')
    expect(defaultDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe('iPad')
    expect(defaultDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 0)).toBe('Mac')
    expect(defaultDeviceName('Mozilla/5.0 (Linux; Android 15; Pixel 8) Mobile Safari')).toBe('Android-Handy')
  })
})
