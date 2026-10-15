import { loadLanguage } from './i18n'

// Zuerst die Sprache laden – erst danach laufen die übrigen Module (deren Texte auf Modulebene schon übersetzt werden).
// Ohne Top-Level-await: ältere Safari-Versionen kennen es nicht.
void loadLanguage().then(() => import('./start'))
