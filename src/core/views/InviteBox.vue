<script setup lang="ts">
import { onMounted, ref } from 'vue'
import qrcode from 'qrcode-generator'
import { inviteLink } from '../sync/logic'
import { t, intlLocale } from '@/i18n'

/** Einladung anzeigen: QR-Code, Code zum Abtippen, Teilen. */
const props = defineProps<{ server: string; code: string; expires: string; person?: string; reset?: boolean }>()

const link = ref('')
const svg = ref('')
const copied = ref(false)

/** Adresse, unter der die eingeladene Person die App öffnet: der eigene Server, wenn er die App ausliefert. */
async function appBase(): Promise<string> {
  if (location.origin === new URL(props.server).origin) return location.href
  try {
    const r = await fetch(`${props.server}/api/health`, { cache: 'no-store' })
    if ((await r.json()).appHosted) return `${props.server}/`
  } catch {
    /* dann die aktuelle Adresse */
  }
  return location.href
}

onMounted(async () => {
  link.value = inviteLink(await appBase(), props.server, props.code)
  const qr = qrcode(0, 'M')
  qr.addData(link.value)
  qr.make()
  svg.value = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
})

async function share() {
  const intro = props.person
    ? props.reset
      ? t('{person}, hier kannst du ein neues Passwort für „KofferFertigRaus“ festlegen (gilt einmal, 24 Stunden):', { person: props.person })
      : t('{person}, du bist zu „KofferFertigRaus“ eingeladen (gilt einmal, 24 Stunden):', { person: props.person })
    : t('Einladung zu „KofferFertigRaus“ (gilt einmal, 24 Stunden):')
  const text = t('{intro}\n{link}\nOder in der App unter „Geräte-Abgleich“ eingeben: {code}', { intro, link: link.value, code: props.code })
  try {
    if (navigator.share) await navigator.share({ title: t('KofferFertigRaus – Einladung'), text })
    else {
      await navigator.clipboard.writeText(text)
      copied.value = true
    }
  } catch {
    /* abgebrochen */
  }
}

const until = (iso: string) => new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <div class="border rounded p-3 text-center" data-invite>
    <div v-if="person" class="fw-semibold mb-2">{{ reset ? t('Neues Passwort für {person}', { person }) : t('Einladung für {person}', { person }) }}</div>
    <div class="qr mx-auto mb-2" role="img" :aria-label="t('QR-Code der Einladung')" v-html="svg"></div>
    <div class="small mb-1">{{ t('Mit der Kamera scannen – oder in der App unter „Geräte-Abgleich“ eingeben:') }}</div>
    <div class="fs-4 font-monospace fw-semibold mb-1 user-select-all" data-invite-code>{{ code }}</div>
    <div class="small text-body-secondary mb-2">{{ t('Gilt einmal, bis {until}.', { until: until(expires) }) }}<template v-if="person"> {{ t('Dabei wird das Passwort festgelegt.') }}</template></div>
    <button type="button" class="btn btn-outline-primary btn-sm" @click="share"><i class="bi bi-share me-1" aria-hidden="true"></i>{{ t('Einladung teilen') }}</button>
    <span v-if="copied" class="small text-success ms-2">{{ t('Kopiert') }}</span>
  </div>
</template>

<style scoped>
.qr {
  width: 180px;
  max-width: 100%;
  background: #fff;
  padding: 4px;
  border-radius: 0.5rem;
}
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>
