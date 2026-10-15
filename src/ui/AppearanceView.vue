<script setup lang="ts">
/** Einstellungen → Aussehen: Design, Farben, Schrift, Hintergrund und Aufteilung der Reiseseite. Alles wirkt sofort. */
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ThemePreview from './ThemePreview.vue'
import TripLayoutEditor from './TripLayoutEditor.vue'
import { CORNERS, TEXT_SIZES, appearance, resetSettings, setBackground, type ColorMode, type Corners, type TextSize, type Veil } from './appearance'
import { THEMES, getTheme } from './themes'
import { t } from '@/i18n'

const route = useRoute()
const modes: { id: ColorMode; label: string; icon: string }[] = [
  { id: 'auto', label: t('Wie das Gerät'), icon: 'circle-half' },
  { id: 'hell', label: t('Hell'), icon: 'sun' },
  { id: 'dunkel', label: t('Dunkel'), icon: 'moon-stars' }
]
const veils: { id: Veil; label: string }[] = [
  { id: 'auto', label: t('Farbe des Designs') },
  { id: 'hell', label: t('Weiß') },
  { id: 'dunkel', label: t('Schwarz') }
]
const textSizes = Object.entries(TEXT_SIZES) as [TextSize, (typeof TEXT_SIZES)[TextSize]][]
const corners = Object.entries(CORNERS) as [Corners, (typeof CORNERS)[Corners]][]

/** Schnell-Einstellungen für den Hintergrund */
const PRESETS = [
  { label: t('Klar'), hint: t('Foto kräftig'), v: { cover: 10, veil: 'auto', blur: 0, saturate: 110, cards: 0 } },
  { label: t('Ausgewogen'), hint: t('Standard'), v: { cover: 30, veil: 'auto', blur: 0, saturate: 100, cards: 0 } },
  { label: t('Ruhig'), hint: t('Foto weich im Hintergrund'), v: { cover: 55, veil: 'auto', blur: 6, saturate: 85, cards: 0 } },
  { label: t('Glas'), hint: t('Karten durchscheinend'), v: { cover: 15, veil: 'auto', blur: 0, saturate: 105, cards: 35 } },
  { label: t('Abend'), hint: t('Foto abgedunkelt'), v: { cover: 45, veil: 'dunkel', blur: 2, saturate: 90, cards: 10 } }
] as const

const busy = ref(false)
const error = ref('')
async function pick(e: Event, scope: 'design' | 'alle') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    await setBackground(file, scope)
    appearance.background = true
  } catch (err) {
    error.value = t('Bild konnte nicht gelesen werden: {x}', { x: (err as Error).message })
  } finally {
    busy.value = false
  }
}
async function removeBackground() {
  await setBackground(null, appearance.customBackground === 'alle' ? 'alle' : 'design')
}

onMounted(async () => {
  const teil = String(route.query.teil ?? '')
  if (!teil) return
  await nextTick()
  document.getElementById(`teil-${teil}`)?.scrollIntoView({ block: 'start' })
})
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/einstellungen" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ t('Einstellungen') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ t('Aussehen') }}</h1>
    <p class="small text-body-secondary mb-0 on-bg">{{ t('Alles wirkt sofort und gilt für dieses Gerät.') }}</p>
  </div>

  <!-- Design -->
  <section id="teil-design" class="card mb-3">
    <div class="card-body">
      <h2 class="h5 mb-1">{{ t('Design') }}</h2>
      <p class="small text-body-secondary">{{ t('{n} Designs – jedes mit eigenen Farben, Schriften, Formen, Logo und Hintergrundmuster.', { n: THEMES.length }) }}</p>
      <div class="row g-2 mb-3" role="radiogroup" :aria-label="t('Design')">
        <div v-for="theme in THEMES" :key="theme.id" class="col-6 col-md-4 col-lg-3">
          <button type="button" class="theme-option w-100 text-start" :class="{ active: appearance.theme === theme.id }" role="radio"
                  :aria-checked="appearance.theme === theme.id" :aria-label="theme.label" :data-theme="theme.id" @click="appearance.theme = theme.id">
            <ThemePreview :theme="theme" :dark="appearance.dark" />
            <span class="d-flex align-items-center gap-1 mt-2">
              <span class="fw-semibold small">{{ theme.label }}</span>
              <i v-if="appearance.theme === theme.id" class="bi bi-check-circle-fill text-primary ms-auto" aria-hidden="true"></i>
            </span>
            <span class="d-block text-body-secondary hint">{{ theme.hint }}</span>
          </button>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-6">
          <div class="small fw-semibold mb-1">{{ t('Farben') }}</div>
          <div class="btn-group btn-group-sm" role="group" :aria-label="t('Hell oder dunkel')">
            <button v-for="m in modes" :key="m.id" type="button" class="btn" :class="appearance.mode === m.id ? 'btn-primary' : 'btn-outline-primary'"
                    :aria-pressed="appearance.mode === m.id" @click="appearance.mode = m.id">
              <i :class="`bi bi-${m.icon} me-1`" aria-hidden="true"></i>{{ m.label }}
            </button>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="small fw-semibold mb-1">{{ t('Schriftgröße') }}</div>
          <div class="btn-group btn-group-sm" role="group" :aria-label="t('Schriftgröße')">
            <button v-for="[id, s] in textSizes" :key="id" type="button" class="btn" :class="appearance.textSize === id ? 'btn-primary' : 'btn-outline-primary'"
                    :aria-pressed="appearance.textSize === id" @click="appearance.textSize = id">{{ s.label }}</button>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <label for="corners" class="small fw-semibold mb-1 d-block">{{ t('Ecken') }}</label>
          <select id="corners" v-model="appearance.corners" class="form-select form-select-sm w-auto">
            <option v-for="[id, c] in corners" :key="id" :value="id">{{ c.label }}</option>
          </select>
        </div>
      </div>
      <button type="button" class="btn btn-link btn-sm px-0 mt-2" @click="resetSettings('design')">{{ t('Design zurücksetzen') }}</button>
    </div>
  </section>

  <!-- Hintergrund -->
  <section id="teil-hintergrund" class="card mb-3">
    <div class="card-body">
      <h2 class="h5 mb-1">{{ t('Hintergrund') }}</h2>
      <div class="form-check form-switch mb-2">
        <input id="bg" v-model="appearance.background" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="bg">{{ t('Hintergrund zeigen (eigenes Foto oder Muster des Designs)') }}</label>
      </div>

      <div class="d-flex flex-wrap gap-2 mb-2">
        <label class="btn btn-outline-primary btn-sm mb-0" :class="{ disabled: busy }">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-image me-1" aria-hidden="true"></i>{{ t('Foto für „{name}“', { name: getTheme(appearance.theme).label }) }}
          <input type="file" accept="image/*" class="d-none" data-scope="design" @change="pick($event, 'design')" />
        </label>
        <label class="btn btn-outline-primary btn-sm mb-0" :class="{ disabled: busy }">
          <i class="bi bi-images me-1" aria-hidden="true"></i>{{ t('Foto für alle Designs') }}
          <input type="file" accept="image/*" class="d-none" data-scope="alle" @change="pick($event, 'alle')" />
        </label>
        <button v-if="appearance.customBackground" type="button" class="btn btn-outline-danger btn-sm" @click="removeBackground">
          <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ appearance.customBackground === 'alle' ? t('Foto entfernen (alle Designs)') : t('Foto entfernen') }}
        </button>
      </div>
      <div v-if="error" class="alert alert-danger small py-2">{{ error }}</div>
      <p class="small text-body-secondary">
        {{ t('{x} Fotos kommen per Abgleich auch auf die anderen Geräte.', { x: appearance.customBackground === 'design' ? t('Eigenes Foto für dieses Design.') : appearance.customBackground === 'alle' ? t('Eigenes Foto für alle Designs.') : t('Kein eigenes Foto – das Muster des Designs wird gezeigt.') }) }}
      </p>

      <template v-if="appearance.customBackground">
        <div class="small fw-semibold mb-1">{{ t('Schnell einstellen') }}</div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <button v-for="pr in PRESETS" :key="pr.label" type="button" class="btn btn-sm btn-outline-secondary" :title="pr.hint" @click="Object.assign(appearance, pr.v)">
            {{ pr.label }}
          </button>
        </div>

        <div class="row g-3">
          <div class="col-12 col-md-6">
            <label for="cover" class="form-label small fw-semibold d-flex justify-content-between">{{ t('Schleier über dem Foto') }} <span class="fw-normal">{{ appearance.cover }} %</span></label>
            <input id="cover" v-model.number="appearance.cover" type="range" min="0" max="90" step="5" class="form-range" />
            <div class="small text-body-secondary">{{ t('0 % = Foto pur, mehr = blasser und ruhiger') }}</div>
          </div>
          <div class="col-12 col-md-6">
            <div class="form-label small fw-semibold">{{ t('Farbe des Schleiers') }}</div>
            <div class="btn-group btn-group-sm" role="group" :aria-label="t('Farbe des Schleiers')">
              <button v-for="v in veils" :key="v.id" type="button" class="btn" :class="appearance.veil === v.id ? 'btn-primary' : 'btn-outline-primary'"
                      :aria-pressed="appearance.veil === v.id" @click="appearance.veil = v.id">{{ v.label }}</button>
            </div>
          </div>
          <div class="col-12 col-md-6">
            <label for="blur" class="form-label small fw-semibold d-flex justify-content-between">{{ t('Unschärfe') }} <span class="fw-normal">{{ t('{blur} px', { blur: appearance.blur }) }}</span></label>
            <input id="blur" v-model.number="appearance.blur" type="range" min="0" max="20" step="1" class="form-range" />
          </div>
          <div class="col-12 col-md-6">
            <label for="sat" class="form-label small fw-semibold d-flex justify-content-between">{{ t('Farbsättigung') }} <span class="fw-normal">{{ appearance.saturate }} %</span></label>
            <input id="sat" v-model.number="appearance.saturate" type="range" min="0" max="200" step="5" class="form-range" />
            <div class="small text-body-secondary">{{ t('0 % = schwarz-weiß, 100 % = wie aufgenommen') }}</div>
          </div>
        </div>
      </template>

      <div class="row g-3 mt-0">
        <div class="col-12 col-md-6">
          <label for="cards" class="form-label small fw-semibold d-flex justify-content-between">{{ t('Karten durchscheinend') }} <span class="fw-normal">{{ appearance.cards }} %</span></label>
          <input id="cards" v-model.number="appearance.cards" type="range" min="0" max="60" step="5" class="form-range" />
          <div class="small text-body-secondary">{{ t('Lässt den Hintergrund leicht durch die Karten scheinen (mit Milchglas-Effekt)') }}</div>
        </div>
        <div v-if="!appearance.customBackground" class="col-12 col-md-6">
          <label for="pattern" class="form-label small fw-semibold d-flex justify-content-between">{{ t('Stärke des Musters') }} <span class="fw-normal">{{ appearance.pattern }} %</span></label>
          <input id="pattern" v-model.number="appearance.pattern" type="range" min="0" max="200" step="10" class="form-range" />
        </div>
      </div>
      <button type="button" class="btn btn-link btn-sm px-0 mt-2" @click="resetSettings('hintergrund')">{{ t('Hintergrund-Einstellungen zurücksetzen') }}</button>
    </div>
  </section>

  <!-- Reiseseite -->
  <section id="teil-reiseseite" class="card mb-3">
    <div class="card-body">
      <h2 class="h5 mb-1">{{ t('Reiseseite') }}</h2>
      <p class="small text-body-secondary">
        {{ t('Aufteilung und Darstellung der Seite einer Reise. Keine Sorge: Bereiche, die du aus allen Reitern nimmst, bleiben unter „Weitere Bereiche“ erreichbar.') }}
      </p>
      <TripLayoutEditor />
    </div>
  </section>
</template>

<style scoped>
.theme-option {
  height: 100%;
  padding: 0.5rem;
  color: var(--nww-text);
  background: var(--nww-surface-2);
  border: 2px solid var(--nww-border);
  border-radius: var(--bs-border-radius);
}
.theme-option.active {
  border-color: var(--nww-primary);
  box-shadow: 0 0 0 3px rgba(var(--nww-primary-rgb), 0.25);
}
.hint {
  font-size: 0.75rem;
  line-height: 1.25;
}
</style>
