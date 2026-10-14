<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { todayIso } from '@/core/dates'
import { KIND_LABEL, groupOf, type Reminder, type ReminderGroup } from '@/core/reminders'
import { syncState } from '@/core/sync/engine'
import { pushState } from '@/core/push'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { aboStatus, aboUrls, disableAbo, enableAbo, remindersOfTrip, shareIcs, tripIcs, type AboStatus } from '../calendar'
import { locale } from '@/core/i18n'

const props = defineProps<{ tripId: string }>()
const today = todayIso()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
// Neu berechnen, sobald sich Daten der Reise ändern (liveQuery beobachtet alle gelesenen Tabellen)
const list = useLiveQuery(async () => {
  const t = await tripRepository.get(props.tripId)
  return t ? remindersOfTrip(t, today) : []
}, [] as Reminder[])

const GROUPS: { id: ReminderGroup; label: string; cls: string }[] = [
  { id: 'ueberfaellig', label: 'Überfällig', cls: 'text-danger' },
  { id: 'heute', label: 'Heute', cls: 'text-primary' },
  { id: 'woche', label: 'Nächste 7 Tage', cls: '' },
  { id: 'spaeter', label: 'Später', cls: '' }
]
const grouped = computed(() => GROUPS.map((g) => ({ ...g, items: list.value.filter((r) => groupOf(r, today) === g.id) })).filter((g) => g.items.length))
const past = computed(() => list.value.filter((r) => groupOf(r, today) === 'vorbei'))

const day = (iso: string) => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${iso}T12:00:00`))
function when(r: Reminder) {
  let s = day(r.date)
  if (r.endDate && r.endDate !== r.date) s += ` – ${day(r.endDate)}`
  if (r.time) s += `, ${r.time}${r.endTime ? `–${r.endTime}` : ''} Uhr`
  return s
}

/** Zusatzinfo ohne „Reise: …“ (das steht nur im Kalender, hier ist klar, welche Reise) */
const detail = (r: Reminder) => (r.detail ?? '').split('\n').filter((l) => !l.startsWith('Reise: '))[0] ?? ''

// ---------------- Kalender
const busy = ref(false)
const message = ref<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null)
const abo = shallowRef<{ server: string; status: AboStatus } | null>(null)
const aboLoaded = ref(false)

async function loadAbo() {
  try {
    const r = await aboStatus()
    abo.value = r ? { server: r.client.server, status: r.status } : null
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  } finally {
    aboLoaded.value = true
  }
}
onMounted(loadAbo)
const urls = computed(() => (abo.value?.status.token ? aboUrls(abo.value.server, abo.value.status.token) : null))

async function exportTrip() {
  if (!trip.value) return
  await shareIcs(await tripIcs(trip.value), `${trip.value.title.replace(/[^\wäöüÄÖÜß -]/g, '').trim() || 'Reise'}.ics`)
}

async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true
  message.value = null
  try {
    await fn()
    await loadAbo()
    message.value = { type: 'success', text: ok }
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  } finally {
    busy.value = false
  }
}
const start = () => run(() => enableAbo(), 'Kalender-Abo ist eingerichtet. Jetzt auf dem iPad „Im Kalender abonnieren“ antippen.')
const renew = () => confirm('Neue geheime Adresse erzeugen? Die alte funktioniert dann nicht mehr – bereits abonnierte Kalender müssen neu abonniert werden.') && run(() => enableAbo(true), 'Neue Adresse erzeugt.')
const stop = () => confirm('Kalender-Abo beenden? Abonnierte Kalender bekommen dann keine Termine mehr.') && run(disableAbo, 'Kalender-Abo beendet.')
async function copy() {
  if (!urls.value) return
  try {
    await navigator.clipboard.writeText(urls.value.https)
    message.value = { type: 'info', text: 'Adresse kopiert.' }
  } catch {
    message.value = { type: 'info', text: urls.value.https }
  }
}
const ago = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale(), { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : 'noch nie')
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="$t('Termine & Fristen')" />

  <p class="small text-body-secondary on-bg">
    {{ $t('Gesammelt aus Unterkünften, An- und Rückreise, Unternehmungen, Dokumenten, Reiseapotheke und Packliste. Ändern kannst du alles dort – ein Tipp auf einen Eintrag führt hin.') }}
  </p>

  <div v-if="!list.length" class="card mb-3"><div class="card-body text-body-secondary">{{ $t('Noch keine Termine.') }}</div></div>

  <section v-for="g in grouped" :key="g.id" class="mb-3">
    <h2 class="h6 on-bg" :class="g.cls">{{ g.label }} <span class="badge text-bg-light border">{{ g.items.length }}</span></h2>
    <div class="list-group">
      <RouterLink v-for="r in g.items" :key="r.id" :to="r.to ?? `/trip/${tripId}`" class="list-group-item list-group-item-action d-flex gap-3 align-items-start"
                  :data-reminder="r.id">
        <i :class="`bi bi-${KIND_LABEL[r.kind].icon} fs-5 mt-1`" :style="{ color: r.kind === 'frist' ? 'var(--nww-accent)' : 'var(--nww-primary)' }" aria-hidden="true"></i>
        <span class="flex-grow-1 min-w-0">
          <span class="d-block fw-semibold">{{ r.title }}</span>
          <span class="d-block small text-body-secondary">{{ KIND_LABEL[r.kind].label }} · {{ when(r) }}<template v-if="r.location"> · {{ r.location }}</template></span>
          <span v-if="detail(r)" class="d-block small text-body-secondary text-truncate">{{ detail(r) }}</span>
        </span>
      </RouterLink>
    </div>
  </section>

  <details v-if="past.length" class="mb-3">
    <summary class="small text-body-secondary on-bg">{{ $t('Vorbei ({0})', [past.length]) }}</summary>
    <div class="list-group mt-2">
      <RouterLink v-for="r in past" :key="r.id" :to="r.to ?? `/trip/${tripId}`" class="list-group-item list-group-item-action small text-body-secondary">
        {{ when(r) }} · {{ r.title }}
      </RouterLink>
    </div>
  </details>

  <!-- Kalender -->
  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5"><i class="bi bi-calendar-plus me-1 text-primary" aria-hidden="true"></i>{{ $t('In den Kalender') }}</h2>
      <div v-if="message" class="alert py-2 small" :class="`alert-${message.type}`" role="status">{{ message.text }}</div>

      <div class="mb-3">
        <div class="fw-semibold">{{ $t('Kalender-Abo') }} <span class="badge text-bg-success ms-1">{{ $t('empfohlen') }}</span></div>
        <p class="small text-body-secondary mb-2">
          {{ $t('Der Kalender auf iPad/iPhone (oder Android, Outlook) holt die Termine aller laufenden und kommenden Reisen selbst ab und') }}
          <strong>{{ $t('erinnert dich rechtzeitig') }}</strong> {{ $t('– Stornofristen 2 Tage vorher, Abfahrten 2 Stunden vorher, Reisetage am Vorabend. Änderungen in der App kommen automatisch an.') }}
        </p>
        <p v-if="!syncState.configured" class="small mb-0">
          <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ $t('Dafür wird der') }} <RouterLink to="/abgleich">{{ $t('Geräte-Abgleich') }}</RouterLink> {{ $t('mit dem eigenen Server gebraucht.') }}
        </p>
        <template v-else-if="aboLoaded">
          <template v-if="urls">
            <div class="d-flex flex-wrap gap-2 mb-2">
              <a :href="urls.webcal" class="btn btn-primary btn-sm"><i class="bi bi-calendar-check me-1" aria-hidden="true"></i>{{ $t('Im Kalender abonnieren') }}</a>
              <button type="button" class="btn btn-outline-primary btn-sm" @click="copy"><i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ $t('Adresse kopieren') }}</button>
              <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="busy" @click="renew">{{ $t('Neue Adresse') }}</button>
              <button type="button" class="btn btn-outline-danger btn-sm" :disabled="busy" @click="stop">{{ $t('Abo beenden') }}</button>
            </div>
            <div class="small text-body-secondary">
              {{ $t('Zuletzt aktualisiert: {0}. Die Adresse ist geheim – wer sie hat, sieht eure Termine. Für Google Kalender: Adresse kopieren → „Per URL hinzufügen“.', [ago(abo!.status.updated)]) }}
            </div>
          </template>
          <button v-else type="button" class="btn btn-primary btn-sm" :disabled="busy" @click="start">
            <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ $t('Kalender-Abo einrichten') }}
          </button>
        </template>
      </div>

      <div v-if="syncState.configured" class="mb-3" data-push-hint>
        <div class="fw-semibold">{{ $t('Als Benachrichtigung') }}</div>
        <p class="small text-body-secondary mb-2">
          {{ $t('Ohne Kalender: Die App selbst meldet sich zur selben Zeit auf dem Gerät – auch wenn sie geschlossen ist.') }}
        </p>
        <RouterLink to="/benachrichtigungen" class="btn btn-outline-primary btn-sm">
          <i class="bi me-1" :class="pushState.active ? 'bi-bell-fill' : 'bi-bell'" aria-hidden="true"></i>{{ pushState.active ? $t('Benachrichtigungen sind an') : $t('Benachrichtigungen einrichten') }}
        </RouterLink>
      </div>

      <div>
        <div class="fw-semibold">{{ $t('Einmalig als Datei') }}</div>
        <p class="small text-body-secondary mb-2">{{ $t('Nur diese Reise, Stand jetzt – spätere Änderungen kommen nicht automatisch an.') }}</p>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="exportTrip"><i class="bi bi-download me-1" aria-hidden="true"></i>{{ $t('Kalenderdatei (.ics)') }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
