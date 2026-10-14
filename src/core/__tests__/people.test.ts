import { describe, expect, it } from 'vitest'
import { canCreateTrips, canEdit, emptyPeople, isMine, linkedMember, mergeLinks, myParticipant, peopleFromInfo, sharedLabel, tripRoleOf, type PeopleState } from '../people'

const marco = { id: 'm1', name: 'Marco', role: 'verwalter' as const }
const birgit = { id: 'b1', name: 'Birgit', role: 'mitglied' as const }
const lea = { id: 'l1', name: 'Lea', role: 'leser' as const }
const state = (me: PeopleState['me'], tripAccess: PeopleState['tripAccess'] = {}): PeopleState => ({
  enabled: true,
  me,
  manager: me?.role === 'verwalter',
  members: [marco, birgit, lea],
  tripAccess
})

describe('Personen & Rechte', () => {
  it('Recht je Reise: Rolle als Standard, Abweichung gewinnt, Verwalter immer', () => {
    expect(tripRoleOf(emptyPeople(), 't')).toBe('bearbeiten')
    expect(tripRoleOf(state(lea), 't')).toBe('lesen')
    expect(tripRoleOf(state(lea, { t: 'bearbeiten' }), 't')).toBe('bearbeiten')
    expect(tripRoleOf(state(birgit, { t: 'kein' }), 't')).toBe('kein')
    expect(tripRoleOf(state(marco, { t: 'kein' }), 't')).toBe('bearbeiten')
    expect(canEdit('t', state(birgit, { t: 'lesen' }))).toBe(false)
    expect(canCreateTrips(state(lea))).toBe(false)
    expect(canCreateTrips(emptyPeople())).toBe(true)
  })

  it('Verknüpfung Teilnehmer ↔ Person', () => {
    const links = { Marco: 'm1', Birgit: 'b1', Alt: 'weg' }
    expect(linkedMember(state(birgit), links, 'Marco')?.name).toBe('Marco')
    expect(linkedMember(state(birgit), links, 'Alt')).toBeNull()
    expect(isMine(state(birgit), links, 'Birgit')).toBe(true)
    expect(isMine(state(birgit), links, 'Marco')).toBe(false)
    expect(isMine(emptyPeople(), links, 'Birgit')).toBe(false)
    expect(myParticipant(state(birgit), links)).toBe('Birgit')
  })

  it('mergeLinks: fremde Verknüpfungen bleiben, eigene und freie nach Wunsch, jede Person nur einmal', () => {
    const before = { Marco: 'm1', Birgit: 'b1' }
    // Birgit versucht Marcos Verknüpfung zu lösen und sich als „Kind“ einzutragen
    expect(mergeLinks(state(birgit), before, { Kind: 'b1' }, ['Marco', 'Birgit', 'Kind'])).toEqual({ Marco: 'm1', Kind: 'b1' })
    // Teilnehmer „Marco“ entfernt: Verknüpfung bleibt trotzdem (nur Marco darf sie lösen)
    expect(mergeLinks(state(birgit), before, { Birgit: 'b1' }, ['Birgit'])).toEqual({ Marco: 'm1', Birgit: 'b1' })
    // Gerät ohne Person (Gruppenschlüssel) darf alles
    expect(mergeLinks(emptyPeople(), before, { Birgit: 'b1' }, ['Marco', 'Birgit'])).toEqual({ Birgit: 'b1' })
    // Freie Namen an andere Personen verknüpfen ist erlaubt
    expect(mergeLinks(state(marco), {}, { Lea: 'l1', Marco: 'm1' }, ['Marco', 'Lea'])).toEqual({ Marco: 'm1', Lea: 'l1' })
  })

  it('Freigabe in Worten', () => {
    expect(sharedLabel(state(birgit), [])).toBe('Privat – nur für dich sichtbar')
    expect(sharedLabel(state(birgit), ['*'])).toBe('Für alle in der Reisegruppe sichtbar')
    expect(sharedLabel(state(birgit), ['m1', 'l1'])).toBe('Privat · freigegeben für Marco, Lea')
  })

  it('aus /api/info übernehmen', () => {
    expect(peopleFromInfo({})).toEqual(emptyPeople())
    const p = peopleFromInfo({ people: true, member: birgit, manager: false, members: [marco, birgit], tripAccess: { t: 'lesen' } })
    expect(p.me).toEqual(birgit)
    expect(p.manager).toBe(false)
    expect(p.tripAccess).toEqual({ t: 'lesen' })
  })
})
