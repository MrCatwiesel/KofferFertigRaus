/**
 * Alle zu übersetzenden Texte der App finden: $t('…'), t('…'), tn(n, '…', '…') in src/ (ohne Tests).
 * Als Werkzeug:  node build/i18n-texte.mjs [fehlend]   – listet (fehlende englische) Texte je Datei
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const unq = (s) => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\')

/** @returns {Map<string, Set<string>>} Text → Dateien */
export function collectKeys(root = new URL('../src', import.meta.url).pathname) {
  const keys = new Map()
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) {
        if (n !== '__tests__' && n !== 'en') walk(p)
      } else if (/\.(vue|ts)$/.test(n) && !n.endsWith('.d.ts')) {
        // Kommentare zählen nicht (Beispiele in der Doku)
        const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\w])\/\/[^\n]*/g, '$1')
        const add = (k) => {
          if (!keys.has(k)) keys.set(k, new Set())
          keys.get(k).add(relative(root, p))
        }
        for (const m of src.matchAll(/(?<![\w$.])(?:\$?t|N_)\(\s*'((?:[^'\\]|\\.)*)'/g)) add(unq(m[1]))
        for (const m of src.matchAll(/(?<![\w$.])\$?tn\(\s*[^,()]+(?:\([^()]*\))?[^,()]*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'/g)) {
          add(unq(m[1]))
          add(unq(m[2]))
        }
      }
    }
  }
  walk(root)
  // Fehlermeldungen des Servers: die App zeigt sie übersetzt an (t(json.error))
  const server = new URL('../server', `file://${root}/`).pathname
  for (const n of readdirSync(server).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))) {
    const src = readFileSync(join(server, n), 'utf8')
    for (const m of src.matchAll(/HttpError\(\d+, '((?:[^'\\]|\\.)*)'/g)) {
      const k = unq(m[1])
      if (!keys.has(k)) keys.set(k, new Set())
      keys.get(k).add(`server/${n}`)
    }
  }
  return keys
}

/** Englisches Wörterbuch aus src/core/i18n/en/*.ts (einfach eingelesen, ohne TypeScript) */
export async function loadEnglish(root = new URL('../src/core/i18n/en', import.meta.url).pathname) {
  const out = {}
  for (const n of readdirSync(root).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(root, n), 'utf8')
    const body = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)
    Object.assign(out, new Function(`return (${body})`)())
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = collectKeys()
  const en = await loadEnglish()
  const onlyMissing = process.argv[2] === 'fehlend'
  const byFile = new Map()
  for (const [k, files] of keys) {
    if (onlyMissing && k in en) continue
    const f = [...files][0]
    if (!byFile.has(f)) byFile.set(f, [])
    byFile.get(f).push(k)
  }
  let n = 0
  for (const [f, list] of [...byFile].sort()) {
    console.log(`// ${f}`)
    for (const k of list) console.log(`  ${JSON.stringify(k)}: '',`), n++
  }
  console.error(`${n} Texte${onlyMissing ? ' ohne Übersetzung' : ''} (von ${keys.size})`)
}
