<script setup lang="ts">
/**
 * Reisebericht als Druckvorlage (A4): Titelseite, Überblick mit Karte und Zahlen, Tage mit Text, Fotos und Touren.
 * „Drucken / als PDF sichern“ öffnet den Druckdialog des Geräts – dort lässt sich ein PDF speichern.
 * Farben und Schriften kommen aus dem gewählten Design.
 */
import { computed, nextTick, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { flag } from '@/core/countries'
import { formatMoney } from '@/core/format'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { MOODS, journalRepository, photoRepository, type JournalEntry, type Photo } from '@/modules/journal/public'
import { profileSvg, routeRepository, statsLine, trackSvg, type Route } from '@/modules/routes/public'
import { accommodationRepository, type Accommodation } from '@/modules/accommodation/public'
import { EXPENSE_CATEGORY, expenseRepository, summarize, type Expense } from '@/modules/expenses/public'
import { routesSvg } from '@/services/tracks'
import { DEFAULT_OPTIONS, buildDays, photoColumns, pickCover, reportStats, type ReportOptions } from '../logic'

const props = defineProps<{ tripId: string }>()

const KEY = 'nww-bericht'
const o = reactive<ReportOptions>({ ...DEFAULT_OPTIONS })
try {
  Object.assign(o, JSON.parse(localStorage.getItem(KEY) ?? '{}'))
} catch {
  /* Standard */
}
watch(o, () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(o))
  } catch {
    /* egal */
  }
})

const trip = shallowRef<Trip | null>(null)
const entries = shallowRef<JournalEntry[]>([])
const photos = shallowRef<Photo[]>([])
const routes = shallowRef<Route[]>([])
const stays = shallowRef<Accommodation[]>([])
const expenses = shallowRef<Expense[]>([])
const urls = new Map<string, string>()
const loading = ref(true)

async function load() {
  const t = await tripRepository.get(props.tripId)
  if (!t) return
  trip.value = t
  ;[entries.value, photos.value, routes.value, stays.value, expenses.value] = await Promise.all([
    journalRepository.listByTrip(props.tripId),
    photoRepository.listByTrip(props.tripId),
    routeRepository.listByTrip(props.tripId),
    accommodationRepository.listByTrip(props.tripId),
    expenseRepository.listByTrip(props.tripId)
  ])
  loading.value = false
}
void load()
onUnmounted(() => urls.forEach((u) => URL.revokeObjectURL(u)))

/** Objekt-Adresse für ein Bild (einmal erzeugt, beim Verlassen freigegeben) */
function url(key: string, blob: Blob | null | undefined): string {
  if (!blob) return ''
  let u = urls.get(key)
  if (!u) {
    u = URL.createObjectURL(blob)
    urls.set(key, u)
  }
  return u
}
const photoUrl = (p: Photo) => url(p.id, p.full ?? p.thumb)

const built = computed(() => (trip.value ? buildDays(trip.value, entries.value, photos.value, routes.value, o) : { days: [], otherRoutes: [] }))
const stats = computed(() => (trip.value ? reportStats(trip.value, entries.value, photos.value.length, routes.value) : null))
const coverUrl = computed(() => {
  if (trip.value?.cover) return url('cover', trip.value.cover)
  const p = pickCover(entries.value, photos.value)
  return p ? photoUrl(p) : ''
})
const overview = computed(() => (o.routes ? routesSvg(routes.value.map((r) => ({ points: r.preview, color: r.color })), { width: 720, height: 420 }) : ''))
const bookedStays = computed(() => stays.value.filter((s) => s.status === 'gebucht').sort((a, b) => a.checkIn.localeCompare(b.checkIn)))
const money = computed(() => (trip.value && expenses.value.length ? summarize(expenses.value, trip.value.currency, trip.value.startDate, trip.value.endDate) : null))

const dateLong = (d: string) => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`))
const dateShort = (d: string) => new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${d}T12:00:00`))
const nights = (a: Accommodation) => Math.max(0, Math.round((Date.parse(a.checkOut) - Date.parse(a.checkIn)) / 86400_000))
const km = (m: number) => `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
const mood = (v: number) => MOODS.find((m) => m.value === v)?.emoji ?? ''
const paras = (t: string) => t.trim().split(/\n\s*\n/).filter(Boolean)
const routeSvg = (r: Route) => trackSvg(r.preview, { width: 420, height: 260, color: r.color, stroke: 3.5 })
const profile = (r: Route) => profileSvg(r.points, { width: 520, height: 120, color: r.color })

const printing = ref(false)
async function print() {
  printing.value = true
  await nextTick()
  // Alle Fotos fertig laden, sonst fehlen sie im PDF
  await Promise.all([...document.querySelectorAll<HTMLImageElement>('.report img')].map((i) => i.decode().catch(() => undefined)))
  printing.value = false
  window.print()
}
</script>

<template>
  <div class="no-print mb-3">
    <RouterLink :to="`/trip/${tripId}?bereich=danach`" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ trip?.title ?? 'Zurück' }}</RouterLink>
    <h1 class="h3 mb-1 mt-1">Reisebericht</h1>
    <p class="small text-body-secondary mb-2">
      Zum Drucken oder als PDF: „Drucken“ antippen. Auf dem iPad im Druckdialog oben auf <i class="bi bi-box-arrow-up" aria-hidden="true"></i> Teilen →
      „In Dateien sichern“ – schon ist das PDF fertig (z. B. für die Familie oder als Vorlage fürs Fotobuch).
    </p>

    <div class="card">
      <div class="card-body row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <div class="small fw-semibold mb-1">Art</div>
          <div class="btn-group btn-group-sm" role="group" aria-label="Art des Berichts">
            <button type="button" class="btn" :class="o.layout === 'bericht' ? 'btn-primary' : 'btn-outline-primary'" @click="o.layout = 'bericht'">Bericht</button>
            <button type="button" class="btn" :class="o.layout === 'fotobuch' ? 'btn-primary' : 'btn-outline-primary'" @click="o.layout = 'fotobuch'">Fotobuch</button>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <label for="r-photos" class="small fw-semibold mb-1 d-block">Fotos</label>
          <select id="r-photos" v-model="o.photos" class="form-select form-select-sm">
            <option value="alle">alle</option>
            <option value="vier">höchstens 4 je Eintrag</option>
            <option value="keine">keine</option>
          </select>
        </div>
        <div class="col-12 col-md-5 d-flex flex-wrap gap-3 small">
          <label class="form-check mb-0"><input v-model="o.onlyHighlights" class="form-check-input" type="checkbox" /> nur Höhepunkte</label>
          <label class="form-check mb-0"><input v-model="o.routes" class="form-check-input" type="checkbox" /> Touren</label>
          <label class="form-check mb-0"><input v-model="o.stats" class="form-check-input" type="checkbox" /> Überblick</label>
          <label class="form-check mb-0"><input v-model="o.stays" class="form-check-input" type="checkbox" /> Unterkünfte</label>
          <label class="form-check mb-0"><input v-model="o.expenses" class="form-check-input" type="checkbox" /> Ausgaben</label>
        </div>
        <div class="col-12">
          <button type="button" class="btn btn-primary" :disabled="loading || printing" @click="print">
            <span v-if="printing" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            <i v-else class="bi bi-printer me-1" aria-hidden="true"></i>Drucken / als PDF sichern
          </button>
          <span class="small text-body-secondary ms-2">{{ built.days.length }} Tage · {{ photos.length }} Fotos</span>
        </div>
      </div>
    </div>
  </div>

  <p v-if="loading" class="text-body-secondary no-print">Bericht wird zusammengestellt …</p>

  <article v-else-if="trip" class="report" :class="`layout-${o.layout}`">
    <!-- Titelseite -->
    <section class="r-page r-cover">
      <div class="r-cover-img" :class="{ 'no-photo': !coverUrl }">
        <img v-if="coverUrl" :src="coverUrl" alt="" :style="{ objectPosition: `50% ${trip.coverY ?? 50}%` }" />
      </div>
      <div class="r-cover-text">
        <div class="r-kicker"><span v-for="c in trip.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>{{ trip.destination }}</div>
        <h1 class="r-title">{{ trip.title }}</h1>
        <div class="r-dates">{{ dateShort(trip.startDate) }} – {{ dateShort(trip.endDate) }}</div>
        <div v-if="trip.participants?.length" class="r-people">{{ trip.participants.join(' · ') }}</div>
      </div>
    </section>

    <!-- Überblick -->
    <section v-if="(o.stats && stats) || overview || (o.stays && bookedStays.length) || (o.expenses && money)" class="r-page r-overview">
      <h2 class="r-h2">Überblick</h2>
      <div v-if="o.stats && stats" class="r-stats">
        <div><b>{{ stats.days }}</b><span>Tage</span></div>
        <div v-if="stats.entries"><b>{{ stats.entries }}</b><span>Tagebuch-Einträge</span></div>
        <div v-if="stats.photos"><b>{{ stats.photos }}</b><span>Fotos</span></div>
        <div v-if="stats.routes"><b>{{ km(stats.distance) }}</b><span>auf {{ stats.routes }} Touren</span></div>
        <div v-if="stats.ascent"><b>{{ stats.ascent.toLocaleString('de-DE') }} m</b><span>bergauf</span></div>
      </div>
      <figure v-if="overview" class="r-map">
        <div v-html="overview"></div>
        <figcaption>
          <span v-for="r in routes" :key="r.id" class="r-legend"><i :style="{ background: r.color }"></i>{{ r.name }}</span>
        </figcaption>
      </figure>
      <div v-if="o.stays && bookedStays.length" class="r-block">
        <h3 class="r-h3">Unterkünfte</h3>
        <p v-for="s in bookedStays" :key="s.id" class="mb-1">
          <b>{{ s.name }}</b><template v-if="s.address"> · {{ s.address }}</template> · {{ nights(s) }} {{ nights(s) === 1 ? 'Nacht' : 'Nächte' }}
        </p>
      </div>
      <div v-if="o.expenses && money" class="r-block">
        <h3 class="r-h3">Ausgaben</h3>
        <p class="mb-1"><b>{{ formatMoney(money.total, trip.currency) }}</b> insgesamt · {{ formatMoney(money.perDay, trip.currency) }} pro Tag</p>
        <p class="small mb-0">
          <span v-for="c in money.byCategory" :key="c.category" class="me-3">{{ EXPENSE_CATEGORY[c.category].label }}: {{ formatMoney(c.amount, trip.currency) }}</span>
        </p>
      </div>
    </section>

    <!-- Tage -->
    <section v-for="d in built.days" :key="d.date" class="r-day">
      <header class="r-day-head">
        <span v-if="d.dayNo" class="r-dayno">Tag {{ d.dayNo }}</span>
        <span class="r-daydate">{{ dateLong(d.date) }}</span>
      </header>
      <div v-for="e in d.entries" :key="e.id" class="r-entry">
        <h2 class="r-h2">{{ e.title || 'Ohne Titel' }} <span v-if="e.mood" class="r-mood">{{ mood(e.mood) }}</span></h2>
        <div v-if="e.location" class="r-loc"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ e.location }}</div>
        <p v-for="(p, k) in paras(e.text)" :key="k" class="r-text">{{ p }}</p>
        <div v-if="e.photos.length" class="r-photos" :style="{ gridTemplateColumns: `repeat(${photoColumns(e.photos.length, o.layout)}, 1fr)` }">
          <figure v-for="p in e.photos" :key="p.id" class="r-photo">
            <img :src="photoUrl(p)" :alt="p.caption" loading="eager" />
            <figcaption v-if="p.caption">{{ p.caption }}</figcaption>
          </figure>
        </div>
      </div>
      <div v-for="r in d.routes" :key="r.id" class="r-route">
        <h3 class="r-h3"><i class="bi bi-signpost-2" aria-hidden="true"></i> {{ r.name }}</h3>
        <div class="r-route-stats">{{ statsLine(r.stats) }}</div>
        <div class="r-route-figs">
          <div class="r-track" v-html="routeSvg(r)"></div>
          <div class="r-profile" v-html="profile(r)"></div>
        </div>
      </div>
    </section>

    <section v-if="built.otherRoutes.length" class="r-day">
      <header class="r-day-head"><span class="r-daydate">Weitere Touren</span></header>
      <div v-for="r in built.otherRoutes" :key="r.id" class="r-route">
        <h3 class="r-h3">{{ r.name }}</h3>
        <div class="r-route-stats">{{ statsLine(r.stats) }}</div>
        <div class="r-route-figs">
          <div class="r-track" v-html="routeSvg(r)"></div>
          <div class="r-profile" v-html="profile(r)"></div>
        </div>
      </div>
    </section>

    <footer class="r-footer">Erstellt mit „Nix wie weg“</footer>
  </article>
</template>

<style scoped>
/* Bildschirm: Seiten wie Papier auf dem Hintergrund */
.report {
  --r-accent: var(--nww-primary);
  max-width: 820px;
  margin: 0 auto 3rem;
  color: #222;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 6px 30px rgba(0, 0, 0, 0.18);
  font-family: var(--nww-body-font);
  overflow: hidden;
}
:is(.r-title, .r-h2, .r-h3, .r-daydate) {
  font-family: var(--nww-heading-font);
  font-weight: var(--nww-heading-weight);
  color: #1d1d1d;
}
.r-page,
.r-day {
  padding: 2.2rem 2.6rem;
}
.r-day + .r-day,
.r-overview,
.r-day {
  border-top: 1px dashed #ddd;
}
.r-cover {
  position: relative;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 900px;
}
.r-cover-img {
  position: relative;
  flex: 1;
  min-height: 560px;
  background: linear-gradient(160deg, var(--nww-sky-2), var(--nww-sky-1));
}
.r-cover-img img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.r-cover-text {
  padding: 2rem 2.6rem 2.6rem;
  border-top: 6px solid var(--r-accent);
}
.r-kicker {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.8rem;
  color: #666;
}
.r-title {
  font-size: 2.8rem;
  line-height: 1.05;
  margin: 0.3rem 0 0.4rem;
}
.r-dates {
  font-size: 1.15rem;
  color: var(--r-accent);
}
.r-people {
  margin-top: 0.4rem;
  color: #666;
}
.r-h2 {
  font-size: 1.45rem;
  margin: 0 0 0.4rem;
}
.r-h3 {
  font-size: 1.05rem;
  margin: 0 0 0.25rem;
}
.r-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.6rem;
  margin: 0.8rem 0 1.2rem;
}
.r-stats div {
  display: flex;
  flex-direction: column;
}
.r-stats b {
  font-size: 1.5rem;
  color: var(--r-accent);
  line-height: 1.1;
}
.r-stats span {
  font-size: 0.8rem;
  color: #666;
}
.r-map {
  margin: 0 0 1rem;
  padding: 0.6rem;
  background: #f6f6f3;
  border-radius: 6px;
}
.r-map :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}
.r-legend {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-right: 1rem;
  font-size: 0.8rem;
  color: #444;
}
.r-legend i {
  width: 1.2rem;
  height: 0.3rem;
  border-radius: 2px;
}
.r-block {
  margin-top: 1rem;
}
.r-day-head {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
  padding-bottom: 0.4rem;
  border-bottom: 2px solid var(--r-accent);
}
.r-dayno {
  font-weight: 700;
  color: #fff;
  background: var(--r-accent);
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  font-size: 0.85rem;
}
.r-daydate {
  font-size: 1.1rem;
}
.r-entry + .r-entry {
  margin-top: 1.4rem;
}
.r-mood {
  font-size: 1.1rem;
}
.r-loc {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.4rem;
}
.r-text {
  line-height: 1.6;
  margin-bottom: 0.6rem;
  white-space: pre-line;
}
.r-photos {
  display: grid;
  gap: 0.5rem;
  margin: 0.6rem 0 0.4rem;
}
.r-photo {
  margin: 0;
  break-inside: avoid;
}
.r-photo img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 3px;
  display: block;
}
.layout-fotobuch .r-photo img {
  aspect-ratio: 3 / 2;
}
.r-photo figcaption {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.15rem;
}
.r-route {
  margin-top: 1.2rem;
  break-inside: avoid;
}
.r-route-stats {
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 0.4rem;
}
.r-route-figs {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 0.8rem;
  align-items: center;
}
.r-route-figs :deep(svg) {
  width: 100%;
  height: auto;
  display: block;
}
.r-track {
  background: #f6f6f3;
  border-radius: 6px;
}
.r-profile {
  color: #333;
}
.r-footer {
  padding: 1rem 2.6rem 1.6rem;
  font-size: 0.75rem;
  color: #999;
  text-align: center;
}
@media (max-width: 600px) {
  .r-page,
  .r-day {
    padding: 1.2rem;
  }
  .r-title {
    font-size: 2rem;
  }
  .r-route-figs {
    grid-template-columns: 1fr;
  }
}
</style>

<style>
/* Druck: nur der Bericht, A4, Seitenumbrüche */
@media print {
  @page {
    size: A4;
    margin: 12mm 12mm 14mm;
  }
  html,
  body {
    background: #fff !important;
  }
  body::before,
  body::after,
  .app-header,
  .bottom-nav,
  .no-print,
  .app-main > :not(.report):not(article) {
    display: none !important;
  }
  .app-main {
    padding: 0 !important;
    max-width: none !important;
    width: auto !important;
  }
  .report {
    max-width: none !important;
    margin: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .report .r-page {
    break-after: page;
  }
  .report .r-cover {
    min-height: 265mm;
  }
  .report .r-cover-img {
    min-height: 185mm;
  }
  .report .r-page,
  .report .r-day {
    padding: 0 0 6mm;
    border-top: 0;
  }
  .report .r-cover-text {
    padding: 8mm 0 0;
  }
  .report.layout-fotobuch .r-day {
    break-before: page;
  }
  .report .r-day + .r-day {
    margin-top: 6mm;
  }
  .report .r-entry,
  .report .r-day-head {
    break-inside: avoid-page;
  }
  .report .r-entry {
    break-inside: auto;
  }
  .report .r-day-head {
    break-after: avoid;
  }
}
</style>
