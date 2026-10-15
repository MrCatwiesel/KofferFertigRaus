import { loadLanguage, t } from '@/i18n'

// Sprache des Betrachters (Gerätesprache bzw. die in der App gewählte) – vor den übrigen Modulen laden
void loadLanguage().then(() => {
  document.title = t('Reise ansehen')
  return import('./viewer')
})
