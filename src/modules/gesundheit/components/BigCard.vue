<script setup lang="ts">
import type { CardRow } from '../logic'

/** Vollbild zum Hinhalten (Arzt, Kellner) – Tippen schließt */
defineProps<{ title: string; rows: CardRow[]; lang: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="big-view" role="dialog" aria-modal="true" :aria-label="t('Groß zeigen')" data-big @click="emit('close')">
    <button type="button" class="btn btn-lg btn-light position-absolute top-0 end-0 m-3" :aria-label="t('Schließen')" @click.stop="emit('close')">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
    <div class="big-title">{{ title }}</div>
    <div class="big-text" :lang="lang || undefined">
      <div v-for="(r, i) in rows" :key="i" :class="{ 'text-danger': r.strong }">{{ r.text }}</div>
    </div>
    <div v-if="rows.some((r) => r.pron)" class="big-pron fst-italic"><div v-for="(r, i) in rows" :key="i">{{ r.pron }}</div></div>
    <div v-if="lang" class="big-source"><div v-for="(r, i) in rows" :key="i">{{ r.source }}</div></div>
  </div>
</template>

<style scoped>
.big-view {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 4rem 1.5rem 2rem;
  gap: 1.25rem;
  overflow-y: auto;
}
.big-title {
  font-size: 1.25rem;
  color: var(--bs-secondary-color);
}
.big-text {
  font-size: clamp(1.6rem, 6vw, 3.5rem);
  font-weight: 700;
  line-height: 1.2;
}
.big-pron {
  font-size: clamp(1.1rem, 3.5vw, 1.6rem);
  color: var(--bs-secondary-color);
}
.big-source {
  font-size: 1rem;
  color: var(--bs-secondary-color);
}
</style>
