<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import { TripContextHeader, tripRepository } from '@/modules/trip/public'
import { PiwigoApi } from '../api'
import { albumNameFor, describeQueue, findAlbumByName, sortAlbums } from '../logic'
import { albumLinkRepository, piwigoPrefs, uploadRepository } from '../repository'
import { processQueue, uploadState } from '../uploader'
import type { PiwigoAlbum, PiwigoStatus } from '../types'
import { t } from '@/core/i18n'

const props = defineProps<{ tripId: string }>()
const online = useOnline()

type State = 'loading' | 'no-sync' | 'no-piwigo' | 'error' | 'ready'
const state = ref<State>('loading')
const message = ref('')
const status = ref<PiwigoStatus | null>(null)
const albums = ref<PiwigoAlbum[]>([])
const parentAlbum = ref<number | null>(null)
const newName = ref('')
const chooseId = ref<number | null>(null)
const busy = ref(false)
const feedback = ref('')
let api: PiwigoApi | null = null

const link = useLiveQuery(() => albumLinkRepository.get(props.tripId), undefined)
const queue = useLiveQuery(() => uploadRepository.listByTrip(props.tripId), [])
const sorted = computed(() => sortAlbums(albums.value))
const errors = computed(() => queue.value.filter((u) => u.status === 'error'))

onMounted(load)

async function load() {
  state.value = 'loading'
  api = await PiwigoApi.fromSync()
  if (!api) return (state.value = 'no-sync')
  const trip = await tripRepository.get(props.tripId)
  newName.value = albumNameFor(trip ?? { title: t('Reise') })
  parentAlbum.value = await piwigoPrefs.parentAlbum()
  if (!online.value) {
    state.value = 'error'
    message.value = t('Offline – Piwigo ist gerade nicht erreichbar. Fotos warten und werden später hochgeladen.')
    return
  }
  const enabled = await api.enabled()
  if (enabled === false) return (state.value = 'no-piwigo')
  try {
    status.value = await api.status()
    albums.value = await api.albums()
    await piwigoPrefs.setEnabled(true)
    state.value = 'ready'
  } catch (e) {
    state.value = 'error'
    message.value = (e as Error).message
  }
}

async function useAlbum(album: PiwigoAlbum) {
  await albumLinkRepository.set(props.tripId, { id: album.id, name: album.name, url: album.url })
  feedback.value = t('Verbunden mit „{0}“.', [album.name])
  void processQueue(true)
}

async function chooseExisting() {
  const album = albums.value.find((a) => a.id === chooseId.value)
  if (album) await useAlbum(album)
}

async function createNew() {
  if (!api || !newName.value.trim()) return
  busy.value = true
  feedback.value = ''
  try {
    await piwigoPrefs.setParentAlbum(parentAlbum.value)
    const same = findAlbumByName(albums.value, newName.value, parentAlbum.value)
    if (same && !confirm(t('Ein Album „{0}“ gibt es schon. Trotzdem ein neues anlegen?', [same.name]))) return useAlbum(same)
    const created = await api.createAlbum(newName.value.trim(), parentAlbum.value)
    albums.value = await api.albums()
    await useAlbum(albums.value.find((a) => a.id === created.id) ?? { id: created.id, name: created.name, parentId: parentAlbum.value, images: 0, totalImages: 0, url: '' })
  } catch (e) {
    feedback.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function setAuto(e: Event) {
  await albumLinkRepository.setAutoUpload(props.tripId, (e.target as HTMLInputElement).checked)
}

async function unlink() {
  if (!confirm(t('Verbindung zum Album lösen? Fotos in Piwigo bleiben erhalten.'))) return
  await albumLinkRepository.remove(props.tripId)
}

async function uploadNow() {
  await uploadRepository.retryNow(props.tripId)
  await processQueue(true)
}

async function discardQueue() {
  if (!confirm(t('Wartende Originalfotos dieser Reise verwerfen? Die verkleinerten Fotos im Tagebuch bleiben.'))) return
  await uploadRepository.removeByTrip(props.tripId)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="$t('Fotos in Piwigo')" />

  <div v-if="state === 'loading'" class="text-center my-5"><span class="spinner-border text-primary" :aria-label="$t('Lädt')"></span></div>

  <div v-else-if="state === 'no-sync'" class="alert alert-info">
    {{ $t('Piwigo läuft über deinen eigenen Abgleich-Server. Richte zuerst den') }}
    <RouterLink to="/abgleich">{{ $t('Geräte-Abgleich') }}</RouterLink> {{ $t('ein.') }}
  </div>

  <div v-else-if="state === 'no-piwigo'" class="alert alert-info">
    {{ $t('Piwigo ist für diese Reisegruppe nicht verfügbar: Entweder ist es auf dem Server noch nicht eingerichtet (') }}<code>NWW_PIWIGO_URL</code>, <code>NWW_PIWIGO_KEY_ID</code>, <code>NWW_PIWIGO_SECRET</code> {{ $t('– Anleitung in') }} <code>server/README.md</code>{{ $t('), oder der Besitzer des Servers hat es für diese Gruppe nicht freigegeben (Einstellungen → Reisegruppen).') }}
  </div>

  <template v-else>
    <div v-if="state === 'error'" class="alert alert-warning d-flex align-items-start gap-2">
      <span class="flex-grow-1">{{ message }}</span>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">{{ $t('Erneut') }}</button>
    </div>
    <p v-else-if="status" class="small text-body-secondary">
      {{ $t('Angemeldet in Piwigo als') }} <strong>{{ status.user }}</strong>.
      <span v-if="!status.admin" class="text-danger">{{ $t('Dieser Benutzer ist kein Administrator – Hochladen und Alben anlegen gehen nur mit einem Administrator-Schlüssel.') }}</span>
    </p>

    <!-- Album der Reise -->
    <section class="card mb-3">
      <div class="card-body">
        <h2 class="h6 card-title"><i class="bi bi-folder2-open me-1" aria-hidden="true"></i>{{ $t('Album dieser Reise') }}</h2>
        <template v-if="link">
          <p class="mb-2">
            <strong>{{ link.albumName }}</strong>
            <a v-if="link.albumUrl" :href="link.albumUrl" target="_blank" rel="noopener" class="ms-2 small">{{ $t('In Piwigo öffnen') }} <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i></a>
          </p>
          <div class="form-check form-switch mb-2">
            <input id="pwg-auto" class="form-check-input" type="checkbox" role="switch" :checked="link.autoUpload" @change="setAuto" />
            <label class="form-check-label" for="pwg-auto">{{ $t('Neue Fotos aus dem Tagebuch automatisch hochladen (Original)') }}</label>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="unlink">{{ $t('Anderes Album wählen') }}</button>
        </template>
        <template v-else>
          <p class="small text-body-secondary">
            {{ $t('Noch kein Album verbunden. Beim ersten Hochladen wird automatisch eines angelegt – oder du legst es hier fest.') }}
          </p>
          <div v-if="state === 'ready'" class="row g-2">
            <div class="col-12 col-md-6">
              <label for="pwg-new" class="form-label small">{{ $t('Neues Album') }}</label>
              <input id="pwg-new" v-model="newName" class="form-control" />
            </div>
            <div class="col-12 col-md-6">
              <label for="pwg-parent" class="form-label small">{{ $t('anlegen in') }}</label>
              <select id="pwg-parent" v-model="parentAlbum" class="form-select">
                <option :value="null">{{ $t('– oberste Ebene –') }}</option>
                <option v-for="a in sorted" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
            </div>
            <div class="col-12">
              <button type="button" class="btn btn-primary btn-sm" :disabled="busy || !newName.trim()" @click="createNew">
                <i class="bi bi-folder-plus me-1" aria-hidden="true"></i>{{ $t('Album anlegen (privat)') }}
              </button>
            </div>
            <div class="col-12 mt-3">
              <label for="pwg-existing" class="form-label small">{{ $t('oder vorhandenes Album verbinden') }}</label>
              <div class="input-group">
                <select id="pwg-existing" v-model="chooseId" class="form-select">
                  <option :value="null">{{ $t('– Album wählen –') }}</option>
                  <option v-for="a in sorted" :key="a.id" :value="a.id">{{ a.name }} ({{ a.images }})</option>
                </select>
                <button type="button" class="btn btn-outline-primary" :disabled="!chooseId" @click="chooseExisting">{{ $t('Verbinden') }}</button>
              </div>
            </div>
          </div>
        </template>
        <div v-if="feedback" class="small mt-2">{{ feedback }}</div>
      </div>
    </section>

    <!-- Warteschlange -->
    <section class="card mb-3">
      <div class="card-body">
        <h2 class="h6 card-title"><i class="bi bi-cloud-upload me-1" aria-hidden="true"></i>{{ $t('Hochladen') }}</h2>
        <p v-if="!queue.length" class="mb-0 text-body-secondary small">{{ $t('Alle Fotos dieses Geräts sind in Piwigo.') }}</p>
        <template v-else>
          <p class="mb-2">{{ describeQueue(queue) }}<span v-if="uploadState.current"> {{ $t('– lade „{0}“ …', [uploadState.current]) }}</span></p>
          <ul v-if="errors.length" class="small text-danger ps-3">
            <li v-for="u in errors.slice(0, 5)" :key="u.id">{{ u.filename }}: {{ u.error }}</li>
          </ul>
          <div class="d-flex gap-2">
            <button type="button" class="btn btn-sm btn-primary" :disabled="uploadState.running || !online" @click="uploadNow">
              <span v-if="uploadState.running" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ $t('Jetzt hochladen') }}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger" :disabled="uploadState.running" @click="discardQueue">{{ $t('Verwerfen') }}</button>
          </div>
        </template>
        <p class="small text-body-secondary mt-2 mb-0">
          {{ $t('Hochgeladen wird das Original vom Gerät, auf dem das Foto hinzugefügt wurde. Im Tagebuch bleibt eine verkleinerte Fassung, damit es auch offline funktioniert. Fotos, die im Tagebuch gelöscht werden, bleiben in Piwigo.') }}
        </p>
      </div>
    </section>
  </template>
</template>
