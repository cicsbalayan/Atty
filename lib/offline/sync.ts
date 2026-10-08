import { ApiError } from "@/lib/api-client"
import type { QueuedScan, ScanQueue } from "./queue"

export type SyncOutcome = "recorded" | "already-present" | "failed"

export interface ScanResult {
  scan: QueuedScan
  outcome: SyncOutcome
  message?: string
}

export interface SyncReport {
  results: ScanResult[]
  pausedAuth: boolean
}

export async function syncQueue(deps: {
  queue: ScanQueue
  eventId: string
  record: (eventId: string, srcode: string) => Promise<unknown>
  isAuthError?: (error: unknown) => boolean
  onProgress?: (done: number, total: number) => void
}): Promise<SyncReport> {
  const { queue, eventId, record } = deps
  const isAuthError =
    deps.isAuthError ??
    ((error: unknown) => error instanceof ApiError && error.status === 401)
  const pending = await queue.pending(eventId)
  const results: ScanResult[] = []
  for (const [index, scan] of pending.entries()) {
    await queue.markSyncing(scan.id)
    try {
      await record(eventId, scan.srcode)
      await queue.markDone(scan.id)
      results.push({ scan, outcome: "recorded" })
    } catch (error) {
      if (isAuthError(error)) {
        await queue.requeue(scan.id)
        return { results, pausedAuth: true }
      }
      if (error instanceof ApiError && error.code === "DUPLICATE_ATTENDANCE") {
        await queue.markDone(scan.id)
        results.push({
          scan,
          outcome: "already-present",
          message: error.message,
        })
      } else {
        const message = error instanceof Error ? error.message : "Sync failed."
        await queue.markFailed(scan.id, message)
        results.push({ scan, outcome: "failed", message })
      }
    }
    deps.onProgress?.(index + 1, pending.length)
  }
  return { results, pausedAuth: false }
}
