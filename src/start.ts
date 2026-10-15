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
import { startLock } from './core/lock'
import { startPush } from './core/push'
import { intlLocale, t, tk, tn } from './i18n'
import Tx from './i18n/Tx'

// Reihenfolge wichtig: erst Module registrieren, dann Router bauen.
registerAllModules()

// Aussehen: Stil, hell/dunkel (Standard: wie das Gerät) und Hintergrund
startAppearance()
// App-Sperre (Code / Face ID), falls auf diesem Gerät eingerichtet
startLock()

const app = createApp(App)
// Übersetzen in jeder Vorlage ohne Import: {{ t('…') }}
app.config.globalProperties.t = t
app.config.globalProperties.tn = tn
app.config.globalProperties.tk = tk
app.config.globalProperties.intlLocale = intlLocale
// Sätze mit Link/Code darin: <Tx text="… {link} …"><template #link>…</template></Tx>
app.component('Tx', Tx)
const router = buildRouter()
app.use(router).mount('#app')
// Hat sich die Adresse geändert, während die App startete (Sprache laden, erste Seite), dorthin nachziehen –
// der Router hört erst nach der ersten Navigation auf Adresswechsel
void router.isReady().then(() => {
  const wanted = decodeURI(location.hash.replace(/^#/, '')) || '/'
  if (wanted !== decodeURI(router.currentRoute.value.fullPath)) void router.replace(wanted)
})

// Geräte-Abgleich im Hintergrund (nur aktiv, wenn eingerichtet)
startAutoSync()
startModules()
// Push-Benachrichtigungen: Abo dieses Geräts beim Server aktuell halten
void startPush()

// Alter Kachel-Zwischenspeicher (vor 1.27.1 ohne CORS gespeichert, fürs Kartenbild im Reisebericht unbrauchbar)
setTimeout(() => void globalThis.caches?.delete('osm-kacheln').catch(() => false), 10_000)
