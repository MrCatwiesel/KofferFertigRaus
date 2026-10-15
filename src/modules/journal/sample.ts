import type { SampleTrip } from '@/core/sample'
import { journalRepository } from './repository'

/** Beispielreise: zwei Tagebuch-Einträge (einer als Highlight), heute noch leer */
export async function journalSample(s: SampleTrip): Promise<void> {
  const entries = [
    {
      date: s.day(0),
      title: 'Ankunft am See',
      location: 'Riva del Garda',
      mood: 4,
      highlight: false,
      text: 'Am Brenner kurz Stau, sonst gut durchgekommen. Die Ferienwohnung liegt nur ein paar Minuten vom Hafen entfernt. Abends noch am Ufer entlang spaziert – die Berge rund um den See leuchten in der Abendsonne.'
    },
    {
      date: s.day(1),
      title: 'Auf den Monte Baldo',
      location: 'Malcesine',
      mood: 5,
      highlight: true,
      text: 'Früh los nach Malcesine, damit die Schlange an der Seilbahn noch kurz ist. Die Kabine dreht sich auf dem Weg nach oben einmal um sich selbst. Oben Sonne, unten der ganze See. Nach einer kleinen Runde über den Grat gab es Polenta auf der Hütte.'
    }
  ]
  for (const e of entries) await journalRepository.save(s.tripId, undefined, e, [], [], [])
}
