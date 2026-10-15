/**
 * Kleiner Markdown-Leser für Hilfetexte und das Änderungsprotokoll.
 *
 * Kann bewusst nur, was die Texte brauchen:
 *  - Überschriften `##`, `###`, `####` (eine Stufe tiefer gesetzt: ## → h3 …)
 *  - Absätze, Aufzählungen `- ` (auch eingerückt), nummerierte Listen `1. `
 *  - Hinweis-Kasten: Zeile mit `> ` (Tipp)
 *  - **fett**, *kursiv*, `Code`, [Text](Adresse)
 *
 * Alles andere wird als Text ausgegeben – HTML im Text wird maskiert.
 * Interne Adressen (`#/…`) bleiben in der App, externe öffnen ein neues Fenster.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Nur sichere Ziele: App-intern (#/…), http(s) und mailto */
function safeHref(href: string): string | null {
  if (href.startsWith('#/')) return href
  if (/^(https?:|mailto:)/i.test(href)) return href
  return null
}

/** Inline-Auszeichnung in einer (schon maskierten) Zeile */
export function renderInline(text: string): string {
  // Code zuerst herauslösen, damit * und [] darin unberührt bleiben
  const codes: string[] = []
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${c}</code>`)
    return `\u0000${codes.length - 1}\u0000`
  })
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label: string, rawHref: string) => {
    const href = safeHref(rawHref.replace(/&amp;/g, '&'))
    if (!href) return label
    const attr = escapeHtml(href)
    return href.startsWith('#/') ? `<a href="${attr}">${label}</a>` : `<a href="${attr}" target="_blank" rel="noopener">${label}</a>`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)])
}

interface ListFrame {
  tag: 'ul' | 'ol'
  indent: number
}

/** Wandelt Markdown in HTML um (für v-html; Eingabe wird maskiert). */
export function renderMarkdown(md: string): string {
  const out: string[] = []
  const lists: ListFrame[] = []
  let para: string[] = []
  let tip: string[] = []

  const flushPara = () => {
    if (para.length) out.push(`<p>${renderInline(para.join(' '))}</p>`)
    para = []
  }
  const flushTip = () => {
    if (tip.length) out.push(`<div class="help-tip"><i class="bi bi-lightbulb" aria-hidden="true"></i><div>${renderInline(tip.join(' '))}</div></div>`)
    tip = []
  }
  const closeLists = (toIndent = -1) => {
    while (lists.length && lists[lists.length - 1].indent > toIndent) {
      out.push(`</li></${lists.pop()!.tag}>`)
    }
  }
  const flushAll = () => {
    flushPara()
    flushTip()
    closeLists()
  }

  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) {
      flushPara()
      flushTip()
      // Leerzeile beendet Listen nicht sofort – erst eine Zeile ohne Listenzeichen
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushAll()
      const level = Math.min(6, heading[1].length + 1)
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) {
      flushPara()
      closeLists()
      tip.push(quote[1])
      continue
    }
    const item = /^(\s*)(-|\*|\d+\.)\s+(.*)$/.exec(line)
    if (item) {
      flushPara()
      flushTip()
      const indent = item[1].length
      const tag: ListFrame['tag'] = /\d/.test(item[2]) ? 'ol' : 'ul'
      const top = lists[lists.length - 1]
      if (!top || indent > top.indent) {
        lists.push({ tag, indent })
        out.push(`<${tag}><li>`)
      } else {
        closeLists(indent)
        const cur = lists[lists.length - 1]
        if (cur && cur.indent === indent && cur.tag === tag) {
          out.push('</li><li>')
        } else {
          if (cur && cur.indent === indent) out.push(`</li></${lists.pop()!.tag}>`)
          lists.push({ tag, indent })
          out.push(`<${tag}><li>`)
        }
      }
      out.push(renderInline(item[3]))
      continue
    }
    // Fortsetzungszeile eines Listenpunkts (eingerückt) – sonst normaler Absatz
    if (lists.length && /^\s+/.test(line)) {
      out.push(' ' + renderInline(line.trim()))
      continue
    }
    closeLists()
    flushTip()
    para.push(line.trim())
  }
  flushAll()
  return out.join('')
}

/** Reiner Text (für die Suche und kurze Vorschauen) */
export function plainText(md: string): string {
  return md
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#>]/g, '')
    .replace(/^\s*(-|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}
