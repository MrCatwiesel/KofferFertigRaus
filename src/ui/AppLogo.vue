<script setup lang="ts">
/** Logo „Nix wie weg“ – Form je Design (Berg, Ortsmarke, Stempel, Kompass), Farben aus den CSS-Variablen. */
import { computed } from 'vue'
import { appearance } from './appearance'
import { getTheme, type LogoKind } from './themes'

const props = withDefaults(defineProps<{ size?: number; kind?: LogoKind }>(), { size: 30, kind: undefined })
const logo = computed(() => props.kind ?? getTheme(appearance.theme).logo)
</script>

<template>
  <!-- Alpin: Gipfel mit Abendsonne im abgerundeten Quadrat -->
  <svg v-if="logo === 'berg'" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="nww-logo">
    <rect width="64" height="64" rx="16" fill="var(--nww-primary)" />
    <circle cx="44" cy="22" r="8" fill="var(--nww-accent)" />
    <path d="M6 50 L24 24 L33 36 L40 28 L58 50 Z" fill="var(--nww-surface)" opacity="0.95" />
    <path d="M24 24 L19.5 30.5 L24 29 L27.5 31.5 Z" fill="var(--nww-primary)" opacity="0.35" />
    <path d="M10 54 H54" stroke="var(--nww-surface)" stroke-width="3" stroke-linecap="round" opacity="0.7" />
  </svg>

  <!-- Modern: Farbverlauf mit Ortsmarke und Flugbahn -->
  <svg v-else-if="logo === 'pin'" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="nww-logo">
    <defs>
      <linearGradient id="nww-logo-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--nww-primary)" />
        <stop offset="1" :stop-color="appearance.theme && getTheme(appearance.theme).gradient ? 'var(--nww-accent)' : 'var(--nww-primary)'" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="20" fill="url(#nww-logo-g)" />
    <path d="M12 46 C 22 30, 34 46, 50 18" fill="none" stroke="var(--nww-on-primary)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 6" />
    <path d="M32 14c-6.6 0-12 5.1-12 11.6C20 34 32 46 32 46s12-12 12-20.4C44 19.1 38.6 14 32 14z" fill="var(--nww-on-primary)" />
    <circle cx="32" cy="25.5" r="4.6" fill="var(--nww-primary)" />
  </svg>

  <!-- Kompass im Quadrat -->
  <svg v-else-if="logo === 'kompass'" :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="nww-logo">
    <rect width="64" height="64" rx="14" fill="var(--nww-primary)" />
    <circle cx="32" cy="32" r="21" fill="none" stroke="var(--nww-on-primary)" stroke-width="2.5" opacity="0.9" />
    <path d="M32 13v4M32 47v4M13 32h4M47 32h4" stroke="var(--nww-on-primary)" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />
    <path d="M32 18 L38 32 L32 46 L26 32 Z" fill="var(--nww-on-primary)" />
    <path d="M32 18 L38 32 L26 32 Z" fill="var(--nww-accent)" />
    <circle cx="32" cy="32" r="2.6" fill="var(--nww-primary)" />
  </svg>

  <!-- Retro: runder Reisestempel mit Sonne und Bergen -->
  <svg v-else :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true" class="nww-logo">
    <circle cx="32" cy="32" r="30" fill="var(--nww-surface)" stroke="var(--nww-text)" stroke-width="3" />
    <circle cx="32" cy="32" r="24" fill="var(--nww-sky-1)" />
    <g stroke="var(--nww-accent)" stroke-width="2.4" stroke-linecap="round">
      <path d="M32 14v5M20 18l3 4M44 18l-3 4M14 28h5M45 28h5" />
    </g>
    <circle cx="32" cy="31" r="7" fill="var(--nww-accent)" />
    <path d="M8.5 40 L22 28 L30 36 L38 27 L55.5 40 A24 24 0 0 1 8.5 40 Z" fill="var(--nww-primary)" />
    <path d="M22 28 L18 31.5 L22 31 L25 33 Z" fill="var(--nww-surface)" />
  </svg>
</template>

<style scoped>
.nww-logo {
  flex: none;
  display: block;
}
</style>
