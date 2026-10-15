<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { APP_VERSION } from '@/config'
import { canCreateTrips } from '@/core/people'
import { helpContent } from './index'
import { renderMarkdown } from './markdown'
import { searchTopics, topicForRoute } from './logic'
import { loadChangelog, markSeen, type ReleaseNote } from './whats-new'
import { useSampleTrip } from './useSampleTrip'

const props = defineProps<{ topic?: string }>()
const router = useRouter()
const route = useRoute()
const content = helpContent()

// Vom „?“ der Kopfzeile: #/hilfe?seite=<Routen-Name> → passendes Thema (die Texte lädt erst diese Seite)
const fromPage = typeof route.query.seite === 'string' ? topicForRoute(content, route.query.seite) : undefined
if (fromPage) void router.replace(`/hilfe/${fromPage.id}`)

const query = ref('')
const current = computed(() => (props.topic ? content.topics.find((t) => t.id === props.topic) : undefined))
const hits = computed(() => searchTopics(content, query.value))
const html = computed(() => (current.value ? renderMarkdown(current.value.body) : ''))
const groups = computed(() =>
  content.groups.map((g) => ({ ...g, topics: content.topics.filter((t) => t.group === g.id) })).filter((g) => g.topics.length)
)
/** Weitere Themen aus demselben Bereich */
const related = computed(() => (current.value ? content.topics.filter((t) => t.group === current.value!.group && t.id !== current.value!.id) : []))
const groupTitle = computed(() => content.groups.find((g) => g.id === current.value?.group)?.title ?? '')

// ---- Was ist neu (Thema „neu“) ----
const notes = ref<ReleaseNote[] | null>(null)
const showAll = ref(false)
const shownNotes = computed(() => (notes.value ?? []).slice(0, showAll.value ? 40 : 5))
onMounted(async () => {
  if (props.topic !== 'neu') return
  notes.value = await loadChangelog()
  await markSeen(APP_VERSION)
})

// ---- Beispielreise ----
const { creating, error, create: sample } = useSampleTrip()

/** Zurück zur Seite, von der das „?“ kam – sonst zur Übersicht */
function back() {
  if (window.history.state?.back) router.back()
  else router.push('/hilfe')
}
</script>

<template>
  <!-- Ein Thema -->
  <article v-if="current" class="help-page" data-help-topic>
    <nav class="mb-2 small" :aria-label="t('Pfad')">
      <button type="button" class="btn btn-link btn-sm px-0 text-decoration-none" @click="back">
        <i class="bi bi-chevron-left" aria-hidden="true"></i>{{ t('Zurück') }}
      </button>
      <span class="text-body-secondary mx-1 on-bg">·</span>
      <RouterLink to="/hilfe" class="text-decoration-none">{{ t('Hilfe') }}</RouterLink>
      <span class="text-body-secondary on-bg"> › {{ groupTitle }}</span>
    </nav>
    <div class="card">
      <div class="card-body help-body">
        <h1 class="h3 d-flex align-items-center gap-2 mb-3">
          <i :class="`bi bi-${current.icon} text-primary`" aria-hidden="true"></i>{{ current.title }}
        </h1>

        <template v-if="current.id === 'neu'">
          <p class="text-body-secondary small">{{ t('Du nutzt Version {APP_VERSION}.', { APP_VERSION }) }}</p>
          <div v-if="!notes" class="text-body-secondary small"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Lade …') }}</div>
          <section v-for="n in shownNotes" :key="n.version" class="release" data-release>
            <h2 class="h5 mb-1">{{ t('Version {version}', { version: n.version }) }}</h2>
            <div class="small text-body-secondary mb-2">{{ n.label }}</div>
            <div v-html="renderMarkdown(n.body)"></div>
          </section>
          <button v-if="notes && notes.length > 5 && !showAll" type="button" class="btn btn-sm btn-outline-secondary" @click="showAll = true">{{ t('Ältere Versionen zeigen') }}</button>
        </template>
        <div v-else v-html="html"></div>
      </div>
    </div>

    <section v-if="related.length" class="mt-4">
      <h2 class="h6 text-body-secondary text-uppercase small on-bg">{{ t('Mehr zu „{groupTitle}“', { groupTitle }) }}</h2>
      <div class="d-flex flex-wrap gap-2">
        <RouterLink v-for="topic in related" :key="topic.id" :to="`/hilfe/${topic.id}`" class="btn btn-sm btn-outline-primary">
          <i :class="`bi bi-${topic.icon} me-1`" aria-hidden="true"></i>{{ topic.title }}
        </RouterLink>
      </div>
    </section>
  </article>

  <!-- Übersicht -->
  <div v-else-if="!topic && !fromPage">
    <h1 class="h3 mb-3">{{ t('Hilfe') }}</h1>

    <div class="input-group mb-3">
      <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
      <input v-model="query" type="search" class="form-control" :placeholder="t('Suchen, z. B. Packliste, offline, Fotos …')" :aria-label="t('Hilfe durchsuchen')" data-help-search />
    </div>

    <!-- Suchergebnisse -->
    <template v-if="query.trim().length >= 2">
      <div v-if="hits.length" class="list-group mb-4" data-help-hits>
        <RouterLink v-for="h in hits" :key="h.topic.id" :to="`/hilfe/${h.topic.id}`" class="list-group-item list-group-item-action d-flex gap-3">
          <i :class="`bi bi-${h.topic.icon} fs-5 text-primary`" aria-hidden="true"></i>
          <span class="min-w-0">
            <span class="d-block fw-semibold">{{ h.topic.title }}</span>
            <span class="d-block small text-body-secondary">{{ h.snippet || h.topic.summary }}</span>
          </span>
        </RouterLink>
      </div>
      <div v-else class="card card-body text-body-secondary mb-4">
        {{ t('Nichts gefunden. Versuch ein anderes Wort – oder schau unten in den Bereichen.') }}
      </div>
    </template>

    <template v-else>
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <RouterLink to="/willkommen" class="card h-100 text-decoration-none text-body start-card">
            <div class="card-body">
              <i class="bi bi-play-circle fs-3 text-primary" aria-hidden="true"></i>
              <div class="fw-semibold mt-1">{{ t('Einführung') }}</div>
              <div class="small text-body-secondary">{{ t('In einer Minute: was die App kann und wie es losgeht.') }}</div>
            </div>
          </RouterLink>
        </div>
        <div v-if="canCreateTrips()" class="col-12 col-md-4">
          <button type="button" class="card h-100 w-100 text-start text-body start-card" :disabled="creating" data-sample-button @click="sample">
            <div class="card-body">
              <i class="bi bi-suitcase2 fs-3 text-primary" aria-hidden="true"></i>
              <div class="fw-semibold mt-1">
                {{ t('Beispielreise anlegen') }}<span v-if="creating" class="spinner-border spinner-border-sm ms-2" aria-hidden="true"></span>
              </div>
              <div class="small text-body-secondary">{{ t('Eine fertige Reise an den Gardasee zum Ausprobieren – mit einem Tipp wieder weg.') }}</div>
            </div>
          </button>
        </div>
        <div class="col-12 col-md-4">
          <RouterLink to="/hilfe/neu" class="card h-100 text-decoration-none text-body start-card">
            <div class="card-body">
              <i class="bi bi-stars fs-3 text-primary" aria-hidden="true"></i>
              <div class="fw-semibold mt-1">{{ t('Was ist neu?') }}</div>
              <div class="small text-body-secondary">{{ t('Version {APP_VERSION} und die Neuerungen davor.', { APP_VERSION }) }}</div>
            </div>
          </RouterLink>
        </div>
      </div>
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <section v-for="g in groups" :key="g.id" class="mb-4" :data-help-group="g.id">
        <h2 class="h6 text-body-secondary text-uppercase small mb-2 on-bg">
          <i :class="`bi bi-${g.icon} me-1`" aria-hidden="true"></i>{{ g.title }}
        </h2>
        <div class="list-group">
          <RouterLink v-for="topic in g.topics" :key="topic.id" :to="`/hilfe/${topic.id}`" class="list-group-item list-group-item-action d-flex align-items-center gap-3">
            <i :class="`bi bi-${topic.icon} fs-5 text-primary`" aria-hidden="true"></i>
            <span class="flex-grow-1 min-w-0">
              <span class="d-block fw-semibold">{{ topic.title }}</span>
              <span class="d-block small text-body-secondary">{{ topic.summary }}</span>
            </span>
            <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
          </RouterLink>
        </div>
      </section>
    </template>
  </div>

  <!-- Unbekanntes Thema (alter Link) -->
  <div v-else-if="topic" class="card card-body">
    <p class="mb-2">{{ t('Dieses Hilfe-Thema gibt es nicht (mehr).') }}</p>
    <div><RouterLink to="/hilfe" class="btn btn-outline-primary btn-sm">{{ t('Zur Hilfe-Übersicht') }}</RouterLink></div>
  </div>
</template>

<style scoped>
.start-card {
  border: var(--nww-border-width) solid var(--nww-border);
  transition: transform 0.15s ease;
}
button.start-card {
  background: var(--bs-card-bg);
}
.start-card:hover:not(:disabled) {
  transform: translateY(-2px);
}
.min-w-0 {
  min-width: 0;
}
.release + .release {
  border-top: 1px solid var(--nww-border);
  padding-top: 1rem;
  margin-top: 1rem;
}
</style>

<style>
/* Für den per v-html eingesetzten Hilfetext (scoped greift dort nicht) */
.help-body {
  line-height: 1.6;
  max-width: 46rem;
}
.help-body h2,
.help-body h3 {
  font-size: 1.1rem;
  margin-top: 1.4rem;
  margin-bottom: 0.5rem;
}
.help-body h4 {
  font-size: 1rem;
  margin-top: 1rem;
}
.help-body ul,
.help-body ol {
  padding-left: 1.3rem;
}
.help-body li {
  margin-bottom: 0.25rem;
}
.help-body code {
  color: inherit;
  background: var(--nww-surface-2, rgba(0, 0, 0, 0.05));
  padding: 0.05rem 0.3rem;
  border-radius: 0.3rem;
}
.help-body .help-tip {
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  margin: 0.8rem 0;
  border-radius: var(--nww-radius, 0.5rem);
  background: rgba(var(--nww-primary-rgb, 47, 93, 80), 0.08);
  border-left: 3px solid var(--nww-primary, #2f5d50);
}
.help-body .help-tip .bi {
  color: var(--nww-primary, #2f5d50);
}
</style>
