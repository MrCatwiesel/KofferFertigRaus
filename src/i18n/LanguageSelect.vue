<script setup lang="ts">
import { computed } from 'vue'
import { LANGUAGES, chooseLanguage, hasChosenLanguage, language, languageName, preferredLanguage } from './index'

/**
 * Sprachwahl. Beschriftung immer auch auf Englisch („Sprache · Language“), damit man sie findet,
 * auch wenn die App gerade in einer fremden Sprache läuft. Ein Wechsel lädt die App neu.
 */
defineProps<{ compact?: boolean }>()

const device = preferredLanguage(null)
const current = computed(() => (hasChosenLanguage() ? language() : ''))

function change(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (v === current.value) return
  chooseLanguage(v || null)
}
</script>

<template>
  <div :class="compact ? 'd-inline-flex align-items-center gap-2' : ''" data-language>
    <label for="app-language" :class="compact ? 'small mb-0' : 'form-label'">
      <i class="bi bi-translate me-1" aria-hidden="true"></i>{{ language() === 'en' ? 'Language' : `${t('Sprache')} · Language` }}
    </label>
    <select id="app-language" class="form-select" :class="{ 'form-select-sm w-auto': compact }" :value="current" @change="change">
      <option value="">{{ t('Wie das Gerät ({name})', { name: languageName(device) }) }}</option>
      <option v-for="code in LANGUAGES" :key="code" :value="code" :lang="code">{{ languageName(code) }}</option>
    </select>
  </div>
</template>
