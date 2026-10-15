<script setup lang="ts">
import AppLogo from '@/ui/AppLogo.vue'
import { canCreateTrips } from '@/core/people'
import { installHint } from './platform'
import { useSampleTrip } from './useSampleTrip'

/** Startseite, solange noch keine Reise da ist: erste Schritte statt einer leeren Liste */
const showInstall = installHint() === 'ios'
const { creating, error, create: sample } = useSampleTrip()
</script>

<template>
  <div class="card welcome" data-welcome>
    <div class="card-body p-4">
      <div class="d-flex align-items-center gap-3 mb-3">
        <AppLogo :size="48" />
        <div>
          <h2 class="h4 mb-0">Willkommen!</h2>
          <div class="text-body-secondary">Plane deine erste Reise – oder schau dich erst einmal um.</div>
        </div>
      </div>

      <div class="row g-2">
        <div v-if="canCreateTrips()" class="col-12 col-sm-6">
          <RouterLink to="/trip/neu" class="choice choice-primary" data-welcome-new>
            <i class="bi bi-plus-circle" aria-hidden="true"></i>
            <span><strong>Erste Reise planen</strong><small>Name, Ziel und Zeitraum genügen.</small></span>
          </RouterLink>
        </div>
        <div v-if="canCreateTrips()" class="col-12 col-sm-6">
          <button type="button" class="choice" :disabled="creating" data-welcome-sample @click="sample">
            <span v-if="creating" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <i v-else class="bi bi-suitcase2" aria-hidden="true"></i>
            <span><strong>Beispielreise ansehen</strong><small>Eine fertige Reise zum Ausprobieren.</small></span>
          </button>
        </div>
        <div class="col-12 col-sm-6">
          <RouterLink to="/willkommen" class="choice" data-welcome-intro>
            <i class="bi bi-play-circle" aria-hidden="true"></i>
            <span><strong>Kurze Einführung</strong><small>Was kann die App? In einer Minute.</small></span>
          </RouterLink>
        </div>
        <div class="col-12 col-sm-6">
          <RouterLink to="/abgleich" class="choice">
            <i class="bi bi-cloud-arrow-down" aria-hidden="true"></i>
            <span><strong>Schon Reisen auf einem anderen Gerät?</strong><small>Mit deinem Server verbinden – oder unter Einstellungen eine Sicherung einlesen.</small></span>
          </RouterLink>
        </div>
      </div>

      <div v-if="error" class="alert alert-danger mt-3 mb-0">{{ error }}</div>

      <div v-if="showInstall" class="alert alert-info small mt-3 mb-0 d-flex gap-2" data-welcome-install>
        <i class="bi bi-phone" aria-hidden="true"></i>
        <span>Tipp: In Safari über <strong>Teilen → Zum Home-Bildschirm</strong> wird KofferFertigRaus zur App – dann bleiben die Daten zuverlässig erhalten. <RouterLink to="/hilfe/installieren">Mehr dazu</RouterLink></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.choice {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  padding: 0.8rem 0.9rem;
  text-align: left;
  text-decoration: none;
  color: var(--nww-text);
  background: transparent;
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: var(--nww-radius);
  transition: background 0.15s ease;
}
.choice:hover:not(:disabled) {
  background: rgba(var(--nww-primary-rgb), 0.06);
}
.choice > .bi,
.choice > .spinner-border {
  flex: none;
  font-size: 1.4rem;
  color: var(--nww-primary);
}
.choice > .spinner-border {
  margin: 0.25rem;
}
.choice small {
  display: block;
  color: var(--nww-muted);
}
.choice-primary {
  border-color: var(--nww-primary);
  background: rgba(var(--nww-primary-rgb), 0.06);
}
</style>
