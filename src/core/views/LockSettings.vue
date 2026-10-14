<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LOCK_TIMEOUTS, biometricAvailable, disableBiometric, enableBiometric, lock, lockNow, removeLock, setLockTimeout, setPin, unlockWithPin, validPin } from '../lock'
import { t } from '@/core/i18n'

const bioPossible = ref(false)
onMounted(async () => (bioPossible.value = await biometricAvailable()))

const pin1 = ref('')
const pin2 = ref('')
const current = ref('')
const changing = ref(false)
const msg = ref<{ type: 'success' | 'danger'; text: string } | null>(null)
const busy = ref(false)

async function save() {
  msg.value = null
  if (!validPin(pin1.value)) return (msg.value = { type: 'danger', text: t('Der Code braucht 4 bis 8 Ziffern.') })
  if (pin1.value !== pin2.value) return (msg.value = { type: 'danger', text: t('Die beiden Eingaben stimmen nicht überein.') })
  if (lock.enabled) {
    // Code ändern: alter Code nötig
    if (!(await unlockWithPin(current.value))) return (msg.value = { type: 'danger', text: t('Bisheriger Code ist falsch.') })
  }
  busy.value = true
  try {
    await setPin(pin1.value)
    msg.value = { type: 'success', text: lock.biometric ? t('Neuer Code gespeichert.') : t('App-Sperre ist eingerichtet.') }
    pin1.value = pin2.value = current.value = ''
    changing.value = false
  } finally {
    busy.value = false
  }
}

async function toggleBio(on: boolean) {
  msg.value = null
  try {
    if (on) {
      await enableBiometric()
      msg.value = { type: 'success', text: t('Face ID / Touch ID ist eingerichtet.') }
    } else disableBiometric()
  } catch (e) {
    msg.value = { type: 'danger', text: t('Ging nicht: {0}', [(e as Error).message]) }
  }
}

async function remove() {
  msg.value = null
  if (!(await removeLock(current.value))) return (msg.value = { type: 'danger', text: t('Code ist falsch.') })
  current.value = ''
  msg.value = { type: 'success', text: t('App-Sperre ist aufgehoben.') }
}
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/einstellungen" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ $t('Einstellungen') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ $t('App-Sperre') }}</h1>
    <p class="small text-body-secondary mb-0 on-bg">{{ $t('Gilt nur für dieses Gerät.') }}</p>
  </div>

  <div v-if="msg" class="alert py-2" :class="`alert-${msg.type}`" role="status">{{ msg.text }}</div>

  <section class="card mb-3">
    <div class="card-body">
      <p class="small text-body-secondary">
        {{ $t('Schützt Ausweis- und Buchungsnummern, Notizen und Fotos vor neugierigen Blicken, wenn jemand das iPad oder Handy in die Hand bekommt. Die Daten selbst sind auf dem Gerät nicht verschlüsselt – für den Schutz bei Verlust zusätzlich die Gerätesperre (Code/Face ID) des iPads nutzen.') }}
      </p>

      <template v-if="!lock.enabled || changing">
        <h2 class="h6">{{ lock.enabled ? $t('Code ändern') : $t('Code festlegen') }}</h2>
        <form class="row g-2" @submit.prevent="save">
          <div v-if="lock.enabled" class="col-12 col-md-4">
            <label for="cur" class="form-label small">{{ $t('Bisheriger Code') }}</label>
            <input id="cur" v-model="current" type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="form-control" />
          </div>
          <div class="col-6 col-md-4">
            <label for="p1" class="form-label small">{{ $t('Neuer Code (4–8 Ziffern)') }}</label>
            <input id="p1" v-model="pin1" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" class="form-control" />
          </div>
          <div class="col-6 col-md-4">
            <label for="p2" class="form-label small">{{ $t('Wiederholen') }}</label>
            <input id="p2" v-model="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" class="form-control" />
          </div>
          <div class="col-12 d-flex gap-2">
            <button type="submit" class="btn btn-primary" :disabled="busy">{{ lock.enabled ? $t('Code ändern') : $t('App-Sperre einschalten') }}</button>
            <button v-if="changing" type="button" class="btn btn-outline-secondary" @click="changing = false">{{ $t('Abbrechen') }}</button>
          </div>
        </form>
      </template>

      <template v-else>
        <div class="d-flex align-items-center gap-2 mb-3 text-success"><i class="bi bi-shield-lock-fill fs-4" aria-hidden="true"></i><strong>{{ $t('App-Sperre ist an') }}</strong></div>

        <div class="mb-3">
          <label for="to" class="form-label small fw-semibold">{{ $t('Sperren') }}</label>
          <select id="to" class="form-select w-auto" :value="lock.timeoutMin" @change="setLockTimeout(Number(($event.target as HTMLSelectElement).value))">
            <option v-for="t in LOCK_TIMEOUTS" :key="t.min" :value="t.min">{{ t.label }}</option>
          </select>
        </div>

        <div class="form-check form-switch mb-1">
          <input id="bio" class="form-check-input" type="checkbox" role="switch" :checked="lock.biometric" :disabled="!bioPossible && !lock.biometric"
                 @change="toggleBio(($event.target as HTMLInputElement).checked)" />
          <label class="form-check-label" for="bio">{{ $t('Mit Face ID / Touch ID entsperren') }}</label>
        </div>
        <p v-if="!bioPossible" class="small text-body-secondary">
          {{ $t('Auf diesem Gerät bzw. in diesem Browser nicht verfügbar. Auf dem iPad/iPhone funktioniert es, wenn die App über „Teilen → Zum Home-Bildschirm“ installiert ist und über https geöffnet wird.') }}
        </p>

        <div class="d-flex flex-wrap gap-2 mt-3">
          <button type="button" class="btn btn-outline-primary" @click="lockNow"><i class="bi bi-lock me-1" aria-hidden="true"></i>{{ $t('Jetzt sperren') }}</button>
          <button type="button" class="btn btn-outline-secondary" @click="changing = true">{{ $t('Code ändern') }}</button>
        </div>

        <hr />
        <form class="d-flex flex-wrap align-items-end gap-2" @submit.prevent="remove">
          <div>
            <label for="rm" class="form-label small">{{ $t('Zum Ausschalten Code eingeben') }}</label>
            <input id="rm" v-model="current" type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="form-control" />
          </div>
          <button type="submit" class="btn btn-outline-danger">{{ $t('App-Sperre ausschalten') }}</button>
        </form>
      </template>
    </div>
  </section>
</template>
