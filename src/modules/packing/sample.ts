import type { SampleTrip } from '@/core/sample'
import { tripDays } from '@/modules/trip/public'
import { packingRepository } from './repository'
import { draftsFromTemplates } from './logic'
import { TEMPLATES } from './templates'

/** Beispielreise: Grundausstattung, Strand und Auto – fast alles schon eingepackt (die Reise läuft ja) */
export async function packingSample(s: SampleTrip): Promise<void> {
  const tpl = TEMPLATES.filter((t) => ['basis', 'strand', 'auto'].includes(t.id))
  const drafts = draftsFromTemplates(tpl, tripDays(s.startDate, s.endDate), s.participants.length, [], s.participants)
  // Ein paar Dinge bleiben offen, damit man das Abhaken ausprobieren kann
  drafts.forEach((d, i) => (d.packed = i % 7 !== 3))
  await packingRepository.createMany(s.tripId, drafts)
}
