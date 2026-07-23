import type { Account, DuplicateGroup, Transaction } from '@/types/transaction'

/**
 * On-device persistence backed by IndexedDB.
 *
 * The analytical database itself lives in-memory (DuckDB-WASM) for speed. When
 * the user opts in, we mirror the domain data — accounts, transactions,
 * duplicate resolutions and rejected transfer pairs — into IndexedDB so it can
 * be restored on the next visit. IndexedDB is used instead of DuckDB's OPFS
 * backend because OPFS holds an exclusive access handle that is only released on
 * garbage collection, which makes it unreliable across page reloads. IndexedDB
 * has none of those locking issues and works in every modern browser.
 */

export type PersistedSnapshot = {
  accounts: Account[]
  transactions: Transaction[]
  duplicateGroups: DuplicateGroup[]
  rejectedPairs: string[]
}

const DB_NAME = 'statement-analyzer'
const DB_VERSION = 1
const STORE = 'kv'
const SNAPSHOT_KEY = 'snapshot'

/** Whether this browser can persist data on-device. */
export function isPersistenceSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Persist the full snapshot, replacing any previous copy. */
export async function savePersistedSnapshot(snapshot: PersistedSnapshot): Promise<void> {
  const db = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(snapshot, SNAPSHOT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Load the persisted snapshot, or null if none has been saved. */
export async function loadPersistedSnapshot(): Promise<PersistedSnapshot | null> {
  const db = await openIdb()
  try {
    return await new Promise<PersistedSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(SNAPSHOT_KEY)
      request.onsuccess = () => resolve((request.result as PersistedSnapshot) ?? null)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

/** Remove all persisted data from this device. */
export async function clearPersistedSnapshot(): Promise<void> {
  const db = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(SNAPSHOT_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
