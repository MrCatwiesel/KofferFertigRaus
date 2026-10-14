<script setup lang="ts">
/** Reiseseite anpassen: welche Bereiche in welchem Reiter, Reihenfolge, Darstellung. */
import { computed, ref } from 'vue'
import { getTripSections, type TripPhase } from '@/core/registry'
import { PHASES, moveInTab, phasesOf, sectionsIn, togglePlacement, unplaced } from '@/core/trip-layout'
import { appearance, resetSettings } from './appearance'
import { N_, t, translated } from '@/core/i18n'

const TAB_LABEL: Record<TripPhase, { label: string; icon: string }> = translated({
  planung: { label: N_('Planung'), icon: 'clipboard-check' },
  unterwegs: { label: N_('Unterwegs'), icon: 'compass' },
  danach: { label: N_('Danach'), icon: 'stars' },
  teilen: { label: N_('Teilen & Archiv'), icon: 'send' }
})

const sections = getTripSections()
const tab = ref<TripPhase>('planung')
const l = computed(() => appearance.layout)
const inTab = computed(() => sectionsIn(tab.value, sections, l.value))
const notInTab = computed(() => sections.filter((s) => !phasesOf(s, l.value).includes(tab.value)))
const nowhere = computed(() => unplaced(sections, l.value))

const add = ref('')
function addSection() {
  const s = sections.find((x) => x.moduleId === add.value)
  if (s) appearance.layout = togglePlacement(l.value, s, tab.value, true)
  add.value = ''
}
function removeSection(id: string) {
  const s = sections.find((x) => x.moduleId === id)
  if (s) appearance.layout = togglePlacement(l.value, s, tab.value, false)
}
function move(id: string, delta: number) {
  appearance.layout = moveInTab(l.value, sections, tab.value, id, delta)
}
const where = (id: string) =>
  phasesOf(sections.find((s) => s.moduleId === id)!, l.value)
    .filter((p) => p !== tab.value)
    .map((p) => TAB_LABEL[p].label)
    .join(', ')

function reset() {
  if (confirm(t('Reiseseite auf die ursprüngliche Aufteilung zurücksetzen?'))) resetSettings('reiseseite')
}
</script>

<template>
  <div>
    <!-- Darstellung -->
    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6">
        <label class="form-label small fw-semibold" for="lv">{{ $t('Bereiche zeigen als') }}</label>
        <select id="lv" v-model="appearance.layout.view" class="form-select">
          <option value="kacheln">{{ $t('Kacheln') }}</option>
          <option value="gross">{{ $t('Große Kacheln') }}</option>
          <option value="liste">{{ $t('Kompakte Liste') }}</option>
        </select>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label small fw-semibold" for="lh">{{ $t('Titelbild') }}</label>
        <select id="lh" v-model="appearance.layout.hero" class="form-select">
          <option value="gross">{{ $t('Groß') }}</option>
          <option value="mittel">{{ $t('Mittel') }}</option>
          <option value="klein">{{ $t('Klein') }}</option>
          <option value="aus">{{ $t('Kein Titelbild') }}</option>
        </select>
      </div>
      <div class="col-12">
        <div class="form-check form-switch">
          <input id="lt" v-model="appearance.layout.tabs" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="lt">{{ $t('Reiter (Planung · Unterwegs · Danach · Teilen) – sonst alles untereinander') }}</label>
        </div>
        <div class="form-check form-switch">
          <input id="la" v-model="appearance.layout.autoTab" class="form-check-input" type="checkbox" role="switch" :disabled="!appearance.layout.tabs" />
          <label class="form-check-label" for="la">{{ $t('Passenden Reiter nach Datum öffnen (sonst immer „Planung“)') }}</label>
        </div>
        <div class="form-check form-switch">
          <input id="ls" v-model="appearance.layout.summaries" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="ls">{{ $t('Kurze Zusammenfassung unter jedem Bereich') }}</label>
        </div>
        <div class="form-check form-switch">
          <input id="lf" v-model="appearance.layout.facts" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="lf">{{ $t('Eckdaten (Zeitraum, Personen, Anreise, Budget)') }}</label>
        </div>
        <div class="form-check form-switch">
          <input id="lq" v-model="appearance.layout.quick" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="lq">{{ $t('Unterwegs: große Knöpfe „Heute“ und „Notfall“') }}</label>
        </div>
      </div>
    </div>

    <!-- Zuordnung und Reihenfolge -->
    <div class="fw-semibold small mb-2">{{ $t('Welche Bereiche stehen wo?') }}</div>
    <div class="btn-group btn-group-sm flex-wrap mb-2" role="group" :aria-label="$t('Reiter wählen')">
      <button v-for="p in PHASES" :key="p" type="button" class="btn" :class="tab === p ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="tab === p" @click="tab = p">
        <i :class="`bi bi-${TAB_LABEL[p].icon} me-1`" aria-hidden="true"></i>{{ TAB_LABEL[p].label }}
      </button>
    </div>
    <ul class="list-group mb-2" :aria-label="`Bereiche im Reiter ${TAB_LABEL[tab].label}`">
      <li v-for="(s, k) in inTab" :key="s.moduleId" class="list-group-item d-flex align-items-center gap-2 py-2" :data-edit-section="s.moduleId">
        <i :class="`bi bi-${s.icon} text-primary`" aria-hidden="true"></i>
        <span class="flex-grow-1 min-w-0">
          <span class="d-block">{{ s.title }}</span>
          <span v-if="where(s.moduleId)" class="d-block small text-body-secondary">{{ $t('auch in: {0}', [where(s.moduleId)]) }}</span>
        </span>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="k === 0" :aria-label="`${s.title} nach oben`" @click="move(s.moduleId, -1)">
          <i class="bi bi-arrow-up" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="k === inTab.length - 1" :aria-label="`${s.title} nach unten`" @click="move(s.moduleId, 1)">
          <i class="bi bi-arrow-down" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger" :aria-label="`${s.title} aus diesem Reiter nehmen`" @click="removeSection(s.moduleId)">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </li>
      <li v-if="!inTab.length" class="list-group-item small text-body-secondary">{{ $t('Dieser Reiter ist leer.') }}</li>
    </ul>
    <div v-if="notInTab.length" class="input-group input-group-sm mb-3">
      <select v-model="add" class="form-select" :aria-label="$t('Bereich hinzufügen')">
        <option value="">{{ $t('Bereich hinzufügen …') }}</option>
        <option v-for="s in notInTab" :key="s.moduleId" :value="s.moduleId">{{ s.title }}</option>
      </select>
      <button type="button" class="btn btn-outline-primary" :disabled="!add" @click="addSection">{{ $t('Hinzufügen') }}</button>
    </div>
    <p v-if="nowhere.length" class="small text-body-secondary">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ $t('In keinem Reiter: {0} – bleibt auf der Reiseseite unter „Weitere Bereiche“ erreichbar.', [nowhere.map((s) => s.title).join(', ')]) }}
    </p>
    <button type="button" class="btn btn-link btn-sm px-0" @click="reset">{{ $t('Ursprüngliche Aufteilung wiederherstellen') }}</button>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
