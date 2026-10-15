// Übersetzen in jeder Vue-Vorlage ohne Import (gesetzt in src/start.ts)
export {}

declare module 'vue' {
  interface ComponentCustomProperties {
    t: typeof import('./index').t
    tn: typeof import('./index').tn
    intlLocale: typeof import('./index').intlLocale
  }
}
