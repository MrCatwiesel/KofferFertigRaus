import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { RouteRecordRaw } from 'vue-router'
import { registerAllModules } from '@/modules'
import { getModules } from '@/core/registry'
import { helpDe } from '../topics.de'
import { parseChangelog } from '../whats-new'

registerAllModules()

function names(routes: readonly RouteRecordRaw[]): string[] {
  return routes.flatMap((r) => [...(typeof r.name === 'string' ? [r.name] : []), ...names(r.children ?? [])])
}

/** Routen-Namen des Kerns (router.ts) – der Router selbst braucht ein Browserfenster */
const coreNames = [...readFileSync('src/core/router.ts', 'utf8').matchAll(/name: '([^']+)'/g)].map((m) => m[1])
const allRoutes = [...coreNames, ...getModules().flatMap((m) => names(m.routes))]

describe('Hilfetexte (Deutsch)', () => {
  it('jede Seite der App hat ein Hilfe-Thema', () => {
    expect(allRoutes.length).toBeGreaterThan(50)
    const covered = new Set(helpDe.topics.flatMap((t) => t.routes ?? []))
    expect(allRoutes.filter((n) => !covered.has(n))).toEqual([])
  })

  it('keine Seite steht bei zwei Themen, keine erfundenen Seiten', () => {
    const seen = helpDe.topics.flatMap((t) => t.routes ?? [])
    expect(seen.filter((n, i) => seen.indexOf(n) !== i)).toEqual([])
    expect(seen.filter((n) => !allRoutes.includes(n))).toEqual([])
  })

  it('eindeutige Themen in bekannten Bereichen', () => {
    const ids = helpDe.topics.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    const groups = new Set(helpDe.groups.map((g) => g.id))
    expect(helpDe.topics.filter((t) => !groups.has(t.group)).map((t) => t.id)).toEqual([])
  })

  it('alle Verweise #/hilfe/… zeigen auf vorhandene Themen', () => {
    const ids = new Set(helpDe.topics.map((t) => t.id))
    const broken = helpDe.topics.flatMap((t) => [...t.body.matchAll(/\(#\/hilfe\/([^)#]+)\)/g)].map((m) => `${t.id} → ${m[1]}`)).filter((l) => !ids.has(l.split(' → ')[1]))
    expect(broken).toEqual([])
  })

  it('jedes Thema hat Inhalt (außer „Was ist neu“, das aus dem Änderungsprotokoll kommt)', () => {
    expect(helpDe.topics.filter((t) => t.id !== 'neu' && t.body.trim().length < 80).map((t) => t.id)).toEqual([])
  })
})

describe('Änderungsprotokoll', () => {
  it('beginnt mit der aktuellen Version aus package.json', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
    expect(parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))[0]?.version).toBe(pkg.version)
  })
})
