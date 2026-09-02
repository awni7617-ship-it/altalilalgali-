/**
 * A very small IndexedDB key/value store.
 *
 * Everything personal to one device — orders, favourites, the profile, the
 * admin credential — lives here, and on a device with no cloud backend the
 * store catalogue does too. localStorage would be simpler but its ~5 MB cap
 * is spent by two or three photos, so photos would start failing silently.
 */

const DB_NAME = 'rescue'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const idb = {
  get: <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key) as IDBRequest<IDBValidKey>).then(() => undefined),
  del: (key: string) => tx('readwrite', (s) => s.delete(key) as IDBRequest<undefined>).then(() => undefined),
  keys: () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
  clear: () => tx('readwrite', (s) => s.clear() as IDBRequest<undefined>).then(() => undefined),
}

/** Best-effort read that never throws — private-mode browsers can refuse IndexedDB. */
export async function safeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await idb.get<T>(key)
    return v === undefined ? fallback : v
  } catch {
    return fallback
  }
}
