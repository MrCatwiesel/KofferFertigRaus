<script setup lang="ts">
/** Vorschläge passend zur Reise: Wetter, Zielland, Anreise, Unternehmungen, Unterkunft, Reisehinweise. */
import { computed, ref, watch } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import { getMeta, setMeta } from '@/core/meta'
import { tripRepository, type Trip } from '@/modules/trip/public'
import type { WeatherOutlook } from '@/services/weather'
import { packingRepository } from '../repository'
import { draftsFromSuggestions, newSuggestions, suggestItems, type Suggestion } from '../suggest'
import { suggestContext } from '../suggest-context'
import { CATEGORY, type PackingItem } from '../types'

const props = defineProps<{ tripId: string; items: PackingItem[] }>()
const online = useOnline()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)

const all = ref<Suggestion[]>([])
const outlook = ref<WeatherOutlook | null>(null)
const loadingWeather = ref(false)
const dismissed = ref<string[]>([])
const selected = ref(new Set<string>())
const open = ref(true)
const metaKey = computed(() => `packing.vorschlaege.aus.${props.tripId}`)

async function load(withWeather: boolean) {
  const t = await tripRepository.get(props.tripId)
  if (!t) return
  if (withWeather) loadingWeather.value = true
  try {
    const ctx = await suggestContext(t, withWeather)
    if (withWeather) outlook.value = ctx.outlook
    all.value = suggestItems(ctx)
  } finally {
    loadingWeather.value = false
  }
}
// erst ohne Wetter (sofort), dann mit (Netz)
watch(trip, async (t, old) => {
  if (!t || (old && old.id === t.id && old.updatedAt === t.updatedAt)) return
  dismissed.value = await getMeta<string[]>(metaKey.value, [])
  await load(false)
  if (online.value) await load(true)
}, { immediate: true })

const visible = computed(() => newSuggestions(all.value, props.items).filter((s) => !dismissed.value.includes(s.key)))
watch(visible, (v) => {
  // neue Vorschläge vorab auswählen
  const s = new Set(selected.value)
  for (const x of v) if (!s.has(`-${x.key}`)) s.add(x.key)
  selected.value = s
}, { immediate: true })
const chosen = computed(() => visible.value.filter((s) => selected.value.has(s.key)))

function toggle(key: string) {
  const s = new Set(selected.value)
  if (s.has(key)) {
    s.delete(key)
    s.add(`-${key}`) // bewusst abgewählt
  } else {
    s.add(key)
    s.delete(`-${key}`)
  }
  selected.value = s
}

async function take(list: Suggestion[]) {
  if (!list.length || !trip.value) return
  await packingRepository.createMany(props.tripId, draftsFromSuggestions(list, trip.value.participants ?? []))
}
async function dismiss(s: Suggestion) {
  dismissed.value = [...dismissed.value, s.key]
  await setMeta(metaKey.value, dismissed.value)
}
async function restore() {
  dismissed.value = []
  await setMeta(metaKey.value, [])
}

const weatherLine = computed(() => {
  const o = outlook.value
  if (!o) return ''
  const src = o.source === 'vorhersage' ? 'Vorhersage' : `so war es dort in den Jahren ${o.years.join(', ')}`
  return `${o.minTemp} bis ${o.maxTemp} °C, Regen an ${Math.round(o.rainShare * 100)} % der Tage${o.snow ? ', Schnee möglich' : ''} (${src})`
})
</script>

<template>
  <section class="card mb-3" data-packing-suggestions>
    <div class="card-body py-2">
      <button type="button" class="btn btn-link p-0 text-decoration-none d-flex align-items-center gap-2 w-100 text-start" :aria-expanded="open" @click="open = !open">
        <i class="bi bi-stars text-primary" aria-hidden="true"></i>
        <span class="fw-semibold flex-grow-1 text-body">{{ $t('Vorschläge für diese Reise') }} <span v-if="visible.length" class="badge text-bg-primary">{{ visible.length }}</span></span>
        <i class="bi text-body-secondary" :class="open ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true"></i>
      </button>

      <div v-if="open" class="mt-2">
        <p class="small mb-2" :class="weatherLine ? '' : 'text-body-secondary'">
          <i class="bi bi-cloud-sun me-1" aria-hidden="true"></i>
          <template v-if="weatherLine">{{ weatherLine }}</template>
          <template v-else-if="loadingWeather">{{ $t('Wetter wird abgefragt …') }}</template>
          <template v-else-if="!online">{{ $t('Ohne Internet: Vorschläge ohne Wetter.') }}</template>
          <template v-else>{{ $t('Kein Wetter gefunden – im Tagesplaner einen Ort fürs Wetter festlegen.') }}</template>
        </p>

        <p v-if="!visible.length" class="small text-body-secondary mb-1">
          {{ $t('Alles Passende ist schon auf der Liste.') }}
          <button v-if="dismissed.length" type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="restore">{{ $t('Ausgeblendete wieder zeigen ({0})', [dismissed.length]) }}</button>
        </p>
        <ul v-else class="list-unstyled mb-2">
          <li v-for="s in visible" :key="s.key" class="d-flex align-items-start gap-2 py-1 border-top" :data-suggestion="s.key">
            <input :id="`sg-${s.key}`" class="form-check-input mt-1" type="checkbox" :checked="selected.has(s.key)" @change="toggle(s.key)" />
            <label :for="`sg-${s.key}`" class="flex-grow-1">
              <span class="fw-semibold">{{ s.name }}</span>
              <span v-if="s.personal && (trip?.participants?.length ?? 0) > 1" class="small text-body-secondary"> {{ $t('· je Person') }}</span>
              <span v-else-if="s.quantity > 1" class="small text-body-secondary"> · {{ s.quantity }}×</span>
              <span class="d-block small text-body-secondary"><i :class="`bi bi-${CATEGORY[s.category].icon} me-1`" aria-hidden="true"></i>{{ s.reason }}</span>
            </label>
            <button type="button" class="btn btn-sm btn-link text-body-secondary p-0" :aria-label="`${s.name} ausblenden`" :title="$t('Nicht vorschlagen')" @click="dismiss(s)">
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </li>
        </ul>
        <button v-if="visible.length" type="button" class="btn btn-primary btn-sm" :disabled="!chosen.length" @click="take(chosen)">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ $t('{0} übernehmen', [chosen.length]) }}
        </button>
      </div>
    </div>
  </section>
</template>
