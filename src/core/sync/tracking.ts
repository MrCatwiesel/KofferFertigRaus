import type { DBCore, DBCoreMutateRequest, DBCoreTable, Middleware } from 'dexie'

/** Ein geänderter Datensatz, der beim nächsten Abgleich hochgeladen werden muss. */
export interface ChangedKey {
  tbl: string
  id: string
}

/** Zähler für Abgleich-Schreibvorgänge, die NICHT erneut protokolliert werden dürfen. */
let remoteDepth = 0

/** Führt `fn` als Abgleich-Schreibvorgang aus (Änderungen vom Server werden nicht zurückgeschickt). */
export async function asRemote<T>(fn: () => Promise<T>): Promise<T> {
  remoteDepth++
  try {
    return await fn()
  } finally {
    remoteDepth--
  }
}

/** Markiert eine laufende IndexedDB-Transaktion als Abgleich (genauer als der globale Zähler). */
export function markRemote(idbtrans: unknown): void {
  if (idbtrans && typeof idbtrans === 'object') (idbtrans as Record<string, unknown>).__nwwRemote = true
}

/**
 * Nur die markierte Transaktion gilt als Abgleich. (Früher galt zusätzlich jede Transaktion während eines Abgleichs –
 * dadurch wurden eigene Änderungen in diesem Moment nie hochgeladen.)
 */
function isRemote(trans: unknown): boolean {
  return !!trans && typeof trans === 'object' && (trans as Record<string, unknown>).__nwwRemote === true
}

/** Schlüssel der betroffenen Datensätze einer Schreibanfrage (ohne fehlgeschlagene). */
export function keysOf(req: DBCoreMutateRequest, keyPath: string, failures: Record<number, unknown> = {}): string[] {
  let keys: unknown[] = []
  if (req.type === 'delete') keys = req.keys
  else if (req.type === 'add' || req.type === 'put') {
    keys = req.keys ?? req.values.map((v) => (v as Record<string, unknown> | undefined)?.[keyPath])
  }
  return keys.filter((k, i) => !(i in failures) && (typeof k === 'string' || typeof k === 'number')).map(String)
}

/**
 * Dexie-Middleware: merkt sich jede lokale Änderung (anlegen, ändern, löschen) in synchronisierten Tabellen.
 * So müssen die einzelnen Module nichts über den Abgleich wissen.
 */
export function changeTracking(tables: readonly string[], onChange: (keys: ChangedKey[]) => void): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'nww-change-tracking',
    create(down) {
      return {
        ...down,
        table(name: string): DBCoreTable {
          const table = down.table(name)
          if (!tables.includes(name)) return table
          const keyPath = String(table.schema.primaryKey.keyPath ?? 'id')
          return {
            ...table,
            async mutate(req) {
              const remote = isRemote(req.trans)
              const res = await table.mutate(req)
              if (!remote) {
                if (req.type === 'deleteRange') {
                  console.warn(`[Abgleich] Bereichslöschung in ${name} wird nicht übertragen.`)
                } else {
                  const ids = keysOf(req, keyPath, res.failures)
                  if (ids.length) onChange(ids.map((id) => ({ tbl: name, id })))
                }
              }
              return res
            }
          }
        }
      }
    }
  }
}
