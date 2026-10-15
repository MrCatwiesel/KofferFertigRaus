import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { NOW, activity, localDate, seed, trip } from './helpers'

const med = {
  id: 'm1', tripId: 't1', name: 'Marcumar', kind: 'dauer', person: 'Birgit', dose: '3 mg', unitsPerDose: 1, times: ['18:00'], stockUnits: 20,
  expiryDate: '', prescription: true, handLuggage: true, cooling: false, packed: false, notes: '', createdAt: NOW, updatedAt: NOW
}
const contact = { id: 'c1', tripId: 't1', label: 'Auslandskrankenversicherung', phone: '+49 89 123456', notes: '', createdAt: NOW, updatedAt: NOW }
const running = () => trip({ startDate: localDate(-1), endDate: localDate(3), countries: ['IT'] })

test.describe('Gesundheit & Notfall', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('eintragen, Reiseseite, Notfall-Seite, Notfallpass, PDF, Tagesplan', async ({ page }) => {
    await seed(page, {
      trips: [running()],
      medications: [med],
      emergencyContacts: [contact],
      activities: [activity({ title: 'Trattoria da Nonna', category: 'essen', setting: 'innen', plannedDate: localDate(0) })]
    })

    // Reiter „Gesundheit“ unter Dokumente & Notfall
    await page.goto('/#/trip/t1/dokumente?tab=gesundheit')
    await expect(page.locator('[data-health-person="Marco"]')).toContainText('Noch nichts eingetragen')
    await page.locator('[data-health-edit="Birgit"]').click()
    await page.getByLabel('Penicillin').check()
    await page.getByLabel('Nimmt Blutverdünner').check()
    await page.getByLabel('Diabetes').check()
    await page.locator('#blood-type').selectOption('O+')
    await page.locator('#health-notes').fill('EpiPen in der Handtasche')
    await page.locator('[data-health-save]').click()
    const birgit = page.locator('[data-health-person="Birgit"]')
    await expect(birgit).toContainText('Penicillin')
    await expect(birgit).toContainText('Nimmt Blutverdünner, Diabetes')
    await expect(birgit).toContainText('Blutgruppe 0+')

    // Kachel auf der Reiseseite, Notfall-Knopf in der Kopfzeile (Reise läuft)
    await page.goto('/#/trip/t1')
    await page.reload() // Daten kamen am Dexie vorbei in die Datenbank – die Kopfzeile lädt sie erst neu
    await expect(page.locator('body')).toContainText('Birgit: Penicillin, Nimmt Blutverdünner, Diabetes')
    await page.locator('[data-emergency-button]').click()
    await expect(page).toHaveURL(/#\/trip\/t1\/sos/)
    await expect(page.locator('[data-emergency-button]')).toHaveCount(0) // auf der Notfall-Seite selbst nicht

    // Notfall-Seite: Notruf Italien, Karte auf Italienisch, Medikamente, eigene Nummern
    await expect(page.locator('[data-sos-number="112"]')).toBeVisible()
    const card = page.locator('[data-sos-person="Birgit"]')
    await expect(card.locator('[data-sos-card]')).toContainText('Ho un’allergia a:')
    await expect(card.locator('[data-sos-card]')).toContainText('penicillina')
    await expect(card.locator('[data-sos-card]')).toContainText('Prendo anticoagulanti.')
    await expect(card.locator('[data-sos-card]')).toContainText('Ho il diabete.')
    await expect(card.locator('[data-sos-card]')).toContainText('Gruppo sanguigno: O+')
    await expect(card).toContainText('Ich nehme Blutverdünner.')
    await expect(card.locator('[data-sos-meds]')).toContainText('Marcumar (3 mg)')
    await expect(card).toContainText('EpiPen in der Handtasche')
    await expect(page.locator('[data-sos-person="Marco"]')).toHaveCount(0)
    await expect(page.locator('body')).toContainText('Ohne Angaben: Marco.')
    await expect(page.locator('body')).toContainText('Auslandskrankenversicherung')

    await card.locator('[data-sos-big]').click()
    await expect(page.locator('[data-big]')).toContainText('Prendo anticoagulanti.')
    await page.locator('[data-big]').click()
    await expect(page.locator('[data-big]')).toHaveCount(0)

    // Andere Sprache für die Karte
    await page.locator('select[aria-label="Andere Sprache"]').selectOption('el')
    await expect(card.locator('[data-sos-card]')).toContainText('Παίρνω αντιπηκτικά.')
    await expect(card).toContainText('Pérno antipiktiká.')
    await page.locator('[data-card-lang="it"]').click()

    // Text für den Notfallpass
    await card.locator('[data-copy-pass]').click()
    await expect(card.locator('[data-copy-pass]')).toContainText('Kopiert')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'Allergien: Penicillin\nErkrankungen: Nimmt Blutverdünner, Diabetes\nMedikamente: Marcumar (3 mg)\nBlutgruppe: 0+\nEpiPen in der Handtasche'
    )

    // Notfallkarte als PDF
    await page.locator('[data-card-pdf]').click()
    const download = page.waitForEvent('download')
    await page.locator('[data-card-pdf-share]').click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^notfallkarte-.*\.pdf$/)
    expect(readFileSync((await file.path())!).subarray(0, 5).toString()).toBe('%PDF-')

    // Tagesplan: bei Restaurants der Verweis auf die Allergie-Karte
    await page.goto(`/#/trip/t1/tagesplan?tag=${localDate(0)}`)
    await page.locator('[data-allergy-hint]').click()
    await expect(page).toHaveURL(/#\/trip\/t1\/sprachfuehrer\?sprache=it/)
    await expect(page.locator('[data-allergy-text]')).toContainText('penicillina')

    // Großer Knopf „Notfall“ auf der Reiseseite
    await page.goto('/#/trip/t1')
    await page.locator('[data-quick-sos]').click()
    await expect(page).toHaveURL(/#\/trip\/t1\/sos/)
  })

  test('Übernehmen: Allergien vom Gerät (bis 1.42) und aus der letzten Reise', async ({ page }) => {
    await seed(page, {
      trips: [running(), trip({ id: 't0', title: 'Frühling', startDate: '2026-04-01', endDate: '2026-04-05' })],
      healthProfiles: [
        {
          id: 't0:gesundheit:Marco', tripId: 't0', person: 'Marco', allergens: ['milk'], custom: [], conditions: [], bloodType: 'A+', otherConditions: '', notes: '',
          sharedWith: ['*'], createdAt: NOW, updatedAt: NOW
        }
      ],
      meta: [
        { key: 'sprachfuehrer.allergene', value: ['kiwi'] },
        { key: 'sprachfuehrer.eigene-allergene', value: [{ id: 'k', text: 'Koriander', tr: { it: 'coriandolo' } }] }
      ]
    })
    await page.goto('/#/trip/t1/dokumente?tab=gesundheit')
    await expect(page.locator('[data-device-allergies]')).toContainText('Kiwi, Koriander')
    await page.locator('#takeover-person').selectOption('Birgit')
    await page.locator('[data-device-takeover]').click()
    await expect(page.locator('[data-device-allergies]')).toHaveCount(0)
    await expect(page.locator('[data-health-person="Birgit"]')).toContainText('Kiwi')
    await expect(page.locator('[data-health-person="Birgit"]')).toContainText('Koriander')

    await expect(page.locator('[data-health-previous]')).toContainText('„Frühling“')
    await page.locator('[data-health-previous]').getByRole('button', { name: 'Übernehmen' }).click()
    await expect(page.locator('[data-health-person="Marco"]')).toContainText('Milch')
    await expect(page.locator('[data-health-previous]')).toHaveCount(0)

    // Sprachführer: Auswahl der Person
    await page.goto('/#/trip/t1/sprachfuehrer')
    await page.locator('[data-allergy-person="Birgit"]').click()
    await expect(page.locator('[data-allergy-text]')).toContainText('kiwi, coriandolo')
    await page.locator('[data-allergy-person="Marco"]').click()
    await expect(page.locator('[data-allergy-text]')).toContainText('latte')
  })
})

test.describe('Englisch', () => {
  test.use({ locale: 'en-GB' })
  test('Notfall-Seite für Österreich: Karte auf Deutsch, darunter Englisch', async ({ page }) => {
    await seed(page, {
      trips: [trip({ startDate: localDate(-1), endDate: localDate(3), countries: ['AT'] })],
      healthProfiles: [
        {
          id: 't1:gesundheit:Marco', tripId: 't1', person: 'Marco', allergens: ['peanuts'], custom: [], conditions: ['asthma'], bloodType: 'O-', otherConditions: '', notes: '',
          sharedWith: ['*'], createdAt: NOW, updatedAt: NOW
        }
      ]
    })
    await page.goto('/#/trip/t1/sos')
    await expect(page.locator('[data-sos-number="112"]')).toBeVisible()
    const card = page.locator('[data-sos-person="Marco"]')
    await expect(card.locator('[data-sos-card]')).toContainText('Ich habe eine Allergie gegen:')
    await expect(card.locator('[data-sos-card]')).toContainText('Ich habe Asthma.')
    await expect(card.locator('[data-sos-card]')).toContainText('Blutgruppe: 0-')
    await expect(card).toContainText('I have asthma.')
    await expect(card).toContainText('Blood type: O-')
  })
})
