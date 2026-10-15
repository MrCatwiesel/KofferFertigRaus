<script setup lang="ts">
/** Sperrbildschirm: Code eingeben oder Face ID / Touch ID. Liegt über der App (die bleibt im Hintergrund erhalten). */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppLogo from '@/ui/AppLogo.vue'
import { lock, unlockWithBiometric, unlockWithPin } from '../lock'
import { t } from '@/i18n'

const pin = ref('')
const error = ref('')
const shake = ref(false)
const busy = ref(false)
const now = ref(Date.now())
const forgot = ref(false)
const timer = setInterval(() => (now.value = Date.now()), 1000)
onUnmounted(() => clearInterval(timer))

const waitSec = computed(() => Math.max(0, Math.ceil((lock.blockedUntil - now.value) / 1000)))

async function check() {
  if (busy.value || waitSec.value) return
  busy.value = true
  const ok = await unlockWithPin(pin.value)
  busy.value = false
  now.value = Date.now()
  if (!ok) {
    error.value = waitSec.value ? '' : t('Falscher Code')
    shake.value = true
    setTimeout(() => (shake.value = false), 400)
    pin.value = ''
  }
}
function press(d: string) {
  if (waitSec.value || pin.value.length >= 8) return
  error.value = ''
  pin.value += d
  if (pin.value.length === lock.length) void check()
}
function back() {
  pin.value = pin.value.slice(0, -1)
}
async function bio() {
  error.value = ''
  if (!(await unlockWithBiometric())) error.value = t('Nicht erkannt – bitte Code eingeben.')
}
function key(e: KeyboardEvent) {
  if (/^\d$/.test(e.key)) press(e.key)
  else if (e.key === 'Backspace') back()
  else if (e.key === 'Enter' && pin.value.length >= 4) void check()
}
onMounted(() => window.addEventListener('keydown', key))
onUnmounted(() => window.removeEventListener('keydown', key))
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="lock-screen" role="dialog" aria-modal="true" :aria-label="t('App gesperrt')">
    <div class="lock-inner">
      <AppLogo :size="56" class="mx-auto mb-3" />
      <h1 class="h4 mb-1">KofferFertigRaus</h1>
      <p class="text-body-secondary small mb-3">{{ t('Gesperrt – Code eingeben') }}</p>

      <div class="dots mb-2" :class="{ shake }" aria-live="polite" :aria-label="t('{n} von {n2} Ziffern', { n: pin.length, n2: lock.length })">
        <span v-for="i in lock.length" :key="i" class="dot" :class="{ filled: i <= pin.length }"></span>
      </div>
      <div class="msg small mb-2" role="alert">
        <span v-if="waitSec" class="text-danger">{{ t('Zu viele Fehlversuche – bitte {waitSec} s warten.', { waitSec }) }}</span>
        <span v-else-if="error" class="text-danger">{{ error }}</span>
      </div>

      <div class="pad" role="group" :aria-label="t('Ziffern')">
        <button v-for="k in keys" :key="k" type="button" class="pad-key" :disabled="!!waitSec" @click="press(k)">{{ k }}</button>
        <button v-if="lock.biometric" type="button" class="pad-key pad-icon" :aria-label="t('Mit Face ID oder Touch ID entsperren')" @click="bio">
          <i class="bi bi-person-bounding-box" aria-hidden="true"></i>
        </button>
        <span v-else></span>
        <button type="button" class="pad-key" :disabled="!!waitSec" @click="press('0')">0</button>
        <button type="button" class="pad-key pad-icon" :aria-label="t('Löschen')" @click="back"><i class="bi bi-backspace" aria-hidden="true"></i></button>
      </div>

      <button v-if="lock.biometric" type="button" class="btn btn-primary mt-3" @click="bio">
        <i class="bi bi-person-bounding-box me-1" aria-hidden="true"></i>{{ t('Mit Face ID / Touch ID entsperren') }}
      </button>
      <div class="mt-3">
        <button type="button" class="btn btn-link btn-sm" @click="forgot = !forgot">{{ t('Code vergessen?') }}</button>
        <p v-if="forgot" class="small text-body-secondary text-start mx-auto" style="max-width: 22rem">
          {{ t('Der Code lässt sich nicht wiederherstellen. Ausweg: die Daten dieser App auf dem Gerät löschen (iPad/iPhone: App vom Home-Bildschirm entfernen bzw. Einstellungen → Safari → Erweitert → Websitedaten). Mit Geräte-Abgleich kommen alle Reisen danach vom eigenen Server zurück.') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  overflow-y: auto;
  padding: 1.5rem 1rem;
  text-align: center;
  background: var(--nww-bg);
}
.lock-inner {
  width: 100%;
  max-width: 22rem;
}
.dots {
  display: flex;
  justify-content: center;
  gap: 0.8rem;
}
.dot {
  width: 0.9rem;
  height: 0.9rem;
  border: 2px solid var(--nww-primary);
  border-radius: 50%;
}
.dot.filled {
  background: var(--nww-primary);
}
.shake {
  animation: shake 0.35s;
}
@keyframes shake {
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}
.msg {
  min-height: 1.4em;
}
.pad {
  display: grid;
  grid-template-columns: repeat(3, 4.5rem);
  justify-content: center;
  gap: 0.8rem;
}
.pad-key {
  width: 4.5rem;
  height: 4.5rem;
  font-size: 1.6rem;
  color: var(--nww-text);
  background: var(--nww-surface);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: 50%;
  box-shadow: var(--nww-shadow);
}
.pad-key:active {
  background: rgba(var(--nww-primary-rgb), 0.15);
}
.pad-icon {
  font-size: 1.4rem;
}
</style>
