import type { SampleTrip } from '@/core/sample'
import { contactRepository, documentRepository } from './repository'
import { emptyDocumentDraft } from './logic'

/** Beispielreise: Ausweise, Versicherung und eine eigene Notfallnummer */
export async function documentsSample(s: SampleTrip): Promise<void> {
  const nextYears = (n: number) => `${Number(s.today.slice(0, 4)) + n}-06-30`
  await documentRepository.createMany(s.tripId, [
    ...s.participants.map((p, i) => emptyDocumentDraft({ type: 'ausweis', title: 'Personalausweis', person: p, validUntil: nextYears(3 + i), hasCopy: true, packed: true })),
    emptyDocumentDraft({ type: 'fuehrerschein', title: 'Führerschein', person: s.participants[0], packed: true }),
    emptyDocumentDraft({ type: 'versicherung', title: 'Auslandskrankenversicherung', notes: 'Notruf steht unter Notfallnummern.', hasCopy: true, packed: true })
  ])
  await contactRepository.create(s.tripId, { label: 'Notruf Auslandskrankenversicherung', phone: '+49 000 0000000', notes: 'Beispiel – die echte Nummer steht auf der Versicherungskarte.' })
}
