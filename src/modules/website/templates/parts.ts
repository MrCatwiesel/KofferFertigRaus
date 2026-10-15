import { formatDate } from '../../../core/format'
import { esc, longDate } from '../logic'
import type { SiteActivity, SiteData, SiteRoute, SiteStay } from '../types'
import { profileSvg, statsLine as routeStats, trackSvg } from '../../../services/tracks'
import { intlLocale } from '@/i18n'

/** Gemeinsame Bausteine aller Vorlagen. */

export function statsLine(s: SiteData): string {
  const parts = [
    `${s.stats.days} ${s.stats.days === 1 ? 'Tag' : 'Tage'}`,
    s.stats.photos ? `${s.stats.photos} Fotos` : '',
    s.participants.length ? `mit ${esc(s.participants.join(', '))}` : ''
  ].filter(Boolean)
  return `<p class="text-body-secondary small mb-4 stats">${parts.join(' · ')}</p>`
}

export function footer(s: SiteData): string {
  const by = s.author ? `${esc(s.author)} · ` : ''
  return `
  <footer class="border-top py-4 mt-4">
    <div class="container small text-body-secondary text-center">
      ${by}${esc(s.destination)}, ${formatDate(s.startDate)} – ${formatDate(s.endDate)}<br>
      Erstellt mit „KofferFertigRaus“ am ${formatDate(s.generatedAt.slice(0, 10))}
    </div>
  </footer>`
}

/** Übersichtskarte aller Routen (nur, wenn es sie gibt). */
export function overviewBlock(s: SiteData): string {
  if (!s.overviewMap) return ''
  return `
  <figure class="route route-overview">
    <img class="route-map" src="${s.overviewMap}" alt="Karte mit allen Routen der Reise" loading="lazy">
  </figure>`
}

/** Routen eines Tages: Karte mit Strecke (ohne Internet beim Erstellen: nur die Linie) und Höhenprofil. */
export function routesBlock(routes: SiteRoute[]): string {
  return routes
    .map(
      (r) => `
  <figure class="route">
    <figcaption class="route-head"><span class="route-dot" style="background:${esc(r.color)}"></span><strong>${esc(r.name)}</strong> <span class="text-body-secondary small">${esc(routeStats(r.stats))}</span></figcaption>
    ${r.map ? `<img class="route-map" src="${r.map}" alt="Karte: ${esc(r.name)}" loading="lazy">` : `<div class="route-track">${trackSvg(r.points, { color: r.color })}</div>`}
    ${r.points.some((p) => p[2] !== null) ? `<div class="route-profile">${profileSvg(r.points, { color: r.color })}</div>` : ''}
  </figure>`
    )
    .join('')
}

const shortDate = (iso: string) =>
  iso ? new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : ''

/** Unterkünfte als kleine Karten: Art, Name, Zeitraum, Nächte – Adresse und Link nur, wenn freigegeben. */
export function staysBlock(stays: SiteStay[], heading = 'Unsere Unterkünfte'): string {
  if (!stays.length) return ''
  return `
  <section class="stays mb-4">
    <h2 class="h5 section-title">${esc(heading)}</h2>
    <div class="stay-grid">
      ${stays
        .map((st) => {
          const when = st.checkIn && st.checkOut ? `${shortDate(st.checkIn)} – ${shortDate(st.checkOut)}` : shortDate(st.checkIn)
          const nights = st.nights ? ` · ${st.nights} ${st.nights === 1 ? 'Nacht' : 'Nächte'}` : ''
          return `
      <div class="stay">
        <div class="stay-emoji" aria-hidden="true">${st.emoji}</div>
        <div class="stay-body">
          <div class="stay-type">${esc(st.type)}</div>
          <div class="stay-name">${st.url ? `<a href="${esc(st.url)}" target="_blank" rel="noopener noreferrer">${esc(st.name)}</a>` : esc(st.name)}</div>
          ${when ? `<div class="small text-body-secondary">${esc(when)}${nights}</div>` : ''}
          ${st.address ? `<div class="small text-body-secondary">📍 ${esc(st.address)}</div>` : ''}
        </div>
      </div>`
        })
        .join('')}
    </div>
  </section>`
}

/** Unternehmungen als Liste, nach Tag sortiert. */
export function activitiesBlock(acts: SiteActivity[], heading = 'Was wir unternommen haben'): string {
  if (!acts.length) return ''
  return `
  <section class="acts mb-4">
    <h2 class="h5 section-title">${esc(heading)}</h2>
    <ul class="act-list">
      ${acts
        .map(
          (a) => `
      <li><span class="act-emoji" aria-hidden="true">${a.emoji}</span><div><strong>${esc(a.title)}</strong>
        <div class="small text-body-secondary">${[a.date ? esc(longDate(a.date)) : '', esc(a.kind), a.place ? `📍 ${esc(a.place)}` : ''].filter(Boolean).join(' · ')}</div></div></li>`
        )
        .join('')}
    </ul>
  </section>`
}
