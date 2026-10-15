/**
 * Personen und Rechte (Server 1.16) – was dieses Gerät über sich weiß.
 *
 * Die Rechte setzt der Server durch (Unsichtbares kommt gar nicht erst an, unerlaubte Änderungen werden
 * zurückgenommen). Die App nutzt diese Angaben nur, um passend anzuzeigen: „Nur lesen“, „Privat“, Freigabe.
 * Ohne Server oder mit Gruppenschlüssel (`me` leer) gilt: alles erlaubt.
 */
import { reactive } from 'vue'
import { t } from '@/i18n'

export type MemberRole = 'verwalter' | 'mitglied' | 'leser'
export type TripRole = 'bearbeiten' | 'lesen' | 'kein'

export interface PersonInfo {
  id: string
  name: string
  role: MemberRole
}

export interface PeopleState {
  /** Server kennt Personen */
  enabled: boolean
  /** Ich (Person dieses Geräts) – null: Gerät ohne Person, volle Rechte */
  me: PersonInfo | null
  /** Darf Personen und Rechte verwalten */
  manager: boolean
  /** Aktive Personen der Reisegruppe */
  members: PersonInfo[]
  /** Abweichende Rechte je Reise (nur meine) */
  tripAccess: Record<string, TripRole>
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  verwalter: t('Verwalter'),
  mitglied: t('Mitglied'),
  leser: t('Nur lesen')
}

export const TRIP_ROLE_LABEL: Record<TripRole, string> = {
  bearbeiten: t('Bearbeiten'),
  lesen: t('Nur lesen'),
  kein: t('Kein Zugriff')
}

export const emptyPeople = (): PeopleState => ({ enabled: false, me: null, manager: true, members: [], tripAccess: {} })

export const people = reactive<PeopleState>(emptyPeople())

/** Verknüpfung Teilnehmer-Name → Person (am Datensatz der Reise). */
export type MemberLinks = Record<string, string>

/** Mein Recht an einer Reise. */
export function tripRoleOf(state: PeopleState, tripId: string | undefined): TripRole {
  if (!state.me || state.me.role === 'verwalter') return 'bearbeiten'
  const o = tripId ? state.tripAccess[tripId] : undefined
  if (o) return o
  return state.me.role === 'leser' ? 'lesen' : 'bearbeiten'
}

export const canEdit = (tripId: string | undefined, state: PeopleState = people) => tripRoleOf(state, tripId) === 'bearbeiten'

/** Darf ich neue Reisen anlegen? */
export const canCreateTrips = (state: PeopleState = people) => !state.me || state.me.role !== 'leser'

/** Person, mit der ein Teilnehmer-Name verknüpft ist (nur aktive Personen). */
export function linkedMember(state: PeopleState, links: MemberLinks | undefined, name: string): PersonInfo | null {
  const id = name ? links?.[name] : undefined
  return (id && state.members.find((m) => m.id === id)) || null
}

/** Ist dieser Teilnehmer-Name mit mir verknüpft? (dann sind seine Einträge privat) */
export function isMine(state: PeopleState, links: MemberLinks | undefined, name: string): boolean {
  return !!state.me && !!name && links?.[name] === state.me.id
}

/** Mein Teilnehmer-Name in einer Reise – oder ''. */
export function myParticipant(state: PeopleState, links: MemberLinks | undefined): string {
  if (!state.me || !links) return ''
  return Object.keys(links).find((n) => links[n] === state.me!.id) ?? ''
}

/**
 * Verknüpfungen nach dem Bearbeiten: eigene und freie Namen nach Wunsch, fremde bleiben unangetastet
 * (die darf nur die Person selbst lösen – der Server lehnt es sonst ab).
 */
export function mergeLinks(state: PeopleState, before: MemberLinks | undefined, wanted: MemberLinks, participants: string[]): MemberLinks {
  const out: MemberLinks = {}
  const old = before ?? {}
  const foreign = (name: string) => !!old[name] && old[name] !== state.me?.id && state.members.some((m) => m.id === old[name]) && !!state.me
  for (const [name, id] of Object.entries(old)) if (foreign(name)) out[name] = id
  for (const name of participants) {
    if (foreign(name)) continue
    const id = wanted[name]
    if (id) out[name] = id
  }
  // Eine Person nur einmal je Reise
  const seen = new Set<string>()
  for (const name of Object.keys(out)) {
    if (seen.has(out[name])) delete out[name]
    else seen.add(out[name])
  }
  return out
}

/** Freigabe eines privaten Eintrags in Worten. */
export function sharedLabel(state: PeopleState, shared: string[] | undefined): string {
  const list = shared ?? []
  if (list.includes('*')) return t('Für alle in der Reisegruppe sichtbar')
  const names = list.map((id) => state.members.find((m) => m.id === id)?.name).filter(Boolean)
  return names.length ? t('Privat · freigegeben für {names}', { names: names.join(', ') }) : t('Privat – nur für dich sichtbar')
}

/** Aus den Server-Angaben (GET /api/info) übernehmen. */
export function peopleFromInfo(info: {
  people?: boolean
  member?: PersonInfo | null
  manager?: boolean
  members?: PersonInfo[]
  tripAccess?: Record<string, TripRole>
}): PeopleState {
  if (!info.people) return emptyPeople()
  return {
    enabled: true,
    me: info.member ? { id: info.member.id, name: info.member.name, role: info.member.role } : null,
    manager: info.manager !== false,
    members: (info.members ?? []).map((m) => ({ id: m.id, name: m.name, role: m.role })),
    tripAccess: { ...(info.tripAccess ?? {}) }
  }
}

export function setPeople(next: PeopleState): void {
  Object.assign(people, next)
}
