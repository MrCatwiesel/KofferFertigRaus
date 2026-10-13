<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { getDayLinks, type DayLink } from '@/core/registry'
import { todayIso } from '@/core/dates'
import { formatDayShort } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { journalRepository, photoRepository } from '../repository'
import { entriesByDay, excerpt, journalStats, moodOf, orderPhotos } from '../logic'
import { useObjectUrls } from '../composables'
import type { JournalEntry, Photo } from '../types'
import PhotoLightbox from '../components/PhotoLightbox.vue'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const entries = useLiveQuery(() => journalRepository.listByTrip(props.tripId), [] as JournalEntry[])
const photos = useLiveQuery(() => photoRepository.listByTrip(props.tripId), [] as Photo[], { shallow: true })
const thumbs = useObjectUrls(photos, (p) => p.id, (p) => p.thumb)
// Verweise anderer Module je Tag (z. B. die Wanderung des Tages)
const dayLinks = useLiveQuery(() => getDayLinks(props.tripId), [] as DayLink[])
const linksByDay = computed(() => {
  const m = new Map<string, DayLink[]>()
  for (const l of dayLinks.value) m.set(l.date, [...(m.get(l.date) ?? []), l])
  return m
})

const onlyHighlights = ref(false)
const showEmptyDays = ref(true)

const photosByEntry = computed(() => {
  const m = new Map<string, Photo[]>()
  for (const p of photos.value) m.set(p.entryId, [...(m.get(p.entryId) ?? []), p])
  for (const e of entries.value) m.set(e.id, orderPhotos(e.photoIds, m.get(e.id) ?? []))
  return m
})

const days = computed(() => {
  if (!trip.value) return []
  const list = onlyHighlights.value ? entries.value.filter((e) => e.highlight) : entries.value
  return entriesByDay(trip.value.startDate, trip.value.endDate, list).filter(
    (d) => d.entries.length || (showEmptyDays.value && !onlyHighlights.value)
  )
})
const stats = computed(() => journalStats(entries.value, photos.value.length))

const lightbox = ref<{ photos: Photo[]; start: number } | null>(null)

function toggleHighlight(e: JournalEntry) {
  journalRepository.setHighlight(e.id, !e.highlight)
}

async function removeEntry(e: JournalEntry) {
  const n = photosByEntry.value.get(e.id)?.length ?? 0
  const what = `„${e.title || 'Eintrag ohne Titel'}“${n ? ` mit ${n} ${n === 1 ? 'Foto' : 'Fotos'}` : ''}`
  if (!confirm(`${what} löschen? Das lässt sich nicht rückgängig machen.`)) return
  await journalRepository.remove(e.id)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Reisetagebuch" />

  <div v-if="stats.entries" class="d-flex flex-wrap gap-2 small mb-3">
    <span class="badge text-bg-light border"><i class="bi bi-journal-text me-1" aria-hidden="true"></i>{{ stats.entries }} Einträge</span>
    <span class="badge text-bg-light border"><i class="bi bi-images me-1" aria-hidden="true"></i>{{ stats.photos }} Fotos</span>
    <span class="badge text-bg-warning"><i class="bi bi-star-fill me-1" aria-hidden="true"></i>{{ stats.highlights }} Highlights</span>
  </div>

  <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
    <RouterLink :to="`/trip/${tripId}/tagebuch/neu`" class="btn btn-primary">
      <i class="bi bi-pencil-square me-1" aria-hidden="true"></i>Neuer Eintrag
    </RouterLink>
    <div class="form-check form-switch mb-0 ms-auto">
      <input id="hl" v-model="onlyHighlights" class="form-check-input" type="checkbox" role="switch" />
      <label class="form-check-label small" for="hl">Nur Highlights</label>
    </div>
    <div v-if="!onlyHighlights" class="form-check form-switch mb-0">
      <input id="empty" v-model="showEmptyDays" class="form-check-input" type="checkbox" role="switch" />
      <label class="form-check-label small" for="empty">Leere Tage</label>
    </div>
  </div>

  <p v-if="onlyHighlights && days.length === 0" class="text-body-secondary">
    Noch keine Highlights. Markiere die schönsten Einträge mit dem Stern – sie kommen später auf die Reise-Webseite.
  </p>

  <div class="timeline">
    <section v-for="d in days" :key="d.date" class="mb-3">
      <div class="d-flex align-items-baseline gap-2 mb-1">
        <h2 class="h6 mb-0">{{ formatDayShort(d.date) }}</h2>
        <span v-if="d.dayNumber" class="small text-body-secondary">Tag {{ d.dayNumber }}</span>
        <span v-if="d.date === todayIso()" class="badge text-bg-primary">heute</span>
      </div>
      <div v-if="linksByDay.get(d.date)?.length" class="d-flex flex-wrap gap-1 mb-1">
        <RouterLink v-for="l in linksByDay.get(d.date)" :key="l.to" :to="l.to" class="badge rounded-pill text-bg-light border text-decoration-none fw-normal day-link">
          <i :class="`bi bi-${l.icon} me-1`" :style="{ color: l.color }" aria-hidden="true"></i>{{ l.label }}
        </RouterLink>
      </div>

      <RouterLink v-if="d.entries.length === 0" :to="{ path: `/trip/${tripId}/tagebuch/neu`, query: { tag: d.date } }"
                  class="d-block border border-dashed rounded p-2 small text-body-secondary text-decoration-none">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Eintrag schreiben
      </RouterLink>

      <article v-for="e in d.entries" :key="e.id" class="card mb-2">
        <div v-if="photosByEntry.get(e.id)?.length" class="photo-strip">
          <button v-for="(p, i) in photosByEntry.get(e.id)!.slice(0, 4)" :key="p.id" type="button" class="photo-btn"
                  :aria-label="`Foto ${i + 1} groß anzeigen`" @click="lightbox = { photos: photosByEntry.get(e.id)!, start: i }">
            <img :src="thumbs.get(p.id)" :alt="p.caption || ''" loading="lazy" />
            <span v-if="i === 3 && photosByEntry.get(e.id)!.length > 4" class="more">+{{ photosByEntry.get(e.id)!.length - 4 }}</span>
          </button>
        </div>
        <div class="card-body py-2">
          <div class="d-flex justify-content-between gap-2">
            <RouterLink :to="`/trip/${tripId}/tagebuch/${e.id}`" class="fw-semibold text-body text-decoration-none">
              <span v-if="moodOf(e.mood)" class="me-1" :title="moodOf(e.mood)!.label">{{ moodOf(e.mood)!.emoji }}</span>
              {{ e.title || 'Ohne Titel' }}
            </RouterLink>
            <div class="d-flex align-items-start gap-1 flex-none">
              <button type="button" class="btn btn-sm p-0" :aria-label="e.highlight ? 'Highlight entfernen' : 'Als Highlight markieren'"
                      @click="toggleHighlight(e)">
                <i class="bi fs-5" :class="e.highlight ? 'bi-star-fill text-warning' : 'bi-star text-body-secondary'" aria-hidden="true"></i>
              </button>
              <div class="dropdown">
                <button type="button" class="btn btn-sm btn-link text-body-secondary px-1 py-0" data-bs-toggle="dropdown" aria-label="Weitere Aktionen">
                  <i class="bi bi-three-dots-vertical fs-5" aria-hidden="true"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><RouterLink class="dropdown-item" :to="`/trip/${tripId}/tagebuch/${e.id}`"><i class="bi bi-pencil me-2" aria-hidden="true"></i>Bearbeiten</RouterLink></li>
                  <li><button type="button" class="dropdown-item text-danger" @click="removeEntry(e)"><i class="bi bi-trash me-2" aria-hidden="true"></i>Löschen</button></li>
                </ul>
              </div>
            </div>
          </div>
          <div v-if="e.location" class="small text-body-secondary"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ e.location }}</div>
          <p v-if="e.text" class="small mb-0 mt-1">{{ excerpt(e.text) }}</p>
        </div>
      </article>
    </section>
  </div>

  <PhotoLightbox v-if="lightbox" :photos="lightbox.photos" :start="lightbox.start" @close="lightbox = null" />
</template>

<style scoped>
.border-dashed {
  border-style: dashed !important;
}
.photo-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}
.photo-strip:has(.photo-btn:only-child) {
  grid-template-columns: 1fr;
}
.photo-btn {
  position: relative;
  border: 0;
  padding: 0;
  background: var(--bs-secondary-bg);
  aspect-ratio: 1;
  overflow: hidden;
}
.photo-strip:has(.photo-btn:only-child) .photo-btn {
  aspect-ratio: 16 / 9;
}
.photo-btn:first-child {
  border-top-left-radius: var(--bs-card-inner-border-radius);
}
.photo-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-btn .more {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-weight: 600;
  font-size: 1.2rem;
}
.flex-none {
  flex: none;
}
</style>
