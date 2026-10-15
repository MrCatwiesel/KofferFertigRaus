<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/ui/AppLogo.vue'
import { canCreateTrips } from '@/core/people'
import { setMeta } from '@/core/meta'
import { installHint } from './platform'
import { useSampleTrip } from './useSampleTrip'
import LanguageSelect from '@/i18n/LanguageSelect.vue'
import { t } from '@/i18n'

/**
 * Einführung in wenigen Schritten. Erreichbar über die Willkommen-Ansicht, die Hilfe
 * und die Einstellungen – jederzeit wiederholbar.
 */
const router = useRouter()
const hint = installHint()
const { creating, error, create: sample } = useSampleTrip()

interface Step {
  id: string
  title: string
  icon: string
}
const steps: Step[] = [
  { id: 'willkommen', title: t('Willkommen'), icon: 'suitcase-lg' },
  { id: 'planen', title: t('Planen & vorbereiten'), icon: 'map' },
  { id: 'unterwegs', title: t('Unterwegs'), icon: 'compass' },
  { id: 'erinnern', title: t('Erinnern & teilen'), icon: 'journal-richtext' },
  { id: 'daten', title: t('Deine Daten'), icon: 'shield-lock' },
  { id: 'installieren', title: t('Als App nutzen'), icon: 'phone' },
  { id: 'los', title: t('Los geht’s'), icon: 'rocket-takeoff' }
]
const index = ref(0)
const step = computed(() => steps[index.value])
const last = computed(() => index.value === steps.length - 1)

function go(delta: number) {
  index.value = Math.min(steps.length - 1, Math.max(0, index.value + delta))
}
function startSample() {
  void setMeta('help.introDone', true)
  void sample()
}
function finish(to: string) {
  void setMeta('help.introDone', true)
  router.push(to)
}

// Pfeiltasten am Computer
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Wischen auf iPad und Handy
let touchX: number | null = null
function touchStart(e: TouchEvent) {
  touchX = e.touches[0]?.clientX ?? null
}
function touchEnd(e: TouchEvent) {
  if (touchX === null) return
  const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX
  touchX = null
  if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
}
</script>

<template>
  <div class="intro mx-auto" data-intro @touchstart.passive="touchStart" @touchend.passive="touchEnd">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <span class="small text-body-secondary on-bg">{{ t('Schritt {x} von {n}', { x: index + 1, n: steps.length }) }}</span>
      <button v-if="!last" type="button" class="btn btn-link btn-sm text-decoration-none" @click="finish('/trip')">{{ t('Überspringen') }}</button>
    </div>

    <div class="card intro-card">
      <div class="card-body p-4">
        <div class="intro-icon mb-3">
          <AppLogo v-if="step.id === 'willkommen'" :size="56" />
          <i v-else :class="`bi bi-${step.icon}`" aria-hidden="true"></i>
        </div>
        <h1 class="h3 mb-3" data-intro-title>{{ step.id === 'willkommen' ? t('Willkommen bei KofferFertigRaus') : step.title }}</h1>

        <template v-if="step.id === 'willkommen'">
          <p class="lead">{{ t('Deine Reise an einem Ort – von der ersten Idee bis zur Erinnerung.') }}</p>
          <div class="phases">
            <div><i class="bi bi-map" aria-hidden="true"></i><span>{{ t('Planen') }}</span></div>
            <div><i class="bi bi-list-check" aria-hidden="true"></i><span>{{ t('Vorbereiten') }}</span></div>
            <div><i class="bi bi-compass" aria-hidden="true"></i><span>{{ t('Unterwegs') }}</span></div>
            <div><i class="bi bi-journal-richtext" aria-hidden="true"></i><span>{{ t('Erinnern') }}</span></div>
          </div>
          <p class="mt-3 mb-0 text-body-secondary">{{ t('Kostenlos, ohne Werbung und ohne Konto. Alles funktioniert auch ohne Internet.') }}</p>
          <div class="mt-3"><LanguageSelect compact /></div>
        </template>

        <template v-else-if="step.id === 'planen'">
          <ul class="intro-list">
            <li><i class="bi bi-car-front" aria-hidden="true"></i><span><strong>{{ t('Anreise und Unterkünfte') }}</strong> {{ t('mit Zeiten, Kosten und Stornofristen – Bestätigungsmails liest die App selbst ein.') }}</span></li>
            <li><i class="bi bi-star" aria-hidden="true"></i><span><strong>{{ t('Ideen sammeln') }}</strong> {{ t('für Ausflüge und Restaurants, gemeinsam per Abstimmung entscheiden.') }}</span></li>
            <li><i class="bi bi-backpack" aria-hidden="true"></i><span><strong>{{ t('Packliste') }}</strong> {{ t('aus Vorlagen – Mengen passend zu Reisedauer und Personen.') }}</span></li>
            <li><i class="bi bi-passport" aria-hidden="true"></i><span><strong>{{ t('Dokumente, Reiseapotheke, Reisehinweise') }}</strong> {{ t('– mit Ablaufdaten und Erinnerungen.') }}</span></li>
          </ul>
        </template>

        <template v-else-if="step.id === 'unterwegs'">
          <ul class="intro-list">
            <li><i class="bi bi-sun" aria-hidden="true"></i><span><strong>{{ t('Heute') }}</strong> {{ t('zeigt den Tag mit Wetter und schlägt passende Ideen vor – bei Regen die für drinnen.') }}</span></li>
            <li><i class="bi bi-map" aria-hidden="true"></i><span><strong>{{ t('Karte') }}</strong> {{ t('mit Unterkünften, Ideen, Touren und Fotos – auch offline.') }}</span></li>
            <li><i class="bi bi-wallet2" aria-hidden="true"></i><span><strong>{{ t('Ausgaben') }}</strong> {{ t('in Sekunden erfassen; am Ende rechnet die App aus, wer wem was schuldet.') }}</span></li>
            <li><i class="bi bi-telephone" aria-hidden="true"></i><span><strong>{{ t('Notfall') }}</strong> {{ t('– die wichtigen Nummern mit einem Tipp.') }}</span></li>
          </ul>
        </template>

        <template v-else-if="step.id === 'erinnern'">
          <ul class="intro-list">
            <li><i class="bi bi-journal-richtext" aria-hidden="true"></i><span><strong>{{ t('Tagebuch') }}</strong> {{ t('mit Fotos und Sprachnotizen – auf Wunsch mit fertigem Entwurf aus dem Tag.') }}</span></li>
            <li><i class="bi bi-book" aria-hidden="true"></i><span><strong>{{ t('Reisebericht und Fotobuch') }}</strong> {{ t('als PDF-Datei.') }}</span></li>
            <li><i class="bi bi-window" aria-hidden="true"></i><span><strong>{{ t('Reise-Webseite') }}</strong> {{ t('oder ein Link für Freunde und Familie.') }}</span></li>
          </ul>
        </template>

        <template v-else-if="step.id === 'daten'">
          <p>{{ t('Alles, was du einträgst, liegt') }} <strong>{{ t('nur auf diesem Gerät') }}</strong>{{ t('. Kein fremder Server, keine Werbung.') }}</p>
          <ul class="intro-list">
            <li><i class="bi bi-download" aria-hidden="true"></i><span>{{ t('Sichere deine Reisen ab und zu unter') }} <strong>{{ t('Einstellungen → Datensicherung') }}</strong>.</span></li>
            <li><i class="bi bi-cloud-arrow-up" aria-hidden="true"></i><span>{{ t('Mehrere Geräte oder Mitreisende? Mit dem') }} <strong>{{ t('Geräte-Abgleich') }}</strong> {{ t('über deinen eigenen Server bleiben alle auf demselben Stand.') }}</span></li>
          </ul>
        </template>

        <template v-else-if="step.id === 'installieren'">
          <template v-if="hint === 'installiert'">
            <p class="mb-0"><i class="bi bi-check-circle-fill text-success me-1" aria-hidden="true"></i>{{ t('Die App liegt schon auf deinem Home-Bildschirm – bestens.') }}</p>
          </template>
          <template v-else-if="hint === 'ios'">
            <p>{{ t('Auf dem iPad oder iPhone gehört die App auf den Home-Bildschirm. Dann behält Safari die Daten zuverlässig, und Face ID und Benachrichtigungen funktionieren.') }}</p>
            <ol class="mb-0">
              <li>{{ t('In Safari auf') }} <strong>{{ t('Teilen') }}</strong> {{ t('tippen') }} <i class="bi bi-box-arrow-up" aria-hidden="true"></i></li>
              <li><strong>{{ t('Zum Home-Bildschirm') }}</strong> {{ t('wählen') }}</li>
              <li>{{ t('Die App ab jetzt über das neue Symbol öffnen') }}</li>
            </ol>
          </template>
          <template v-else-if="hint === 'android'">
            <p>{{ t('Leg die App auf den Startbildschirm – dann startet sie wie jede andere App:') }}</p>
            <p class="mb-0">{{ t('Chrome-Menü (drei Punkte) →') }} <strong>{{ t('App installieren') }}</strong>.</p>
          </template>
          <template v-else>
            <p>{{ t('Die App lässt sich installieren und startet dann im eigenen Fenster – oder du nutzt sie einfach im Browser.') }}</p>
            <p class="mb-0">{{ t('Chrome oder Edge: in der Adressleiste auf') }} <strong>{{ t('Installieren') }}</strong> {{ t('klicken. Auf iPad und iPhone: Safari → Teilen →') }} <strong>{{ t('Zum Home-Bildschirm') }}</strong>.</p>
          </template>
        </template>

        <template v-else-if="step.id === 'los'">
          <p>{{ t('Womit möchtest du anfangen?') }}</p>
          <div class="d-grid gap-2">
            <button v-if="canCreateTrips()" type="button" class="btn btn-primary" data-intro-new @click="finish('/trip/neu')">
              <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Erste Reise planen') }}
            </button>
            <button v-if="canCreateTrips()" type="button" class="btn btn-outline-primary" :disabled="creating" data-intro-sample @click="startSample">
              <span v-if="creating" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
              <i v-else class="bi bi-suitcase2 me-1" aria-hidden="true"></i>{{ t('Beispielreise ansehen') }}
            </button>
            <button type="button" class="btn btn-outline-secondary" @click="finish('/abgleich')">
              <i class="bi bi-cloud-arrow-down me-1" aria-hidden="true"></i>{{ t('Mit meinem Server verbinden') }}
            </button>
            <button type="button" class="btn btn-link" @click="finish('/hilfe')">{{ t('Zur Hilfe') }}</button>
          </div>
          <div v-if="error" class="alert alert-danger mt-3 mb-0">{{ error }}</div>
        </template>
      </div>
    </div>

    <div class="d-flex align-items-center justify-content-between mt-3">
      <button type="button" class="btn btn-outline-secondary" :disabled="index === 0" @click="go(-1)">
        <i class="bi bi-chevron-left" aria-hidden="true"></i><span class="d-none d-sm-inline ms-1">{{ t('Zurück') }}</span>
      </button>
      <div class="dots" role="tablist" :aria-label="t('Schritte')">
        <button
          v-for="(s, i) in steps"
          :key="s.id"
          type="button"
          role="tab"
          :aria-selected="i === index"
          :aria-label="s.title"
          :class="{ active: i === index }"
          @click="index = i"
        ></button>
      </div>
      <button v-if="!last" type="button" class="btn btn-primary" data-intro-next @click="go(1)">
        <span class="d-none d-sm-inline me-1">{{ t('Weiter') }}</span><i class="bi bi-chevron-right" aria-hidden="true"></i>
      </button>
      <button v-else type="button" class="btn btn-outline-primary" @click="finish('/trip')">{{ t('Fertig') }}</button>
    </div>
  </div>
</template>

<style scoped>
.intro {
  max-width: 36rem;
}
.intro-card {
  min-height: 22rem;
}
.intro-icon {
  font-size: 2.6rem;
  line-height: 1;
  color: var(--nww-primary);
}
.phases {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  text-align: center;
}
.phases div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  padding: 0.7rem 0.2rem;
  border-radius: var(--nww-radius);
  background: rgba(var(--nww-primary-rgb), 0.08);
  font-size: 0.85rem;
}
.phases .bi {
  font-size: 1.4rem;
  color: var(--nww-primary);
}
.intro-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.intro-list li {
  display: flex;
  gap: 0.8rem;
  margin-bottom: 0.9rem;
}
.intro-list li:last-child {
  margin-bottom: 0;
}
.intro-list .bi {
  flex: none;
  font-size: 1.3rem;
  color: var(--nww-primary);
}
.dots {
  display: flex;
  gap: 0.4rem;
}
.dots button {
  width: 0.6rem;
  height: 0.6rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--nww-border);
}
.dots button.active {
  background: var(--nww-primary);
  transform: scale(1.25);
}
</style>
