<script setup lang="ts">
/** Reisestatistik / Jahresrückblick über alle Reisen. */
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { countryName, flag } from '@/core/countries'
import { formatDate, formatMoney } from '@/core/format'
import { todayIso } from '@/core/dates'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { photoRepository, journalRepository } from '@/modules/journal/public'
import { routeRepository } from '@/modules/routes/public'
import { accommodationRepository } from '@/modules/accommodation/public'
import { expenseRepository, inTripCurrency } from '@/modules/expenses/public'
import { placeRepository } from '@/modules/map/public'
import TripsMap from '../components/TripsMap.vue'
import { summarize, yearsOf, type TripExtra } from '../logic'
import { locale, t, tn } from '@/core/i18n'

const router = useRouter()
const trips = shallowRef<Trip[]>([])
const extra = shallowRef(new Map<string, TripExtra>())
const loading = ref(true)
const year = ref<number | null>(null)
const today = todayIso()

async function load() {
  trips.value = await tripRepository.listAll()
  const m = new Map<string, TripExtra>()
  for (const t of trips.value) {
    const [routes, photos, entries, stays, expenses, places] = await Promise.all([
      routeRepository.listByTrip(t.id),
      photoRepository.countByTrip(t.id),
      journalRepository.listByTrip(t.id),
      accommodationRepository.listByTrip(t.id),
      expenseRepository.listByTrip(t.id),
      placeRepository.listByTrip(t.id)
    ])
    const spent: Record<string, number> = {}
    for (const e of expenses) spent[t.currency] = (spent[t.currency] ?? 0) + inTripCurrency(e, t.currency)
    const place = places.find((p) => p.kind === 'accommodation') ?? places[0]
    const firstRoute = routes.find((r) => r.points.length)
    m.set(t.id, {
      routes: routes.map((r) => ({ name: r.name, distance: r.stats.distance, ascent: r.stats.ascent })),
      photos,
      entries: entries.length,
      nights: stays
        .filter((s) => s.status === 'gebucht' && s.checkIn && s.checkOut)
        .reduce((n, s) => n + Math.max(0, Math.round((Date.parse(s.checkOut) - Date.parse(s.checkIn)) / 86400_000)), 0),
      spent,
      location: place ? [place.lat, place.lon] : firstRoute ? [firstRoute.points[0][0], firstRoute.points[0][1]] : null
    })
  }
  extra.value = m
  loading.value = false
}
void load()

const years = computed(() => yearsOf(trips.value))
const s = computed(() => summarize(trips.value, extra.value, year.value, today))
const km = (m: number) => `${Math.round(m / 1000).toLocaleString(locale())} km`
const MONTHS = [t('Jan'), t('Feb'), t('Mär'), t('Apr'), t('Mai'), t('Jun'), t('Jul'), t('Aug'), t('Sep'), t('Okt'), t('Nov'), t('Dez')]
const maxMonth = computed(() => Math.max(1, ...s.value.months))
const mapPoints = computed(() =>
  s.value.rows
    .map((r) => ({ id: r.id, title: r.title, sub: `${r.destination} · ${formatDate(r.startDate)}`, at: extra.value.get(r.id)?.location }))
    .filter((p): p is { id: string; title: string; sub: string; at: [number, number] } => !!p.at)
)
const tiles = computed(() =>
  [
    { icon: 'suitcase2', n: s.value.trips, value: s.value.trips, label: s.value.trips === 1 ? t('Reise') : t('Reisen') },
    { icon: 'calendar-range', n: s.value.days, value: s.value.days, label: t('Reisetage') },
    { icon: 'moon-stars', n: s.value.nights, value: s.value.nights, label: t('Übernachtungen') },
    { icon: 'globe-europe-africa', n: s.value.countries.length, value: s.value.countries.length, label: s.value.countries.length === 1 ? t('Land') : t('Länder') },
    { icon: 'signpost-2', n: s.value.distance, value: km(s.value.distance), label: tn(s.value.routes, 'auf {n} Tour', 'auf {n} Touren') },
    { icon: 'graph-up-arrow', n: s.value.ascent, value: `${s.value.ascent.toLocaleString(locale())} m`, label: 'bergauf' },
    { icon: 'images', n: s.value.photos, value: s.value.photos.toLocaleString(locale()), label: t('Fotos') },
    { icon: 'journal-richtext', n: s.value.entries, value: s.value.entries, label: t('Tagebuch-Einträge') }
  ].filter((t) => t.n > 0)
)
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/trip" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ $t('Meine Reisen') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ $t('Unsere Reisen in Zahlen') }}</h1>
  </div>

  <div class="d-flex flex-wrap gap-2 mb-3" role="group" :aria-label="$t('Zeitraum')">
    <button type="button" class="btn btn-sm" :class="year === null ? 'btn-primary' : 'btn-outline-primary'" @click="year = null">{{ $t('Alle Jahre') }}</button>
    <button v-for="y in years" :key="y" type="button" class="btn btn-sm" :class="year === y ? 'btn-primary' : 'btn-outline-primary'" @click="year = y">{{ y }}</button>
  </div>

  <p v-if="loading" class="text-body-secondary">{{ $t('Wird gezählt …') }}</p>
  <div v-else-if="!s.trips" class="card"><div class="card-body text-body-secondary">
    {{ $t('Noch keine Reise in diesem Zeitraum') }}<template v-if="s.planned"> {{ $t('– {0} geplant', [s.planned]) }}</template>.
  </div></div>
  <template v-else>
    <div class="row g-2 mb-3">
      <div v-for="t in tiles" :key="t.label" class="col-6 col-md-3">
        <div class="card h-100 stat">
          <div class="card-body py-2">
            <i :class="`bi bi-${t.icon} text-primary`" aria-hidden="true"></i>
            <div class="stat-value">{{ t.value }}</div>
            <div class="small text-body-secondary">{{ t.label }}</div>
          </div>
        </div>
      </div>
    </div>
    <p v-if="s.planned" class="small text-body-secondary on-bg">{{ $t('Dazu {0} geplante {1}.', [s.planned, s.planned === 1 ? $t('Reise') : $t('Reisen')]) }}</p>

    <section v-if="s.countries.length" class="card mb-3">
      <div class="card-body">
        <h2 class="h6">{{ $t('Länder') }}</h2>
        <span v-for="c in s.countries" :key="c" class="badge text-bg-light border fs-6 fw-normal me-1 mb-1">{{ flag(c) }} {{ countryName(c) }}</span>
      </div>
    </section>

    <section v-if="mapPoints.length" class="card mb-3">
      <div class="card-body">
        <h2 class="h6">{{ $t('Wo wir waren') }}</h2>
        <TripsMap :points="mapPoints" @open="(id) => router.push(`/trip/${id}`)" />
      </div>
    </section>

    <section class="card mb-3">
      <div class="card-body">
        <h2 class="h6">{{ $t('Reisetage je Monat') }}</h2>
        <svg viewBox="0 0 600 170" class="months" role="img" :aria-label="$t('Reisetage je Monat: {0}', [s.months.join(', ')])">
          <g v-for="(v, i) in s.months" :key="i">
            <rect :x="i * 50 + 8" :y="140 - (v / maxMonth) * 120" width="34" :height="Math.max(v ? 2 : 0, (v / maxMonth) * 120)" rx="4" fill="var(--nww-primary)" />
            <text v-if="v" :x="i * 50 + 25" :y="134 - (v / maxMonth) * 120" text-anchor="middle" class="m-val">{{ v }}</text>
            <text :x="i * 50 + 25" y="160" text-anchor="middle" class="m-lab">{{ MONTHS[i] }}</text>
          </g>
        </svg>
      </div>
    </section>

    <section v-if="s.longestTrip || s.longestRoute || s.highestRoute || Object.keys(s.spent).length" class="card mb-3">
      <div class="card-body">
        <h2 class="h6">{{ $t('Rekorde') }}</h2>
        <ul class="list-unstyled mb-0">
          <li v-if="s.longestTrip" class="mb-1"><i class="bi bi-trophy text-primary me-2" aria-hidden="true"></i>{{ $t('Längste Reise:') }} <b>{{ s.longestTrip.title }}</b> {{ $t('({0} Tage)', [s.longestTrip.days]) }}</li>
          <li v-if="s.longestRoute" class="mb-1"><i class="bi bi-signpost-2 text-primary me-2" aria-hidden="true"></i>{{ $t('Längste Tour:') }} <b>{{ s.longestRoute.name }}</b> ({{ km(s.longestRoute.distance) }}, {{ s.longestRoute.trip }})</li>
          <li v-if="s.highestRoute" class="mb-1"><i class="bi bi-graph-up-arrow text-primary me-2" aria-hidden="true"></i>{{ $t('Meiste Höhenmeter:') }} <b>{{ s.highestRoute.name }}</b> ({{ s.highestRoute.ascent.toLocaleString($t(locale())) }} m, {{ s.highestRoute.trip }})</li>
          <li v-for="(v, c) in s.spent" :key="c" class="mb-1"><i class="bi bi-wallet2 text-primary me-2" aria-hidden="true"></i>{{ $t('Ausgegeben:') }} <b>{{ formatMoney(v, String(c)) }}</b></li>
        </ul>
      </div>
    </section>

    <section class="mb-4">
      <h2 class="h6 text-body-secondary on-bg">{{ $t('Reisen') }}</h2>
      <div class="list-group">
        <RouterLink v-for="r in s.rows" :key="r.id" :to="`/trip/${r.id}`" class="list-group-item list-group-item-action">
          <div class="d-flex justify-content-between gap-2">
            <span class="fw-semibold"><span v-for="c in r.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>{{ r.title }}</span>
            <span class="small text-body-secondary text-nowrap">{{ formatDate(r.startDate) }}</span>
          </div>
          <div class="small text-body-secondary">
            {{ $t('{0} Tage', [r.days]) }}<template v-if="r.distance"> · {{ km(r.distance) }}</template><template v-if="r.ascent"> {{ $t('· {0} Hm', [r.ascent.toLocaleString($t(locale()))]) }}</template><template v-if="r.photos"> {{ $t('· {0} Fotos', [r.photos]) }}</template>
          </div>
        </RouterLink>
      </div>
    </section>
  </template>
</template>

<style scoped>
.stat .bi {
  font-size: 1.2rem;
}
.stat-value {
  font-family: var(--nww-heading-font);
  font-weight: var(--nww-heading-weight);
  font-size: 1.5rem;
  line-height: 1.15;
}
.months {
  width: 100%;
  height: auto;
}
.m-val {
  font-size: 13px;
  font-weight: 700;
  fill: var(--nww-text);
}
.m-lab {
  font-size: 12px;
  fill: var(--nww-muted);
}
</style>
