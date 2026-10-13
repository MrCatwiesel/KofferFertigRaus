import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getModules } from './registry'

/** Baut den Router aus den Routen aller registrierten Module. */
export function buildRouter() {
  const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/trip' },
    { path: '/einstellungen', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/einstellungen/aussehen', name: 'appearance', component: () => import('@/ui/AppearanceView.vue') },
    { path: '/abgleich', name: 'sync', component: () => import('./views/SyncSettings.vue') },
    { path: '/gruppen', name: 'groups', component: () => import('./views/GroupsAdmin.vue') },
    { path: '/sicherung', name: 'backup-targets', component: () => import('./views/BackupTargets.vue') },
    { path: '/trip/:tripId/teilen', name: 'share-trip', component: () => import('./views/ShareTrip.vue'), props: true },
    ...getModules().flatMap((m) => m.routes),
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
  return createRouter({
    // Hash-Routing (#/trip): läuft auf jedem einfachen Webserver und in jedem Unterordner,
    // ohne Server-Konfiguration für Neuladen oder Direktlinks.
    history: createWebHashHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 })
  })
}
