import { describe, expect, it, vi } from "vitest"
import { createMemoryStorage } from "./store"
import { createSnapshotStore } from "./snapshots"

describe("snapshot store", () => {
  it("round-trips data with a saved-at stamp", async () => {
    const snapshots = createSnapshotStore(createMemoryStorage())
    await snapshots.save("events:all", [1, 2])
    const loaded = await snapshots.load<number[]>("events:all")
    expect(loaded?.data).toEqual([1, 2])
    expect(typeof loaded?.savedAt).toBe("number")
  })

  it("returns null for missing keys", async () => {
    const snapshots = createSnapshotStore(createMemoryStorage())
    expect(await snapshots.load("nope")).toBeNull()
  })

  it("evicts the oldest entry past the cap", async () => {
    const snapshots = createSnapshotStore(createMemoryStorage(), 2)
    await snapshots.save("a", 1)
    await snapshots.save("b", 2)
    await snapshots.save("c", 3)
    expect(await snapshots.load("a")).toBeNull()
    expect(await snapshots.load("c")).not.toBeNull()
  })

  it("evicts by oldest savedAt, not key order", async () => {
    let now = 1000
    const spy = vi.spyOn(Date, "now").mockImplementation(() => now)
    try {
      const snapshots = createSnapshotStore(createMemoryStorage(), 2)
      await snapshots.save("c", 3)
      now += 1
      await snapshots.save("a", 1)
      now += 1
      await snapshots.save("b", 2)
      // Sorted keys are [a, b, c]; only savedAt order evicts "c".
      expect(await snapshots.load("c")).toBeNull()
      expect(await snapshots.load("a")).not.toBeNull()
      expect(await snapshots.load("b")).not.toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
  it("never throws when storage fails", async () => {
    const broken = createMemoryStorage()
    vi.spyOn(broken, "set").mockRejectedValue(new Error("quota"))
    const snapshots = createSnapshotStore(broken)
    await expect(snapshots.save("a", 1)).resolves.toBeUndefined()
  })
})
