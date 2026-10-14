<script setup lang="ts">
/** Hilfetext mit **fett** und *kursiv* – ohne v-html */
import { computed } from 'vue'
import { textParts } from './suche'

const props = defineProps<{ text: string }>()
const parts = computed(() => textParts(props.text))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"><strong v-if="p.style === 'fett'">{{ p.text }}</strong><em v-else-if="p.style === 'kursiv'">{{ p.text }}</em><template v-else>{{ p.text }}</template></template>
</template>
