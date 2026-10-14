<script setup lang="ts">
import { computed } from 'vue'
import { canEdit, people } from '@/core/people'

/** Hinweis „Nur lesen“ für Reisen, die ich nicht bearbeiten darf (Personen & Rechte). */
const props = defineProps<{ tripId: string }>()
const readOnly = computed(() => people.enabled && !canEdit(props.tripId))
</script>

<template>
  <div v-if="readOnly" class="alert alert-secondary small py-2 d-flex align-items-center gap-2" role="note" data-read-only>
    <i class="bi bi-eye" aria-hidden="true"></i>
    <span>{{ $t('Nur lesen – Änderungen an dieser Reise werden beim Abgleich nicht übernommen.') }}</span>
  </div>
</template>
