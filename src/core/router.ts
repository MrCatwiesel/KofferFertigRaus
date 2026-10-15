import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getModules } from './registry'

/** Hilfe: erst die Texte der gewählten Sprache laden, dann die Ansicht (beides nicht im Start-Paket) */
async function helpView() {
  const [{ prepareHelp }, view] = await Promise.all([import('@/help/index'), import('@/help/HelpView.vue')])
  await prepareHelp()
  return view
}

/** Baut den Router aus den Routen aller registrierten Module. */
export function buildRouter() {
  const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/trip' },
    { path: '/einstellungen', name: 'settings', component: () => import('./views/SettingsView.vue') },
    { path: '/einstellungen/sperre', name: 'lock', component: () => import('./views/LockSettings.vue') },
    { path: '/einstellungen/aussehen', name: 'appearance', component: () => import('@/ui/AppearanceView.vue') },
    { path: '/abgleich', name: 'sync', component: () => import('./views/SyncSettings.vue') },
    { path: '/gruppen', name: 'groups', component: () => import('./views/GroupsAdmin.vue') },
    { path: '/personen', name: 'people', component: () => import('./views/PeopleAdmin.vue') },
    { path: '/benachrichtigungen', name: 'push', component: () => import('./views/PushSettings.vue') },
    { path: '/sicherung', name: 'backup-targets', component: () => import('./views/BackupTargets.vue') },
    { path: '/hilfe', name: 'help', component: helpView },
    { path: '/hilfe/:topic', name: 'help-topic', component: helpView, props: true },
    { path: '/willkommen', name: 'intro', component: () => import('@/help/IntroView.vue') },
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
