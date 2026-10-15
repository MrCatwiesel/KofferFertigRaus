<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { APP_VERSION } from '@/config'
import { db } from '@/core/db'
import { compareVersions, headlines, loadChangelog, markSeen, notesSince, seenVersion } from './whats-new'

/** Einmaliger Hinweis nach einem Update: was ist seit der zuletzt gesehenen Version neu? */
const items = ref<string[]>([])
/** Anzahl neuer Versionen seit dem letzten Besuch (0 = kein Hinweis) */
const versions = ref(0)

onMounted(async () => {
  const seen = await seenVersion(APP_VERSION, (await db.trips.count()) > 0)
  if (compareVersions(APP_VERSION, seen) <= 0) return
  const notes = notesSince(await loadChangelog(), seen, 5)
  if (!notes.length) return
  versions.value = notes.length
  items.value = notes.flatMap(headlines).slice(0, 4)
})

function close() {
  versions.value = 0
  void markSeen(APP_VERSION)
}
</script>

<template>
  <div v-if="versions" class="alert alert-success d-flex gap-2 align-items-start" role="status" data-whats-new>
    <i class="bi bi-stars fs-5" aria-hidden="true"></i>
    <div class="flex-grow-1 small">
      <strong>{{ versions > 1 ? t('Neu in Version {version} und davor', { version: APP_VERSION }) : t('Neu in Version {version}', { version: APP_VERSION }) }}{{ items.length ? ':' : '' }}</strong>
      {{ items.join(' · ') }}
      <RouterLink to="/hilfe/neu" class="ms-1" @click="close">{{ t('Mehr erfahren') }}</RouterLink>
    </div>
    <button type="button" class="btn-close" :aria-label="t('Hinweis schließen')" @click="close"></button>
  </div>
</template>
