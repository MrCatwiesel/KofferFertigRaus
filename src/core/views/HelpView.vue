<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { APP_CONFIG } from '@/config'
import { HELP_GROUPS, HELP_TOPICS } from '../hilfe/inhalt'
import { searchHelp, topicForRoute } from '../hilfe/suche'
import RichText from '../hilfe/RichText.vue'

const route = useRoute()
const query = ref('')
const found = computed(() => searchHelp(HELP_TOPICS, query.value))
const searching = computed(() => query.value.trim().length > 1)
// Vom „?“ einer Seite gekommen → passendes Thema offen; oder direkt ?thema=<id>
const from = String(route.query.von ?? '')
const current = ref(String(route.query.thema ?? '') || topicForRoute(HELP_TOPICS, from)?.id || '')
const byGroup = computed(() => HELP_GROUPS.map((g) => ({ g, topics: HELP_TOPICS.filter((t) => t.group === g) })))

onMounted(async () => {
  if (!current.value) return
  await nextTick()
  // nach dem Zurücksetzen der Scroll-Position durch den Router
  setTimeout(() => document.getElementById(`hilfe-${current.value}`)?.scrollIntoView({ block: 'start' }), 80)
})
</script>

<template>
  <div class="mb-3">
    <h1 class="h3 mb-0">Hilfe</h1>
    <p class="text-body-secondary small mb-0 on-bg">Kurz erklärt – zum Nachschlagen. Oder gleich die <RouterLink to="/einfuehrung">Einführung</RouterLink> ansehen.</p>
  </div>

  <div class="input-group mb-3">
    <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
    <input v-model="query" type="search" class="form-control" placeholder="Suchen, z. B. Packliste, Server, Fotos …" aria-label="Hilfe durchsuchen" data-help-search />
  </div>

  <template v-if="searching">
    <p v-if="!found.length" class="text-body-secondary on-bg">Nichts gefunden. Anderes Wort versuchen – oder unten nachsehen.</p>
    <div v-for="t in found" :key="t.id" class="card mb-2" data-help-topic>
      <div class="card-body">
        <h2 class="h6"><i :class="`bi bi-${t.icon} me-2 text-primary`" aria-hidden="true"></i>{{ t.title }}</h2>
        <p v-for="(p, i) in t.text" :key="i" class="small mb-2"><RichText :text="p" /></p>
        <ol v-if="t.steps" class="small mb-2"><li v-for="s in t.steps" :key="s"><RichText :text="s" /></li></ol>
        <RouterLink v-for="l in t.links ?? []" :key="l.to" :to="l.to" class="btn btn-sm btn-outline-primary me-2">{{ l.label }}</RouterLink>
      </div>
    </div>
  </template>

  <template v-else>
    <section v-for="{ g, topics } in byGroup" :key="g" class="mb-3">
      <h2 class="h6 text-body-secondary text-uppercase small mb-2 on-bg">{{ g }}</h2>
      <div class="list-group">
        <details v-for="t in topics" :id="`hilfe-${t.id}`" :key="t.id" class="list-group-item" :open="t.id === current" data-help-topic>
          <summary class="fw-semibold"><i :class="`bi bi-${t.icon} me-2 text-primary`" aria-hidden="true"></i>{{ t.title }}</summary>
          <div class="pt-2">
            <p v-for="(p, i) in t.text" :key="i" class="small mb-2"><RichText :text="p" /></p>
            <ol v-if="t.steps" class="small mb-2"><li v-for="s in t.steps" :key="s"><RichText :text="s" /></li></ol>
            <RouterLink v-for="l in t.links ?? []" :key="l.to" :to="l.to" class="btn btn-sm btn-outline-primary me-2 mb-1">{{ l.label }}</RouterLink>
          </div>
        </details>
      </div>
    </section>
  </template>

  <div class="card mb-3">
    <div class="card-body small">
      <i class="bi bi-chat-dots me-1" aria-hidden="true"></i>Fehler gefunden oder einen Wunsch? Gern als „Issue“ im
      <a :href="`${APP_CONFIG.repositoryUrl}/issues`" target="_blank" rel="noopener">Projekt auf GitHub</a>.
    </div>
  </div>
</template>

<style scoped>
summary {
  cursor: pointer;
}
details {
  scroll-margin-top: 5rem;
}
</style>
