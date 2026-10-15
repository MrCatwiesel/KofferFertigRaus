/**
 * Text aus einer Datei holen: PDF (pdf.js, auf dem Gerät), gespeicherte E-Mail (.eml), HTML, Kalender (.ics), Text.
 * E-Mails: Text- und HTML-Teil, auch quoted-printable/base64 und ISO-8859-1; angehängte Kalenderdateien werden mitgelesen.
 */
import { htmlToText } from '@/core/html-text'
import { t } from '@/i18n'

/** Bytes → Text: UTF-8, sonst westeuropäisch (Windows-1252) */
export function bytesToText(bytes: Uint8Array, charset = ''): string {
  if (charset && !/^utf-?8$/i.test(charset)) {
    try {
      return new TextDecoder(charset.toLowerCase()).decode(bytes)
    } catch {
      /* unbekannter Zeichensatz */
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function decodeQuotedPrintable(s: string): Uint8Array {
  const soft = s.replace(/=\r?\n/g, '')
  const out: number[] = []
  for (let i = 0; i < soft.length; i++) {
    const c = soft[i]
    if (c === '=' && /^[0-9A-F]{2}$/i.test(soft.slice(i + 1, i + 3))) {
      out.push(parseInt(soft.slice(i + 1, i + 3), 16))
      i += 2
    } else out.push(...new TextEncoder().encode(c))
  }
  return new Uint8Array(out)
}

function decodeBase64(s: string): Uint8Array {
  const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** Kopfzeile mit Codierung „=?utf-8?Q?…?=“ lesbar machen */
export function decodeHeader(v: string): string {
  return v.replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (_, cs: string, enc: string, data: string) =>
    bytesToText(enc.toUpperCase() === 'B' ? decodeBase64(data) : decodeQuotedPrintable(data.replace(/_/g, ' ')), cs)
  )
}

interface Part {
  headers: Record<string, string>
  body: string
}

function splitPart(raw: string): Part {
  const i = raw.search(/\r?\n\r?\n/)
  const head = i === -1 ? raw : raw.slice(0, i)
  const body = i === -1 ? '' : raw.slice(i).replace(/^\r?\n\r?\n/, '')
  const headers: Record<string, string> = {}
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = /^([\w-]+):\s*(.*)$/.exec(line)
    if (m) headers[m[1].toLowerCase()] = m[2]
  }
  return { headers, body }
}

function partText(p: Part): { type: string; text: string }[] {
  const ct = p.headers['content-type'] ?? 'text/plain'
  const type = ct.split(';')[0].trim().toLowerCase()
  const boundary = /boundary="?([^";]+)"?/i.exec(ct)?.[1]
  if (type.startsWith('multipart/') && boundary) {
    return p.body
      .split(`--${boundary}`)
      .slice(1)
      .filter((s) => !s.startsWith('--'))
      .flatMap((s) => partText(splitPart(s.replace(/^\r?\n/, ''))))
  }
  const enc = (p.headers['content-transfer-encoding'] ?? '').toLowerCase()
  const charset = /charset="?([^";]+)"?/i.exec(ct)?.[1] ?? ''
  const bytes = enc === 'base64' ? decodeBase64(p.body) : enc === 'quoted-printable' ? decodeQuotedPrintable(p.body) : new TextEncoder().encode(p.body)
  if (!/^text\/(plain|html|calendar)$/.test(type)) return []
  return [{ type, text: bytesToText(bytes, enc ? charset : '') }]
}

/** Gespeicherte E-Mail (.eml) → Betreff + Text (Text-Teil bevorzugt, sonst HTML) + angehängte Kalender */
export function emailToText(raw: string): string {
  const top = splitPart(raw)
  const parts = partText(top)
  const plain = parts.find((p) => p.type === 'text/plain')?.text
  const html = parts.find((p) => p.type === 'text/html')?.text
  const body = plain && plain.trim().length > 40 ? plain : html ? htmlToText(html) : (plain ?? '')
  const cal = parts.filter((p) => p.type === 'text/calendar').map((p) => p.text)
  const subject = top.headers.subject ? `${decodeHeader(top.headers.subject)}\n` : ''
  return [subject + body, ...cal].join('\n\n')
}

/** Text einer Datei für die Buchungserkennung */
export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (name.endsWith('.pdf') || file.type === 'application/pdf' || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    const { pdfToText } = await import('./pdf')
    return pdfToText(bytes)
  }
  const text = bytesToText(bytes)
  if (name.endsWith('.eml') || /^(received|return-path|mime-version|from|date|message-id|subject|delivered-to):/im.test(text.slice(0, 2000))) return emailToText(text)
  if (name.endsWith('.html') || name.endsWith('.htm') || /^\s*<(!doctype|html)/i.test(text)) return htmlToText(text)
  if (file.type.startsWith('image/')) throw new Error(t('Bilder (Fotos/Screenshots) kann die App nicht lesen – bitte den Text kopieren und einfügen oder die PDF/E-Mail nehmen.'))
  return text
}
