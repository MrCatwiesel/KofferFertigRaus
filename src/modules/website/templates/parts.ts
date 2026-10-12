import { formatDate } from '../../../core/format'
import { esc } from '../logic'
import type { SiteData, SiteRoute } from '../types'
import { profileSvg, statsLine as routeStats, trackSvg } from '../../../services/tracks'

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
      Erstellt mit „Nix wie weg“ am ${formatDate(s.generatedAt.slice(0, 10))}
    </div>
  </footer>`
}

/** Routen eines Tages: Strecke (ohne Kartenhintergrund, funktioniert offline) und Höhenprofil. */
export function routesBlock(routes: SiteRoute[]): string {
  return routes
    .map(
      (r) => `
  <figure class="route">
    <figcaption class="route-head"><span class="route-dot" style="background:${esc(r.color)}"></span><strong>${esc(r.name)}</strong> <span class="text-body-secondary small">${esc(routeStats(r.stats))}</span></figcaption>
    <div class="route-track">${trackSvg(r.points, { color: r.color })}</div>
    ${r.points.some((p) => p[2] !== null) ? `<div class="route-profile">${profileSvg(r.points, { color: r.color })}</div>` : ''}
  </figure>`
    )
    .join('')
}
