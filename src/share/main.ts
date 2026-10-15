import { loadLanguage, t } from '@/i18n'

// Sprache des Betrachters (Gerätesprache bzw. die in der App gewählte) – vor den übrigen Modulen laden
await loadLanguage()
document.title = t('Reise ansehen')
await import('./viewer')
