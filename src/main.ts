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

// Reihenfolge wichtig: erst Module registrieren, dann Router bauen.
registerAllModules()

// Dark Mode automatisch nach Systemeinstellung
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const applyTheme = () => document.documentElement.setAttribute('data-bs-theme', dark.matches ? 'dark' : 'light')
applyTheme()
dark.addEventListener('change', applyTheme)

createApp(App).use(buildRouter()).mount('#app')

// Geräte-Abgleich im Hintergrund (nur aktiv, wenn eingerichtet)
startAutoSync()
startModules()
