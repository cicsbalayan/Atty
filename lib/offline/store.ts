export interface OfflineStorage {
  get<T>(store: string, key: string): Promise<T | null>
  set(store: string, key: string, value: unknown): Promise<void>
  del(store: string, key: string): Promise<void>
  keys(store: string): Promise<string[]>
  clear(store: string): Promise<void>
}

export function createMemoryStorage(): OfflineStorage {
  const data = new Map<string, Map<string, unknown>>()
  const table = (store: string): Map<string, unknown> => {
    let t = data.get(store)
    if (!t) {
      t = new Map()
      data.set(store, t)
    }
    return t
  }
  return {
    async get<T>(store: string, key: string) {
      return (table(store).get(key) as T | undefined) ?? null
    },
    async set(store: string, key: string, value: unknown) {
      table(store).set(key, value)
    },
    async del(store: string, key: string) {
      table(store).delete(key)
    },
    async keys(store: string) {
      return [...(data.get(store)?.keys() ?? [])]
    },
    async clear(store: string) {
      data.get(store)?.clear()
    },
  }
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      for (const store of ["scans", "snapshots"]) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store)
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = work(tx.objectStore(store))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createIndexedDBStorage(
  dbName = "atty-offline"
): OfflineStorage {
  const db = openDb(dbName)
  return {
    get: async (store, key) => {
      const value = await run(await db, store, "readonly", (s) => s.get(key))
      return (value as never) ?? null
    },
    set: async (store, key, value) => {
      await run(await db, store, "readwrite", (s) => s.put(value, key))
    },
    del: async (store, key) => {
      await run(await db, store, "readwrite", (s) => s.delete(key))
    },
    keys: async (store) => {
      const keys = await run(await db, store, "readonly", (s) => s.getAllKeys())
      return keys.map(String)
    },
    clear: async (store) => {
      await run(await db, store, "readwrite", (s) => s.clear())
    },
  }
}
