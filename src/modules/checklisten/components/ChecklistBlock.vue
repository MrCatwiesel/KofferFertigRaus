<script setup lang="ts">
import { computed, ref } from 'vue'
import { checklistRepository } from '../repository'
import { missingTexts, progress } from '../logic'
import type { ChecklistItem, ChecklistKind } from '../types'
import { t } from '@/i18n'

const props = defineProps<{
  tripId: string
  list: ChecklistKind
  refId?: string
  items: ChecklistItem[]
  /** Vorschläge der App */
  suggestions: string[]
  /** Liste einer früheren Reise zum Übernehmen */
  previous?: { title: string; texts: string[] } | null
}>()

const p = computed(() => progress(props.items))
const missing = computed(() => missingTexts(props.items, props.suggestions))
const newText = ref('')
const showSuggestions = ref(false)

async function add() {
  const text = newText.value.trim()
  if (!text) return
  await checklistRepository.add(props.tripId, props.list, props.refId ?? '', [text])
  newText.value = ''
}
async function addTexts(texts: string[]) {
  await checklistRepository.add(props.tripId, props.list, props.refId ?? '', missingTexts(props.items, texts))
  showSuggestions.value = false
}
const toggle = (i: ChecklistItem) => checklistRepository.setDone(i.id, !i.done)
const remove = (i: ChecklistItem) => checklistRepository.remove(i.id)
const resetAll = () => checklistRepository.setAll(props.items.filter((i) => i.done).map((i) => i.id), false)
const domId = computed(() => `chk-${props.list}-${props.refId ?? ''}`)
</script>

<template>
  <div :data-checklist="list" :data-ref="refId || undefined">
    <!-- Leer: Liste anlegen -->
    <div v-if="!items.length" class="d-flex flex-wrap gap-2 mb-2">
      <button v-if="previous" type="button" class="btn btn-sm btn-primary" data-take-previous @click="addTexts(previous.texts)">
        <i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>{{ t('Liste von „{title}“ übernehmen', { title: previous.title }) }}
      </button>
      <button type="button" class="btn btn-sm" :class="previous ? 'btn-outline-primary' : 'btn-primary'" data-take-suggestions @click="addTexts(suggestions)">
        <i class="bi bi-magic me-1" aria-hidden="true"></i>{{ t('Vorschläge übernehmen ({n})', { n: suggestions.length }) }}
      </button>
    </div>

    <template v-else>
      <div class="d-flex align-items-center gap-2 mb-2">
        <div class="progress flex-grow-1" role="progressbar" :aria-label="t('Fortschritt')" :aria-valuenow="p.done" aria-valuemin="0" :aria-valuemax="p.total" style="height: 0.5rem">
          <div class="progress-bar" :class="p.done === p.total ? 'bg-success' : ''" :style="{ width: `${(100 * p.done) / p.total}%` }"></div>
        </div>
        <span class="small text-body-secondary text-nowrap" data-progress>{{ t('{done} von {total}', p) }}</span>
      </div>
      <ul class="list-group mb-2">
        <li v-for="i in items" :key="i.id" class="list-group-item d-flex align-items-center gap-2 py-2" :class="{ 'text-body-secondary': i.done }">
          <input :id="`${domId}-${i.id}`" class="form-check-input m-0 flex-none big-check" type="checkbox" :checked="i.done" @change="toggle(i)" />
          <label class="flex-grow-1 mb-0" :for="`${domId}-${i.id}`" :class="{ 'text-decoration-line-through': i.done }">{{ i.text }}</label>
          <button type="button" class="btn btn-sm btn-link text-body-secondary p-0" :aria-label="t('{name} entfernen', { name: i.text })" @click="remove(i)">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </li>
      </ul>
    </template>

    <form class="input-group input-group-sm mb-2" @submit.prevent="add">
      <input v-model="newText" class="form-control" :placeholder="t('Eigener Punkt …')" :aria-label="t('Eigener Punkt')" />
      <button class="btn btn-outline-primary" type="submit" :disabled="!newText.trim()" :aria-label="t('Hinzufügen')"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
    </form>

    <div v-if="items.length" class="d-flex flex-wrap gap-3 small">
      <button v-if="missing.length" type="button" class="btn btn-link btn-sm p-0" @click="showSuggestions = !showSuggestions">
        {{ t('Weitere Vorschläge ({n})', { n: missing.length }) }}
      </button>
      <button v-if="p.done" type="button" class="btn btn-link btn-sm p-0 text-body-secondary" @click="resetAll">{{ t('Alle Häkchen entfernen') }}</button>
    </div>
    <ul v-if="showSuggestions && missing.length" class="list-unstyled small mt-2 mb-0">
      <li v-for="s in missing" :key="s" class="d-flex align-items-center gap-2 mb-1">
        <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-1" :aria-label="t('{name} hinzufügen', { name: s })" @click="addTexts([s])">
          <i class="bi bi-plus" aria-hidden="true"></i>
        </button>
        <span>{{ s }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.big-check {
  width: 1.4em;
  height: 1.4em;
}
.flex-none {
  flex: none;
}
</style>
