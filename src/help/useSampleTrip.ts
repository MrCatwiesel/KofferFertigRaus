import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { createSampleTrip } from '@/core/sample'

/** Beispielreise anlegen und öffnen – für Willkommen, Einführung und Hilfe */
export function useSampleTrip() {
  const router = useRouter()
  const creating = ref(false)
  const error = ref('')
  async function create() {
    if (creating.value) return
    creating.value = true
    error.value = ''
    try {
      const id = await createSampleTrip()
      await router.push(`/trip/${id}`)
    } catch (e) {
      error.value = `Die Beispielreise konnte nicht angelegt werden: ${(e as Error).message}`
    } finally {
      creating.value = false
    }
  }
  return { creating, error, create }
}
