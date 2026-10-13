import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './ui/theme.css'

import App from './App.vue'
import { registerAllModules } from './modules'
import { buildRouter } from './core/router'
import { startAutoSync } from './core/sync/engine'
import { startModules } from './core/registry'
import { startAppearance } from './ui/appearance'

// Reihenfolge wichtig: erst Module registrieren, dann Router bauen.
registerAllModules()

// Aussehen: Stil, hell/dunkel (Standard: wie das Gerät) und Hintergrund
startAppearance()

createApp(App).use(buildRouter()).mount('#app')

// Geräte-Abgleich im Hintergrund (nur aktiv, wenn eingerichtet)
startAutoSync()
startModules()
