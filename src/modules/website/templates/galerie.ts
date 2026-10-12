import { esc, img, longDate, moodEmoji, paragraphs } from '../logic'
import type { SiteTemplate } from './types'
import { footer, routesBlock, statsLine } from './parts'

/** Galerie: Fotos im Vordergrund (Mauerwerk-Raster), Texte kurz darunter. */
export const galerie: SiteTemplate = {
  css: `
  .gal-head { padding: 3rem 0 1.5rem; }
  .gal-head h1 { font-weight: 800; }
  .gal-head .bar { width: 4rem; height: .35rem; background: var(--accent); border-radius: 1rem; margin: 1rem 0; }
  .gal-day { margin: 2.5rem 0 1rem; display: flex; align-items: baseline; gap: .75rem; }
  .gal-day .num { background: var(--accent); color: #fff; border-radius: 2rem; padding: .1rem .7rem; font-weight: 700; font-size: .85rem; }
  .masonry { columns: 3 220px; column-gap: .6rem; }
  .masonry figure { break-inside: avoid; margin: 0 0 .6rem; position: relative; }
  .masonry img { width: 100%; height: auto; border-radius: .6rem; display: block; cursor: zoom-in; }
  .masonry figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 1.5rem .6rem .45rem; color: #fff; font-size: .8rem;
    background: linear-gradient(to top, rgba(0,0,0,.6), transparent); border-radius: 0 0 .6rem .6rem; }
  .gal-text { max-width: 720px; }
  `,
  body: (ctx) => {
    const s = ctx.site
    return `
  <main class="container" style="max-width: 1200px">
    <header class="gal-head">
      <h1 class="display-5">${esc(s.title)}</h1>
      <div class="bar"></div>
      ${s.subtitle ? `<p class="lead text-body-secondary mb-0">${esc(s.subtitle)}</p>` : ''}
      ${s.intro ? `<div class="mt-3 gal-text">${paragraphs(s.intro)}</div>` : ''}
    </header>
    ${statsLine(s)}
    ${routesBlock(s.routes)}
    ${s.days
      .map(
        (d) => `
    <section>
      <div class="gal-day">${d.dayNumber ? `<span class="num">Tag ${d.dayNumber}</span>` : ''}<span class="text-body-secondary">${esc(longDate(d.date))}</span></div>
      ${d.entries
        .map((e) => {
          const meta = [ctx.settings.showLocation && e.location ? esc(e.location) : '', ctx.settings.showMood ? moodEmoji(e.mood) : '']
            .filter(Boolean).join(' · ')
          return `
      <div class="gal-text mb-2">
        ${e.title ? `<h2 class="h5 mb-1">${esc(e.title)}</h2>` : ''}
        ${meta ? `<div class="small text-body-secondary mb-1">${meta}</div>` : ''}
        ${paragraphs(e.text, 'small')}
      </div>
      ${e.photos.length ? `<div class="masonry mb-3">${e.photos.map((p) => `<figure>${img(p)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}`
        })
        .join('')}
      ${routesBlock(d.routes)}
    </section>`
      )
      .join('')}
  </main>
  ${footer(s)}`
  }
}
