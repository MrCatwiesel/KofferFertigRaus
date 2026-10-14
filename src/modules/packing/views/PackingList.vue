<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { packingRepository } from '../repository'
import { SHARED, emptyPackingDraft, groupByCategory, parseQuickAdd, persons, progress, progressByPerson } from '../logic'
import { CATEGORY, type PackingCategory, type PackingItem } from '../types'
import PackingSuggestions from '../components/PackingSuggestions.vue'
import { t } from '@/core/i18n'

const props = defineProps<{ tripId: string }>()

const list = useLiveQuery(() => packingRepository.listByTrip(props.tripId), [] as PackingItem[])
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)

const openOnly = ref(false)
const person = ref('')
const search = ref('')
const quickName = ref('')
const quickCategory = ref<PackingCategory>('sonstiges')
const collapsed = ref(new Set<PackingCategory>())

const includeShared = ref(true)

/** Teilnehmer der Reise plus früher frei eingetragene Namen */
const people = computed(() => [...new Set([...participantsOf(trip.value), ...persons(list.value)])])
const tabs = computed(() => (people.value.length ? progressByPerson(list.value, people.value) : []))
const groups = computed(() =>
  groupByCategory(list.value, { openOnly: openOnly.value, person: person.value, includeShared: includeShared.value, search: search.value })
)
/** Fortschritt für den gewählten Reiter (Person bzw. Gemeinsam) oder für alles */
const prog = computed(() => tabs.value.find((t) => t.person === person.value)?.progress ?? progress(list.value))
const tabLabel = (p: string) => (p === SHARED ? t('Gemeinsam') : p)

function toggle(item: PackingItem) {
  packingRepository.setPacked(item.id, !item.packed)
}

function toggleGroup(c: PackingCategory) {
  const s = new Set(collapsed.value)
  if (s.has(c)) s.delete(c)
  else s.add(c)
  collapsed.value = s
}

async function quickAdd() {
  if (!quickName.value.trim()) return
  const { name, quantity } = parseQuickAdd(quickName.value)
  await packingRepository.create(props.tripId, emptyPackingDraft({ name, quantity, category: quickCategory.value, person: person.value === SHARED ? '' : person.value }))
  quickName.value = ''
}

async function unpackAll() {
  if (!confirm(t('Alle Häkchen entfernen? Praktisch, um für die Rückreise neu zu packen.'))) return
  await packingRepository.unpackAll(props.tripId)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="$t('Packliste')" />
  <PackingSuggestions :trip-id="tripId" :items="list" />

  <!-- Leerer Zustand -->
  <div v-if="list.length === 0" class="text-center py-4">
    <i class="bi bi-backpack display-5 text-primary d-block mb-2" aria-hidden="true"></i>
    <p class="text-body-secondary">{{ $t('Starte mit einer Vorlage – Mengen werden nach Reisedauer und Personen berechnet.') }}</p>
    <RouterLink :to="`/trip/${tripId}/packliste/vorlagen`" class="btn btn-primary">
      <i class="bi bi-magic me-1" aria-hidden="true"></i>{{ $t('Vorlagen auswählen') }}
    </RouterLink>
  </div>

  <template v-else>
    <!-- Fortschritt -->
    <div class="card mb-3">
      <div class="card-body py-2">
        <div class="d-flex justify-content-between align-items-baseline mb-1">
          <strong>{{ $t('{0} von {1} eingepackt', [prog.packed, prog.total]) }}</strong>
          <span class="small text-body-secondary">{{ prog.percent }} %</span>
        </div>
        <div class="progress" style="height: 8px" role="progressbar" :aria-valuenow="prog.percent" aria-valuemin="0"
             aria-valuemax="100" :aria-label="$t('Packfortschritt')">
          <div class="progress-bar" :class="prog.percent === 100 ? 'bg-success' : ''" :style="{ width: `${prog.percent}%` }"></div>
        </div>
        <div v-if="prog.essentialOpen" class="small text-danger mt-1">
          <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>{{ $t('{0} wichtige Dinge fehlen noch', [prog.essentialOpen]) }}
        </div>
        <div v-else-if="prog.percent === 100" class="small text-success mt-1">
          <i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ $t('Alles eingepackt – gute Reise!') }}
        </div>
      </div>
    </div>

    <!-- Reiter pro Person -->
    <ul v-if="tabs.length" class="nav nav-pills flex-nowrap overflow-auto mb-3 person-tabs">
      <li class="nav-item">
        <button class="nav-link text-nowrap" :class="{ active: person === '' }" @click="person = ''">{{ $t('Alle') }}</button>
      </li>
      <li v-for="t in tabs" :key="t.person" class="nav-item">
        <button class="nav-link text-nowrap" :class="{ active: person === t.person }" @click="person = t.person">
          <i class="bi me-1" :class="t.person === SHARED ? 'bi-people' : 'bi-person'" aria-hidden="true"></i>{{ tabLabel(t.person) }}
          <span class="small opacity-75 ms-1">{{ t.progress.packed }}/{{ t.progress.total }}</span>
          <i v-if="t.progress.essentialOpen" class="bi bi-exclamation-circle-fill text-danger ms-1 small" :title="$t('Wichtiges fehlt')"></i>
        </button>
      </li>
    </ul>

    <!-- Schnell hinzufügen -->
    <form class="input-group mb-3" @submit.prevent="quickAdd">
      <input v-model="quickName" class="form-control" :aria-label="$t('Neuer Eintrag')"
             :placeholder="person && person !== SHARED ? $t('Für {0}, z. B. „2x Badehose“', [person]) : $t('Hinzufügen, z. B. „2x Badehose“')" />
      <select v-model="quickCategory" class="form-select flex-grow-0 w-auto" :aria-label="$t('Kategorie')">
        <option v-for="(c, key) in CATEGORY" :key="key" :value="key">{{ c.label }}</option>
      </select>
      <button class="btn btn-primary" type="submit" :aria-label="$t('Hinzufügen')"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
    </form>

    <!-- Filter & Aktionen -->
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <input v-model="search" type="search" class="form-control form-control-sm w-auto flex-grow-1" :placeholder="$t('Suchen')" :aria-label="$t('Suchen')" />
      <div v-if="person && person !== SHARED" class="form-check form-switch mb-0">
        <input id="incl-shared" v-model="includeShared" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="incl-shared">{{ $t('mit Gemeinsamem') }}</label>
      </div>
      <div class="form-check form-switch mb-0">
        <input id="open-only" v-model="openOnly" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="open-only">{{ $t('Nur offene') }}</label>
      </div>
      <div class="dropdown ms-auto">
        <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" :aria-label="$t('Weitere Aktionen')">
          <i class="bi bi-three-dots" aria-hidden="true"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><RouterLink class="dropdown-item" :to="`/trip/${tripId}/packliste/vorlagen`"><i class="bi bi-magic me-2" aria-hidden="true"></i>{{ $t('Vorlage hinzufügen') }}</RouterLink></li>
          <li><button class="dropdown-item" @click="unpackAll"><i class="bi bi-arrow-counterclockwise me-2" aria-hidden="true"></i>{{ $t('Alle Häkchen entfernen') }}</button></li>
        </ul>
      </div>
    </div>

    <p v-if="groups.length === 0" class="text-body-secondary">{{ $t('Nichts gefunden.') }}</p>

    <!-- Liste nach Kategorien -->
    <section v-for="g in groups" :key="g.category" class="mb-3">
      <button type="button" class="btn btn-link text-body text-decoration-none p-0 d-flex align-items-center gap-2 w-100 mb-1"
              :aria-expanded="!collapsed.has(g.category)" @click="toggleGroup(g.category)">
        <i :class="`bi bi-${CATEGORY[g.category].icon} text-primary`" aria-hidden="true"></i>
        <span class="fw-semibold">{{ CATEGORY[g.category].label }}</span>
        <span class="small text-body-secondary">{{ g.packed }}/{{ g.items.length }}</span>
        <i class="bi ms-auto small" :class="collapsed.has(g.category) ? 'bi-chevron-down' : 'bi-chevron-up'" aria-hidden="true"></i>
      </button>
      <ul v-show="!collapsed.has(g.category)" class="list-group">
        <li v-for="i in g.items" :key="i.id" class="list-group-item d-flex align-items-center gap-2 py-2"
            :class="{ 'text-body-secondary': i.packed }">
          <input :id="`p-${i.id}`" class="form-check-input m-0 flex-none packing-check" type="checkbox" :checked="i.packed"
                 @change="toggle(i)" />
          <label class="flex-grow-1 mb-0" :for="`p-${i.id}`" :class="{ 'text-decoration-line-through': i.packed }">
            <span v-if="i.quantity > 1" class="fw-semibold">{{ i.quantity }}× </span>{{ i.name }}
            <i v-if="i.essential" class="bi bi-exclamation-circle-fill text-danger small ms-1" :title="$t('Wichtig')" :aria-label="$t('Wichtig')"></i>
            <span v-if="i.person && person !== i.person" class="badge text-bg-light border ms-1">{{ i.person }}</span>
          </label>
          <RouterLink :to="`/trip/${tripId}/packliste/${i.id}`" class="btn btn-sm btn-link text-body-secondary" :aria-label="`${i.name} bearbeiten`">
            <i class="bi bi-pencil" aria-hidden="true"></i>
          </RouterLink>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.packing-check {
  width: 1.4em;
  height: 1.4em;
}
.flex-none {
  flex: none;
}
.person-tabs {
  scrollbar-width: none;
}
</style>
