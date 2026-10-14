<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { setMeta } from '../meta'
import { canCreateTrips } from '../people'
import { INTRO_SLIDES } from '../hilfe/inhalt'

/** Kurze Einführung: ein paar Seiten zum Durchtippen, jederzeit überspringbar. */
const router = useRouter()
const i = ref(0)
const slide = computed(() => INTRO_SLIDES[i.value])
const last = computed(() => i.value === INTRO_SLIDES.length - 1)

async function done(to: string) {
  await setMeta('einfuehrung.gesehen', true)
  void router.push(to)
}
</script>

<template>
  <div class="intro card mx-auto my-3" data-intro>
    <div class="card-body text-center p-4">
      <div class="d-flex justify-content-end">
        <button type="button" class="btn btn-link btn-sm text-body-secondary" data-intro-skip @click="done('/trip')">Überspringen</button>
      </div>
      <i :class="`bi bi-${slide.icon} display-3 text-primary d-block mb-3`" aria-hidden="true"></i>
      <h1 class="h4" aria-live="polite">{{ slide.title }}</h1>
      <p class="mb-4">{{ slide.text }}</p>

      <div class="d-flex justify-content-center gap-2 mb-4" role="tablist" aria-label="Seiten der Einführung">
        <button v-for="(s, k) in INTRO_SLIDES" :key="k" type="button" class="dot" :class="{ active: k === i }" role="tab" :aria-selected="k === i" :aria-label="`Seite ${k + 1}: ${s.title}`" @click="i = k"></button>
      </div>

      <div class="d-flex justify-content-between gap-2 flex-wrap">
        <button type="button" class="btn btn-outline-secondary" :disabled="i === 0" @click="i--"><i class="bi bi-chevron-left" aria-hidden="true"></i> Zurück</button>
        <button v-if="!last" type="button" class="btn btn-primary" data-intro-next @click="i++">Weiter <i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        <div v-else class="d-flex gap-2 flex-wrap justify-content-end">
          <button type="button" class="btn btn-outline-primary" @click="done('/hilfe')">Zur Hilfe</button>
          <button v-if="canCreateTrips()" type="button" class="btn btn-primary" data-intro-start @click="done('/trip/neu')">Erste Reise planen</button>
          <button v-else type="button" class="btn btn-primary" @click="done('/trip')">Los geht's</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.intro {
  max-width: 34rem;
}
.dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  border: 0;
  padding: 0;
  background: var(--bs-secondary-bg);
  box-shadow: inset 0 0 0 1px var(--bs-border-color);
}
.dot.active {
  background: var(--bs-primary);
}
</style>
