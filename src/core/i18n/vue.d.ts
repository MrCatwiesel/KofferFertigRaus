import type { t, tn } from './index'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** Übersetzen in Vorlagen (in Skripten: `import { t } from '@/core/i18n'`) */
    $t: typeof t
    $tn: typeof tn
  }
}
export {}
