# Offline Queue + Offline Viewing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The kiosk records scans into an IndexedDB queue when offline and replays them on reconnect, while already-loaded lists stay browsable from snapshots.

**Architecture:** New `lib/offline/` boundary (store, queue, snapshots, sync engine, connectivity hook) plus three UI pieces (banner, pending badge + sync button, report dialog) and CheckInForm enqueue integration. Online behavior stays pixel-identical.

**Tech Stack:** TypeScript, React 19, raw IndexedDB (no new dependencies), existing `recordAttendance` endpoint for replay.

## Global Constraints

- Prettier: no semicolons, double quotes, 2-space indent, `printWidth: 80`, `trailingComma: "es5"`. Format only touched files: `npx prettier --write <files>`. Never repo-wide.
- Tests run on vitest. Default env is node; jsdom needs a `/** @vitest-environment jsdom */` docblock. `@testing-library/jest-dom` is NOT installed: assert via DOM directly (`.textContent`, `toBeTruthy`, `toBeNull`).
- Mock `next/navigation` as `useRouter: () => ({ refresh: vi.fn() })`.
- Every source file stays under 400 lines.
- Verify every task: `npm run typecheck`, `npm run lint` (0 errors; 2 pre-existing warnings in `components/events/EventFormDialog.tsx` are not yours), `npm test`, `npm run build`.
- Branch is `feat/ui-ux-design`. Commit each finished task separately (`feat(offline): ...`).
- Frontend-only: no `apps-script/` changes. Replayed scans carry server sync-time stamps; store and show device `scannedAt`, and say so in the report UI copy.

---

### File map

| File | Responsibility |
|---|---|
| Create `lib/offline/store.ts` | `OfflineStorage` interface, in-memory backend, IndexedDB backend |
| Create `lib/offline/store.test.ts` | Backend contract tests (run against both backends) |
| Create `lib/offline/queue.ts` | `ScanQueue`: enqueue, pending list, status transitions, counts, change subscription |
| Create `lib/offline/queue.test.ts` | Queue semantics tests on the in-memory backend |
| Create `lib/offline/snapshots.ts` | `SnapshotStore`: save/load snapshots with `savedAt`, entry cap |
| Create `lib/offline/snapshots.test.ts` | Snapshot tests on the in-memory backend |
| Create `hooks/useOnline.ts` | Connectivity boolean from online/offline events |
| Create `hooks/useOnline.test.ts` | jsdom event-dispatch tests |
| Create `lib/offline/sync.ts` | `syncQueue` replay engine with per-scan outcomes |
| Create `lib/offline/sync.test.ts` | Engine tests on mocked record fn |
| Create `components/offline/OfflineBanner.tsx` | App-wide offline banner |
| Create `components/offline/QueueStatus.tsx` | Pending pill + Sync now button + auto-sync manager |
| Create `components/offline/SyncReportDialog.tsx` | Per-scan outcome report |
| Create `components/offline/*.test.tsx` | jsdom tests for the three components |
| Modify `components/attendance/CheckInForm.tsx` | Enqueue on network failure + queued state |
| Modify `hooks/useCached.ts` | Persist successful reads; serve snapshots when offline |
| Modify `app/(app)/layout.tsx` or `AppShell` | Mount `OfflineBanner` (pick whichever already wraps all app routes: `AppShell`) |

---

### Task 1: Offline storage backends

**Files:**
- Create: `lib/offline/store.ts`
- Test: `lib/offline/store.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `OfflineStorage` (`get/set/del/keys/clear`), `createMemoryStorage()`, `createIndexedDBStorage(dbName?)` — used by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/store.test.ts`
Expected: FAIL with "Failed to resolve import ./store".

- [ ] **Step 3: Write minimal implementation**

```ts
export interface OfflineStorage {
  get<T>(store: string, key: string): Promise<T | null>
  set(store: string, key: string, value: unknown): Promise<void>
  del(store: string, key: string): Promise<void>
  keys(store: string): Promise<string[]>
  clear(store: string): Promise<void>
}

export function createMemoryStorage(): OfflineStorage {
  const data = new Map<string, Map<string, unknown>>()
  const table = (store: string): Map<string, unknown> => {
    let t = data.get(store)
    if (!t) {
      t = new Map()
      data.set(store, t)
    }
    return t
  }
  return {
    async get<T>(store, key) {
      return (table(store).get(key) as T | undefined) ?? null
    },
    async set(store, key, value) {
      table(store).set(key, value)
    },
    async del(store, key) {
      table(store).delete(key)
    },
    async keys(store) {
      return [...(data.get(store)?.keys() ?? [])]
    },
    async clear(store) {
      data.get(store)?.clear()
    },
  }
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => {
      for (const store of ["scans", "snapshots"]) {
        if (!request.result.objectStoreNames.contains(store)) {
          request.result.createObjectStore(store)
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function run<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  work: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const request = work(tx.objectStore(store))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function createIndexedDBStorage(
  dbName = "atty-offline"
): OfflineStorage {
  const db = openDb(dbName)
  return {
    get: async (store, key) => {
      const value = await run(await db, store, "readonly", (s) =>
        s.get(key)
      )
      return (value as never) ?? null
    },
    set: async (store, key, value) => {
      await run(await db, store, "readwrite", (s) => s.put(value, key))
    },
    del: async (store, key) => {
      await run(await db, store, "readwrite", (s) => s.delete(key))
    },
    keys: async (store) => {
      const keys = await run(await db, store, "readonly", (s) =>
        s.getAllKeys()
      )
      return keys.map(String)
    },
    clear: async (store) => {
      await run(await db, store, "readwrite", (s) => s.clear())
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/store.test.ts`
Expected: PASS (3 tests; IndexedDB backend is exercised in a browser/manual pass, not jsdom, which lacks IndexedDB).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/store.ts lib/offline/store.test.ts
git commit -m "feat(offline): storage interface with memory and IndexedDB backends"
```

---

### Task 2: Scan queue

**Files:**
- Create: `lib/offline/queue.ts`
- Test: `lib/offline/queue.test.ts`

**Interfaces:**
- Consumes: `OfflineStorage`, `createMemoryStorage` from Task 1.
- Produces: `QueuedScan`, `createScanQueue(storage)` with `enqueue / pending / markSyncing / markDone / markFailed / remove / pendingCount / subscribe` — used by Tasks 5, 6, 7.

- [ ] **Step 1: Write the failing test**

```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/queue.test.ts`
Expected: FAIL with "Failed to resolve import ./queue".

- [ ] **Step 3: Write minimal implementation**

```ts
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
  enqueue(eventId: string, srcode: string, scannedAt: number): Promise<QueuedScan>
  pending(eventId: string): Promise<QueuedScan[]>
  pendingCount(eventId?: string): Promise<number>
  markSyncing(id: string): Promise<void>
  markDone(id: string): Promise<void>
  markFailed(id: string, reason: string): Promise<void>
  remove(id: string): Promise<void>
  subscribe(listener: () => void): () => void
}

export function createScanQueue(storage: OfflineStorage): ScanQueue {
  const listeners = new Set<() => void>()
  function emit() {
    for (const listener of [...listeners]) listener()
  }
  async function update(
    id: string,
    patch: Partial<QueuedScan>
  ): Promise<void> {
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
        if (scan && scan.eventId === eventId && scan.status !== "done") {
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
          scan.status !== "done" &&
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/queue.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/queue.ts lib/offline/queue.test.ts
git commit -m "feat(offline): scan queue with FIFO pending and status transitions"
```

---

### Task 3: Read snapshots

**Files:**
- Create: `lib/offline/snapshots.ts`
- Test: `lib/offline/snapshots.test.ts`

**Interfaces:**
- Consumes: `OfflineStorage` from Task 1.
- Produces: `SnapshotEnvelope<T>`, `createSnapshotStore(storage, maxEntries = 50)` with `save / load / clear` — used by Task 9.

- [ ] **Step 1: Write the failing test**

```ts
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

  it("never throws when storage fails", async () => {
    const broken = createMemoryStorage()
    vi.spyOn(broken, "set").mockRejectedValue(new Error("quota"))
    const snapshots = createSnapshotStore(broken)
    await expect(snapshots.save("a", 1)).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/snapshots.test.ts`
Expected: FAIL with "Failed to resolve import ./snapshots".

- [ ] **Step 3: Write minimal implementation**

```ts
import type { OfflineStorage } from "./store"

export interface SnapshotEnvelope<T> {
  data: T
  savedAt: number
}

const SNAPSHOTS = "snapshots"

export interface SnapshotStore {
  save(key: string, data: unknown): Promise<void>
  load<T>(key: string): Promise<SnapshotEnvelope<T> | null>
  clear(): Promise<void>
}

export function createSnapshotStore(
  storage: OfflineStorage,
  maxEntries = 50
): SnapshotStore {
  return {
    async save(key, data) {
      try {
        await storage.set(SNAPSHOTS, key, { data, savedAt: Date.now() })
        const keys = await storage.keys(SNAPSHOTS)
        for (const extra of keys.slice(0, Math.max(0, keys.length - maxEntries))) {
          await storage.del(SNAPSHOTS, extra)
        }
      } catch {
        // Snapshots are best-effort: a quota error must never break a read.
      }
    },
    async load(key) {
      try {
        return await storage.get<SnapshotEnvelope<never>>(SNAPSHOTS, key)
      } catch {
        return null
      }
    },
    clear() {
      return storage.clear(SNAPSHOTS)
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/snapshots.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/snapshots.ts lib/offline/snapshots.test.ts
git commit -m "feat(offline): snapshot store with saved-at stamps and cap"
```

---

### Task 4: Connectivity hook

**Files:**
- Create: `hooks/useOnline.ts`
- Test: `hooks/useOnline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `useOnline(): boolean` — used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useOnline } from "./useOnline"

function Probe() {
  return <p>{useOnline() ? "online" : "offline"}</p>
}

describe("useOnline", () => {
  afterEach(cleanup)

  it("reflects browser online/offline events", () => {
    render(<Probe />)
    expect(screen.getByText("online")).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(screen.getByText("offline")).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    expect(screen.getByText("online")).toBeTruthy()
  })
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run hooks/useOnline.test.ts`
Expected: FAIL with "Failed to resolve import ./useOnline".

- [ ] **Step 3: Write minimal implementation**

```ts
"use client"

import * as React from "react"

export function useOnline(): boolean {
  const [online, setOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  )
  React.useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [])
  return online
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run hooks/useOnline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useOnline.ts hooks/useOnline.test.ts
git commit -m "feat(offline): connectivity hook from browser online events"
```

---

### Task 5: Sync engine

**Files:**
- Create: `lib/offline/sync.ts`
- Test: `lib/offline/sync.test.ts`

**Interfaces:**
- Consumes: `ScanQueue` from Task 2, `recordAttendance` from `lib/api-client` (injected as a `record` dep so tests use fakes). `ScanQueue` needs one addition in this task: `requeue(id)` resetting a `syncing` scan to `queued` (used on auth pause); the Step 1 test below covers it, and Task 2's suite grows by that test.
- Produces: `SyncReport`, `syncQueue({ queue, eventId, record, isAuthError?, onProgress? })` — used by Tasks 6 and 8.

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/offline/sync.test.ts`
Expected: FAIL with "Failed to resolve import ./sync".

- [ ] **Step 3: Write minimal implementation**

```ts
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
          results.push({ scan, outcome: "already-present", message: error.message })
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
  ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/offline/sync.test.ts lib/offline/queue.test.ts`
Expected: PASS (queue tests grow by the requeue test).

- [ ] **Step 5: Commit**

```bash
git add lib/offline/sync.ts lib/offline/sync.test.ts lib/offline/queue.ts lib/offline/queue.test.ts
git commit -m "feat(offline): replay engine with per-scan outcomes and auth pause"
```

---

### Task 6: Banner, badge, and auto-sync

**Files:**
- Create: `components/offline/OfflineBanner.tsx`
- Create: `components/offline/QueueStatus.tsx` (pending pill + Sync now + `QueueSyncManager` auto-sync effect)
- Test: `components/offline/OfflineBanner.test.tsx`, `components/offline/QueueStatus.test.tsx`
- Modify: `components/layout/AppShell.tsx` (render `<OfflineBanner />` above the grid)

**Interfaces:**
- Consumes: `useOnline` (Task 4), `ScanQueue.subscribe` + `pendingCount` (Task 2), `syncQueue` (Task 5), real `recordAttendance` from `lib/api-client`.
- Produces: mounted banner app-wide; `QueueSyncManager({ eventId, queue })` handling reconnect auto-sync and manual sync with report callback.

- [ ] **Step 1: Write the failing tests**

```tsx
/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { OfflineBanner } from "./OfflineBanner"

describe("OfflineBanner", () => {
  afterEach(cleanup)

  it("appears offline and disappears on reconnect", () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole("status")).toBeNull()
    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(screen.getByRole("status").textContent).toContain("offline")
    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    expect(screen.queryByRole("status")).toBeNull()
  })
});
```

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryStorage } from "@/lib/offline/store"
import { createScanQueue } from "@/lib/offline/queue"
import { QueueStatus } from "./QueueStatus"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe("QueueStatus", () => {
  afterEach(cleanup)

  it("shows the pending count and runs a manual sync", async () => {
    const queue = createScanQueue(createMemoryStorage())
    await queue.enqueue("EVT-1", "26-00001", 1)
    const onReport = vi.fn()
    render(
      <QueueStatus
        eventId="EVT-1"
        queue={queue}
        record={vi.fn().mockResolvedValue({ ok: true })}
        onReport={onReport}
      />
    )
    expect(screen.getByText("1 pending").textContent).toContain("1")
    fireEvent.click(screen.getByRole("button", { name: /sync now/i }))
    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1))
    expect(screen.queryByText("1 pending")).toBeNull()
  })

  it("disables sync while a run is in flight", async () => {    const queue = createScanQueue(createMemoryStorage())
    await queue.enqueue("EVT-1", "26-00001", 1)
    let release!: () => void
    const gate = new Promise<unknown>((resolve) => {
      release = () => resolve({ ok: true })
    })
    render(
      <QueueStatus
        eventId="EVT-1"
        queue={queue}
        record={() => gate}
        onReport={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /sync now/i }))
    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled()
    release()
  })

  it("warns when storage fell back to memory", async () => {
    const queue = createScanQueue(createMemoryStorage())
    await queue.enqueue("EVT-1", "26-00001", 1)
    render(
      <QueueStatus
        eventId="EVT-1"
        queue={queue}
        record={vi.fn().mockResolvedValue({ ok: true })}
        onReport={vi.fn()}
        storageWarning={true}
      />
    )
    expect(screen.getByText(/won't survive a reload/i)).toBeTruthy()
  })
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/offline/`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write minimal implementations**

`OfflineBanner.tsx`:

```tsx
"use client"

import { WifiOff } from "lucide-react"
import { useOnline } from "@/hooks/useOnline"

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      className="clay flex items-center gap-2 p-3 text-sm text-muted-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You are offline. Scans will queue and lists show saved copies.
    </p>
  )
}
```

`QueueStatus.tsx`:

```tsx
"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import type { ScanQueue } from "@/lib/offline/queue"
import { syncQueue, type SyncReport } from "@/lib/offline/sync"
import { useOnline } from "@/hooks/useOnline"

export function usePendingCount(
  queue: ScanQueue,
  eventId: string
): number {
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    let live = true
    queue.pendingCount(eventId).then((n) => {
      if (live) setCount(n)
    })
    return queue.subscribe(() => {
      queue.pendingCount(eventId).then((n) => {
        if (live) setCount(n)
      })
    })
  }, [queue, eventId])
  return count
}

export function QueueStatus({
  eventId,
  queue,
  record,
  onReport,
  storageWarning = false,
}: {
  eventId: string
  queue: ScanQueue
  record: (eventId: string, srcode: string) => Promise<unknown>
  onReport: (report: SyncReport) => void
  storageWarning?: boolean
}) {
  const online = useOnline()
  const count = usePendingCount(queue, eventId)
  const [syncing, setSyncing] = React.useState(false)

  async function run() {
    if (syncing || !online) return
    setSyncing(true)
    try {
      onReport(await syncQueue({ queue, eventId, record }))
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync on reconnect when anything is queued.
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (online) void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  if (count === 0 && !storageWarning) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      {storageWarning ? (
        <span role="note" className="text-sm text-muted-foreground">
          Local storage unavailable — queued scans won't survive a reload.
        </span>
      ) : null}
      {count > 0 ? (
        <>
          <span className="clay-pressed px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
            {count} pending
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="clay-btn"
            disabled={syncing || !online}
            onClick={() => void run()}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </>
      ) : null}
    </div>
  )
}
```

Mount `<OfflineBanner />` in `AppShell` above the grid div. Verify `WifiOff`
exists in the installed lucide-react (`Select-String` the package exports or
swap for `CloudOff` if missing — check before committing).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/offline/`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/offline/OfflineBanner.tsx components/offline/QueueStatus.tsx components/offline/OfflineBanner.test.tsx components/offline/QueueStatus.test.tsx components/layout/AppShell.tsx
git commit -m "feat(offline): banner, pending badge, manual and auto sync"
```

---

### Task 7: Kiosk enqueue integration

**Files:**
- Modify: `components/attendance/CheckInForm.tsx`
- Test: extend or add `components/attendance/CheckInFormOffline.test.tsx` (new file; do not rewrite the existing suite)

**Interfaces:**
- Consumes: `createScanQueue` + `createIndexedDBStorage` (Tasks 1–2). Module-level singleton queue so the kiosk and `QueueStatus` share one: create `lib/offline/shared.ts` in this task exporting `getSharedQueue()` (IndexedDB in browser, memory fallback when IndexedDB is missing) and `isMemoryFallback()`.
- Produces: offline scans enqueue with a "Queued" outcome; online flow byte-identical. The kiosk keeps its verify-then-record flow: only a network failure (`TypeError` from fetch) diverts a format-valid scan into the queue — there is no `navigator.onLine` short-circuit, per the spec.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CheckInForm } from "./CheckInForm"
import { checkAttendance, recordAttendance } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({
  checkAttendance: vi.fn(),
  recordAttendance: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe("CheckInForm offline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(cleanup)

  it("queues a valid scan instead of erroring on network failure", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(new TypeError("offline"))
    render(<CheckInForm eventId="EVT-1" eventName="E" eventActive={true} />)
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /validate sr code/i }))
    await waitFor(() => {
      expect(screen.getByText(/queued/i).textContent).toContain("Queued")
    })
    expect(checkAttendance).toHaveBeenCalledTimes(1)
    expect(recordAttendance).not.toHaveBeenCalled()
  })
});
```

Adapt label/button names to the real form (read `CheckInForm.tsx` first;
keep the suite's existing selectors working — online tests must not change).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/attendance/CheckInFormOffline.test.tsx`
Expected: FAIL (no "Queued" text; error shown instead).

- [ ] **Step 3: Write minimal implementation**

In `CheckInForm.tsx`: extend the `Outcome` union with
`{ kind: "queued"; srcode: string }` and render it in the existing
`aria-live` region with the copy "Queued — will sync when reconnected."
(see the `duplicate` outcome block for the exact rendering pattern). In
`onLookup`, wrap the `checkAttendance` call so a `TypeError` (fetch failed
mid-flight) enqueues instead of erroring:

```ts
try {
  const res = await checkAttendance(eventId, code)
  // ... unchanged verify/confirm branches
} catch (error) {
  if (error instanceof TypeError) {
    await getSharedQueue().enqueue(eventId, code, Date.now())
    setOutcome({ kind: "queued", srcode: code })
    return
  }
  // ... unchanged error branch
}
```

`shared.ts` (also exposes the fallback flag for the Task 6 warning):

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/attendance/CheckInFormOffline.test.tsx components/attendance/CheckInForm.test.tsx`
Expected: PASS, including the untouched online suite.

- [ ] **Step 5: Commit**

```bash
git add lib/offline/shared.ts components/attendance/CheckInForm.tsx components/attendance/CheckInFormOffline.test.tsx
git commit -m "feat(offline): kiosk enqueues scans when the network fails"
```

---

### Task 8: Sync report dialog

**Files:**
- Create: `components/offline/SyncReportDialog.tsx`
- Test: `components/offline/SyncReportDialog.test.tsx`
- Modify: event detail page + check-in page to mount `QueueStatus` + dialog (server pages: add the client components; dialog state lives in a small client wrapper `QueueSyncPanel({ eventId })` created in this task that owns `report` state, renders `QueueStatus` and `SyncReportDialog`, and toasts clean syncs via the existing `useToast`).

**Interfaces:**
- Consumes: `SyncReport` (Task 5), `QueueStatus` (Task 6), `useToast` (existing).
- Produces: reviewed failures stay queued or are discarded by the operator.

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SyncReport } from "@/lib/offline/sync"
import { SyncReportDialog } from "./SyncReportDialog"

const report: SyncReport = {
  pausedAuth: false,
  results: [
    {
      scan: {
        id: "1",
        eventId: "EVT-1",
        srcode: "26-00001",
        scannedAt: 1,
        status: "done",
      },
      outcome: "recorded",
    },
    {
      scan: {
        id: "2",
        eventId: "EVT-1",
        srcode: "26-99999",
        scannedAt: 2,
        status: "failed",
        failReason: "No such code.",
      },
      outcome: "failed",
      message: "No such code.",
    },
  ],
}

describe("SyncReportDialog", () => {
  afterEach(cleanup)

  it("lists per-scan outcomes with the failure reason", () => {
    render(
      <SyncReportDialog report={report} onClose={vi.fn()} onDiscard={vi.fn()} />
    )
    expect(screen.getByText("26-00001").textContent).toContain("26-00001")
    expect(screen.getByText(/no such code/i)).toBeTruthy()
  })

  it("discards a failure and closes", () => {
    const onDiscard = vi.fn()
    const onClose = vi.fn()
    render(
      <SyncReportDialog report={report} onClose={onClose} onDiscard={onDiscard} />
    )
    fireEvent.click(screen.getByRole("button", { name: /discard/i }))
    expect(onDiscard).toHaveBeenCalledWith("2")
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it("asks for re-login when paused on auth", () => {
    render(
      <SyncReportDialog
        report={{ results: [], pausedAuth: true }}
        onClose={vi.fn()}
        onDiscard={vi.fn()}
      />
    )
    expect(screen.getByText(/sign in again/i)).toBeTruthy()
  })
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/offline/SyncReportDialog.test.tsx`
Expected: FAIL with "Failed to resolve import".

- [ ] **Step 3: Write minimal implementation**

Build on the existing `Dialog` primitives (`components/ui/dialog.tsx` —
same pattern as `EventFormDialog`). Rows: SR code (mono), outcome badge
(`success` for recorded, `warning` for already-present, `error` for failed —
all three variants exist in `components/ui/badge.tsx`), device scan time via
existing `formatTimeOnly`, failure message. Footer: "Dismiss" + per-failure
"Discard" (calls `onDiscard(scanId)`, which removes from the queue via
`queue.remove`). `QueueSyncPanel` wires `QueueStatus onReport` → sets report
state (or `toast.success("Sync complete.")` when every outcome is recorded/
already-present), renders the dialog, and mounts nothing when idle. The panel
takes `{ eventId }` and builds its own `queue` via `getSharedQueue()`, passes
the real `recordAttendance` as `record`, and passes `isMemoryFallback()` as
`storageWarning` — so its call sites stay one line.

Mount `<QueueSyncPanel eventId={...} />` in `app/(app)/events/[eventId]/page.tsx`
(header action row) and the check-in page.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/offline/`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add components/offline/SyncReportDialog.tsx components/offline/SyncReportDialog.test.tsx components/offline/QueueSyncPanel.tsx "app/(app)/events/[eventId]/page.tsx" "app/(app)/events/[eventId]/check-in/page.tsx"
git commit -m "feat(offline): sync report dialog with keep-or-discard review"
```

---

### Task 9: Offline viewing from snapshots

**Files:**
- Modify: `hooks/useCached.ts` (persist successful reads; serve snapshots when offline)
- Test: extend `hooks/useCached.test.tsx` (offline-serve cases)
- Modify: `components/attendance/AttendanceTable.tsx` (saved-at label when rendering snapshot data)

**Interfaces:**
- Consumes: `SnapshotStore` (Task 3).
- Produces: every whitelisted read viewable offline with a saved-at label.

- [ ] **Step 1: Write the failing tests**

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getSharedSnapshots } from "@/lib/offline/shared"
import { refreshAllReads, useCached } from "./useCached"

function Probe({ fetcher }: { fetcher: () => Promise<string> }) {
  const { data, loading, fromSnapshot } = useCached(
    "events:all",
    fetcher,
    10_000
  )
  if (loading) return <p>loading</p>
  return <p>{`${fromSnapshot ? "saved:" : "live:"}${data ?? "none"}`}</p>
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value,
    configurable: true,
  })
  window.dispatchEvent(new Event(value ? "online" : "offline"))
}

describe("useCached snapshots", () => {
  beforeEach(async () => {
    refreshAllReads()
    await getSharedSnapshots().clear()
    setOnline(true)
  })
  afterEach(cleanup)

  it("persists successful reads to the snapshot store", async () => {
    render(<Probe fetcher={() => Promise.resolve("value")} />)
    await waitFor(() => expect(screen.getByText("live:value")).toBeTruthy())
    await waitFor(async () => {
      expect((await getSharedSnapshots().load("events:all"))?.data).toBe(
        "value"
      )
    })
  })

  it("serves the snapshot with a label when the fetch fails", async () => {
    await getSharedSnapshots().save("events:all", "value")
    refreshAllReads()
    setOnline(false)
    render(<Probe fetcher={() => Promise.reject(new Error("down"))} />)
    await waitFor(() => expect(screen.getByText("saved:value")).toBeTruthy())
  })
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run hooks/useCached.test.tsx`
Expected: FAIL (no snapshot behavior).

- [ ] **Step 3: Write minimal implementation**

In `useCached`, after a successful fetch resolves, fire-and-forget
`getSharedSnapshots().save(key, data)` (never await in the fetch path; the
snapshot store already swallows quota errors). In the catch branch, attempt
`load(key)` on any fetch failure — not only when the browser reports offline,
so flaky gym Wi-Fi degrades to the saved copy too; on hit, populate the entry
as data with no error. Thread `fromSnapshot: boolean` (additive; existing
consumers ignore it) through the hook result. `AttendanceTable` shows
"Saved copy" + time (existing `formatTimeOnly`, needs the stamp: extend the
result with additive `savedAt: number | null`) next to the count when
`fromSnapshot` is true. Snapshot only `attendance:`, `events:`, `report:`,
and `organizations:` keys (prefix allowlist in `useCached`, one array
constant) to bound quota. Add `getSharedSnapshots()` (SnapshotStore over the
shared storage, memory fallback included) to `lib/offline/shared.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run hooks/useCached.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification, manual drill, commit**

Run the whole gate: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`. Then the manual drill with devtools offline: load an event,
go offline, confirm banner + saved-copy table + kiosk queueing; reload
mid-offline; expire the session (clear cookie) and confirm the queue survives
re-login and syncs with a report.

```bash
git add hooks/useCached.ts hooks/useCached.test.tsx lib/offline/shared.ts components/attendance/AttendanceTable.tsx
git commit -m "feat(offline): serve snapshotted reads when offline"
```
