import type { SampleTrip } from '@/core/sample'
import { newId } from '@/core/db'
import { pollRepository } from './repository'

/** Beispielreise: eine offene Abstimmung, Ben hat schon gestimmt – Anna fehlt noch */
export async function pollSample(s: SampleTrip): Promise<void> {
  const options = ['Pizzeria am Hafen', 'Trattoria in Tenno', 'Selbst kochen'].map((text) => ({ id: newId(), text }))
  const id = await pollRepository.create(s.tripId, {
    question: 'Wo essen wir heute Abend?',
    kind: 'auswahl',
    options,
    multiple: false,
    deadline: s.today,
    closed: false,
    createdBy: s.participants[1],
    note: ''
  })
  await pollRepository.setVote({ id, tripId: s.tripId }, s.participants[1], [options[1].id])
}
