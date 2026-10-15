<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { syncState } from '../sync/engine'
import { disablePush, enablePush, loadPushStatus, permission, pushState, pushSupport, sendTestPush, setPushPrefs, type PushPrefs } from '../push'
import { t, intlLocale } from '@/i18n'

const support = pushSupport()
const loading = ref(true)
const busy = ref(false)
const tooOld = ref(false)
const error = ref('')
const info = ref('')
const noDevice = computed(() => syncState.configured && !syncState.device)
const status = computed(() => pushState.status)
const abo = computed(() => (pushState.active ? status.value?.abo ?? null : null))
const denied = ref(permission() === 'denied')

onMounted(async () => {
  if (!syncState.configured) return (loading.value = false)
  try {
    tooOld.value = !(await loadPushStatus())
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

async function run(fn: () => Promise<unknown>, done = '') {
  error.value = info.value = ''
  busy.value = true
  try {
    await fn()
    info.value = done
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
    denied.value = permission() === 'denied'
  }
}

// Direkt aus dem Tippen heraus (Safari fragt sonst nicht nach der Erlaubnis)
function turnOn() {
  const key = status.value?.publicKey
  if (!key) return
  void run(() => enablePush(key), t('Benachrichtigungen sind eingeschaltet. Tipp: „Testnachricht senden“ zeigt, ob alles ankommt.'))
}
const turnOff = () => run(disablePush, t('Benachrichtigungen sind auf diesem Gerät ausgeschaltet.'))
const test = () => run(sendTestPush, t('Testnachricht ist unterwegs – sie sollte in ein paar Sekunden erscheinen.'))
const toggle = (key: keyof PushPrefs, on: boolean) => run(() => setPushPrefs({ [key]: on }))
const setLevel = (v: string) => run(() => setPushPrefs({ unwetterStufe: Number(v) as 2 | 3 | 4 }))

const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '')
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/abgleich" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ t('Geräte-Abgleich') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ t('Benachrichtigungen') }}</h1>
    <p class="text-body-secondary small mb-0 on-bg">{{ t('Erinnerungen an Fristen und Termine, Neues von den Mitreisenden und Unwetterwarnungen – auch wenn die App geschlossen ist. Gilt für dieses Gerät.') }}</p>
  </div>

  <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
  <div v-if="info" class="alert alert-success" role="status">{{ info }}</div>

  <div v-if="!syncState.configured" class="alert alert-info">
    {{ t('Benachrichtigungen kommen über den eigenen Server. Erst den') }} <RouterLink to="/abgleich">{{ t('Geräte-Abgleich') }}</RouterLink> {{ t('einrichten.') }}
  </div>
  <div v-else-if="loading" class="small text-body-secondary"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Lade …') }}</div>
  <div v-else-if="tooOld" class="alert alert-warning" data-push-too-old>
    {{ t('Der Server kennt noch keine Benachrichtigungen. Bitte den Server auf Version 1.17 aktualisieren (im Container:') }} <code>update.sh</code>).
  </div>
  <div v-else-if="noDevice" class="alert alert-warning">
    {{ t('Dieses Gerät ist noch mit dem Schlüssel der Reisegruppe verbunden. Für Benachrichtigungen bitte unter') }}
    <RouterLink to="/abgleich">{{ t('Geräte-Abgleich → Verbindung') }}</RouterLink> {{ t('als eigenes Gerät anmelden.') }}
  </div>

  <template v-else-if="status">
    <!-- Gerät kann es nicht -->
    <div v-if="support === 'ios-installieren'" class="card mb-3 border-primary" data-push-install>
      <div class="card-body">
        <h2 class="h6"><i class="bi bi-phone me-1" aria-hidden="true"></i>{{ t('Erst die App installieren') }}</h2>
        <p class="small mb-2">{{ t('Auf iPad und iPhone gibt es Benachrichtigungen nur für Apps auf dem Home-Bildschirm (ab iOS 16.4):') }}</p>
        <ol class="small mb-0">
          <li>{{ t('In Safari auf') }} <i class="bi bi-box-arrow-up" :aria-label="t('Teilen')"></i> {{ t('„Teilen“ tippen') }}</li>
          <li>{{ t('„Zum Home-Bildschirm“ wählen') }}</li>
          <li>{{ t('Die App über das neue Symbol öffnen und hier einschalten') }}</li>
        </ol>
      </div>
    </div>
    <div v-else-if="support !== 'ok'" class="alert alert-warning">
      {{ support === 'unsicher' ? t('Benachrichtigungen gehen nur, wenn die App über https geöffnet ist.') : t('Dieser Browser unterstützt keine Push-Benachrichtigungen.') }}
    </div>

    <section v-else class="card mb-3" data-push-card>
      <div class="card-body">
        <div class="d-flex align-items-center gap-3">
          <i class="bi fs-2" :class="abo ? 'bi-bell-fill text-primary' : 'bi-bell-slash text-body-secondary'" aria-hidden="true"></i>
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ abo ? t('Eingeschaltet') : t('Ausgeschaltet') }}</div>
            <div class="small text-body-secondary">
              <template v-if="abo && status.geplant">{{ tn(status.geplant, '1 Erinnerung geplant · nächste {when}', '{n} Erinnerungen geplant · nächste {when}', { when: when(status.naechste) }) }}</template>
              <template v-else-if="abo">{{ t('Gerade nichts geplant') }}</template>
              <template v-else>{{ t('Auf diesem Gerät kommen keine Benachrichtigungen.') }}</template>
            </div>
          </div>
          <button v-if="!abo" type="button" class="btn btn-primary" :disabled="busy || denied" data-push-on @click="turnOn">
            <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Einschalten') }}
          </button>
          <button v-else type="button" class="btn btn-outline-secondary" :disabled="busy" data-push-off @click="turnOff">{{ t('Ausschalten') }}</button>
        </div>

        <div v-if="denied" class="alert alert-warning small py-2 mt-3 mb-0">
          {{ t('Benachrichtigungen sind für die App nicht erlaubt. Auf dem iPad:') }} <em>{{ t('Einstellungen → Mitteilungen → KofferFertigRaus') }}</em> {{ t('→ „Mitteilungen erlauben“. Im Browser: Schloss-Symbol neben der Adresse → Benachrichtigungen erlauben. Danach die Seite neu laden.') }}
        </div>

        <template v-if="abo">
          <hr />
          <div class="form-check form-switch mb-2">
            <input id="push-erinnerungen" class="form-check-input" type="checkbox" :checked="abo.prefs.erinnerungen" :disabled="busy" @change="toggle('erinnerungen', ($event.target as HTMLInputElement).checked)" />
            <label class="form-check-label" for="push-erinnerungen">
              {{ t('Erinnerungen an Termine und Fristen') }}
              <span class="d-block small text-body-secondary">{{ t('Stornofrist, Check-in, Abfahrt, Impftermin … – mit derselben Vorwarnung wie im Kalender (Fristen 2 Tage, Termine 2 Stunden, Reisebeginn am Vorabend)') }}</span>
            </label>
          </div>
          <div class="form-check form-switch mb-3">
            <input id="push-aenderungen" class="form-check-input" type="checkbox" :checked="abo.prefs.aenderungen" :disabled="busy" @change="toggle('aenderungen', ($event.target as HTMLInputElement).checked)" />
            <label class="form-check-label" for="push-aenderungen">
              {{ t('Neues von den Mitreisenden') }}
              <span class="d-block small text-body-secondary">{{ t('z. B. „Dolomiten: Birgit – Neu: ein Tagebucheintrag, 5 Fotos“ – gebündelt, höchstens alle 15 Minuten je Reise') }}</span>
            </label>
          </div>
          <!-- Ältere Server (vor 1.19) kennen keine Unwetterwarnungen – dann fehlt die Einstellung -->
          <div v-if="abo.prefs.unwetter !== undefined" class="mb-3" data-push-unwetter>
            <div class="form-check form-switch mb-1">
              <input id="push-unwetter" class="form-check-input" type="checkbox" :checked="abo.prefs.unwetter" :disabled="busy" @change="toggle('unwetter', ($event.target as HTMLInputElement).checked)" />
              <label class="form-check-label" for="push-unwetter">
                {{ t('Unwetterwarnungen') }}
                <span class="d-block small text-body-secondary">{{ t('Amtliche Warnungen (MeteoAlarm) für die Orte laufender und kommender Reisen – ab dem Vortag der Reise') }}</span>
              </label>
            </div>
            <div v-if="abo.prefs.unwetter" class="ms-5 d-flex align-items-center gap-2 small">
              <label for="push-unwetter-stufe">{{ t('ab Stufe') }}</label>
              <select id="push-unwetter-stufe" class="form-select form-select-sm w-auto" :value="abo.prefs.unwetterStufe ?? 3" :disabled="busy" @change="setLevel(($event.target as HTMLSelectElement).value)">
                <option value="2">{{ t('Gelb (Achtung)') }}</option>
                <option value="3">{{ t('Orange (Gefährlich)') }}</option>
                <option value="4">{{ t('Rot (Sehr gefährlich)') }}</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-outline-primary btn-sm" :disabled="busy" data-push-test @click="test"><i class="bi bi-send me-1" aria-hidden="true"></i>{{ t('Testnachricht senden') }}</button>
          <div v-if="abo.lastError" class="small text-danger mt-2"><i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ t('Zuletzt: {lastError}', { lastError: abo.lastError }) }}</div>
        </template>
      </div>
    </section>

    <p class="small text-body-secondary on-bg">
      <i class="bi bi-shield-lock me-1" aria-hidden="true"></i>{{ t('Die Nachrichten laufen verschlüsselt über den Push-Dienst des Geräts (Apple, Google oder Mozilla) – lesen kann sie nur dieses Gerät. Erinnerungen kommen pünktlich, auch wenn die App geschlossen ist; geplant werden sie bei jedem Abgleich.') }}
    </p>
  </template>
</template>
