<script setup lang="ts">
/** Reiseseite anpassen (ab 2.0): Titelbild, Eckdaten, Zusammenfassungen und die angehefteten Bereiche. */
import { computed } from 'vue'
import { getTripSections } from '@/core/registry'
import { togglePin } from '@/core/trip-layout'
import { appearance, resetSettings } from './appearance'
import { t } from '@/i18n'

const sections = getTripSections()
/** Feste Seiten der Reise, die man ebenfalls anheften kann (siehe TripDetail) */
const EXTRA: Record<string, { title: string; icon: string }> = {
  sos: { title: t('Notfall-Seite'), icon: 'heart-pulse' },
  'share-trip': { title: t('Mit Mitreisenden teilen'), icon: 'people' }
}
const pinned = computed(() =>
  appearance.layout.pinned.map((id) => {
    const s = sections.find((x) => x.moduleId === id)
    return { id, title: s?.title ?? EXTRA[id]?.title ?? id, icon: s?.icon ?? EXTRA[id]?.icon ?? 'star' }
  })
)
function move(i: number, delta: number) {
  const list = [...appearance.layout.pinned]
  const j = i + delta
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  appearance.layout = { ...appearance.layout, pinned: list }
}
function unpin(id: string) {
  appearance.layout = togglePin(appearance.layout, id)
}
function reset() {
  if (confirm(t('Reiseseite auf die ursprüngliche Darstellung zurücksetzen? (Angeheftetes bleibt)'))) resetSettings('reiseseite')
}
</script>

<template>
  <div>
    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6">
        <label class="form-label small fw-semibold" for="lh">{{ t('Titelbild') }}</label>
        <select id="lh" v-model="appearance.layout.hero" class="form-select">
          <option value="gross">{{ t('Groß') }}</option>
          <option value="mittel">{{ t('Mittel') }}</option>
          <option value="klein">{{ t('Klein') }}</option>
          <option value="aus">{{ t('Kein Titelbild') }}</option>
        </select>
      </div>
      <div class="col-12">
        <div class="form-check form-switch">
          <input id="ls" v-model="appearance.layout.summaries" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="ls">{{ t('Kurze Zusammenfassung unter jedem Bereich') }}</label>
        </div>
        <div class="form-check form-switch">
          <input id="lf" v-model="appearance.layout.facts" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="lf">{{ t('Eckdaten (Zeitraum, Personen, Anreise, Budget)') }}</label>
        </div>
      </div>
    </div>

    <div class="fw-semibold small mb-2">{{ t('Angeheftet') }}</div>
    <ul v-if="pinned.length" class="list-group mb-2" :aria-label="t('Angeheftete Bereiche')">
      <li v-for="(p, k) in pinned" :key="p.id" class="list-group-item d-flex align-items-center gap-2 py-2" :data-edit-pin="p.id">
        <i :class="`bi bi-${p.icon} text-primary`" aria-hidden="true"></i>
        <span class="flex-grow-1 min-w-0">{{ p.title }}</span>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="k === 0" :aria-label="t('{title} nach vorn', { title: p.title })" @click="move(k, -1)">
          <i class="bi bi-arrow-up" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="k === pinned.length - 1" :aria-label="t('{title} nach hinten', { title: p.title })" @click="move(k, 1)">
          <i class="bi bi-arrow-down" aria-hidden="true"></i>
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger" :aria-label="t('{title} lösen', { title: p.title })" @click="unpin(p.id)">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </li>
    </ul>
    <p v-else class="small text-body-secondary">{{ t('Noch nichts angeheftet. Auf der Reiseseite eine Gruppe öffnen und beim gewünschten Bereich auf den Stern tippen.') }}</p>
    <button type="button" class="btn btn-link btn-sm px-0" @click="reset">{{ t('Ursprüngliche Darstellung wiederherstellen') }}</button>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
