import { registerModule } from '@/core/registry'
import { tripModule } from './trip'
import { accommodationModule } from './accommodation'
import { activityModule } from './activity'
import { travelModule } from './travel'
import { packingModule } from './packing'
import { medsModule } from './meds'
import { documentsModule } from './documents'
import { dayplannerModule } from './dayplanner'
import { journalModule } from './journal'
import { websiteModule } from './website'
import { expensesModule } from './expenses'
import { mapModule } from './map'
import { piwigoModule } from './piwigo'
import { shareModule } from './share'

/**
 * Liste der aktiven Module. Ein neues Modul:
 *  1. Ordner src/modules/<id>/ nach docs/MODUL-VORLAGE.md anlegen
 *  2. hier importieren und registrieren
 */
export function registerAllModules(): void {
  registerModule(tripModule)
  registerModule(travelModule)
  registerModule(accommodationModule)
  registerModule(activityModule)
  registerModule(packingModule)
  registerModule(medsModule)
  registerModule(documentsModule)
  registerModule(dayplannerModule)
  registerModule(mapModule)
  registerModule(journalModule)
  registerModule(piwigoModule)
  registerModule(expensesModule)
  registerModule(websiteModule)
  registerModule(shareModule)
}
