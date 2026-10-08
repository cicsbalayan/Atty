import type { OfflineStorage } from "./store"

export interface SnapshotEnvelope<T> {
  data: T
  savedAt: number
}

const SNAPSHOTS = "snapshots"

export interface SnapshotStore {
  save(key: string, data: unknown): Promise<void>
  load<T>(key: string): Promise<SnapshotEnvelope<T> | null>
  clear(): Promise<void>
}

export function createSnapshotStore(
  storage: OfflineStorage,
  maxEntries = 50
): SnapshotStore {
  return {
    async save(key, data) {
      try {
        await storage.set(SNAPSHOTS, key, { data, savedAt: Date.now() })
        const keys = await storage.keys(SNAPSHOTS)
        for (const extra of keys.slice(
          0,
          Math.max(0, keys.length - maxEntries)
        )) {
          await storage.del(SNAPSHOTS, extra)
        }
      } catch {
        // Snapshots are best-effort: a quota error must never break a read.
      }
    },
    async load(key) {
      try {
        return await storage.get<SnapshotEnvelope<never>>(SNAPSHOTS, key)
      } catch {
        return null
      }
    },
    clear() {
      return storage.clear(SNAPSHOTS)
    },
  }
}
