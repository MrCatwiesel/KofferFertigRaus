/**
 * Übersetzungs-Schlüssel aus dem Quelltext sammeln (für den Test und für neue Sprachen).
 *
 * Gefunden werden die deutschen Texte in `t('…')`, `tk('…')` und `tn(n, '…', '…')`.
 * Schlüssel müssen feste Texte sein (keine `${…}` darin) – Werte kommen als Platzhalter `{name}` hinein.
 *
 * Aufruf von der Kommandozeile:
 *   node build/i18n-keys.mjs fehlend en   → fehlende Einträge als Zeilen zum Einfügen in src/i18n/locales/en.ts
 *   node build/i18n-keys.mjs neu it       → Vorlage für eine neue Sprache (alle Texte, Deutsch als Platzhalter)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const Q = String.raw`(['"\x60])((?:\\.|(?!\1)[^\\])*)\1`
const SINGLE = new RegExp(String.raw`(?<![\w.$])(?:t|tk)\(\s*` + Q, 'g')
const Q2 = String.raw`(['"\x60])((?:\\.|(?!\3)[^\\])*)\3`
const PLURAL = new RegExp(String.raw`(?<![\w.$])tn\(\s*(?:[^,()]|\((?:[^()]|\([^()]*\))*\))+?,\s*` + Q + String.raw`\s*,\s*` + Q2, 'g')

function unescape(s) {
  return s.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c))
}

/** Kommentare entfernen (Beispiele dort sind keine Schlüssel) */
function stripComments(s) {
  return s
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'locales' || name === 'node_modules') continue
      walk(p, out)
    } else if (/\.(ts|vue|mjs)$/.test(name) && !/\.d\.ts$/.test(name) && !/^topics\./.test(name)) out.push(p)
  }
  return out
}

/**
 * Alle Schlüssel mit Fundstellen.
 * @returns {{ keys: Map<string, string[]>, problems: string[] }}
 */
export function collectKeys(root) {
  const keys = new Map()
  const problems = []
  const add = (key, where) => {
    if (key.includes('${')) problems.push(`${where}: Schlüssel mit \${…} – Platzhalter {name} verwenden: ${key}`)
    else if (!keys.has(key)) keys.set(key, [where])
    else keys.get(key).push(where)
  }
  const src = join(root, 'src')
  for (const file of walk(src, [])) {
    const text = stripComments(readFileSync(file, 'utf8'))
    const rel = relative(root, file)
    for (const m of text.matchAll(SINGLE)) add(unescape(m[2]), rel)
    for (const m of text.matchAll(PLURAL)) {
      add(unescape(m[2]), rel)
      add(unescape(m[4]), rel)
    }
  }
  return { keys, problems }
}

/** Platzhalter eines Textes, sortiert */
export function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
}

const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`

async function main() {
  const [cmd, code] = process.argv.slice(2)
  const root = fileURLToPath(new URL('..', import.meta.url))
  const { keys } = collectKeys(root)
  if (cmd === 'neu' && code) {
    console.log(`import type { Messages } from '../index'\n\n/** Sprachdatei ${code} – rechts übersetzen */\nexport const intl = '${code}'\n\nexport default {`)
    for (const k of [...keys.keys()].sort()) console.log(`  ${quote(k)}: ${quote(k)},`)
    console.log('} satisfies Messages')
    return
  }
  if (cmd === 'fehlend' && code) {
    const src = readFileSync(join(root, 'src/i18n/locales', `${code}.ts`), 'utf8')
    for (const [k, where] of keys) {
      if (!src.includes(quote(k) + ':')) console.log(`  ${quote(k)}: '', // ${where[0]}`)
    }
    return
  }
  console.log('Aufruf: node build/i18n-keys.mjs fehlend <sprache> | neu <sprache>')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
