import type { OfflineStorage } from "./store"

export type QueuedScanStatus = "queued" | "syncing" | "done" | "failed"

export interface QueuedScan {
  id: string
  eventId: string
  srcode: string
  scannedAt: number
  status: QueuedScanStatus
  failReason?: string
}

const SCANS = "scans"

export interface ScanQueue {
  enqueue(
    eventId: string,
    srcode: string,
    scannedAt: number
  ): Promise<QueuedScan>
  pending(eventId: string): Promise<QueuedScan[]>
  pendingCount(eventId?: string): Promise<number>
  markSyncing(id: string): Promise<void>
  markDone(id: string): Promise<void>
  markFailed(id: string, reason: string): Promise<void>
  requeue(id: string): Promise<void>
  remove(id: string): Promise<void>
  subscribe(listener: () => void): () => void
}

export function createScanQueue(storage: OfflineStorage): ScanQueue {
  const listeners = new Set<() => void>()
  function emit() {
    for (const listener of [...listeners]) listener()
  }
  async function update(id: string, patch: Partial<QueuedScan>): Promise<void> {
    const current = await storage.get<QueuedScan>(SCANS, id)
    if (!current) return
    await storage.set(SCANS, id, { ...current, ...patch })
    emit()
  }
  return {
    async enqueue(eventId, srcode, scannedAt) {
      const scan: QueuedScan = {
        id: crypto.randomUUID(),
        eventId,
        srcode,
        scannedAt,
        status: "queued",
      }
      await storage.set(SCANS, scan.id, scan)
      emit()
      return scan
    },
    async pending(eventId) {
      const keys = await storage.keys(SCANS)
      const scans: QueuedScan[] = []
      for (const key of keys) {
        const scan = await storage.get<QueuedScan>(SCANS, key)
        if (
          scan &&
          scan.eventId === eventId &&
          (scan.status === "queued" || scan.status === "failed")
        ) {
          scans.push(scan)
        }
      }
      return scans.sort((a, b) => a.scannedAt - b.scannedAt)
    },
    async pendingCount(eventId) {
      const keys = await storage.keys(SCANS)
      let count = 0
      for (const key of keys) {
        const scan = await storage.get<QueuedScan>(SCANS, key)
        if (
          scan &&
          (scan.status === "queued" || scan.status === "failed") &&
          (!eventId || scan.eventId === eventId)
        ) {
          count += 1
        }
      }
      return count
    },
    markSyncing: (id) => update(id, { status: "syncing" }),
    markDone: (id) => update(id, { status: "done" }),
    markFailed: (id, reason) =>
      update(id, { status: "failed", failReason: reason }),
    requeue: (id) => update(id, { status: "queued", failReason: undefined }),
    async remove(id) {
      await storage.del(SCANS, id)
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
