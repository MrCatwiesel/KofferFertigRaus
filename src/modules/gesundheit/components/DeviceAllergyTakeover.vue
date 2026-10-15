<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { clearDeviceAllergens, loadAllergens, loadCustomAllergens, type AllergenId, type CustomAllergen } from '@/modules/sprachfuehrer/public'
import { allergyNames, emptyDraft, personLabel } from '../logic'
import { healthRepository } from '../repository'

/**
 * Bis Version 1.42 lagen Allergien nur auf dem Gerät (Sprachführer). Einmal einer Person zuordnen – danach weg vom Gerät.
 */
const props = defineProps<{ tripId: string; persons: string[] }>()
const emit = defineEmits<{ done: [person: string] }>()
const allergens = ref<AllergenId[]>([])
const custom = ref<CustomAllergen[]>([])
const person = ref('')
onMounted(async () => {
  allergens.value = await loadAllergens()
  custom.value = await loadCustomAllergens()
})
watch(() => props.persons, (list) => {
  if (!list.includes(person.value)) person.value = list[0] ?? ''
}, { immediate: true })
const names = computed(() => allergyNames({ allergens: allergens.value, custom: custom.value }))

async function takeOver() {
  await healthRepository.merge(props.tripId, person.value, { allergens: allergens.value, custom: custom.value }, emptyDraft())
  await clearDeviceAllergens()
  allergens.value = []
  custom.value = []
  emit('done', person.value)
}
</script>

<template>
  <div v-if="names.length" class="alert alert-warning py-2" data-device-allergies>
    <div class="small mb-2">
      {{ t('Auf diesem Gerät sind noch Allergien aus dem Sprachführer gespeichert: {list}. Sie gehören jetzt zu einer Person und werden mit den anderen Geräten abgeglichen.', { list: names.join(', ') }) }}
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <label for="takeover-person" class="small">{{ t('Für') }}</label>
      <select id="takeover-person" v-model="person" class="form-select form-select-sm w-auto">
        <option v-for="p in persons" :key="p" :value="p">{{ personLabel(p) }}</option>
      </select>
      <button type="button" class="btn btn-sm btn-primary" data-device-takeover @click="takeOver">{{ t('Übernehmen') }}</button>
    </div>
  </div>
</template>
