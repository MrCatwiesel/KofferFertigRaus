// Startet den Abgleich-Server für die Klicktests: App aus dist/, Daten in einem frischen Temp-Ordner.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from '../server/server.mjs'

const port = Number(process.argv[2] ?? 8791)
export const KEY = 'klicktest-schluessel-1234567890'
const server = createSyncServer({ keys: [KEY], dataDir: mkdtempSync(join(tmpdir(), 'nww-e2e-')), appDir: join(import.meta.dirname, '..', 'dist') })
server.listen(port, () => console.log(`Klicktest-Server auf ${port}`))
