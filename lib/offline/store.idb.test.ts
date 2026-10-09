/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto"
import { describe, expect, it } from "vitest"
import { createIndexedDBStorage } from "./store"

let n = 0
function dbName(): string {
  n += 1
  return `test-atty-offline-${Date.now()}-${n}`
}

describe("indexeddb storage", () => {
  it("round-trips values by store and key", async () => {
    const storage = createIndexedDBStorage(dbName())
    expect(await storage.get("scans", "k")).toBeNull()
    await storage.set("scans", "k", { n: 1 })
    expect(await storage.get("scans", "k")).toEqual({ n: 1 })
  })

  it("deletes and lists keys per store", async () => {
    const storage = createIndexedDBStorage(dbName())
    await storage.set("scans", "a", 1)
    await storage.set("scans", "b", 2)
    await storage.set("snapshots", "a", 3)
    expect(await storage.keys("scans")).toEqual(["a", "b"])
    await storage.del("scans", "a")
    expect(await storage.keys("scans")).toEqual(["b"])
    expect(await storage.keys("snapshots")).toEqual(["a"])
  })

  it("clears one store without touching others", async () => {
    const storage = createIndexedDBStorage(dbName())
    await storage.set("scans", "a", 1)
    await storage.set("snapshots", "a", 2)
    await storage.clear("scans")
    expect(await storage.keys("scans")).toEqual([])
    expect(await storage.keys("snapshots")).toEqual(["a"])
  })

  it("rejects when the write aborts instead of reporting success", async () => {
    const storage = createIndexedDBStorage(dbName())
    // Functions cannot be structured-cloned, so the put aborts the
    // transaction; run() must reject rather than resolve.
    await expect(storage.set("scans", "k", () => {})).rejects.toThrow()
    expect(await storage.get("scans", "k")).toBeNull()
    // The connection stays usable after the abort.
    await storage.set("scans", "ok", { n: 1 })
    expect(await storage.get("scans", "ok")).toEqual({ n: 1 })
  })
})
