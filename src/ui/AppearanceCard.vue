<script setup lang="ts">
import { ref } from 'vue'
import AppLogo from './AppLogo.vue'
import { STYLES, appearance, setBackground, type AppStyle, type ColorMode } from './appearance'

const styles = Object.entries(STYLES) as [AppStyle, (typeof STYLES)[AppStyle]][]
const modes: { id: ColorMode; label: string; icon: string }[] = [
  { id: 'auto', label: 'Wie das Gerät', icon: 'circle-half' },
  { id: 'hell', label: 'Hell', icon: 'sun' },
  { id: 'dunkel', label: 'Dunkel', icon: 'moon-stars' }
]
const busy = ref(false)
const error = ref('')

async function pick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    await setBackground(file)
    appearance.background = true
  } catch (err) {
    error.value = `Bild konnte nicht gelesen werden: ${(err as Error).message}`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5 d-flex align-items-center gap-2"><i class="bi bi-palette text-primary" aria-hidden="true"></i>Aussehen</h2>

      <div class="row g-2 mb-3" role="radiogroup" aria-label="Stil">
        <div v-for="[id, s] in styles" :key="id" class="col-12 col-md-4">
          <button type="button" class="style-option w-100 text-start" :class="{ active: appearance.style === id }" role="radio"
                  :aria-checked="appearance.style === id" :data-style="id" @click="appearance.style = id">
            <span class="d-flex align-items-center gap-2 mb-1">
              <span class="swatches"><span v-for="c in s.swatches" :key="c" :style="{ background: c }"></span></span>
              <span class="fw-semibold">{{ s.label }}</span>
              <i v-if="appearance.style === id" class="bi bi-check-circle-fill text-primary ms-auto" aria-hidden="true"></i>
            </span>
            <span class="small text-body-secondary d-block">{{ s.hint }}</span>
          </button>
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        <span class="small text-body-secondary me-1">Farben:</span>
        <div class="btn-group btn-group-sm" role="group" aria-label="Hell oder dunkel">
          <button v-for="m in modes" :key="m.id" type="button" class="btn" :class="appearance.mode === m.id ? 'btn-primary' : 'btn-outline-primary'"
                  :aria-pressed="appearance.mode === m.id" @click="appearance.mode = m.id">
            <i :class="`bi bi-${m.icon} me-1`" aria-hidden="true"></i>{{ m.label }}
          </button>
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-3">
        <div class="form-check form-switch mb-0">
          <input id="bg" v-model="appearance.background" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="bg">Hintergrundbild</label>
        </div>
        <label class="btn btn-outline-primary btn-sm mb-0" :class="{ disabled: busy }">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-image me-1" aria-hidden="true"></i>Eigenes Bild wählen
          <input type="file" accept="image/*" class="d-none" @change="pick" />
        </label>
        <button v-if="appearance.customBackground" type="button" class="btn btn-link btn-sm p-0" @click="setBackground(null)">Eigenes Bild entfernen</button>
      </div>
      <div v-if="error" class="alert alert-danger small py-2 mt-2 mb-0">{{ error }}</div>
      <p class="small text-body-secondary mt-2 mb-0">
        <AppLogo :size="16" class="d-inline-block align-text-bottom me-1" />
        Stil und Farben gelten für dieses Gerät. Ein eigenes Hintergrundbild gilt für den gewählten Stil und kommt per Abgleich
        auch auf die anderen Geräte.
      </p>
    </div>
  </section>
</template>

<style scoped>
.style-option {
  padding: 0.75rem 0.9rem;
  color: var(--nww-text);
  background: var(--nww-surface-2);
  border: 2px solid var(--nww-border);
  border-radius: var(--bs-border-radius);
}
.style-option.active {
  border-color: var(--nww-primary);
  background: rgba(var(--nww-primary-rgb), 0.08);
}
.swatches {
  display: inline-flex;
}
.swatches span {
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid var(--nww-surface);
  margin-left: -0.3rem;
}
.swatches span:first-child {
  margin-left: 0;
}
</style>
