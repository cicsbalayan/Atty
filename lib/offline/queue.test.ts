import { describe, expect, it } from "vitest"
import { createMemoryStorage } from "./store"
import { createScanQueue } from "./queue"

function setup() {
  return createScanQueue(createMemoryStorage())
}

describe("scan queue", () => {
  it("enqueues scans with device timestamps in FIFO order", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1000)
    await queue.enqueue("EVT-1", "26-00002", 2000)
    const list = await queue.pending("EVT-1")
    expect(list.map((s) => s.srcode)).toEqual(["26-00001", "26-00002"])
    expect(list[0].scannedAt).toBe(1000)
    expect(list[0].status).toBe("queued")
  })

  it("scopes pending and counts by event", async () => {
    const queue = setup()
    await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.enqueue("EVT-2", "26-00002", 2)
    expect(await queue.pendingCount("EVT-1")).toBe(1)
    expect(await queue.pendingCount()).toBe(2)
  })

  it("transitions syncing to done, removing it from pending", async () => {
    const queue = setup()
    const scan = await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.markSyncing(scan.id)
    expect((await queue.pending("EVT-1")).map((s) => s.id)).toEqual([])
    await queue.markDone(scan.id)
    expect(await queue.pendingCount("EVT-1")).toBe(0)
  })

  it("keeps failed scans with their reason", async () => {
    const queue = setup()
    const scan = await queue.enqueue("EVT-1", "26-99999", 1)
    await queue.markSyncing(scan.id)
    await queue.markFailed(scan.id, "Unknown SR code.")
    const list = await queue.pending("EVT-1")
    expect(list).toHaveLength(1)
    expect(list[0].status).toBe("failed")
    expect(list[0].failReason).toBe("Unknown SR code.")
  })

  it("notifies subscribers on every mutation", async () => {
    const queue = setup()
    let calls = 0
    queue.subscribe(() => {
      calls += 1
    })
    await queue.enqueue("EVT-1", "26-00001", 1)
    expect(calls).toBe(1)
  })

  it("re-queues an interrupted syncing scan", async () => {
    const queue = setup()
    const scan = await queue.enqueue("EVT-1", "26-00001", 1)
    await queue.markSyncing(scan.id)
    await queue.requeue(scan.id)
    const list = await queue.pending("EVT-1")
    expect(list.map((s) => s.status)).toEqual(["queued"])
  })
})
