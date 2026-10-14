<script setup lang="ts">
import { useRoute } from 'vue-router'
import { getNavItems } from '@/core/registry'
import { useOnline } from '@/core/composables'
import { syncState } from '@/core/sync/engine'
import AppLogo from '@/ui/AppLogo.vue'
import LockScreen from '@/core/views/LockScreen.vue'
import { lock } from '@/core/lock'

const navItems = getNavItems()
const online = useOnline()
const route = useRoute()
</script>

<template>
  <LockScreen v-if="lock.locked" />
  <header class="navbar navbar-expand app-header border-bottom sticky-top" :inert="lock.locked">
    <div class="container">
      <RouterLink to="/" class="navbar-brand fw-semibold d-flex align-items-center gap-2">
        <AppLogo :size="30" />{{ $t('Nix wie weg') }}
      </RouterLink>
      <!-- Abgleich-Status (nur wenn eingerichtet) -->
      <RouterLink v-if="syncState.configured" to="/abgleich" class="sync-badge ms-auto me-3 text-decoration-none"
                  :title="syncState.lastError || (syncState.pending ? `${syncState.pending} Änderungen warten` : $t('Abgeglichen'))"
                  :aria-label="$t('Geräte-Abgleich')">
        <i class="bi" :class="syncState.revoked ? 'bi-person-x text-danger' : syncState.running ? 'bi-arrow-repeat text-primary spin' : syncState.lastError ? 'bi-cloud-slash text-warning' : syncState.pending ? 'bi-cloud-arrow-up text-body-secondary' : 'bi-cloud-check text-success'" aria-hidden="true"></i>
        <span v-if="syncState.pending && !syncState.running" class="badge rounded-pill text-bg-secondary">{{ syncState.pending }}</span>
      </RouterLink>
      <!-- Hilfe zur aktuellen Seite -->
      <RouterLink :to="{ path: '/hilfe', query: route.name && route.name !== 'help' ? { von: String(route.name) } : {} }" class="help-link text-decoration-none me-md-3"
                  :class="{ 'ms-auto': !syncState.configured }" :title="$t('Hilfe zu dieser Seite')" :aria-label="$t('Hilfe')" data-help-link>
        <i class="bi bi-question-circle" aria-hidden="true"></i>
      </RouterLink>
      <ul class="navbar-nav d-none d-md-flex">
        <li v-for="item in navItems" :key="item.id" class="nav-item">
          <RouterLink :to="item.to" class="nav-link" active-class="active">
            <i :class="`bi bi-${item.icon} me-1`" aria-hidden="true"></i>{{ item.title }}
          </RouterLink>
        </li>
        <li class="nav-item">
          <RouterLink to="/einstellungen" class="nav-link" active-class="active">
            <i class="bi bi-gear me-1" aria-hidden="true"></i>{{ $t('Einstellungen') }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </header>

  <div v-if="!online" :inert="lock.locked" class="bg-warning-subtle text-warning-emphasis small text-center py-1">
    <i class="bi bi-wifi-off me-1" aria-hidden="true"></i>{{ $t('Offline – alle Daten bleiben verfügbar.') }}
  </div>

  <main class="container py-3 app-main" :inert="lock.locked" :aria-hidden="lock.locked">
    <!-- key: beim Wechsel zu einer anderen Reise neu aufbauen (Abfragen hängen an der Adresse); Reiter (?bereich=) bleiben -->
    <RouterView :key="$route.path" />
  </main>

  <!-- Untere Navigation für das Handy -->
  <nav class="bottom-nav d-md-none border-top" :inert="lock.locked" :aria-label="$t('Hauptnavigation')">
    <RouterLink v-for="item in navItems" :key="item.id" :to="item.to" active-class="active">
      <i :class="`bi bi-${item.icon}`" aria-hidden="true"></i><span>{{ item.title }}</span>
    </RouterLink>
    <RouterLink to="/einstellungen" active-class="active">
      <i class="bi bi-gear" aria-hidden="true"></i><span>{{ $t('Einstellungen') }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.help-link {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--bs-secondary-color);
}
.sync-badge {
  font-size: 1.35rem;
  position: relative;
  line-height: 1;
}
.sync-badge .badge {
  position: absolute;
  top: -0.35rem;
  right: -0.7rem;
  font-size: 0.6rem;
}
.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
