<script setup lang="ts">
/**
 * Einstellungen (ab 2.0): vier Gruppen, die sich wie auf der Reiseseite aus ihrer Kachel öffnen.
 * Die Seiten selbst sind unverändert – nur der Weg dorthin ist kürzer.
 */
import { computed } from 'vue'
import { APP_CONFIG, APP_VERSION } from '@/config'
import { appearance, EFFECTS } from '@/ui/appearance'
import { getTheme } from '@/ui/themes'
import ZoomGroups, { type ZoomGroup } from '@/ui/ZoomGroups.vue'
import { lock } from '../lock'
import { people } from '../people'
import { syncState } from '../sync/engine'
import { t } from '@/i18n'
import LanguageSelect from '@/i18n/LanguageSelect.vue'

const groups = computed<ZoomGroup[]>(() => {
  const connected = syncState.configured && !syncState.revoked
  return [
    {
      id: 'geraet',
      title: t('Dieses Gerät'),
      icon: 'phone',
      color: '#3d6fd0',
      sub: t('Aussehen, Effekte, Sperre, Benachrichtigungen'),
      items: [
        { id: 'aussehen', title: t('Aussehen & Effekte'), icon: 'palette', to: '/einstellungen/aussehen', sub: t('Design „{name}“ · Effekte: {fx}', { name: getTheme(appearance.theme).label, fx: EFFECTS[appearance.effects].label }) },
        { id: 'sperre', title: t('App-Sperre'), icon: lock.enabled ? 'shield-lock-fill' : 'shield-lock', to: '/einstellungen/sperre', sub: lock.enabled ? (lock.biometric ? t('An · mit Face ID / Touch ID') : t('An')) : t('Aus – mit Code oder Face ID schützen') },
        ...(connected ? [{ id: 'push', title: t('Benachrichtigungen'), icon: 'bell', to: '/benachrichtigungen', sub: t('Erinnerungen, Unwetter, Neues von Mitreisenden') }] : [])
      ]
    },
    {
      id: 'daten',
      title: t('Daten & Sicherung'),
      icon: 'database',
      color: '#3a9a4b',
      sub: t('Datensicherung als Datei, Speicher'),
      items: [{ id: 'daten', title: t('Daten & Sicherung'), icon: 'database', to: '/einstellungen/daten' }]
    },
    {
      id: 'gemeinsam',
      title: t('Gemeinsam reisen'),
      icon: 'people',
      color: '#d07a26',
      sub: connected ? t('Verbunden – Geräte, Personen, Server') : t('Geräte-Abgleich, Personen & Rechte'),
      items: [
        { id: 'abgleich', title: t('Geräte-Abgleich'), icon: 'cloud-arrow-up', to: '/abgleich', sub: t('Server, Geräte, Reisegruppen, Server-Sicherung, Piwigo') },
        ...(connected && people.enabled && people.manager ? [{ id: 'personen', title: t('Personen & Rechte'), icon: 'person-gear', to: '/personen', sub: t('Einladen, Rollen, Zugriff je Reise') }] : [])
      ]
    },
    {
      id: 'hilfe',
      title: t('Hilfe & Info'),
      icon: 'question-circle',
      color: '#7e52c2',
      sub: t('Hilfe, Einführung, Neues, Statistik'),
      items: [
        { id: 'hilfe', title: t('Hilfe'), icon: 'book', to: '/hilfe', sub: t('Anleitungen zu allen Bereichen') },
        { id: 'einfuehrung', title: t('Einführung'), icon: 'mortarboard', to: '/willkommen', sub: t('Kurzer Rundgang, Beispielreise') },
        { id: 'neu', title: t('Was ist neu?'), icon: 'stars', to: '/hilfe/neu', sub: t('Änderungen je Version') },
        { id: 'statistik', title: t('Statistik'), icon: 'bar-chart', to: '/statistik', sub: t('Länder, Kilometer, Reisetage') },
        ...(APP_CONFIG.donationUrl ? [{ id: 'spende', title: t('Unterstützen'), icon: 'heart', href: APP_CONFIG.donationUrl, sub: t('Über {donationLabel}', { donationLabel: APP_CONFIG.donationLabel }) }] : []),
        { id: 'info', title: t('Über die App'), icon: 'info-circle', to: '/einstellungen/info', sub: t('Version {APP_VERSION}, Lizenz, Dienste', { APP_VERSION }) }
      ]
    }
  ]
})
</script>

<template>
  <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
    <h1 class="h3 mb-0">{{ t('Einstellungen') }}</h1>
    <a v-if="APP_CONFIG.donationUrl" :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger" data-donate>
      <i class="bi bi-heart-fill me-1" aria-hidden="true"></i>{{ t('Unterstützen') }}
    </a>
  </div>

  <ZoomGroups :groups="groups" :columns="2" class="mb-4" />

  <section class="card mb-3">
    <div class="card-body">
      <LanguageSelect />
      <div class="form-text">{{ t('Gilt für dieses Gerät. Beim Wechsel lädt die App kurz neu.') }}</div>
    </div>
  </section>
</template>
