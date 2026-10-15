<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useOnline } from '@/core/composables'
import { formatDate } from '@/core/format'
import { syncState } from '@/core/sync/engine'
import { ago } from '@/core/sync/logic'
import { TripContextHeader } from '@/modules/trip/public'
import { FONT_GROUPS, TEMPLATE_INFO, websiteRepository } from '@/modules/website/public'
import { ShareApi } from '../api'
import { EXPIRY_OPTIONS, MODE_LABEL, accessLabel, describeShare, emptyShareDraft, shareName, shareState, shareUrl } from '../logic'
import type { ShareDraft, ShareLink, ShareLook, ShareMode } from '../types'
import { t } from '@/i18n'

const props = defineProps<{ tripId: string }>()
const online = useOnline()

type State = 'loading' | 'no-sync' | 'old-server' | 'error' | 'ready'
const state = ref<State>('loading')
const message = ref('')
const links = ref<ShareLink[]>([])
const busy = ref(false)
const created = ref<ShareLink | null>(null)
const copied = ref('')
let api: ShareApi | null = null

const draft = reactive<ShareDraft>(emptyShareDraft())
const ownLook = ref(false)
const look = reactive<ShareLook>({ template: 'klassisch', accent: '#0d6efd', font: 'modern', dark: false, showMood: true, showLocation: true })

const sorted = computed(() => [...links.value].sort((a, b) => b.created.localeCompare(a.created)))

onMounted(load)

async function load() {
  state.value = 'loading'
  api = await ShareApi.fromSync()
  if (!api) return (state.value = 'no-sync')
  const site = await websiteRepository.get(props.tripId)
  if (site) Object.assign(look, { template: site.template, accent: site.accent, font: site.font, dark: site.dark, showMood: site.showMood, showLocation: site.showLocation })
  const info = await api.client.info()
  if (!info) {
    state.value = 'error'
    message.value = online.value ? t('Server nicht erreichbar.') : t('Offline – Lese-Links lassen sich nur mit Verbindung zum Server verwalten.')
    return
  }
  if (!info.shares) return (state.value = 'old-server')
  try {
    links.value = await api.list(props.tripId)
    state.value = 'ready'
  } catch (e) {
    state.value = 'error'
    message.value = (e as Error).message
  }
}

async function create() {
  if (!api) return
  busy.value = true
  message.value = ''
  try {
    const link = await api.create(props.tripId, { ...draft, look: ownLook.value ? { ...look } : null })
    links.value = [link, ...links.value]
    created.value = link
    Object.assign(draft, emptyShareDraft())
  } catch (e) {
    message.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function update(link: ShareLink, patch: Partial<ShareDraft> & { revoked?: boolean }) {
  if (!api) return
  try {
    const fresh = await api.update(link.token, patch)
    links.value = links.value.map((l) => (l.token === link.token ? fresh : l))
  } catch (e) {
    message.value = (e as Error).message
  }
}

async function remove(link: ShareLink) {
  if (!api || !confirm(t('Lese-Link „{shareName}“ endgültig löschen? Wer ihn hat, sieht danach nichts mehr.', { shareName: shareName(link) }))) return
  try {
    await api.remove(link.token)
    links.value = links.value.filter((l) => l.token !== link.token)
    if (created.value?.token === link.token) created.value = null
  } catch (e) {
    message.value = (e as Error).message
  }
}

const urlOf = (link: ShareLink) => (api ? shareUrl(api.server, link.token) : '')

async function copy(link: ShareLink) {
  try {
    await navigator.clipboard.writeText(urlOf(link))
    copied.value = link.token
    setTimeout(() => (copied.value = ''), 2000)
  } catch {
    prompt(t('Link kopieren:'), urlOf(link))
  }
}

async function shareLink(link: ShareLink) {
  try {
    await navigator.share({ title: link.title || t('Unsere Reise'), url: urlOf(link) })
  } catch {
    /* abgebrochen */
  }
}

const canShare = typeof navigator !== 'undefined' && !!navigator.share

function setMode(link: ShareLink, mode: ShareMode) {
  if (link.mode !== mode) void update(link, { mode })
}

async function changePassword(link: ShareLink) {
  const pw = prompt(link.password ? t('Neues Passwort (leer lassen = Passwort entfernen):') : t('Passwort für diesen Link:'))
  if (pw === null) return
  await update(link, { password: pw })
}

async function changeExpiry(link: ShareLink, e: Event) {
  const v = (e.target as HTMLSelectElement).value
  await update(link, { expiresDays: v === '' ? null : Number(v) })
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Für Freunde freigeben')" />

  <p class="text-body-secondary small">
    {{ t('Ein Lese-Link zeigt deine Erlebnisse als schöne Seite – Freunde brauchen weder App noch Schlüssel und können nichts ändern.') }}
    <strong>{{ t('Nie dabei:') }}</strong> {{ t('Planung, Budget, Ausgaben, Reiseapotheke, Dokumente, Notfallnummern und Mitreisende.') }}
  </p>

  <div v-if="state === 'loading'" class="text-center my-5"><span class="spinner-border text-primary" :aria-label="t('Lädt')"></span></div>

  <div v-else-if="state === 'no-sync'" class="alert alert-info">
    <Tx text="Lese-Links laufen über deinen eigenen Server. Richte zuerst den {link} ein."><template #link><RouterLink to="/abgleich">{{ t('Geräte-Abgleich') }}</RouterLink></template></Tx>
  </div>

  <div v-else-if="state === 'old-server'" class="alert alert-warning">
    {{ t('Dein Server kennt noch keine Lese-Links. Bitte dort aktualisieren:') }} <code>/opt/koffer-fertig-raus/server/proxmox/update.sh</code>
  </div>

  <div v-else-if="state === 'error'" class="alert alert-warning d-flex align-items-start gap-2">
    <span class="flex-grow-1">{{ message }}</span>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">{{ t('Erneut') }}</button>
  </div>

  <template v-else>
    <div v-if="syncState.pending" class="alert alert-light border small">
      <i class="bi bi-cloud-arrow-up me-1" aria-hidden="true"></i>
      {{ t('Noch {pending} Änderungen auf diesem Gerät, die nicht auf dem Server sind. Freunde sehen den Stand des Servers – der Abgleich läuft automatisch.', { pending: syncState.pending }) }}
    </div>
    <div v-if="message" class="alert alert-danger">{{ message }}</div>

    <!-- Neu erstellt -->
    <div v-if="created" class="alert alert-success">
      <div class="fw-semibold mb-1"><i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ t('Lese-Link erstellt') }}</div>
      <div class="small text-break mb-2"><code>{{ urlOf(created) }}</code></div>
      <div class="d-flex flex-wrap gap-2">
        <button v-if="canShare" type="button" class="btn btn-sm btn-success" @click="shareLink(created)"><i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>{{ t('Teilen') }}</button>
        <button type="button" class="btn btn-sm btn-outline-success" @click="copy(created)">
          <i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ copied === created.token ? t('Kopiert') : t('Kopieren') }}
        </button>
        <a :href="urlOf(created)" target="_blank" rel="noopener" class="btn btn-sm btn-outline-success"><i class="bi bi-eye me-1" aria-hidden="true"></i>{{ t('Ansehen') }}</a>
      </div>
    </div>

    <!-- Neuer Link -->
    <section class="card mb-3">
      <div class="card-body">
        <h2 class="h6 card-title"><i class="bi bi-link-45deg me-1" aria-hidden="true"></i>{{ t('Neuer Lese-Link') }}</h2>
        <div class="mb-3">
          <span class="form-label d-block small">{{ t('Was sollen Freunde sehen?') }}</span>
          <div class="btn-group w-100" role="group" :aria-label="t('Inhalt')">
            <input id="m-hl" v-model="draft.mode" type="radio" class="btn-check" value="highlights" />
            <label class="btn btn-outline-primary" for="m-hl"><i class="bi bi-star me-1" aria-hidden="true"></i>{{ t('Nur Highlights') }}</label>
            <input id="m-all" v-model="draft.mode" type="radio" class="btn-check" value="journal" />
            <label class="btn btn-outline-primary" for="m-all"><i class="bi bi-journal-richtext me-1" aria-hidden="true"></i>{{ t('Ganzes Tagebuch') }}</label>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-3 mb-3">
          <div class="form-check form-switch mb-0">
            <input id="s-photos" v-model="draft.photos" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label" for="s-photos">{{ t('Fotos zeigen') }}</label>
          </div>
          <div class="form-check form-switch mb-0">
            <input id="s-routes" v-model="draft.routes" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label" for="s-routes">{{ t('Routen zeigen') }} <span class="small text-body-secondary">{{ t('(die dafür freigegebenen)') }}</span></label>
          </div>
          <div class="form-check form-switch mb-0">
            <input id="s-stays" v-model="draft.stays" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label" for="s-stays">{{ t('Unterkünfte zeigen') }}</label>
          </div>
          <div v-if="draft.stays" class="form-check form-switch mb-0">
            <input id="s-staydet" v-model="draft.stayDetails" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label" for="s-staydet">{{ t('mit Adresse und Link') }}</label>
          </div>
          <div class="form-check form-switch mb-0">
            <input id="s-acts" v-model="draft.activities" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label" for="s-acts">{{ t('Unternehmungen zeigen') }}</label>
          </div>
        </div>
        <p class="small text-body-secondary">{{ t('Preise, Buchungsnummern, Budget und Notizen bleiben immer privat.') }}</p>
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-6">
            <label for="s-note" class="form-label small">{{ t('Für wen?') }} <span class="text-body-secondary">{{ t('(nur für dich sichtbar)') }}</span></label>
            <input id="s-note" v-model="draft.note" class="form-control" maxlength="80" :placeholder="t('z. B. Familie, Kollegen')" />
          </div>
          <div class="col-12 col-md-6">
            <label for="s-title" class="form-label small">{{ t('Überschrift') }} <span class="text-body-secondary">{{ t('(optional)') }}</span></label>
            <input id="s-title" v-model="draft.title" class="form-control" maxlength="120" :placeholder="t('wie Reise-Webseite')" />
          </div>
          <div class="col-6">
            <label for="s-pw" class="form-label small">{{ t('Passwort') }} <span class="text-body-secondary">{{ t('(optional)') }}</span></label>
            <input id="s-pw" v-model="draft.password" type="text" class="form-control" autocomplete="off" />
          </div>
          <div class="col-6">
            <label for="s-exp" class="form-label small">{{ t('Gültig') }}</label>
            <select id="s-exp" v-model="draft.expiresDays" class="form-select">
              <option v-for="o in EXPIRY_OPTIONS" :key="o.label" :value="o.days">{{ o.label }}</option>
            </select>
          </div>
        </div>

        <div class="form-check form-switch mb-2">
          <input id="s-look" v-model="ownLook" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="s-look">{{ t('Eigenes Aussehen') }} <span class="small text-body-secondary">{{ t('(sonst wie die Reise-Webseite)') }}</span></label>
        </div>
        <div v-if="ownLook" class="row g-2 mb-3">
          <div class="col-6">
            <label for="s-tpl" class="form-label small">{{ t('Vorlage') }}</label>
            <select id="s-tpl" v-model="look.template" class="form-select form-select-sm">
              <option v-for="(tpl, id) in TEMPLATE_INFO" :key="id" :value="id">{{ tpl.title }}</option>
            </select>
          </div>
          <div class="col-6">
            <label for="s-font" class="form-label small">{{ t('Schrift') }}</label>
            <select id="s-font" v-model="look.font" class="form-select form-select-sm">
              <optgroup v-for="g in FONT_GROUPS" :key="g.group" :label="g.group">
                <option v-for="f in g.fonts" :key="f.id" :value="f.id">{{ f.label }}</option>
              </optgroup>
            </select>
          </div>
          <div class="col-6 d-flex align-items-center gap-2">
            <label for="s-accent" class="form-label small mb-0">{{ t('Farbe') }}</label>
            <input id="s-accent" v-model="look.accent" type="color" class="form-control form-control-color" />
          </div>
          <div class="col-6 d-flex align-items-center">
            <div class="form-check form-switch mb-0">
              <input id="s-dark" v-model="look.dark" class="form-check-input" type="checkbox" role="switch" />
              <label class="form-check-label small" for="s-dark">{{ t('Dunkel') }}</label>
            </div>
          </div>
        </div>

        <button type="button" class="btn btn-primary" :disabled="busy || !online" @click="create">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Link erstellen') }}
        </button>
      </div>
    </section>

    <!-- Vorhandene Links -->
    <h2 class="h6">{{ t('Deine Lese-Links') }}</h2>
    <p v-if="!sorted.length" class="text-body-secondary small">{{ t('Noch keine.') }}</p>
    <div v-for="l in sorted" :key="l.token" class="card mb-2" :class="{ 'opacity-75': shareState(l) !== 'aktiv' }">
      <div class="card-body py-2">
        <div class="d-flex align-items-start gap-2">
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold text-truncate">
              {{ shareName(l) }}
              <span v-if="shareState(l) !== 'aktiv'" class="badge text-bg-secondary ms-1">{{ shareState(l) }}</span>
              <i v-if="l.password" class="bi bi-lock-fill text-body-secondary ms-1" :title="t('Mit Passwort')" :aria-label="t('Mit Passwort')"></i>
            </div>
            <div class="small text-body-secondary">
              {{ describeShare(l) }} · {{ accessLabel(l) }}<span v-if="l.lastAccess">{{ t(', zuletzt {ago}', { ago: ago(l.lastAccess) }) }}</span>
              <span v-if="l.expires"> {{ t('· bis {slice}', { slice: formatDate(l.expires.slice(0, 10)) }) }}</span>
            </div>
          </div>
          <div class="dropdown">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" aria-expanded="false" :aria-label="t('Weitere Aktionen')">
              <i class="bi bi-three-dots" aria-hidden="true"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button type="button" class="dropdown-item" @click="update(l, { photos: !l.photos })">{{ l.photos ? t('Fotos ausblenden') : t('Fotos zeigen') }}</button></li>
              <li><button type="button" class="dropdown-item" @click="update(l, { routes: l.routes === false })">{{ l.routes === false ? t('Routen zeigen') : t('Routen ausblenden') }}</button></li>
              <li><button type="button" class="dropdown-item" @click="update(l, { stays: !l.stays })">{{ l.stays ? t('Unterkünfte ausblenden') : t('Unterkünfte zeigen') }}</button></li>
              <li v-if="l.stays"><button type="button" class="dropdown-item" @click="update(l, { stayDetails: !l.stayDetails })">{{ l.stayDetails ? t('Adresse/Link der Unterkünfte ausblenden') : t('Adresse/Link der Unterkünfte zeigen') }}</button></li>
              <li><button type="button" class="dropdown-item" @click="update(l, { activities: !l.activities })">{{ l.activities ? t('Unternehmungen ausblenden') : t('Unternehmungen zeigen') }}</button></li>
              <li><button type="button" class="dropdown-item" @click="changePassword(l)">{{ l.password ? t('Passwort ändern/entfernen') : t('Passwort setzen') }}</button></li>
              <li>
                <label class="dropdown-item-text small d-block">{{ t('Gültig ab jetzt') }}
                  <select class="form-select form-select-sm mt-1" @change="changeExpiry(l, $event)">
                    <option value="" disabled selected>{{ t('wählen …') }}</option>
                    <option v-for="o in EXPIRY_OPTIONS" :key="o.label" :value="o.days ?? ''">{{ o.label }}</option>
                  </select>
                </label>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <button type="button" class="dropdown-item" @click="update(l, { revoked: !l.revoked })">
                  {{ l.revoked ? t('Wieder freigeben') : t('Zurückziehen (vorübergehend)') }}
                </button>
              </li>
              <li><button type="button" class="dropdown-item text-danger" @click="remove(l)"><i class="bi bi-trash me-1" aria-hidden="true"></i>{{ t('Löschen') }}</button></li>
            </ul>
          </div>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
          <div class="btn-group btn-group-sm" role="group" :aria-label="t('Inhalt von {shareName}', { shareName: shareName(l) })">
            <button v-for="m in (['highlights', 'journal'] as ShareMode[])" :key="m" type="button" class="btn"
                    :class="l.mode === m ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="l.mode === m" @click="setMode(l, m)">
              {{ MODE_LABEL[m] }}
            </button>
          </div>
          <button v-if="canShare" type="button" class="btn btn-sm btn-outline-secondary" @click="shareLink(l)"><i class="bi bi-box-arrow-up" aria-hidden="true"></i><span class="visually-hidden">{{ t('Teilen') }}</span></button>
          <button type="button" class="btn btn-sm btn-outline-secondary" @click="copy(l)">
            <i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ copied === l.token ? t('Kopiert') : t('Kopieren') }}
          </button>
          <a :href="urlOf(l)" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary"><i class="bi bi-eye me-1" aria-hidden="true"></i>{{ t('Ansehen') }}</a>
        </div>
      </div>
    </div>
  </template>
</template>
