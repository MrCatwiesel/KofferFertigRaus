<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import {
  DETAIL_LEVELS,
  MapsApi,
  bboxKm,
  bboxTooLarge,
  formatMb,
  offlineMapRepository,
  roundBbox,
  saveToDevice,
  type Bbox,
  type OfflineMap,
  type ServerMap
} from '../offline'
import { t } from '@/core/i18n'

const props = defineProps<{ tripId: string; tripTitle: string; viewBbox: Bbox | null }>()
const emit = defineEmits<{ show: [bbox: Bbox] }>()
const online = useOnline()

const local = useLiveQuery(() => offlineMapRepository.listByTrip(props.tripId), [] as OfflineMap[])
const api = shallowRef<MapsApi | null>(null)
const serverReady = ref<boolean | null>(null) // null = unbekannt (offline / kein Server)
const serverMaps = ref<ServerMap[]>([])
const noServer = ref(false)

const name = ref('')
const zoom = ref(14)
const busy = ref('')
const progress = ref(0)
const error = ref('')
const done = ref('')

async function refresh() {
  error.value = ''
  api.value = await MapsApi.create()
  noServer.value = !api.value
  if (!api.value || !online.value) return
  try {
    const r = await api.value.list()
    serverReady.value = r.available
    serverMaps.value = r.maps
  } catch (e) {
    serverReady.value = null
    // Ältere Server kennen /api/maps noch nicht
    if ((e as { status?: number }).status === 404) serverReady.value = false
    else error.value = (e as Error).message
  }
}

onMounted(() => {
  name.value = props.tripTitle
  void refresh()
})
watch(online, (on) => on && void refresh())
watch(
  () => props.tripTitle,
  (t) => (name.value ||= t)
)

const size = computed(() => (props.viewBbox ? bboxKm(props.viewBbox) : null))
const tooLarge = computed(() => !!props.viewBbox && bboxTooLarge(props.viewBbox))
const localIds = computed(() => new Set(local.value.map((m) => m.id)))
/** Karten dieser Reise auf dem Server, die hier noch fehlen (z. B. auf dem anderen iPad erstellt) */
const fetchable = computed(() => serverMaps.value.filter((m) => m.tripId === props.tripId && m.status === 'fertig' && !localIds.value.has(m.id)))
const pendingOnServer = computed(() => serverMaps.value.filter((m) => m.tripId === props.tripId && m.status === 'läuft'))

async function order() {
  if (!api.value || !props.viewBbox) return
  error.value = ''
  done.value = ''
  progress.value = 0
  try {
    busy.value = t('Server schneidet den Ausschnitt aus …')
    const created = await api.value.order(name.value.trim() || props.tripTitle, props.tripId, roundBbox(props.viewBbox), zoom.value)
    const ready = await api.value.waitUntilReady(created.id, (s) => (busy.value = t('Server schneidet den Ausschnitt aus … {0} s', [s])))
    await fetchToDevice(ready)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = ''
    void refresh()
  }
}

async function fetchToDevice(m: ServerMap) {
  if (!api.value) return
  error.value = ''
  busy.value = t('Lade auf dieses Gerät …')
  try {
    const saved = await saveToDevice(api.value, m, props.tripId, (p) => {
      progress.value = p
      busy.value = t('Lade auf dieses Gerät … {0} %', [Math.round(p * 100)])
    })
    done.value = t('„{0}“ gespeichert ({1}) – funktioniert jetzt auch ohne Internet.', [saved.name, formatMb(saved.size)])
    emit('show', saved.bbox)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = ''
  }
}

async function removeLocal(m: OfflineMap) {
  if (!confirm(t('Offline-Karte „{0}“ von diesem Gerät löschen?', [m.name]))) return
  await offlineMapRepository.remove(m.id)
}

async function removeOnServer(m: ServerMap) {
  if (!api.value || !confirm(t('Karte „{0}“ auch auf dem Server löschen? Andere Geräte können sie dann nicht mehr laden.', [m.name]))) return
  try {
    await api.value.remove(m.id)
  } catch (e) {
    error.value = (e as Error).message
  }
  void refresh()
}

const detailLabel = (z: number) => DETAIL_LEVELS.find((d) => d.zoom === z)?.label ?? t('bis Zoom {0}', [z])
const kmLabel = (b: Bbox) => {
  const k = bboxKm(b)
  return `${k.width} × ${k.height} km`
}
</script>

<template>
  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h6 card-title"><i class="bi bi-cloud-arrow-down me-1" aria-hidden="true"></i>{{ $t('Offline-Karten') }}</h2>

      <!-- Gespeichert auf diesem Gerät -->
      <div v-if="local.length" class="list-group mb-3">
        <div v-for="m in local" :key="m.id" class="list-group-item d-flex align-items-center gap-2">
          <i class="bi bi-map text-success" aria-hidden="true"></i>
          <button type="button" class="btn btn-link text-body text-decoration-none text-start p-0 flex-grow-1 min-w-0" @click="emit('show', m.bbox)">
            <div class="text-truncate">{{ m.name }}</div>
            <div class="small text-body-secondary">{{ kmLabel(m.bbox) }} · {{ detailLabel(m.maxzoom) }} · {{ formatMb(m.size) }}</div>
          </button>
          <button type="button" class="btn btn-sm btn-outline-danger flex-none" :aria-label="$t('{0} löschen', [m.name])" @click="removeLocal(m)">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <p v-else class="small text-body-secondary">
        {{ $t('Speichere den Kartenausschnitt deiner Reise auf diesem Gerät – dann siehst du Karte, Orte und Routen auch ohne Netz, z. B. in den Bergen oder im Ausland.') }}
      </p>

      <!-- Auf dem Server vorhanden, hier noch nicht -->
      <div v-if="fetchable.length" class="mb-3">
        <div class="small text-body-secondary mb-1">{{ $t('Auf deinem Server, aber noch nicht auf diesem Gerät:') }}</div>
        <div v-for="m in fetchable" :key="m.id" class="d-flex flex-wrap align-items-center gap-2 mb-1">
          <span class="small flex-grow-1">{{ m.name }} · {{ kmLabel(m.bbox) }} · {{ formatMb(m.size) }}</span>
          <button type="button" class="btn btn-sm btn-outline-primary" :disabled="!!busy" @click="fetchToDevice(m)">{{ $t('Auf dieses Gerät laden') }}</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="!!busy" :aria-label="$t('Auf dem Server löschen')" @click="removeOnServer(m)">
            <i class="bi bi-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div v-if="pendingOnServer.length && !busy" class="small text-body-secondary mb-2">
        <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ $t('Der Server erstellt gerade „{0}“ –', [pendingOnServer[0].name]) }}
        <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="refresh">{{ $t('neu prüfen') }}</button>
      </div>

      <!-- Neuen Ausschnitt speichern -->
      <div v-if="noServer" class="alert alert-secondary small mb-0">
        {{ $t('Offline-Karten erstellt dein eigener Server. Richte zuerst den') }}
        <RouterLink to="/abgleich">{{ $t('Geräte-Abgleich') }}</RouterLink> {{ $t('ein.') }}
      </div>
      <div v-else-if="!online" class="small text-body-secondary">{{ $t('Neue Ausschnitte kannst du speichern, sobald wieder Internet da ist.') }}</div>
      <div v-else-if="serverReady === false" class="alert alert-secondary small mb-0">
        {{ $t('Dein Server kann noch keine Offline-Karten erstellen. Im Container einmal') }}
        <code>/opt/nix-wie-weg/server/proxmox/update.sh</code> {{ $t('ausführen – danach geht es.') }}
      </div>
      <template v-else>
        <div class="row g-2 align-items-end mb-2">
          <div class="col-12 col-sm-6">
            <label for="om-name" class="form-label small mb-1">{{ $t('Name') }}</label>
            <input id="om-name" v-model="name" class="form-control form-control-sm" maxlength="80" />
          </div>
          <div class="col-12 col-sm-6">
            <span class="form-label small mb-1 d-block">{{ $t('Detail') }}</span>
            <div class="btn-group btn-group-sm w-100" role="group" :aria-label="$t('Detail')">
              <template v-for="d in DETAIL_LEVELS" :key="d.zoom">
                <input :id="`om-z${d.zoom}`" v-model="zoom" type="radio" class="btn-check" :value="d.zoom" />
                <label class="btn btn-outline-primary" :for="`om-z${d.zoom}`" :title="d.hint">{{ d.label }}</label>
              </template>
            </div>
          </div>
        </div>
        <p class="small text-body-secondary mb-2">
          {{ $t('Gespeichert wird der') }} <strong>{{ $t('aktuelle Kartenausschnitt') }}</strong><template v-if="size"> {{ $t('(ca. {0} × {1} km)', [size.width, size.height]) }}</template>{{ $t('. {0}. Meist 5–80 MB.', [DETAIL_LEVELS.find((d) => d.zoom === zoom)?.hint]) }}
        </p>
        <div v-if="tooLarge" class="small text-warning-emphasis mb-2">{{ $t('Der Ausschnitt ist zu groß – bitte etwas näher heranzoomen.') }}</div>
        <button type="button" class="btn btn-primary btn-sm" :disabled="!!busy || tooLarge || !viewBbox" @click="order">
          <i class="bi bi-cloud-arrow-down me-1" aria-hidden="true"></i>{{ $t('Ausschnitt offline speichern') }}
        </button>
      </template>

      <div v-if="busy" class="mt-2">
        <div class="small mb-1"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ busy }}</div>
        <div v-if="progress > 0" class="progress" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100" style="height: 6px">
          <div class="progress-bar" :style="{ width: `${progress * 100}%` }"></div>
        </div>
      </div>
      <div v-if="done" class="small text-success mt-2" role="status">{{ done }}</div>
      <div v-if="error" class="small text-danger mt-2" role="alert">{{ error }}</div>
      <p class="small text-body-secondary mt-2 mb-0">{{ $t('Kartendaten: © OpenStreetMap-Mitwirkende, Protomaps') }}</p>
    </div>
  </section>
</template>

<style scoped>
.flex-none {
  flex: none;
}
.min-w-0 {
  min-width: 0;
}
</style>
