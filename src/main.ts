import { loadLanguage } from './i18n'

// Zuerst die Sprache laden – erst danach laufen die übrigen Module (deren Texte auf Modulebene schon übersetzt werden).
await loadLanguage()
await import('./start')
