import type { SampleTrip } from '@/core/sample'
import { newId } from '@/core/db'
import { pollRepository } from './repository'
import { t } from '@/i18n'

/** Beispielreise: eine offene Abstimmung, Ben hat schon gestimmt – Anna fehlt noch */
export async function pollSample(s: SampleTrip): Promise<void> {
  const options = [t('Pizzeria am Hafen'), t('Trattoria in Tenno'), t('Selbst kochen')].map((text) => ({ id: newId(), text }))
  const id = await pollRepository.create(s.tripId, {
    question: t('Wo essen wir heute Abend?'),
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
