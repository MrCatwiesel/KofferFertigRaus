<script setup lang="ts">
/** Kleine Vorschau eines Designs (Kopfzeile, Titelbild, zwei Kacheln) – mit den Farben des Designs, nicht des aktuellen. */
import { computed } from 'vue'
import { patternCss, type ThemeDef } from './themes'

const props = defineProps<{ theme: ThemeDef; dark: boolean }>()
const p = computed(() => (props.dark ? props.theme.dark : props.theme.light))
const r = computed(() => `${Math.min(props.theme.radius, 1) * 0.55}rem`)
const shadow = computed(() => (props.theme.shadow === 'hard' ? `2px 2px 0 ${p.value.text}` : props.theme.shadow === 'none' ? 'none' : '0 1px 4px rgba(0,0,0,.12)'))
const iconBg = computed(() =>
  props.theme.tile === 'gradient'
    ? `linear-gradient(135deg, ${p.value.primary}, ${p.value.accent})`
    : props.theme.tile === 'solid'
      ? p.value.primary
      : props.theme.tile === 'outline'
        ? 'transparent'
        : `color-mix(in srgb, ${p.value.primary} 15%, transparent)`
)
</script>

<template>
  <div class="tp" :style="{ background: `${patternCss(theme.pattern, p, 1.4, dark)}, ${p.bg}`.replace(/^none, /, ''), color: p.text, fontFamily: theme.body.font }">
    <div class="tp-bar" :style="{ background: p.surface, borderBottom: `${theme.border}px solid ${p.border}` }">
      <span class="tp-dot" :style="{ background: p.primary }"></span>
      <span :style="{ fontFamily: theme.heading.font, fontWeight: theme.heading.weight, textTransform: theme.heading.upper ? 'uppercase' : 'none' }">Nix wie weg</span>
    </div>
    <div class="tp-hero" :style="{ borderRadius: r, background: `linear-gradient(${p.sky2}, ${p.sky1})` }">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <circle cx="74" cy="13" r="5" :fill="p.sun ?? p.accent" />
        <path d="M0 40 L0 24 L14 14 L26 24 L40 10 L56 25 L70 16 L86 26 L100 18 L100 40 Z" :fill="p.far" />
        <path d="M0 40 L0 30 L20 22 L36 31 L54 21 L72 32 L100 26 L100 40 Z" :fill="p.near" />
      </svg>
      <span class="tp-title" :style="{ fontFamily: theme.heading.font, fontWeight: theme.heading.weight, textTransform: theme.heading.upper ? 'uppercase' : 'none' }">Aa Reise</span>
    </div>
    <div class="tp-tiles">
      <div v-for="i in 2" :key="i" class="tp-tile" :style="{ background: p.surface, borderRadius: r, border: `${theme.border}px solid ${p.border}`, boxShadow: shadow }">
        <span class="tp-icon" :style="{ background: iconBg, borderRadius: theme.tile === 'solid' || theme.tile === 'outline' ? '50%' : r, border: theme.tile === 'outline' ? `1.5px solid ${p.primary}` : 'none' }"></span>
        <span class="tp-lines"><span :style="{ background: p.text }"></span><span :style="{ background: p.muted }"></span></span>
      </div>
    </div>
    <div class="tp-btn" :style="{ background: p.primary, color: p.onPrimary, borderRadius: r }">Knopf</div>
  </div>
</template>

<style scoped>
.tp {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 8px;
  overflow: hidden;
  font-size: 10px;
  line-height: 1.2;
  border-radius: 8px;
}
.tp-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  font-size: 10.5px;
}
.tp-dot {
  width: 11px;
  height: 11px;
  border-radius: 3px;
}
.tp-hero {
  position: relative;
  height: 46px;
  margin: 0 7px;
  overflow: hidden;
}
.tp-hero svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.tp-title {
  position: absolute;
  left: 7px;
  bottom: 4px;
  color: #fff;
  font-size: 12px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.tp-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 0 7px;
}
.tp-tile {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px;
}
.tp-icon {
  flex: none;
  width: 14px;
  height: 14px;
}
.tp-lines {
  flex: 1;
  display: grid;
  gap: 3px;
}
.tp-lines span {
  height: 3px;
  border-radius: 2px;
  opacity: 0.8;
}
.tp-lines span:last-child {
  width: 70%;
  opacity: 0.5;
}
.tp-btn {
  align-self: flex-start;
  margin: 0 7px;
  padding: 3px 9px;
  font-weight: 700;
}
</style>
