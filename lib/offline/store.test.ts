import { describe, expect, it } from "vitest"
import {
  createIndexedDBStorage,
  createMemoryStorage,
  type OfflineStorage,
} from "./store"

function behaves(name: string, create: () => OfflineStorage) {
  describe(name, () => {
    it("round-trips values by store and key", async () => {
      const storage = create()
      expect(await storage.get("s", "k")).toBeNull()
      await storage.set("s", "k", { n: 1 })
      expect(await storage.get("s", "k")).toEqual({ n: 1 })
    })

    it("deletes and lists keys per store", async () => {
      const storage = create()
      await storage.set("s", "a", 1)
      await storage.set("s", "b", 2)
      await storage.set("other", "a", 3)
      expect(await storage.keys("s")).toEqual(["a", "b"])
      await storage.del("s", "a")
      expect(await storage.keys("s")).toEqual(["b"])
      expect(await storage.keys("other")).toEqual(["a"])
    })

    it("clears one store without touching others", async () => {
      const storage = create()
      await storage.set("s", "a", 1)
      await storage.set("other", "a", 2)
      await storage.clear("s")
      expect(await storage.keys("s")).toEqual([])
      expect(await storage.keys("other")).toEqual(["a"])
    })
  })
}

describe("memory storage", () => {
  behaves("memory", createMemoryStorage)
})
