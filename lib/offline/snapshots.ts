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
        if (keys.length <= maxEntries) return
        // getAllKeys returns sorted keys, not insertion order, so evict by
        // the oldest savedAt stamp instead of key position.
        const stamped: { key: string; savedAt: number }[] = []
        for (const k of keys) {
          const envelope = await storage.get<SnapshotEnvelope<never>>(
            SNAPSHOTS,
            k
          )
          stamped.push({ key: k, savedAt: envelope?.savedAt ?? 0 })
        }
        stamped.sort((a, b) => a.savedAt - b.savedAt)
        for (const extra of stamped.slice(0, keys.length - maxEntries)) {
          await storage.del(SNAPSHOTS, extra.key)
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
    async clear() {
      try {
        await storage.clear(SNAPSHOTS)
      } catch {
        // Best-effort like save/load: clearing must never throw.
      }
    },
  }
}
