<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { TripContextHeader } from '@/modules/trip/public'
import { accommodationRepository, ACCOMMODATION_TYPE_LABELS, type Accommodation } from '@/modules/accommodation/public'
import { travelRepository, type TravelLeg } from '@/modules/travel/public'
import { checklistRepository } from '../repository'
import { checkinId, checkoutStays, flights, itemsOf, legRoute } from '../logic'
import { checkoutSuggestions, HOME_SUGGESTIONS } from '../suggestions'
import ChecklistBlock from '../components/ChecklistBlock.vue'
import type { ChecklistItem } from '../types'
import { intlLocale, t } from '@/i18n'

const props = defineProps<{ tripId: string }>()
const items = useLiveQuery(() => checklistRepository.listByTrip(props.tripId), [] as ChecklistItem[])
const stays = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])
const legs = useLiveQuery(() => travelRepository.listByTrip(props.tripId), [] as TravelLeg[])

const home = computed(() => itemsOf(items.value, 'zuhause'))
const checkouts = computed(() => checkoutStays(stays.value))
const flightLegs = computed(() => flights(legs.value))

const previous = ref<{ title: string; texts: string[] } | null>(null)
watchEffect(async () => {
  previous.value = home.value.length ? null : await checklistRepository.previousHomeList(props.tripId)
})

const checkinDone = (legId: string) => items.value.some((i) => i.id === checkinId(props.tripId, legId) && i.done)
const toggleCheckin = (l: TravelLeg) => checklistRepository.setCheckin(props.tripId, l.id, !checkinDone(l.id), legRoute(l))

const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(intlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' })
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Abreise-Checklisten')" />

  <!-- Zu Hause -->
  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5"><i class="bi bi-house-door me-2 text-primary" aria-hidden="true"></i>{{ t('Bevor es losgeht') }}</h2>
      <p class="small text-body-secondary">{{ t('Zu Hause, kurz vor der Abfahrt. Die Liste lässt sich bei der nächsten Reise übernehmen.') }}</p>
      <ChecklistBlock :trip-id="tripId" list="zuhause" :items="home" :suggestions="HOME_SUGGESTIONS" :previous="previous" />
    </div>
  </section>

  <!-- Online-Check-in -->
  <section v-if="flightLegs.length" class="card mb-3" data-checklist="checkin">
    <div class="card-body">
      <h2 class="h5"><i class="bi bi-airplane me-2 text-primary" aria-hidden="true"></i>{{ t('Online-Check-in') }}</h2>
      <p class="small text-body-secondary">{{ t('Bei vielen Fluggesellschaften ab 24 Stunden vor Abflug, bei manchen früher. Danach Bordkarte aufs Handy laden.') }}</p>
      <ul class="list-group">
        <li v-for="l in flightLegs" :key="l.id" class="list-group-item d-flex align-items-center gap-2 py-2" :class="{ 'text-body-secondary': checkinDone(l.id) }">
          <input :id="`checkin-${l.id}`" class="form-check-input m-0 big-check" type="checkbox" :checked="checkinDone(l.id)" @change="toggleCheckin(l)" />
          <label class="flex-grow-1 mb-0" :for="`checkin-${l.id}`" :class="{ 'text-decoration-line-through': checkinDone(l.id) }">
            {{ legRoute(l) }}
            <span class="small text-body-secondary ms-1">{{ dateLabel(l.date) }}<template v-if="l.departTime"> · {{ l.departTime }}</template></span>
          </label>
        </li>
      </ul>
    </div>
  </section>

  <!-- Auschecken je Unterkunft -->
  <section v-for="s in checkouts" :key="s.id" class="card mb-3">
    <div class="card-body">
      <h2 class="h5 mb-1"><i class="bi bi-door-open me-2 text-primary" aria-hidden="true"></i>{{ t('Auschecken: {name}', { name: s.name }) }}</h2>
      <p class="small text-body-secondary">{{ ACCOMMODATION_TYPE_LABELS[s.type] }} · {{ t('Abreise {date}', { date: dateLabel(s.checkOut) }) }}</p>
      <ChecklistBlock :trip-id="tripId" list="auschecken" :ref-id="s.id" :items="itemsOf(items, 'auschecken', s.id)" :suggestions="checkoutSuggestions(s.type)" />
    </div>
  </section>
  <p v-if="!checkouts.length" class="small text-body-secondary">
    <Tx text="Für jede gebuchte Unterkunft erscheint hier eine Liste zum Auschecken – Unterkünfte stehen unter {link}.">
      <template #link><RouterLink :to="`/trip/${tripId}/unterkuenfte`">{{ t('Unterkünfte') }}</RouterLink></template>
    </Tx>
  </p>
  <p class="small text-body-secondary">{{ t('Offene Punkte erscheinen rechtzeitig unter „Heute“ und bei den Terminen: zu Hause am Tag vor der Abreise, der Check-in am Tag vor dem Flug, das Auschecken am Abreisetag.') }}</p>
</template>

<style scoped>
.big-check {
  width: 1.4em;
  height: 1.4em;
  flex: none;
}
</style>
