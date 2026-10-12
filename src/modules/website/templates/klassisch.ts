import { esc, img, longDate, moodEmoji, paragraphs } from '../logic'
import type { SiteEntry } from '../types'
import type { SiteTemplate, TemplateContext } from './types'
import { footer, routesBlock, statsLine } from './parts'

/** Klassisch: Titelbild, Einleitung, dann jeder Tag als Karte mit Fotoraster. */
function entry(e: SiteEntry, ctx: TemplateContext): string {
  const meta = [
    ctx.settings.showLocation && e.location ? `<span>📍 ${esc(e.location)}</span>` : '',
    ctx.settings.showMood && moodEmoji(e.mood) ? `<span>${moodEmoji(e.mood)}</span>` : ''
  ].filter(Boolean).join(' ')
  const [first, ...rest] = e.photos
  return `
  <article class="card entry shadow-sm mb-4">
    ${first ? img(first, 'card-img-top') : ''}
    <div class="card-body">
      ${e.title ? `<h3 class="h4 card-title">${esc(e.title)}</h3>` : ''}
      ${meta ? `<div class="small text-body-secondary mb-2">${meta}</div>` : ''}
      ${paragraphs(e.text)}
      ${rest.length ? `<div class="grid">${rest.map((p) => `<figure>${img(p)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      ${first?.caption ? `<p class="small text-body-secondary mb-0 mt-2">Titelbild: ${esc(first.caption)}</p>` : ''}
    </div>
  </article>`
}

export const klassisch: SiteTemplate = {
  css: `
  .hero { position: relative; min-height: 60vh; display: flex; align-items: flex-end; color: #fff; background: var(--accent); overflow: hidden; }
  .hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.65), rgba(0,0,0,0) 60%); }
  .hero .container { position: relative; z-index: 1; padding-bottom: 2.5rem; }
  .day-label { color: var(--accent); font-weight: 600; letter-spacing: .03em; text-transform: uppercase; font-size: .85rem; }
  .entry .card-img-top { aspect-ratio: 3 / 2; object-fit: cover; cursor: zoom-in; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .5rem; margin-top: 1rem; }
  .grid figure { margin: 0; }
  .grid img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; border-radius: .5rem; cursor: zoom-in; }
  .grid figcaption { font-size: .8rem; color: var(--bs-secondary-color); margin-top: .25rem; }
  `,
  body: (ctx) => {
    const s = ctx.site
    return `
  <header class="hero">
    ${s.cover ? img(s.cover, '', true) : ''}
    <div class="container">
      <h1 class="display-4 fw-bold">${esc(s.title)}</h1>
      ${s.subtitle ? `<p class="lead mb-0">${esc(s.subtitle)}</p>` : ''}
    </div>
  </header>
  <main class="container py-5" style="max-width: 820px">
    ${s.intro ? `<div class="lead mb-4">${paragraphs(s.intro)}</div>` : ''}
    ${statsLine(s)}
    ${routesBlock(s.routes)}
    ${s.days
      .map(
        (d) => `
    <section class="mb-5">
      <div class="day-label mb-2">${d.dayNumber ? `Tag ${d.dayNumber} · ` : ''}${esc(longDate(d.date))}</div>
      ${d.entries.map((e) => entry(e, ctx)).join('')}
      ${routesBlock(d.routes)}
    </section>`
      )
      .join('')}
  </main>
  ${footer(s)}`
  }
}
