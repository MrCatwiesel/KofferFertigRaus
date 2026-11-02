<script setup lang="ts">
/**
 * Kacheln für Gruppen, die sich beim Antippen aus der Kachel heraus öffnen (ab 2.0).
 * Genutzt auf der Reiseseite und in den Einstellungen.
 *
 * - Die geöffnete Gruppe steht in der Adresse (?gruppe=…): „Zurück“ im Browser schließt sie wieder.
 * - Eine Gruppe mit nur einem Eintrag führt direkt dorthin.
 * - Bewegung je nach Einstellung (aus/dezent/stark, siehe effects.css).
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '@/i18n'

export interface ZoomItem {
  id: string
  title: string
  icon: string
  /** Ziel in der App … */
  to?: string
  /** … oder eine Adresse außerhalb (öffnet einen neuen Tab) */
  href?: string
  sub?: string
}
export interface ZoomGroup {
  id: string
  title: string
  icon: string
  color: string
  sub?: string
  items: ZoomItem[]
}

const props = withDefaults(
  defineProps<{
    groups: ZoomGroup[]
    queryKey?: string
    pinned?: string[]
    pinnable?: boolean
    /** Spalten ab Tablet-Breite */
    columns?: 2 | 3 | 4
  }>(),
  { queryKey: 'gruppe', pinned: () => [], pinnable: false, columns: 4 }
)
const emit = defineEmits<{ pin: [id: string] }>()

const route = useRoute()
const router = useRouter()

const openId = computed(() => {
  const q = route.query[props.queryKey]
  return typeof q === 'string' && props.groups.some((g) => g.id === q) ? q : null
})
const open = computed(() => props.groups.find((g) => g.id === openId.value) ?? null)

/** Woher die Gruppe aufzoomt (Mitte der angetippten Kachel) und wo die Ansicht beginnt */
const origin = ref('50% 30%')
const frame = ref({ top: 0, bottom: 0 })
let openedHere = false
let lastTile: HTMLElement | null = null

function measureFrame() {
  const header = document.querySelector('.app-header')?.getBoundingClientRect()
  const nav = document.querySelector('.bottom-nav')
  const navRect = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null
  frame.value = { top: Math.max(0, header?.bottom ?? 0), bottom: navRect ? Math.max(0, window.innerHeight - navRect.top) : 0 }
}

function openGroup(g: ZoomGroup, ev: MouseEvent) {
  const el = ev.currentTarget as HTMLElement
  lastTile = el
  measureFrame()
  const r = el.getBoundingClientRect()
  origin.value = `${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + r.height / 2 - frame.value.top)}px`
  openedHere = true
  void router.push({ query: { ...route.query, [props.queryKey]: g.id } })
}

function close() {
  if (openedHere && window.history.state?.back) router.back()
  else {
    const q = { ...route.query }
    delete q[props.queryKey]
    void router.replace({ query: q })
  }
  openedHere = false
}

const panel = ref<HTMLElement | null>(null)
watch(openId, async (id, old) => {
  if (id) {
    if (!old && !openedHere) {
      measureFrame()
      origin.value = '50% 30%'
    }
    document.documentElement.classList.add('fx-locked')
    await nextTick()
    panel.value?.querySelector<HTMLElement>('h2')?.focus()
  } else {
    document.documentElement.classList.remove('fx-locked')
    openedHere = false
    lastTile?.focus()
  }
}, { immediate: true })
onBeforeUnmount(() => document.documentElement.classList.remove('fx-locked'))

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
const isPinned = (id: string) => props.pinned.includes(id)
</script>

<template>
  <div>
  <div class="zg-grid fx-grid" :class="`zg-cols-${columns}`">
    <template v-for="g in groups" :key="g.id">
      <!-- Nur ein Eintrag: direkt dorthin -->
      <RouterLink v-if="g.items.length === 1 && g.items[0].to" :to="g.items[0].to" class="zg-tile fx-tile" :style="{ '--zg': g.color }" :data-group="g.id">
        <span class="zg-icon"><i :class="`bi bi-${g.icon}`" aria-hidden="true"></i></span>
        <span class="zg-title">{{ g.title }}</span>
        <span v-if="g.sub" class="zg-sub">{{ g.sub }}</span>
      </RouterLink>
      <button v-else type="button" class="zg-tile fx-tile" :style="{ '--zg': g.color }" :data-group="g.id" :aria-expanded="openId === g.id" @click="openGroup(g, $event)">
        <span class="zg-icon"><i :class="`bi bi-${g.icon}`" aria-hidden="true"></i></span>
        <span class="zg-title">{{ g.title }}</span>
        <span v-if="g.sub" class="zg-sub">{{ g.sub }}</span>
        <span class="zg-count">{{ g.items.length }}</span>
      </button>
    </template>
  </div>

  <Teleport to="body">
    <Transition name="fx-zoom">
      <div v-if="open" ref="panel" class="zg-panel fx-panel" role="dialog" :aria-label="open.title"
           :style="{ '--zg': open.color, top: `${frame.top}px`, bottom: `${frame.bottom}px`, transformOrigin: origin }" :data-open-group="open.id" @keydown="onKey">
        <div class="container py-3 py-md-4">
          <div class="d-flex align-items-center gap-3 mb-3">
            <button type="button" class="zg-back" :aria-label="t('Zurück')" data-group-close @click="close">
              <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <span class="zg-icon zg-icon-sm"><i :class="`bi bi-${open.icon}`" aria-hidden="true"></i></span>
            <h2 class="h3 mb-0 zg-panel-title" tabindex="-1">{{ open.title }}</h2>
          </div>
          <div class="zg-items">
            <div v-for="(it, i) in open.items" :key="it.id" class="zg-item fx-item" :style="{ '--fx-i': i }" :data-section="it.id">
              <RouterLink v-if="it.to" :to="it.to" class="zg-link stretched-link">
                <i :class="`bi bi-${it.icon}`" aria-hidden="true"></i>
                <span class="min-w-0">
                  <span class="d-block fw-semibold">{{ it.title }}</span>
                  <span v-if="it.sub" class="d-block small text-body-secondary">{{ it.sub }}</span>
                </span>
              </RouterLink>
              <a v-else :href="it.href" target="_blank" rel="noopener" class="zg-link stretched-link">
                <i :class="`bi bi-${it.icon}`" aria-hidden="true"></i>
                <span class="min-w-0">
                  <span class="d-block fw-semibold">{{ it.title }}</span>
                  <span v-if="it.sub" class="d-block small text-body-secondary">{{ it.sub }}</span>
                </span>
              </a>
              <button v-if="pinnable" type="button" class="zg-pin" :class="{ on: isPinned(it.id) }" :aria-pressed="isPinned(it.id)"
                      :aria-label="isPinned(it.id) ? t('„{title}“ lösen', { title: it.title }) : t('„{title}“ oben anheften', { title: it.title })"
                      :title="isPinned(it.id) ? t('Angeheftet – antippen zum Lösen') : t('Oben anheften')" data-pin @click="emit('pin', it.id)">
                <i class="bi" :class="isPinned(it.id) ? 'bi-star-fill' : 'bi-star'" aria-hidden="true"></i>
              </button>
              <i v-else class="bi bi-chevron-right text-body-secondary zg-chev" aria-hidden="true"></i>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
  </div>
</template>

<style scoped>
.zg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .zg-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .zg-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .zg-grid {
    gap: 1rem;
  }
}
.zg-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  min-height: 8.5rem;
  padding: 1rem;
  color: var(--nww-text);
  text-align: left;
  text-decoration: none;
  background: color-mix(in srgb, var(--zg) 13%, var(--nww-card-bg));
  border: var(--nww-border-width) solid color-mix(in srgb, var(--zg) 25%, var(--nww-border));
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
  cursor: pointer;
}
.zg-tile:hover {
  color: var(--nww-text);
}
.zg-icon {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  font-size: 1.35rem;
  color: #fff;
  background: var(--zg);
  border-radius: 0.8rem;
}
.zg-icon-sm {
  width: 2.2rem;
  height: 2.2rem;
  font-size: 1.1rem;
}
.zg-title {
  font-family: var(--nww-heading-font, inherit);
  font-weight: 700;
  font-size: 1.05rem;
  line-height: 1.2;
}
.zg-sub {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  font-size: 0.85rem;
  color: var(--nww-muted);
  line-height: 1.3;
}
.zg-count {
  position: absolute;
  top: 0.8rem;
  right: 0.9rem;
  min-width: 1.6rem;
  padding: 0.05rem 0.45rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  color: var(--nww-muted);
  background: var(--nww-card-bg);
  border-radius: 999px;
}
.zg-panel {
  position: fixed;
  left: 0;
  right: 0;
  z-index: 1025;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: color-mix(in srgb, var(--zg) 10%, var(--nww-bg, var(--bs-body-bg)));
}
.zg-panel-title {
  outline: none;
}
.zg-back {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.9rem;
  height: 2.9rem;
  font-size: 1.25rem;
  color: var(--nww-text);
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: 50%;
  box-shadow: var(--nww-shadow);
}
.zg-items {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
}
@media (min-width: 768px) {
  .zg-items {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.zg-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4.5rem;
  padding: 0.85rem 1rem;
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
}
.zg-link {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex: 1;
  min-width: 0;
  color: var(--nww-text);
  text-decoration: none;
}
.zg-link > .bi {
  font-size: 1.4rem;
  color: var(--zg);
}
.zg-pin {
  position: relative;
  z-index: 2;
  flex: none;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1.2rem;
  color: var(--nww-muted);
  background: none;
  border: 0;
  border-radius: 50%;
}
.zg-pin.on {
  color: #d99a00;
}
.zg-pin:hover {
  background: rgba(var(--nww-primary-rgb), 0.08);
}
.min-w-0 {
  min-width: 0;
}
</style>

<style>
/* Seite dahinter nicht mitscrollen, solange eine Gruppe offen ist */
html.fx-locked,
html.fx-locked body {
  overflow: hidden;
}
</style>
