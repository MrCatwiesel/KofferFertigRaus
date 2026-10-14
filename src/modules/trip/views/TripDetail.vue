<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { flag } from '@/core/countries'
import { getTripSections, type TripPhase } from '@/core/registry'
import { sectionsIn, unplaced } from '@/core/trip-layout'
import { appearance } from '@/ui/appearance'
import { tripRepository } from '../repository'
import { budgetPerPersonDay, defaultTripTab, formatDate, formatMoney, tripDays, tripPhase, tripStatusText } from '../logic'
import { TRANSPORT_LABELS, type Trip } from '../types'
import TripCover from '../components/TripCover.vue'
import SectionTiles from '../components/SectionTiles.vue'
import ReadOnlyNote from '../components/ReadOnlyNote.vue'
import { canEdit } from '@/core/people'

const props = defineProps<{ id: string }>()
const router = useRouter()
const route = useRoute()

const trip = useLiveQuery(() => tripRepository.get(props.id), undefined as Trip | undefined)

const TABS: { id: TripPhase; label: string; icon: string; intro: string }[] = [
  { id: 'planung', label: 'Planung', icon: 'clipboard-check', intro: 'Alles vorbereiten – von der Anreise bis zur Packliste.' },
  { id: 'unterwegs', label: 'Unterwegs', icon: 'compass', intro: 'Was ihr während der Reise braucht – griffbereit, auch offline.' },
  { id: 'danach', label: 'Danach', icon: 'stars', intro: 'Erinnerungen festhalten, abrechnen, Fotos sortieren.' },
  { id: 'teilen', label: 'Teilen & Archiv', icon: 'send', intro: 'Webseite und Lese-Links für Freunde – und die Reise ins Archiv legen.' }
]

/** Gewählter Bereich steht in der Adresse (?bereich=…), damit „Zurück“ wieder dort landet */
const tab = computed<TripPhase>(() => {
  const q = route.query.bereich
  if (TABS.some((t) => t.id === q)) return q as TripPhase
  return trip.value && layout.value.autoTab ? defaultTripTab(trip.value) : 'planung'
})
/** Aufteilung der Reiseseite (Einstellungen → Aussehen → Reiseseite) */
const layout = computed(() => appearance.layout)
const nowTab = computed(() => (trip.value ? defaultTripTab({ ...trip.value, archived: false }) : null))
function select(id: TripPhase) {
  void router.replace({ query: { ...route.query, bereich: id } })
}

const facts = computed(() => {
  const t = trip.value
  if (!t) return []
  const perDay = budgetPerPersonDay(t)
  return [
    { icon: 'calendar-range', value: `${formatDate(t.startDate)} – ${formatDate(t.endDate)} · ${tripDays(t.startDate, t.endDate)} Tage` },
    { icon: 'people', value: t.participants?.length ? t.participants.join(', ') : `${t.travelers} Personen` },
    { icon: 'signpost-split', value: TRANSPORT_LABELS[t.transport] },
    { icon: 'wallet2', value: t.budget ? formatMoney(t.budget, t.currency) + (perDay !== null ? ` · ${formatMoney(perDay, t.currency)} p. P./Tag` : '') : 'Budget offen' }
  ]
})

/** Bereiche, die andere Module beisteuern (Unterkünfte, Unternehmungen …) */
const sections = getTripSections()
const indexed = sections.map((s, i) => ({ ...s, s, i }))
const pick = (list: typeof indexed) => list.map(({ s, i }) => ({ s, i }))
const visible = computed(() => pick(sectionsIn(tab.value, indexed, layout.value)))
/** Ohne Reiter: alle Bereiche untereinander, jeder nur einmal (im ersten passenden Abschnitt) */
const groups = computed(() => {
  const seen = new Set<string>()
  return TABS.map((t) => {
    const items = sectionsIn(t.id, indexed, layout.value).filter((x) => !seen.has(x.moduleId))
    items.forEach((x) => seen.add(x.moduleId))
    return { ...t, items: pick(items) }
  }).filter((g) => g.items.length)
})
/** Bereiche, die in keinem Reiter stehen – bleiben hier erreichbar */
const extra = computed(() => pick(unplaced(indexed, layout.value)))
const isTravelling = computed(() => !!trip.value && tripPhase(trip.value.startDate, trip.value.endDate) === 'unterwegs')
const showQuick = computed(() => layout.value.quick && (layout.value.tabs ? tab.value === 'unterwegs' : isTravelling.value))

/** Zusammenfassungen und geplante Kosten aller Bereiche – aktualisieren sich live. */
const sectionData = useLiveQuery(
  () =>
    Promise.all(
      sections.map(async (s) => ({
        summary: s.summary ? await s.summary(props.id) : '',
        cost: s.plannedCost ? await s.plannedCost(props.id) : 0
      }))
    ),
  [] as { summary: string; cost: number }[]
)

const budgetCheck = computed(() => {
  const t = trip.value
  const planned = sectionData.value.reduce((sum, d) => sum + d.cost, 0)
  if (!t || planned === 0) return null
  const pct = t.budget ? Math.round((planned / t.budget) * 100) : null
  return { planned, pct, over: t.budget !== null && planned > t.budget }
})

const isOver = computed(() => !!trip.value && tripPhase(trip.value.startDate, trip.value.endDate) === 'vorbei')

async function toggleArchive() {
  if (!trip.value) return
  await tripRepository.setArchived(props.id, !trip.value.archived)
}

async function remove() {
  if (!trip.value) return
  if (!confirm(`„${trip.value.title}“ wirklich löschen?`)) return
  await tripRepository.remove(props.id)
  router.replace('/trip')
}
</script>

<template>
  <div v-if="trip">
    <TripCover v-if="layout.hero !== 'aus'" :trip="trip" class="hero mb-3" :class="`hero-${layout.hero}`">
      <div class="d-flex flex-column justify-content-between h-100 p-3 p-md-4">
        <div class="d-flex justify-content-end gap-2">
          <RouterLink :to="`/trip/${trip.id}/titelbild`" class="btn btn-sm hero-btn" aria-label="Titelbild ändern">
            <i class="bi bi-image me-1" aria-hidden="true"></i><span class="d-none d-sm-inline">Titelbild</span>
          </RouterLink>
          <div class="dropdown">
            <button class="btn btn-sm hero-btn" data-bs-toggle="dropdown" aria-label="Aktionen">
              <i class="bi bi-three-dots" aria-hidden="true"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li v-if="canEdit(trip.id)"><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/bearbeiten`">Bearbeiten</RouterLink></li>
              <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/titelbild`">Titelbild ändern</RouterLink></li>
              <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/teilen`">Mit Mitreisenden teilen</RouterLink></li>
              <li><button class="dropdown-item" @click="toggleArchive">{{ trip.archived ? 'Aus dem Archiv holen' : 'Ins Archiv legen' }}</button></li>
              <li><hr class="dropdown-divider" /></li>
              <li v-if="canEdit(trip.id)"><button class="dropdown-item text-danger" @click="remove">Löschen</button></li>
            </ul>
          </div>
        </div>
        <div class="hero-text">
          <div class="small mb-1">
            <span v-if="trip.archived" class="badge text-bg-light me-1"><i class="bi bi-archive me-1" aria-hidden="true"></i>Archiv</span>
            <span v-for="c in trip.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>{{ tripStatusText(trip.startDate, trip.endDate) }}
          </div>
          <h1 class="mb-1 hero-title">{{ trip.title }}</h1>
          <div><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ trip.destination }}</div>
        </div>
      </div>
    </TripCover>
    <div v-else class="d-flex align-items-start justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h3 mb-1">{{ trip.title }}</h1>
        <div class="text-body-secondary">
          <span v-for="c in trip.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>
          <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ trip.destination }} · {{ tripStatusText(trip.startDate, trip.endDate) }}
        </div>
      </div>
      <div class="dropdown">
        <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="dropdown" aria-label="Aktionen"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li v-if="canEdit(trip.id)"><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/bearbeiten`">Bearbeiten</RouterLink></li>
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/titelbild`">Titelbild ändern</RouterLink></li>
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/teilen`">Mit Mitreisenden teilen</RouterLink></li>
          <li><button class="dropdown-item" @click="toggleArchive">{{ trip.archived ? 'Aus dem Archiv holen' : 'Ins Archiv legen' }}</button></li>
          <li><hr class="dropdown-divider" /></li>
          <li v-if="canEdit(trip.id)"><button class="dropdown-item text-danger" @click="remove">Löschen</button></li>
        </ul>
      </div>
    </div>

    <ReadOnlyNote :trip-id="trip.id" />

    <div v-if="layout.facts" class="d-flex flex-wrap gap-2 mb-3">
      <span v-for="f in facts" :key="f.icon" class="fact"><i :class="`bi bi-${f.icon} me-1`" aria-hidden="true"></i>{{ f.value }}</span>
    </div>

    <!-- Bereiche: vor, während und nach der Reise -->
    <template v-if="layout.tabs">
      <nav class="phase-tabs mb-2" aria-label="Bereiche der Reise">
        <button v-for="t in TABS" :key="t.id" type="button" class="phase-tab" :class="{ active: tab === t.id }" :aria-current="tab === t.id ? 'page' : undefined"
                @click="select(t.id)">
          <i :class="`bi bi-${t.icon}`" aria-hidden="true"></i>
          <span>{{ t.label }}</span>
          <span v-if="nowTab === t.id" class="now-dot" title="Passt gerade"></span>
        </button>
      </nav>
      <div class="d-flex align-items-center gap-2 mb-3">
        <p class="small text-body-secondary mb-0 flex-grow-1 on-bg">{{ TABS.find((t) => t.id === tab)!.intro }}</p>
        <RouterLink to="/einstellungen/aussehen?teil=reiseseite" class="btn btn-link btn-sm p-0 text-nowrap"><i class="bi bi-sliders me-1" aria-hidden="true"></i>Anpassen</RouterLink>
      </div>
    </template>

    <!-- Unterwegs: das Wichtigste zuerst -->
    <div v-if="showQuick" class="row g-2 mb-3">
      <div class="col-6">
        <RouterLink to="/heute" class="quick quick-primary"><i class="bi bi-sun" aria-hidden="true"></i>Heute</RouterLink>
      </div>
      <div class="col-6">
        <RouterLink :to="`/trip/${trip.id}/dokumente?tab=notfall`" class="quick quick-danger"><i class="bi bi-telephone" aria-hidden="true"></i>Notfall</RouterLink>
      </div>
    </div>

    <SectionTiles v-if="layout.tabs" :items="visible" :data="sectionData" :trip-id="trip.id" :currency="trip.currency" :view="layout.view"
                  :summaries="layout.summaries" :show-cost="tab === 'planung'" />
    <template v-else>
      <section v-for="g in groups" :key="g.id">
        <h2 class="h6 text-body-secondary d-flex align-items-center gap-2 mt-2 on-bg"><i :class="`bi bi-${g.icon}`" aria-hidden="true"></i>{{ g.label }}
          <span v-if="nowTab === g.id" class="now-dot position-static" title="Passt gerade"></span></h2>
        <SectionTiles :items="g.items" :data="sectionData" :trip-id="trip.id" :currency="trip.currency" :view="layout.view"
                      :summaries="layout.summaries" :show-cost="g.id === 'planung'" />
      </section>
      <div class="text-end mb-3">
        <RouterLink to="/einstellungen/aussehen?teil=reiseseite" class="btn btn-link btn-sm p-0"><i class="bi bi-sliders me-1" aria-hidden="true"></i>Anpassen</RouterLink>
      </div>
    </template>

    <!-- Sicherheitsnetz: Bereiche ohne Reiter bleiben erreichbar -->
    <details v-if="extra.length" class="mb-4 extra">
      <summary class="small text-body-secondary on-bg">Weitere Bereiche ({{ extra.length }})</summary>
      <div class="mt-2">
        <SectionTiles :items="extra" :data="sectionData" :trip-id="trip.id" :currency="trip.currency" view="liste" :summaries="layout.summaries" :show-cost="false" />
      </div>
    </details>

    <!-- Budgetvergleich -->
    <div v-if="budgetCheck && (!layout.tabs || tab === 'planung' || tab === 'danach')" class="card mb-4">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between small mb-1">
          <span>Geplante Kosten</span>
          <strong :class="{ 'text-danger': budgetCheck.over }">
            {{ formatMoney(budgetCheck.planned, trip.currency) }}
            <template v-if="trip.budget"> von {{ formatMoney(trip.budget, trip.currency) }}</template>
          </strong>
        </div>
        <div v-if="budgetCheck.pct !== null" class="progress" style="height: 8px" role="progressbar"
             :aria-valuenow="budgetCheck.pct" aria-valuemin="0" aria-valuemax="100" aria-label="Budget verplant">
          <div class="progress-bar" :class="budgetCheck.over ? 'bg-danger' : budgetCheck.pct > 85 ? 'bg-warning' : 'bg-success'"
               :style="{ width: `${Math.min(100, budgetCheck.pct)}%` }"></div>
        </div>
        <div class="small text-body-secondary mt-1">Anreise, Unterkünfte und Unternehmungen in {{ trip.currency }}, ohne Verpflegung.</div>
      </div>
    </div>

    <div v-if="trip.notes && (!layout.tabs || tab === 'planung')" class="card mb-4">
      <div class="card-body">
        <h2 class="h6 text-body-secondary">Notizen</h2>
        <p class="mb-0" style="white-space: pre-line">{{ trip.notes }}</p>
      </div>
    </div>

    <!-- Archiv -->
    <div v-if="!layout.tabs || tab === 'teilen'" class="card mb-4">
      <div class="card-body d-flex flex-wrap align-items-center gap-3">
        <i class="bi bi-archive fs-3 text-primary" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">{{ trip.archived ? 'Im Archiv' : 'Archiv' }}</div>
          <div class="small text-body-secondary">
            <template v-if="trip.archived">Die Reise liegt im Archiv – in der Reiseliste eingeklappt, alle Daten bleiben erhalten.</template>
            <template v-else-if="isOver">Fertig erzählt? Ins Archiv legen – die Reiseliste bleibt übersichtlich, nichts geht verloren.</template>
            <template v-else>Nach der Reise kannst du sie hier ins Archiv legen.</template>
          </div>
        </div>
        <button type="button" class="btn" :class="trip.archived ? 'btn-outline-primary' : 'btn-primary'" @click="toggleArchive">
          {{ trip.archived ? 'Aus dem Archiv holen' : 'Ins Archiv legen' }}
        </button>
      </div>
    </div>
  </div>

  <p v-else class="text-body-secondary">Reise wird geladen …</p>
</template>

<style scoped>
.hero {
  height: 240px;
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
}
.hero-klein {
  height: 160px;
}
.hero-gross {
  height: 320px;
}
@media (min-width: 768px) {
  .hero {
    height: 300px;
  }
  .hero-klein {
    height: 190px;
  }
  .hero-gross {
    height: 420px;
  }
}
[data-nww-shadow='hard'] .hero {
  border: var(--nww-border-width) solid var(--nww-border);
}
.hero-text {
  color: #fff;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);
}
.hero-title {
  font-size: clamp(1.7rem, 4.5vw, 2.6rem);
  line-height: 1.1;
}
.hero-btn {
  color: #fff;
  background: rgba(0, 0, 0, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.hero-btn:hover {
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
}
.fact {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  font-size: 0.875rem;
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: 999px;
}
.fact .bi {
  color: var(--nww-primary);
}
.phase-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
}
.phase-tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.5rem 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.15;
  color: var(--nww-muted);
  background: none;
  border: 0;
  border-radius: var(--bs-border-radius);
}
.phase-tab .bi {
  font-size: 1.2rem;
}
.phase-tab.active {
  color: var(--nww-on-primary);
  background: var(--nww-primary);
}
[data-nww-gradient] .phase-tab.active {
  background: linear-gradient(135deg, var(--nww-primary), var(--nww-accent));
}
[data-nww-upper] .phase-tab {
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.75rem;
}
.now-dot {
  position: absolute;
  top: 0.4rem;
  right: 0.6rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--nww-accent);
}
.quick {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  padding: 0.85rem;
  font-weight: 700;
  text-decoration: none;
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
}
.quick .bi {
  font-size: 1.3rem;
}
.quick-primary {
  color: var(--nww-on-primary);
  background: var(--nww-primary);
}
.quick-danger {
  color: #fff;
  background: #c0392b;
}
.min-w-0 {
  min-width: 0;
}
</style>
