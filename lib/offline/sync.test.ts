import { describe, expect, it, vi } from "vitest"
import { ApiError } from "@/lib/api-client"
import { createMemoryStorage } from "./store"
import { createScanQueue } from "./queue"
import { syncQueue } from "./sync"

function setup() {
  return createScanQueue(createMemoryStorage())
}

const duplicate = () =>
  Promise.reject(new ApiError("DUPLICATE_ATTENDANCE", "Already here.", 409))
const unknown = () =>
  Promise.reject(new ApiError("SRCODE_NOT_FOUND", "No such code.", 404))

describe("syncQueue", () => {
  it("replays FIFO and reports recorded outcomes", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.enqueue("EVT-1", "26-00002", 2)
    const seen: string[] = []
    const report = await syncQueue({
      queue,
      eventId: "EVT-1",
      record: (eventId, srcode) => {
        seen.push(srcode)
        return Promise.resolve({ ok: true })
      },
    })
    expect(seen).toEqual(["26-00001", "26-00002"])
    expect(report.results.map((r) => r.outcome)).toEqual([
      "recorded",
      "recorded",
    ])
    expect(await queue.pendingCount("EVT-1")).toBe(0)
  })

  it("treats duplicates as already-present, not failures", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1)
    const report = await syncQueue({
      queue,
      eventId: "EVT-1",
      record: duplicate,
    })
    expect(report.results[0].outcome).toBe("already-present")
    expect(await queue.pendingCount("EVT-1")).toBe(0)
  })

  it("keeps unknown codes queued with their reason", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-99999", 1)
    const report = await syncQueue({
      queue,
      eventId: "EVT-1",
      record: unknown,
    })
    expect(report.results[0].outcome).toBe("failed")
    expect(await queue.pendingCount("EVT-1")).toBe(1)
  })

  it("pauses on auth errors and leaves the rest queued", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.enqueue("EVT-1", "26-00002", 2)
    const record = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("UNAUTHORIZED", "No.", 401))
      .mockResolvedValue({ ok: true })
    const report = await syncQueue({ queue, eventId: "EVT-1", record })
    expect(report.pausedAuth).toBe(true)
    expect(record).toHaveBeenCalledTimes(1)
    expect(await queue.pendingCount("EVT-1")).toBe(2)
  })

  it("re-queues the interrupted scan on auth pause", async () => {
    const queue = setup()
    const scan = await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.markSyncing(scan.id)
    await queue.requeue(scan.id)
    const list = await queue.pending("EVT-1")
    expect(list.map((s) => s.status)).toEqual(["queued"])
  })

  it("resumes an interrupted sync where it stopped", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.enqueue("EVT-1", "26-00002", 2)
    const record = vi.fn().mockResolvedValue({ ok: true })
    await syncQueue({ queue, eventId: "EVT-1", record })
    const report = await syncQueue({ queue, eventId: "EVT-1", record })
    expect(report.results).toEqual([])
    expect(record).toHaveBeenCalledTimes(2)
  })
})
