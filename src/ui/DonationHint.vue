<script setup lang="ts">
import { APP_CONFIG } from '@/config'

/** Dezenter Spenden-Hinweis – erscheint nur, wenn in config.ts ein Link eingetragen ist. */
defineProps<{ text?: string }>()
</script>

<template>
  <div v-if="APP_CONFIG.donationUrl" class="alert alert-light border d-flex align-items-center gap-3 small">
    <i class="bi bi-heart-fill text-danger fs-4" aria-hidden="true"></i>
    <div class="flex-grow-1">
      {{ text ?? $t('{0} ist kostenlos und ohne Werbung. Wenn dir die App hilft, freue ich mich über eine kleine Spende.', [APP_CONFIG.name]) }}
    </div>
    <a :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger flex-shrink-0">
      {{ $t('Unterstützen') }}
    </a>
  </div>
</template>
