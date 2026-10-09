/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { ApiError } from "@/lib/api-client"
import {
  getSharedSnapshots,
  resetSharedOfflineForTests,
} from "@/lib/offline/shared"
import { invalidatePrefix, refreshAllReads, useCached } from "./useCached"

beforeEach(() => {
  resetSharedOfflineForTests()
  refreshAllReads()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Probe({ id, staleMs = 60_000 }: { id: string; staleMs?: number }) {
  const { data, loading } = useCached(
    `read:${id}`,
    async () => {
      return `value-${calls++}`
    },
    staleMs
  )
  if (loading) return <p>loading</p>
  return <p>{data}</p>
}

let calls = 0

describe("useCached manual refresh", () => {
  it("serves a repeat read from cache without refetching", async () => {
    calls = 0
    const { rerender } = render(<Probe id="a" />)
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    rerender(<Probe id="a" />)
    // A fresh entry short-circuits the effect, so no second call.
    expect(calls).toBe(1)
  })

  it("refetches when the entry is stale", async () => {
    calls = 0
    // A 1ms window makes the entry stale immediately; changing staleMs
    // changes the effect deps, which is what re-runs it.
    const { rerender } = render(<Probe id="b" staleMs={60_000} />)
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    rerender(<Probe id="b" staleMs={0} />)
    await waitFor(() => expect(screen.getByText("value-1")).toBeTruthy())
    expect(calls).toBe(2)
  })

  it("refetches after refreshAllReads, even when the entry is fresh", async () => {
    calls = 0
    const { rerender } = render(<Probe id="c" />)
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    // Entry is well within its 60s window: only the signal can force this.
    act(() => {
      refreshAllReads()
    })
    rerender(<Probe id="c" />)
    await waitFor(() => expect(screen.getByText("value-1")).toBeTruthy())
    expect(calls).toBe(2)
  })

  it("leaves the component showing data rather than a permanent skeleton", async () => {
    calls = 0
    const { rerender } = render(<Probe id="d" />)
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    act(() => {
      refreshAllReads()
    })
    rerender(<Probe id="d" />)
    // Regression guard: deleting the entry without re-running the effect
    // would leave this stuck on "loading" forever.
    await waitFor(() => expect(screen.queryByText("loading")).toBeNull())
    await waitFor(() => expect(screen.getByText("value-1")).toBeTruthy())
  })

  it("keeps the pending count balanced across a refresh", async () => {
    calls = 0
    render(<Probe id="e" />)
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    act(() => {
      refreshAllReads()
    })
    await waitFor(() => expect(screen.getByText("value-1")).toBeTruthy())
    // If trackSettle were skipped the button would stay disabled forever.
    act(() => {
      refreshAllReads()
    })
    await waitFor(() => expect(screen.getByText("value-2")).toBeTruthy())
  })

  it("still refetches other keys after a prefix-scoped invalidation", async () => {
    calls = 0
    render(
      <>
        <Probe id="f" />
        <Probe id="g" />
      </>
    )
    await waitFor(() => expect(screen.getByText("value-0")).toBeTruthy())
    expect(calls).toBe(2)
    act(() => {
      invalidatePrefix("read:f")
      refreshAllReads()
    })
    await waitFor(() => expect(screen.getByText("value-2")).toBeTruthy())
  })
})

function SnapshotProbe({ fetcher }: { fetcher: () => Promise<string> }) {
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
    render(<SnapshotProbe fetcher={() => Promise.resolve("value")} />)
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
    // Real offline fetch failures reject with TypeError; only those fall
    // back to a snapshot (see the auth test below).
    render(
      <SnapshotProbe fetcher={() => Promise.reject(new TypeError("down"))} />
    )
    await waitFor(() => expect(screen.getByText("saved:value")).toBeTruthy())
  })

  it("surfaces auth errors instead of masking them as a saved copy", async () => {
    await getSharedSnapshots().save("events:all", "value")
    refreshAllReads()
    render(<AuthProbe />)
    await waitFor(() => expect(screen.getByText("error:No.")).toBeTruthy())
    expect(screen.queryByText("saved:value")).toBeNull()
  })
})

function AuthProbe() {
  const { error, loading } = useCached<string>(
    "events:all",
    () => Promise.reject(new ApiError("UNAUTHORIZED", "No.", 401)),
    10_000
  )
  if (loading) return <p>loading</p>
  if (error) return <p>{`error:${error.message}`}</p>
  return <p>unexpected</p>
}
