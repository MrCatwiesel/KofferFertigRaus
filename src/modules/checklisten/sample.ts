import type { SampleTrip } from '@/core/sample'
import { accommodationRepository } from '@/modules/accommodation/public'
import { checklistRepository } from './repository'
import { checkoutSuggestions, HOME_SUGGESTIONS } from './suggestions'

/** Beispielreise: „zu Hause“ ist erledigt (die Reise läuft schon), das Auschecken aus der Ferienwohnung steht noch an */
export async function checklistSample(s: SampleTrip): Promise<void> {
  await checklistRepository.add(s.tripId, 'zuhause', '', HOME_SUGGESTIONS, true)
  // Die Unterkunft legt ihr Modul an – erst danach ist sie da
  s.after(async () => {
    for (const a of await accommodationRepository.listByTrip(s.tripId))
      if (a.status === 'gebucht') await checklistRepository.add(s.tripId, 'auschecken', a.id, checkoutSuggestions(a.type))
  })
}
