/**
 * Ton aufnehmen (Sprachnotizen) mit MediaRecorder.
 * iPhone/iPad (Safari) nehmen als audio/mp4 (AAC) auf, Chrome/Firefox als audio/webm (Opus).
 */
import { t } from '@/core/i18n'

/** Längste Aufnahme – danach wird automatisch beendet (≈ 7 MB bei 64 kbit/s) */
export const MAX_SECONDS = 15 * 60

const CANDIDATES = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

/** Erste Tonart, die der Browser aufnehmen kann ('' = Standard des Browsers) */
export function pickMime(isSupported: (t: string) => boolean): string {
  return CANDIDATES.find((t) => isSupported(t)) ?? ''
}

export function canRecord(): boolean {
  return typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
}

/** „1:05“ */
export function formatSeconds(s: number): string {
  const t = Math.max(0, Math.round(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

export interface Recording {
  /** Beenden und Ergebnis holen */
  stop(): Promise<{ blob: Blob; duration: number }>
  /** Abbrechen ohne Ergebnis */
  cancel(): void
  /** Sekunden seit Beginn */
  elapsed(): number
  /** Lautstärke 0…1 (für die Anzeige) */
  level(): number
}

/** Fragt das Mikrofon an und startet die Aufnahme. Wirft eine verständliche Fehlermeldung. */
export async function startRecording(onAutoStop?: () => void): Promise<Recording> {
  if (!canRecord()) throw new Error(t('Dieses Gerät bzw. dieser Browser kann keinen Ton aufnehmen.'))
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (e) {
    const name = (e as Error).name
    throw new Error(
      name === 'NotAllowedError' || name === 'SecurityError'
        ? t('Kein Zugriff aufs Mikrofon. Bitte in den Einstellungen des Geräts erlauben (iPad: Einstellungen → Safari → Mikrofon).')
        : t('Mikrofon nicht verfügbar.')
    )
  }
  const mimeType = pickMime((t) => MediaRecorder.isTypeSupported(t))
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const started = performance.now()
  let ended = 0

  // Pegel für die Anzeige (wenn möglich)
  let analyser: AnalyserNode | null = null
  let audioCtx: AudioContext | null = null
  try {
    audioCtx = new AudioContext()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 512
    audioCtx.createMediaStreamSource(stream).connect(analyser)
  } catch {
    analyser = null
  }
  const buf = new Uint8Array(512)

  const release = () => {
    stream.getTracks().forEach((t) => t.stop())
    void audioCtx?.close().catch(() => undefined)
  }
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()))
  rec.start(1000)
  const timer = setTimeout(() => onAutoStop?.(), MAX_SECONDS * 1000)

  return {
    elapsed: () => ((ended || performance.now()) - started) / 1000,
    level() {
      if (!analyser) return 0
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      return Math.min(1, peak / 100)
    },
    async stop() {
      clearTimeout(timer)
      ended = performance.now()
      if (rec.state !== 'inactive') rec.stop()
      await done
      release()
      const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0]
      return { blob: new Blob(chunks, { type }), duration: Math.round((ended - started) / 100) / 10 }
    },
    cancel() {
      clearTimeout(timer)
      if (rec.state !== 'inactive') rec.stop()
      release()
    }
  }
}
