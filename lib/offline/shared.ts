import { createIndexedDBStorage, createMemoryStorage } from "./store"
import { createScanQueue, type ScanQueue } from "./queue"

let shared: ScanQueue | null = null
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
