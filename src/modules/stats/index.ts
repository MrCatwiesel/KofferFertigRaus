import type { AppModule } from '@/core/registry'
import { t } from '@/i18n'

/** Modul „Statistik“: Reisen in Zahlen und Jahresrückblick (über alle Reisen). */
export const statsModule: AppModule = {
  id: 'stats',
  title: t('Statistik'),
  icon: 'bar-chart',
  order: 90,
  routes: [{ path: '/statistik', name: 'stats', component: () => import('./views/StatsView.vue') }]
}
