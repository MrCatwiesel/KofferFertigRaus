/**
 * Ungenutztes CSS entfernen – ohne Fremdpakete.
 *
 * Bootstrap und die Bootstrap-Icons bringen tausende Regeln mit, die App nutzt nur einen Bruchteil.
 * Vorgehen (bewusst großzügig, damit nichts verloren geht):
 *  - Aus allen Quelltexten werden alle „Wörter“ gesammelt (Buchstaben, Ziffern, - und _).
 *  - Ein Selektor bleibt, wenn jede seiner Klassen als Wort vorkommt (oder auf der Sicherheitsliste steht).
 *    Für Icons (.bi-xyz) reicht es, wenn „xyz“ vorkommt – Namen werden oft zusammengesetzt (`bi-${icon}`).
 *  - Selektoren ohne Klassen, @font-face, @keyframes usw. bleiben immer.
 * Klassen, die Bootstrap selbst per JavaScript setzt (show, collapsing …), stehen in dessen Quelltext und
 * werden deshalb mitgescannt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const KEEP_AT = /^@(font-face|keyframes|-webkit-keyframes|property|page|counter-style|font-feature-values)\b/i
const NEST_AT = /^@(media|supports|container|layer|document)\b/i

/** Alle Wörter aus Dateien/Ordnern (rekursiv; nur Textdateien). */
export function collectTokens(paths, exts = /\.(vue|ts|js|mjs|html)$/) {
  const tokens = new Set()
  const add = (text) => {
    for (const t of text.split(/[^A-Za-z0-9_-]+/)) if (t) tokens.add(t)
  }
  const walk = (p) => {
    let st
    try {
      st = statSync(p)
    } catch {
      return
    }
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) if (name !== 'node_modules' && !name.startsWith('.')) walk(join(p, name))
    } else if (exts.test(p)) add(readFileSync(p, 'utf8'))
  }
  for (const p of paths) walk(p)
  return tokens
}

/** CSS in Bausteine zerlegen: { prelude, body } für Blöcke, { text } für Anweisungen wie @charset. */
function parse(css) {
  const items = []
  let i = 0
  let start = 0
  const n = css.length
  const skipString = (q) => {
    i++
    while (i < n && css[i] !== q) i += css[i] === '\\' ? 2 : 1
  }
  while (i < n) {
    const c = css[i]
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      // Lizenzkommentare (/*! … */) behalten, andere weglassen
      if (css[i + 2] === '!') items.push({ text: css.slice(i, end + 2) })
      i = end < 0 ? n : end + 2
      start = i
      continue
    }
    if (c === '"' || c === "'") {
      skipString(c)
      i++
      continue
    }
    if (c === ';') {
      const text = css.slice(start, i + 1).trim()
      if (text.length > 1) items.push({ text })
      i++
      start = i
      continue
    }
    if (c === '{') {
      const prelude = css.slice(start, i).trim()
      let depth = 1
      const bodyStart = ++i
      while (i < n && depth) {
        const d = css[i]
        if (d === '"' || d === "'") skipString(d)
        else if (d === '/' && css[i + 1] === '*') i = css.indexOf('*/', i + 2) + 1
        else if (d === '{') depth++
        else if (d === '}') depth--
        i++
      }
      items.push({ prelude, body: css.slice(bodyStart, i - 1) })
      start = i
      continue
    }
    i++
  }
  return items
}

/** Selektorliste an Kommas trennen (nicht innerhalb von Klammern wie :is(a, b)). */
function splitSelectors(prelude) {
  const out = []
  let depth = 0
  let last = 0
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i]
    if (c === '(' || c === '[') depth++
    else if (c === ')' || c === ']') depth--
    else if (c === ',' && depth === 0) {
      out.push(prelude.slice(last, i))
      last = i + 1
    }
  }
  out.push(prelude.slice(last))
  return out.map((s) => s.trim()).filter(Boolean)
}

function stripPseudoArgs(sel) {
  let out = ''
  for (let i = 0; i < sel.length; i++) {
    const m = /^:(not|is|where|has|-webkit-any|-moz-any)\(/.exec(sel.slice(i))
    if (!m) {
      out += sel[i]
      continue
    }
    let depth = 0
    let j = i + m[0].length - 1
    for (; j < sel.length; j++) {
      if (sel[j] === '(') depth++
      else if (sel[j] === ')' && --depth === 0) break
    }
    i = j
  }
  return out
}

export function makeKeep(tokens, safelist = []) {
  const safe = (cls) => safelist.some((r) => r.test(cls))
  return (selector) => {
    if (selector.includes('\\')) return true // maskierte Sonderzeichen: lieber behalten
    // Inhalt von Attribut-Selektoren und :not()/:is()/:where()/:has() ignorieren – sonst fiele z. B.
    // „.btn:not(.dropdown-toggle)“ weg, obwohl die Regel gerade OHNE diese Klasse greift
    const classes = stripPseudoArgs(selector).replace(/\[[^\]]*\]/g, '').match(/\.-?[_a-zA-Z][_a-zA-Z0-9-]*/g) ?? []
    return classes.every((c) => {
      const cls = c.slice(1)
      if (tokens.has(cls) || safe(cls)) return true
      if (cls.startsWith('bi-') && tokens.has(cls.slice(3))) return true
      return false
    })
  }
}

function purgeItems(items, keep, stats) {
  let out = ''
  for (const it of items) {
    if (it.text !== undefined) {
      out += it.text
      continue
    }
    if (it.prelude.startsWith('@')) {
      if (KEEP_AT.test(it.prelude) || !NEST_AT.test(it.prelude)) {
        out += `${it.prelude}{${it.body}}`
      } else {
        const inner = purgeItems(parse(it.body), keep, stats)
        if (inner) out += `${it.prelude}{${inner}}`
      }
      continue
    }
    const selectors = splitSelectors(it.prelude)
    const kept = selectors.filter(keep)
    stats.total += selectors.length
    stats.removed += selectors.length - kept.length
    if (kept.length) out += `${kept.join(',')}{${it.body}}`
  }
  return out
}

/** Gibt das bereinigte CSS und eine kleine Statistik zurück. */
export function purgeCss(css, tokens, safelist = []) {
  const stats = { total: 0, removed: 0, before: css.length, after: 0 }
  const out = purgeItems(parse(css), makeKeep(tokens, safelist), stats)
  stats.after = out.length
  return { css: out, stats }
}

/**
 * PostCSS-Erweiterung für Vite (css.postcss.plugins): bereinigt nur die CSS-Dateien von Bootstrap und
 * Bootstrap-Icons – das eigene CSS der App bleibt unangetastet. Läuft vor dem Bündeln, deshalb passt der
 * Dateiname (Prüfsumme) immer zum bereinigten Inhalt und der Browser-Cache liefert nie veraltetes CSS.
 * @param {{ content: string[], safelist?: RegExp[], files?: RegExp }} opts
 */
export function purgeCssPostcss(opts) {
  const files = opts.files ?? /node_modules[\\/]bootstrap(-icons)?[\\/]/
  let keep = null
  const stats = { total: 0, removed: 0 }
  return {
    postcssPlugin: 'nww-purge-css',
    OnceExit(root) {
      const file = root.source?.input?.file ?? ''
      if (!files.test(file)) return
      keep ??= makeKeep(collectTokens(opts.content), opts.safelist)
      root.walkRules((rule) => {
        const parent = rule.parent
        if (parent?.type === 'atrule' && /keyframes$/i.test(parent.name)) return
        const selectors = rule.selectors
        const kept = selectors.filter(keep)
        stats.total += selectors.length
        stats.removed += selectors.length - kept.length
        if (!kept.length) rule.remove()
        else if (kept.length !== selectors.length) rule.selectors = kept
      })
      // Leer gewordene @media-Blöcke entfernen
      root.walkAtRules((at) => {
        if (/^(media|supports|container|layer)$/i.test(at.name) && at.nodes && !at.nodes.length) at.remove()
      })
      const name = file.split(/[\\/]node_modules[\\/]/).pop()
      console.log(`[css] ${name}: ${stats.removed} von ${stats.total} Selektoren entfernt (ungenutzt)`)
      stats.total = stats.removed = 0
    }
  }
}
