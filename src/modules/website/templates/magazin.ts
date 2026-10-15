import { esc, img, longDate, moodEmoji, paragraphs } from '../logic'
import type { SiteTemplate } from './types'
import { activitiesBlock, footer, overviewBlock, routesBlock, staysBlock, statsLine } from './parts'
import { t } from '@/i18n'

/** Magazin: große Bilder, Text abwechselnd links/rechts, Serif-Überschriften. */
export const magazin: SiteTemplate = {
  css: `
  .mag-hero { text-align: center; padding: 5rem 1rem 2rem; }
  .mag-hero .kicker { color: var(--accent); text-transform: uppercase; letter-spacing: .2em; font-size: .8rem; font-weight: 700; }
  .mag-hero h1 { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2.4rem, 7vw, 4.5rem); line-height: 1.05; }
  .mag-cover img { width: 100%; max-height: 80vh; object-fit: cover; cursor: zoom-in; }
  .story { padding: 3rem 0; border-bottom: 1px solid var(--bs-border-color); }
  .story h2 { font-family: Georgia, 'Times New Roman', serif; }
  .story .date { color: var(--accent); font-weight: 700; font-size: .85rem; text-transform: uppercase; letter-spacing: .08em; }
  .story .lead-img img { width: 100%; height: auto; border-radius: .25rem; cursor: zoom-in; }
  .story .thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: .4rem; margin-top: .4rem; }
  .story .thumbs img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: .25rem; cursor: zoom-in; }
  .story p:first-of-type::first-letter { font-family: Georgia, serif; float: left; font-size: 3.2rem; line-height: .9; padding: .3rem .5rem 0 0; color: var(--accent); }
  .caption { font-size: .8rem; color: var(--bs-secondary-color); font-style: italic; margin-top: .3rem; }
  @media (min-width: 768px) { .story:nth-child(even) .row { flex-direction: row-reverse; } }
  `,
  body: (ctx) => {
    const s = ctx.site
    const stories = s.days.flatMap((d) => [
      ...d.entries.map((e) => {
        const [first, ...rest] = e.photos
        const meta = [
          ctx.settings.showLocation && e.location ? esc(e.location) : '',
          ctx.settings.showMood ? moodEmoji(e.mood) : ''
        ].filter(Boolean).join(' · ')
        return `
      <article class="story">
        <div class="row g-4 align-items-start">
          ${first ? `<div class="col-md-6 lead-img">${img(first)}${first.caption ? `<div class="caption">${esc(first.caption)}</div>` : ''}${rest.length ? `<div class="thumbs">${rest.map((p) => img(p)).join('')}</div>` : ''}</div>` : ''}
          <div class="${first ? 'col-md-6' : 'col-12'}">
            <div class="date">${d.dayNumber ? `${t('Tag {n}', { n: d.dayNumber })} · ` : ''}${esc(longDate(d.date))}</div>
            ${e.title ? `<h2 class="mt-1">${esc(e.title)}</h2>` : ''}
            ${meta ? `<div class="small text-body-secondary mb-3">${meta}</div>` : ''}
            ${paragraphs(e.text)}
          </div>
        </div>
      </article>`
      }),
      d.routes.length
        ? `<section class="story"><div class="date">${d.dayNumber ? `${t('Tag {n}', { n: d.dayNumber })} · ` : ''}${esc(longDate(d.date))}</div>${routesBlock(d.routes)}</section>`
        : ''
    ])
    return `
  <header class="mag-hero container">
    <div class="kicker">${esc(s.destination)}</div>
    <h1 class="my-3">${esc(s.title)}</h1>
    ${s.subtitle ? `<p class="lead text-body-secondary">${esc(s.subtitle)}</p>` : ''}
  </header>
  ${s.cover ? `<div class="mag-cover">${img(s.cover, '', true)}</div>` : ''}
  <main class="container py-4" style="max-width: 1100px">
    ${s.intro ? `<div class="lead my-4 mx-auto" style="max-width: 720px">${paragraphs(s.intro)}</div>` : ''}
    ${statsLine(s)}
    ${overviewBlock(s)}
    ${routesBlock(s.routes)}
    ${staysBlock(s.stays)}
    ${stories.join('')}
    ${activitiesBlock(s.activities)}
  </main>
  ${footer(s)}`
  }
}
