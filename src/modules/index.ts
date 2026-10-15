import { registerModule } from '@/core/registry'
import { tripModule } from './trip'
import { accommodationModule } from './accommodation'
import { activityModule } from './activity'
import { travelModule } from './travel'
import { packingModule } from './packing'
import { checklistenModule } from './checklisten'
import { medsModule } from './meds'
import { documentsModule } from './documents'
import { dayplannerModule } from './dayplanner'
import { journalModule } from './journal'
import { websiteModule } from './website'
import { expensesModule } from './expenses'
import { mapModule } from './map'
import { routesModule } from './routes'
import { piwigoModule } from './piwigo'
import { shareModule } from './share'
import { reiseinfoModule } from './reiseinfo'
import { laenderModule } from './laender'
import { sprachfuehrerModule } from './sprachfuehrer'
import { unwetterModule } from './unwetter'
import { abstimmungModule } from './abstimmung'
import { termineModule } from './termine'
import { bookingModule } from './booking'
import { reportModule } from './report'
import { statsModule } from './stats'

/**
 * Liste der aktiven Module. Ein neues Modul:
 *  1. Ordner src/modules/<id>/ nach docs/MODUL-VORLAGE.md anlegen
 *  2. hier importieren und registrieren
 */
export function registerAllModules(): void {
  registerModule(tripModule)
  registerModule(travelModule)
  registerModule(accommodationModule)
  registerModule(bookingModule)
  registerModule(activityModule)
  registerModule(abstimmungModule)
  registerModule(packingModule)
  registerModule(checklistenModule)
  registerModule(medsModule)
  registerModule(reiseinfoModule)
  registerModule(laenderModule)
  registerModule(sprachfuehrerModule)
  registerModule(unwetterModule)
  registerModule(termineModule)
  registerModule(documentsModule)
  registerModule(dayplannerModule)
  registerModule(mapModule)
  registerModule(routesModule)
  registerModule(journalModule)
  registerModule(piwigoModule)
  registerModule(expensesModule)
  registerModule(websiteModule)
  registerModule(reportModule)
  registerModule(statsModule)
  registerModule(shareModule)
}
