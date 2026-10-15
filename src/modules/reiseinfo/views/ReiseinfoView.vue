<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { countryInfoRepository } from '../repository'
import { refreshTripInfos } from '../refresh'
import { missionName, warningLabel } from '../parse'
import { SOURCE_URL, type CountryInfo, type Mission } from '../types'
import { telHref } from '@/modules/documents/public'
import { t, intlLocale } from '@/i18n'

const tel = (p: string) => telHref(p) ?? undefined

const props = defineProps<{ tripId: string }>()
const online = useOnline()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const infos = useLiveQuery(() => countryInfoRepository.listByTrip(props.tripId), [] as CountryInfo[])
const busy = ref(false)
const message = ref<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null)

const countries = computed(() => trip.value?.countries ?? [])
const infoOf = (c: string) => infos.value.find((i) => i.country === c)

async function refresh(force = true) {
  busy.value = true
  message.value = null
  try {
    const r = await refreshTripInfos(props.tripId, force)
    if (r.errors.length) message.value = { type: 'danger', text: r.errors.join(' · ') }
    else if (r.updated.length) message.value = { type: 'success', text: t('Aktualisiert: {map} – auch in den Dokumenten.', { map: r.updated.map(countryName).join(', ') }) }
    else message.value = { type: 'info', text: t('Alles aktuell – keine Änderungen beim Auswärtigen Amt.') }
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  // Fehlende Länder gleich holen
  const t = await tripRepository.get(props.tripId)
  const have = new Set((await countryInfoRepository.listByTrip(props.tripId)).map((i) => i.country))
  if (online.value && t?.countries?.some((c) => !have.has(c))) await refresh(false)
})

async function seen(i: CountryInfo) {
  if (i.unseenChange) await countryInfoRepository.markSeen(i.id)
}

const mainMissions = (i: CountryInfo) => (i.missions ?? []).filter((m) => m.main)
const honorary = (i: CountryInfo) => (i.missions ?? []).filter((m) => !m.main)
const mapsLink = (m: Mission) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(m.address)}`

const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const badge = (level: string) => (level === 'danger' ? 'text-bg-danger' : level === 'warning' ? 'text-bg-warning' : 'text-bg-success')
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Reisehinweise')" />

  <div v-if="!countries.length" class="alert alert-info">
    {{ t('Noch kein Zielland angegeben.') }} <RouterLink :to="`/trip/${tripId}/bearbeiten`">{{ t('Reise bearbeiten') }}</RouterLink> {{ t('→ „Zielländer“ – danach erscheinen hier Sicherheitslage, Einreisebestimmungen und Impfschutz des Auswärtigen Amts.') }}
  </div>

  <template v-else>
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <button type="button" class="btn btn-outline-primary btn-sm" :disabled="busy || !online" @click="refresh(true)">
        <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>{{ t('Jetzt aktualisieren') }}
      </button>
      <RouterLink :to="`/trip/${tripId}/dokumente`" class="btn btn-outline-secondary btn-sm"><i class="bi bi-folder2-open me-1" aria-hidden="true"></i>{{ t('Zu den Dokumenten') }}</RouterLink>
      <span class="small text-body-secondary">{{ t('Wird automatisch täglich geprüft, wenn du die Reise öffnest.') }}</span>
    </div>
    <div v-if="message" class="alert py-2 small" :class="`alert-${message.type}`">{{ message.text }}</div>

    <section v-for="c in countries" :key="c" class="card mb-3">
      <div class="card-body">
        <h2 class="h5 d-flex flex-wrap align-items-center gap-2">
          <span>{{ flag(c) }} {{ infoOf(c)?.countryName || countryName(c) }}</span>
          <template v-if="infoOf(c)">
            <span class="badge" :class="badge(warningLabel(infoOf(c)!).level)">{{ warningLabel(infoOf(c)!).text }}</span>
            <span v-if="infoOf(c)!.unseenChange" class="badge text-bg-primary">{{ t('geändert') }}</span>
          </template>
        </h2>
        <template v-if="infoOf(c)">
          <p class="small text-body-secondary mb-2">
            {{ t('Stand Auswärtiges Amt: {date} · abgerufen {date2}', { date: date(infoOf(c)!.lastModified), date2: date(infoOf(c)!.fetchedAt) }) }}
            <template v-if="infoOf(c)!.lastChanges"> {{ t('· Letzte Änderung: {infoOf}', { infoOf: infoOf(c)!.lastChanges.slice(0, 160) }) }}</template>
          </p>
          <div v-if="infoOf(c)!.vaccines.length" class="mb-2">
            <span class="small fw-semibold me-1">{{ t('Impfschutz:') }}</span>
            <span v-for="v in infoOf(c)!.vaccines" :key="v.name" class="badge me-1" :class="v.required ? 'text-bg-danger' : 'text-bg-light border'">
              {{ v.name }}{{ v.required ? ' – ' + t('Pflicht') : '' }}
            </span>
          </div>
          <div v-if="infoOf(c)!.missions?.length" class="missions mb-2">
            <div class="small fw-semibold mb-1"><i class="bi bi-bank me-1" aria-hidden="true"></i>{{ t('Deutsche Vertretungen') }}</div>
            <div v-for="m in mainMissions(infoOf(c)!)" :key="m.id" class="mission border rounded p-2 mb-2">
              <div class="fw-semibold">{{ missionName(m) }}</div>
              <div v-if="m.address" class="small"><a :href="mapsLink(m)" target="_blank" rel="noopener">{{ m.address }}</a></div>
              <div class="d-flex flex-wrap gap-2 mt-1">
                <a v-if="m.phone" :href="tel(m.phone)" class="btn btn-sm btn-outline-success"><i class="bi bi-telephone me-1" aria-hidden="true"></i>{{ m.phone }}</a>
                <a v-if="m.emergency" :href="tel(m.emergency)" class="btn btn-sm btn-danger"><i class="bi bi-telephone-plus me-1" aria-hidden="true"></i>{{ t('Notfall: {emergency}', { emergency: m.emergency }) }}</a>
                <a v-if="m.website" :href="m.website" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary"><i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>{{ t('Webseite') }}</a>
              </div>
              <div v-if="m.open" class="small text-body-secondary mt-1 pre">{{ m.open }}</div>
            </div>
            <details v-if="honorary(infoOf(c)!).length" class="small">
              <summary>{{ t('Honorarkonsuln ({honorary})', { honorary: honorary(infoOf(c)!).length }) }}</summary>
              <ul class="list-unstyled mt-1 mb-0">
                <li v-for="m in honorary(infoOf(c)!)" :key="m.id" class="mb-1">
                  <span class="fw-semibold">{{ m.city || missionName(m) }}</span>
                  <template v-if="m.address"> · {{ m.address }}</template>
                  <template v-if="m.phone"> · <a :href="tel(m.phone)">{{ m.phone }}</a></template>
                  <template v-if="m.mail"> · <a :href="`mailto:${m.mail}`">{{ m.mail }}</a></template>
                </li>
              </ul>
            </details>
            <div class="small text-body-secondary">
              <Tx :text="mainMissions(infoOf(c)!).length > 1 ? tk('Botschaften und Honorarkonsuln am Reiseziel stehen auch unter {link}.') : tk('Botschaft und Honorarkonsuln am Reiseziel stehen auch unter {link}.')">
                <template #link><RouterLink :to="`/trip/${tripId}/dokumente?tab=notfall`">{{ t('Notfallnummern') }}</RouterLink></template>
              </Tx>
            </div>
          </div>
          <details v-for="s in infoOf(c)!.sections" :key="s.title" class="info-section" @toggle="seen(infoOf(c)!)">
            <summary class="fw-semibold">{{ s.title }}</summary>
            <div v-for="(p, k) in s.parts" :key="k" class="mt-2">
              <div v-if="p.title" class="small fw-semibold text-body-secondary">{{ p.title }}</div>
              <p class="small mb-1 pre">{{ p.text }}</p>
            </div>
          </details>
        </template>
        <p v-else class="small text-body-secondary mb-0">
          {{ online ? t('Wird abgerufen …') : t('Noch nicht abgerufen – dafür wird Internet benötigt.') }}
        </p>
      </div>
    </section>

    <p class="small text-body-secondary">
      {{ t('Quelle:') }} <a :href="SOURCE_URL" target="_blank" rel="noopener">{{ t('Auswärtiges Amt – Reise- und Sicherheitshinweise') }}</a> {{ t('(OpenData). Angaben ohne Gewähr – kurz vor der Abreise noch einmal aktualisieren. Die Hinweise richten sich an deutsche Staatsangehörige.') }}
    </p>
  </template>
</template>

<style scoped>
.info-section {
  border-top: 1px solid var(--bs-border-color);
  padding: 0.5rem 0;
}
.pre {
  white-space: pre-line;
}
</style>
