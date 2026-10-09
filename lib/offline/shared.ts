import {
  createIndexedDBStorage,
  createMemoryStorage,
  type OfflineStorage,
} from "./store"
import { createScanQueue, type ScanQueue } from "./queue"
import { createSnapshotStore, type SnapshotStore } from "./snapshots"

let storage: OfflineStorage | null = null
let shared: ScanQueue | null = null
let sharedSnapshots: SnapshotStore | null = null
let fallback = false

function getSharedStorage(): OfflineStorage {
  if (!storage) {
    if (typeof indexedDB === "undefined") {
      fallback = true
      storage = createMemoryStorage()
    } else {
      storage = createIndexedDBStorage()
    }
  }
  return storage
}

export function getSharedQueue(): ScanQueue {
  if (!shared) {
    shared = createScanQueue(getSharedStorage())
  }
  return shared
}

export function isMemoryFallback(): boolean {
  return fallback
}

export function getSharedSnapshots(): SnapshotStore {
  if (!sharedSnapshots) {
    sharedSnapshots = createSnapshotStore(getSharedStorage())
  }
  return sharedSnapshots
}

export function resetSharedOfflineForTests(): void {
  storage = null
  shared = null
  sharedSnapshots = null
  fallback = false
}
