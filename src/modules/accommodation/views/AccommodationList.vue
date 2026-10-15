<script setup lang="ts">
import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { formatDate, formatDayShort, formatMoney, safeUrl } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { accommodationRepository } from '../repository'
import { coverage, nights, pricePerNight, sortAccommodations, totalCost, upcomingCancelDeadlines } from '../logic'
import { ACCOMMODATION_STATUS, ACCOMMODATION_TYPE_LABELS, type Accommodation } from '../types'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const list = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])

const sorted = computed(() => sortAccommodations(list.value))
const cov = computed(() => (trip.value ? coverage(trip.value.startDate, trip.value.endDate, list.value) : null))
const cost = computed(() => (trip.value ? totalCost(list.value, trip.value.currency) : 0))
const deadlines = computed(() => upcomingCancelDeadlines(list.value))
const coveragePct = computed(() => (cov.value && cov.value.totalNights > 0 ? Math.round((cov.value.bookedNights / cov.value.totalNights) * 100) : 0))
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Unterkünfte')" />

  <!-- Übersicht: Abdeckung der Nächte -->
  <div v-if="cov && cov.totalNights > 0" class="card mb-3">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-baseline mb-2">
        <strong>{{ t('{bookedNights} von {totalNights} Nächten gebucht', { bookedNights: cov.bookedNights, totalNights: cov.totalNights }) }}</strong>
        <span v-if="cost > 0 && trip" class="small text-body-secondary">{{ formatMoney(cost, trip.currency) }}</span>
      </div>
      <div class="progress mb-2" role="progressbar" :aria-valuenow="coveragePct" aria-valuemin="0" aria-valuemax="100"
           :aria-label="t('Gebuchte Nächte')">
        <div class="progress-bar bg-success" :style="{ width: `${coveragePct}%` }"></div>
      </div>
      <div v-if="cov.gaps.length" class="small">
        <span class="text-body-secondary">{{ t('Noch offen:') }}</span>
        <span v-for="g in cov.gaps" :key="g.from" class="badge text-bg-light border ms-1">
          {{ formatDayShort(g.from) }}<template v-if="g.nights > 1"> – {{ formatDayShort(g.to) }}</template>
          ({{ g.nights }} {{ g.nights === 1 ? 'Nacht' : 'Nächte' }})
        </span>
      </div>
      <div v-else class="small text-success"><i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ t('Alle Nächte gebucht.') }}</div>
      <div v-if="cov.doubleBooked.length" class="small text-danger mt-1">
        <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
        {{ t('Doppelt gebucht: {map}', { map: cov.doubleBooked.map(formatDayShort).join(', ') }) }}
      </div>
    </div>
  </div>

  <!-- Stornofristen -->
  <div v-for="d in deadlines" :key="d.accommodation.id" class="alert alert-warning py-2 small">
    <i class="bi bi-alarm me-1" aria-hidden="true"></i>
    {{ t('{name}: kostenlos stornierbar nur noch {x} (bis {cancelUntil}).', { name: d.accommodation.name, x: d.daysLeft === 0 ? 'heute' : `${d.daysLeft} ${d.daysLeft === 1 ? 'Tag' : 'Tage'}`, cancelUntil: formatDate(d.accommodation.cancelUntil) }) }}
  </div>

  <div class="d-flex flex-wrap gap-2 mb-3">
    <RouterLink :to="`/trip/${tripId}/unterkuenfte/neu`" class="btn btn-primary">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Unterkunft hinzufügen') }}
    </RouterLink>
    <RouterLink :to="`/trip/${tripId}/buchung`" class="btn btn-outline-primary">
      <i class="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>{{ t('Buchung einlesen') }}
    </RouterLink>
  </div>

  <p v-if="sorted.length === 0" class="text-body-secondary">
    {{ t('Noch keine Unterkunft. Lege auch Ideen an – so behältst du Vergleiche im Blick.') }}
  </p>

  <div class="vstack gap-2">
    <div v-for="a in sorted" :key="a.id" class="card position-relative"
         :class="{ 'opacity-50': a.status === 'storniert' }">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div>
            <RouterLink :to="`/trip/${tripId}/unterkuenfte/${a.id}`"
                        class="fw-semibold text-body text-decoration-none stretched-link">{{ a.name }}</RouterLink>
            <div class="small text-body-secondary">
              {{ ACCOMMODATION_TYPE_LABELS[a.type] }} ·
              {{ formatDayShort(a.checkIn) }} – {{ formatDayShort(a.checkOut) }} ·
              {{ nights(a.checkIn, a.checkOut) }} {{ nights(a.checkIn, a.checkOut) === 1 ? 'Nacht' : 'Nächte' }}
            </div>
            <div v-if="a.address" class="small text-body-secondary">
              <i class="bi bi-geo-alt" aria-hidden="true"></i> {{ a.address }}
            </div>
          </div>
          <div class="text-end">
            <span class="badge" :class="ACCOMMODATION_STATUS[a.status].badge">{{ ACCOMMODATION_STATUS[a.status].label }}</span>
            <div v-if="a.price !== null" class="small mt-1">{{ formatMoney(a.price, a.currency) }}</div>
            <div v-if="pricePerNight(a) !== null" class="small text-body-secondary">
              {{ t('{pricePerNight}/Nacht', { pricePerNight: formatMoney(pricePerNight(a)!, a.currency) }) }}
            </div>
          </div>
        </div>
        <a v-if="safeUrl(a.url)" :href="safeUrl(a.url)!" target="_blank" rel="noopener noreferrer"
           class="small position-relative z-2">
          <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>{{ t('Zur Unterkunft') }}
        </a>
      </div>
    </div>
  </div>
</template>
