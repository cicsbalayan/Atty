import { createIndexedDBStorage, createMemoryStorage } from "./store"
import { createScanQueue, type ScanQueue } from "./queue"
import { createSnapshotStore, type SnapshotStore } from "./snapshots"

let shared: ScanQueue | null = null
let sharedSnapshots: SnapshotStore | null = null
let fallback = false

export function getSharedQueue(): ScanQueue {
  if (!shared) {
    if (typeof indexedDB === "undefined") {
      fallback = true
      shared = createScanQueue(createMemoryStorage())
    } else {
      shared = createScanQueue(createIndexedDBStorage())
    }
  }
  return shared
}

export function isMemoryFallback(): boolean {
  return fallback
}

export function getSharedSnapshots(): SnapshotStore {
  if (!sharedSnapshots) {
    if (typeof indexedDB === "undefined") {
      fallback = true
      sharedSnapshots = createSnapshotStore(createMemoryStorage())
    } else {
      sharedSnapshots = createSnapshotStore(createIndexedDBStorage())
    }
  }
  return sharedSnapshots
}
