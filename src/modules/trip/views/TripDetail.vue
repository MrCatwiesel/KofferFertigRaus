<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { flag } from '@/core/countries'
import { getReminders, getTripSections } from '@/core/registry'
import { groupEntries, searchEntries, type GroupEntry } from '@/core/trip-groups'
import { togglePin } from '@/core/trip-layout'
import { todayIso } from '@/core/dates'
import { appearance } from '@/ui/appearance'
import ZoomGroups, { type ZoomGroup } from '@/ui/ZoomGroups.vue'
import { tripRepository } from '../repository'
import { budgetPerPersonDay, formatDate, formatMoney, tripDays, tripPhase, tripStatusText } from '../logic'
import { nowCards, nowPhaseOf, type NowPhase } from '../now'
import { TRANSPORT_LABELS, type Trip } from '../types'
import TripCover from '../components/TripCover.vue'
import ReadOnlyNote from '../components/ReadOnlyNote.vue'
import { canEdit } from '@/core/people'
import { t, tn } from '@/i18n'

const props = defineProps<{ id: string }>()
const router = useRouter()
const route = useRoute()

const trip = useLiveQuery(() => tripRepository.get(props.id), undefined as Trip | undefined)
/** Aussehen der Reiseseite (Einstellungen → Aussehen → Reiseseite) */
const layout = computed(() => appearance.layout)
const today = todayIso()

const facts = computed(() => {
  const tp = trip.value
  if (!tp) return []
  const perDay = budgetPerPersonDay(tp)
  return [
    { icon: 'calendar-range', value: `${formatDate(tp.startDate)} – ${formatDate(tp.endDate)} · ${tn(tripDays(tp.startDate, tp.endDate), '1 Tag', '{n} Tage')}` },
    { icon: 'people', value: tp.participants?.length ? tp.participants.join(', ') : tn(tp.travelers, '1 Person', '{n} Personen') },
    { icon: 'signpost-split', value: TRANSPORT_LABELS[tp.transport] },
    { icon: 'wallet2', value: tp.budget ? formatMoney(tp.budget, tp.currency) + (perDay !== null ? ' · ' + t('{price} p. P./Tag', { price: formatMoney(perDay, tp.currency) }) : '') : t('Budget offen') }
  ]
})

/** Bereiche, die andere Module beisteuern (Unterkünfte, Unternehmungen …) */
const sections = getTripSections()

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

/** Alle Einträge der Reiseseite: Bereiche der Module und zwei feste Seiten der Reise */
interface Entry extends GroupEntry {
  to: string
  summary: string
}
const entries = computed<Entry[]>(() => [
  ...sections.map((s, i) => ({ id: s.moduleId, title: s.title, icon: s.icon, group: s.group, keywords: s.keywords, to: s.to(props.id), summary: sectionData.value[i]?.summary ?? '' })),
  { id: 'sos', title: t('Notfall-Seite'), icon: 'heart-pulse', group: 'gesundheit', keywords: t('Notruf, Hilfe, Botschaft, Notfall'), to: `/trip/${props.id}/sos`, summary: t('Nummern, Botschaft, Allergien – auch zum Zeigen') },
  { id: 'share-trip', title: t('Mit Mitreisenden teilen'), icon: 'people', group: 'erinnern', keywords: t('Datei, Mitreisende, übertragen'), to: `/trip/${props.id}/teilen`, summary: t('Reise als Datei weitergeben') }
])
const sub = (e: Entry) => (layout.value.summaries ? e.summary : '')

const zoomGroups = computed<ZoomGroup[]>(() =>
  groupEntries(entries.value).map(({ group, items }) => ({
    id: group.id,
    title: group.title,
    icon: group.icon,
    color: group.color,
    sub: items.map((e) => e.title).join(' · '),
    items: items.map((e) => ({ id: e.id, title: e.title, icon: e.icon, to: e.to, sub: sub(e) }))
  }))
)
const colorOf = (e: Entry) => zoomGroups.value.find((g) => g.items.some((i) => i.id === e.id))?.color ?? 'var(--nww-primary)'

/** Angeheftet (je Gerät) */
const pinnedItems = computed(() => layout.value.pinned.map((id) => entries.value.find((e) => e.id === id)).filter((e): e is Entry => !!e))
function pin(id: string) {
  appearance.layout = togglePin(appearance.layout, id)
}

/** Suche über alle Funktionen der Reise */
const query = ref('')
const results = computed(() => searchEntries(entries.value, query.value))
function openFirst() {
  if (results.value[0]) void router.push(results.value[0].to)
}

/** „Jetzt wichtig“: Phase aus dem Datum, umschaltbar (?phase=…) */
const PHASES: { id: NowPhase; label: string }[] = [
  { id: 'vorher', label: t('Vorher') },
  { id: 'unterwegs', label: t('Unterwegs') },
  { id: 'danach', label: t('Danach') }
]
const autoPhase = computed<NowPhase>(() => (trip.value ? nowPhaseOf(trip.value, today) : 'vorher'))
const phase = computed<NowPhase>(() => {
  const q = route.query.phase
  return PHASES.some((p) => p.id === q) ? (q as NowPhase) : autoPhase.value
})
function setPhase(id: NowPhase) {
  const q = { ...route.query }
  if (id === autoPhase.value) delete q.phase
  else q.phase = id
  void router.replace({ query: q })
}
const reminders = useLiveQuery(async () => {
  const tp = await tripRepository.get(props.id)
  return tp ? getReminders(tp, today) : []
}, [])
const now = computed(() =>
  nowCards(
    phase.value,
    entries.value.map((e) => ({ moduleId: e.id, title: e.title, icon: e.icon, to: e.to, summary: e.summary })),
    reminders.value,
    today
  )
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
  if (!confirm(t('„{title}“ wirklich löschen?', { title: trip.value.title }))) return
  await tripRepository.remove(props.id)
  router.replace('/trip')
}
</script>

<template>
  <div v-if="trip">
    <TripCover v-if="layout.hero !== 'aus'" :trip="trip" class="hero mb-3" :class="`hero-${layout.hero}`">
      <div class="d-flex flex-column justify-content-between h-100 p-3 p-md-4">
        <div class="d-flex justify-content-end gap-2">
          <RouterLink :to="`/trip/${trip.id}/titelbild`" class="btn btn-sm hero-btn" :aria-label="t('Titelbild ändern')">
            <i class="bi bi-image me-1" aria-hidden="true"></i><span class="d-none d-sm-inline">{{ t('Titelbild') }}</span>
          </RouterLink>
          <div class="dropdown">
            <button class="btn btn-sm hero-btn" data-bs-toggle="dropdown" :aria-label="t('Aktionen')">
              <i class="bi bi-three-dots" aria-hidden="true"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li v-if="canEdit(trip.id)"><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/bearbeiten`">{{ t('Bearbeiten') }}</RouterLink></li>
              <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/titelbild`">{{ t('Titelbild ändern') }}</RouterLink></li>
              <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/teilen`">{{ t('Mit Mitreisenden teilen') }}</RouterLink></li>
              <li><button class="dropdown-item" @click="toggleArchive">{{ trip.archived ? t('Aus dem Archiv holen') : t('Ins Archiv legen') }}</button></li>
              <li><hr class="dropdown-divider" /></li>
              <li v-if="canEdit(trip.id)"><button class="dropdown-item text-danger" @click="remove">{{ t('Löschen') }}</button></li>
            </ul>
          </div>
        </div>
        <div class="hero-text">
          <div class="small mb-1">
            <span v-if="trip.archived" class="badge text-bg-light me-1"><i class="bi bi-archive me-1" aria-hidden="true"></i>{{ t('Archiv') }}</span>
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
        <button class="btn btn-outline-secondary btn-sm" data-bs-toggle="dropdown" :aria-label="t('Aktionen')"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li v-if="canEdit(trip.id)"><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/bearbeiten`">{{ t('Bearbeiten') }}</RouterLink></li>
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/titelbild`">{{ t('Titelbild ändern') }}</RouterLink></li>
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/teilen`">{{ t('Mit Mitreisenden teilen') }}</RouterLink></li>
          <li><button class="dropdown-item" @click="toggleArchive">{{ trip.archived ? t('Aus dem Archiv holen') : t('Ins Archiv legen') }}</button></li>
          <li><hr class="dropdown-divider" /></li>
          <li v-if="canEdit(trip.id)"><button class="dropdown-item text-danger" @click="remove">{{ t('Löschen') }}</button></li>
        </ul>
      </div>
    </div>

    <ReadOnlyNote :trip-id="trip.id" />
    <div v-if="trip.sample" class="alert alert-info d-flex flex-wrap align-items-center gap-2 py-2" data-sample-note>
      <i class="bi bi-mortarboard" aria-hidden="true"></i>
      <span class="flex-grow-1 small">{{ t('Das ist die') }} <strong>{{ t('Beispielreise') }}</strong> {{ t('– schau dich um und ändere ruhig alles.') }}</span>
      <RouterLink to="/hilfe/erste-schritte" class="btn btn-sm btn-outline-primary">{{ t('Hilfe') }}</RouterLink>
      <button v-if="canEdit(trip.id)" type="button" class="btn btn-sm btn-outline-danger" @click="remove">{{ t('Beispielreise löschen') }}</button>
    </div>

    <div v-if="layout.facts" class="d-flex flex-wrap gap-2 mb-3">
      <span v-for="f in facts" :key="f.icon" class="fact"><i :class="`bi bi-${f.icon} me-1`" aria-hidden="true"></i>{{ f.value }}</span>
    </div>

    <!-- Jetzt wichtig: passt zur Reisephase, versteckt aber nichts -->
    <section class="mb-4" data-now>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h2 class="h5 mb-0 on-bg">{{ t('Jetzt wichtig') }}</h2>
        <div class="now-phase" role="group" :aria-label="t('Reisephase')">
          <button v-for="p in PHASES" :key="p.id" type="button" :class="{ active: phase === p.id }" :aria-pressed="phase === p.id" :data-phase="p.id" @click="setPhase(p.id)">
            {{ p.label }}<span v-if="p.id === autoPhase" class="now-dot" :title="t('Passt gerade')"></span>
          </button>
        </div>
      </div>
      <div class="now-grid fx-grid">
        <RouterLink v-for="c in now" :key="c.id" :to="c.to" class="now-card fx-tile" :data-now-card="c.id">
          <i :class="`bi bi-${c.icon}`" aria-hidden="true"></i>
          <span class="min-w-0">
            <span class="d-block fw-semibold">{{ c.title }}</span>
            <span v-if="c.sub" class="d-block small text-body-secondary text-truncate">{{ c.sub }}</span>
          </span>
        </RouterLink>
      </div>
    </section>

    <!-- Angeheftet (je Gerät, Stern in den Gruppen) -->
    <section v-if="pinnedItems.length" class="mb-4" data-pinned>
      <h2 class="h6 text-body-secondary mb-2 on-bg"><i class="bi bi-star-fill me-1 pin-star" aria-hidden="true"></i>{{ t('Angeheftet') }}</h2>
      <div class="pin-row fx-grid">
        <RouterLink v-for="e in pinnedItems" :key="e.id" :to="e.to" class="pin-chip fx-tile" :style="{ '--zg': colorOf(e) }" :data-pinned-item="e.id">
          <i :class="`bi bi-${e.icon}`" aria-hidden="true"></i>{{ e.title }}
        </RouterLink>
      </div>
    </section>

    <!-- Alles zur Reise: Suche und Themen-Gruppen -->
    <section class="mb-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h2 class="h5 mb-0 on-bg">{{ t('Alles zur Reise') }}</h2>
        <RouterLink to="/einstellungen/aussehen?teil=reiseseite" class="btn btn-link btn-sm p-0"><i class="bi bi-sliders me-1" aria-hidden="true"></i>{{ t('Anpassen') }}</RouterLink>
      </div>
      <form class="search mb-3" role="search" @submit.prevent="openFirst">
        <i class="bi bi-search" aria-hidden="true"></i>
        <input v-model="query" type="search" class="form-control" :placeholder="t('Suchen, z. B. Hotel, Packliste, Wetter …')" :aria-label="t('Funktion suchen')" data-trip-search />
      </form>
      <div v-if="query.trim()" data-search-results>
        <div v-if="results.length" class="list-group">
          <RouterLink v-for="e in results" :key="e.id" :to="e.to" class="list-group-item list-group-item-action d-flex align-items-center gap-3" :data-section="e.id">
            <i :class="`bi bi-${e.icon} fs-5`" :style="{ color: colorOf(e) }" aria-hidden="true"></i>
            <span class="min-w-0 flex-grow-1">
              <span class="d-block fw-semibold">{{ e.title }}</span>
              <span v-if="sub(e)" class="d-block small text-body-secondary text-truncate">{{ sub(e) }}</span>
            </span>
            <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
          </RouterLink>
        </div>
        <p v-else class="text-body-secondary on-bg">{{ t('Nichts gefunden. Andere Wörter probieren – oder unten in den Gruppen schauen.') }}</p>
      </div>
      <ZoomGroups v-else :groups="zoomGroups" pinnable :pinned="layout.pinned" @pin="pin" />
    </section>

    <!-- Budgetvergleich -->
    <div v-if="budgetCheck" class="card mb-4">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between small mb-1">
          <span>{{ t('Geplante Kosten') }}</span>
          <strong :class="{ 'text-danger': budgetCheck.over }">
            {{ formatMoney(budgetCheck.planned, trip.currency) }}
            <template v-if="trip.budget"> {{ t('von {budget}', { budget: formatMoney(trip.budget, trip.currency) }) }}</template>
          </strong>
        </div>
        <div v-if="budgetCheck.pct !== null" class="progress" style="height: 8px" role="progressbar"
             :aria-valuenow="budgetCheck.pct" aria-valuemin="0" aria-valuemax="100" :aria-label="t('Budget verplant')">
          <div class="progress-bar" :class="budgetCheck.over ? 'bg-danger' : budgetCheck.pct > 85 ? 'bg-warning' : 'bg-success'"
               :style="{ width: `${Math.min(100, budgetCheck.pct)}%` }"></div>
        </div>
        <div class="small text-body-secondary mt-1">{{ t('Anreise, Unterkünfte und Unternehmungen in {currency}, ohne Verpflegung.', { currency: trip.currency }) }}</div>
      </div>
    </div>

    <div v-if="trip.notes" class="card mb-4">
      <div class="card-body">
        <h2 class="h6 text-body-secondary">{{ t('Notizen') }}</h2>
        <p class="mb-0" style="white-space: pre-line">{{ trip.notes }}</p>
      </div>
    </div>

    <!-- Archiv -->
    <div class="card mb-4">
      <div class="card-body d-flex flex-wrap align-items-center gap-3">
        <i class="bi bi-archive fs-3 text-primary" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">{{ trip.archived ? t('Im Archiv') : t('Archiv') }}</div>
          <div class="small text-body-secondary">
            <template v-if="trip.archived">{{ t('Die Reise liegt im Archiv – in der Reiseliste eingeklappt, alle Daten bleiben erhalten.') }}</template>
            <template v-else-if="isOver">{{ t('Fertig erzählt? Ins Archiv legen – die Reiseliste bleibt übersichtlich, nichts geht verloren.') }}</template>
            <template v-else>{{ t('Nach der Reise kannst du sie hier ins Archiv legen.') }}</template>
          </div>
        </div>
        <button type="button" class="btn" :class="trip.archived ? 'btn-outline-primary' : 'btn-primary'" @click="toggleArchive">
          {{ trip.archived ? t('Aus dem Archiv holen') : t('Ins Archiv legen') }}
        </button>
      </div>
    </div>
  </div>

  <p v-else class="text-body-secondary">{{ t('Reise wird geladen …') }}</p>
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
.now-phase {
  display: inline-flex;
  gap: 0.2rem;
  padding: 0.2rem;
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: 999px;
}
.now-phase button {
  position: relative;
  min-height: 2.5rem;
  padding: 0 0.9rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--nww-muted);
  background: none;
  border: 0;
  border-radius: 999px;
}
.now-phase button.active {
  color: var(--nww-on-primary);
  background: var(--nww-primary);
}
.now-dot {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--nww-accent);
}
.now-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
@media (min-width: 576px) {
  .now-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.now-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.5rem;
  padding: 0.85rem 1rem;
  color: var(--nww-text);
  text-decoration: none;
  background: var(--nww-card-bg);
  border: 2px solid rgba(var(--nww-primary-rgb), 0.45);
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
}
.now-card:hover {
  color: var(--nww-text);
}
.now-card > .bi {
  font-size: 1.5rem;
  color: var(--nww-primary);
}
.pin-star {
  color: #d99a00;
}
.pin-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.pin-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0 1rem;
  font-weight: 600;
  color: var(--nww-text);
  text-decoration: none;
  background: color-mix(in srgb, var(--zg) 13%, var(--nww-card-bg));
  border: var(--nww-border-width) solid color-mix(in srgb, var(--zg) 30%, var(--nww-border));
  border-radius: 999px;
}
.pin-chip .bi {
  color: var(--zg);
}
.search {
  position: relative;
}
.search .bi {
  position: absolute;
  left: 0.9rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--nww-muted);
  pointer-events: none;
}
.search input {
  min-height: 2.9rem;
  padding-left: 2.5rem;
  border-radius: 999px;
}
.min-w-0 {
  min-width: 0;
}
</style>
