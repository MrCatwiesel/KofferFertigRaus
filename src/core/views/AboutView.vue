<script setup lang="ts">
import { APP_CONFIG, APP_VERSION } from '@/config'
import AppLogo from '@/ui/AppLogo.vue'
import { t } from '@/i18n'
</script>

<template>
  <div class="d-flex align-items-center gap-3 mb-3">
    <AppLogo :size="44" />
    <h1 class="h3 mb-0">{{ t('Über „{name}“', { name: APP_CONFIG.name }) }}</h1>
  </div>
  <section class="card">
    <div class="card-body">
      <p class="small text-body-secondary">
        {{ t('Version {APP_VERSION} · Freie Software unter der', { APP_VERSION }) }} <a :href="APP_CONFIG.licenseUrl" target="_blank" rel="noopener">{{ APP_CONFIG.license }}</a>{{ t(', entwickelt in der Freizeit. Kostenlos, ohne Werbung, ohne Konto – deine Daten bleiben auf deinen Geräten bzw. deinem eigenen Server.') }}
      </p>
      <div class="d-flex flex-wrap gap-2">
        <a v-if="APP_CONFIG.donationUrl" :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger">
          <i class="bi bi-heart-fill me-1" aria-hidden="true"></i>{{ t('Über {donationLabel} unterstützen', { donationLabel: APP_CONFIG.donationLabel }) }}
        </a>
        <a :href="APP_CONFIG.repositoryUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-github me-1" aria-hidden="true"></i>{{ t('Quellcode') }}
        </a>
      </div>
      <p class="small text-body-secondary mt-3 mb-0">
        {{ t('Dienste: Wetter und Höhen von Open-Meteo.com (CC BY 4.0) · Karten, Adresssuche und Wanderwege © OpenStreetMap-Mitwirkende (ODbL) · Routenplanung BRouter · Offline-Karten Protomaps · Reise- und Sicherheitshinweise © Auswärtiges Amt (OpenData) · Wechselkurse: EZB-Referenzkurse über Frankfurter.') }}
      </p>
    </div>
  </section>
</template>
