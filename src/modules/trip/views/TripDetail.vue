<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { getTripSections } from '@/core/registry'
import { tripRepository } from '../repository'
import { budgetPerPersonDay, daysUntil, formatDate, formatMoney, tripDays } from '../logic'
import { TRANSPORT_LABELS, type Trip } from '../types'

const props = defineProps<{ id: string }>()
const router = useRouter()

const trip = useLiveQuery(() => tripRepository.get(props.id), undefined as Trip | undefined)

const facts = computed(() => {
  const t = trip.value
  if (!t) return []
  const perDay = budgetPerPersonDay(t)
  return [
    { icon: 'calendar-range', label: 'Zeitraum', value: `${formatDate(t.startDate)} – ${formatDate(t.endDate)} (${tripDays(t.startDate, t.endDate)} Tage)` },
    { icon: 'people', label: 'Personen', value: t.participants?.length ? t.participants.join(', ') : String(t.travelers) },
    { icon: 'signpost-split', label: 'Anreise', value: TRANSPORT_LABELS[t.transport] },
    {
      icon: 'wallet2',
      label: 'Budget',
      value: t.budget ? formatMoney(t.budget, t.currency) + (perDay !== null ? ` (${formatMoney(perDay, t.currency)} p. P./Tag)` : '') : 'nicht festgelegt'
    }
  ]
})

/** Abschnitte, die andere Module beisteuern (Unterkünfte, Unternehmungen …). */
const sections = getTripSections()

/** Zusammenfassungen und geplante Kosten aller Abschnitte – aktualisieren sich live. */
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

/** Platzhalter für die kommenden Module – zeigt die Roadmap direkt in der App. */
const upcoming: { icon: string; title: string; milestone: string }[] = []

async function remove() {
  if (!trip.value) return
  if (!confirm(`„${trip.value.title}“ wirklich löschen?`)) return
  await tripRepository.remove(props.id)
  router.replace('/trip')
}
</script>

<template>
  <div v-if="trip">
    <div class="d-flex align-items-start justify-content-between gap-2 mb-3">
      <div>
        <h1 class="h3 mb-1">{{ trip.title }}</h1>
        <p class="text-body-secondary mb-0">
          <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ trip.destination }}
          <span v-if="daysUntil(trip.startDate) > 0"> · noch {{ daysUntil(trip.startDate) }} Tage</span>
        </p>
      </div>
      <div class="dropdown">
        <button class="btn btn-outline-secondary" data-bs-toggle="dropdown" aria-label="Aktionen">
          <i class="bi bi-three-dots" aria-hidden="true"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/bearbeiten`">Bearbeiten</RouterLink></li>
          <li><RouterLink class="dropdown-item" :to="`/trip/${trip.id}/teilen`">Mit Mitreisenden teilen</RouterLink></li>
          <li><button class="dropdown-item text-danger" @click="remove">Löschen</button></li>
        </ul>
      </div>
    </div>

    <ul class="list-group mb-4">
      <li v-for="f in facts" :key="f.label" class="list-group-item d-flex gap-3">
        <i :class="`bi bi-${f.icon} text-primary`" aria-hidden="true"></i>
        <div>
          <div class="small text-body-secondary">{{ f.label }}</div>
          <div>{{ f.value }}</div>
        </div>
      </li>
    </ul>

    <!-- Planungsbereiche der Module -->
    <h2 class="h6 text-body-secondary">Planung</h2>
    <div class="list-group mb-3">
      <RouterLink v-for="(s, i) in sections" :key="s.moduleId" :to="s.to(trip.id)"
                  class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <i :class="`bi bi-${s.icon} fs-5 text-primary`" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">{{ s.title }}</div>
          <div class="small text-body-secondary">{{ sectionData[i]?.summary ?? '…' }}</div>
        </div>
        <span v-if="sectionData[i]?.cost" class="small text-body-secondary">
          {{ formatMoney(sectionData[i].cost, trip.currency) }}
        </span>
        <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
      </RouterLink>
    </div>

    <!-- Budgetvergleich -->
    <div v-if="budgetCheck" class="card mb-4">
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

    <div v-if="trip.notes" class="mb-4">
      <h2 class="h6 text-body-secondary">Notizen</h2>
      <p class="mb-0" style="white-space: pre-line">{{ trip.notes }}</p>
    </div>

    <h2 v-if="upcoming.length" class="h6 text-body-secondary">Bald verfügbar</h2>
    <div class="row g-2">
      <div v-for="m in upcoming" :key="m.title" class="col-6 col-md-3">
        <div class="border rounded p-3 h-100 text-body-secondary">
          <i :class="`bi bi-${m.icon} fs-4 d-block mb-1`" aria-hidden="true"></i>
          <div class="small">{{ m.title }}</div>
          <span class="badge text-bg-light border">{{ m.milestone }}</span>
        </div>
      </div>
    </div>
  </div>

  <p v-else class="text-body-secondary">Reise wird geladen …</p>
</template>
