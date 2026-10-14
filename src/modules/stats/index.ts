import type { AppModule } from '@/core/registry'
import { N_ } from '@/core/i18n'

/** Modul „Statistik“: Reisen in Zahlen und Jahresrückblick (über alle Reisen). */
export const statsModule: AppModule = {
  id: 'stats',
  title: N_('Statistik'),
  icon: 'bar-chart',
  order: 90,
  routes: [{ path: '/statistik', name: 'stats', component: () => import('./views/StatsView.vue') }]
}
