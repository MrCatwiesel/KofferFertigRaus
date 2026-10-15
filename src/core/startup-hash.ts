/**
 * Adresswechsel während des App-Starts merken (Sprache laden, Module laden, erste Navigation).
 * Der Router hört erst nach seiner ersten Navigation auf Adresswechsel und setzt dabei die
 * ursprüngliche Adresse zurück – wird z. B. ein Link geöffnet, während die App startet, ginge er verloren.
 */
let changed: string | null = null
const onChange = () => (changed = location.hash)

export function watchStartupHash(): void {
  window.addEventListener('hashchange', onChange)
}

/** Nach `router.isReady()`: zuletzt gewünschte Adresse (oder null) – und nicht mehr mithören */
export function takeStartupHash(): string | null {
  window.removeEventListener('hashchange', onChange)
  return changed
}
