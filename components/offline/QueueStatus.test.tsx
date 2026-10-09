/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
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
    expect((await screen.findByText("1 pending")).textContent).toContain("1")
    fireEvent.click(screen.getByRole("button", { name: /sync now/i }))
    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText("1 pending")).toBeNull())
  })

  it("disables sync while a run is in flight", async () => {
    const queue = createScanQueue(createMemoryStorage())
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
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }))
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(
      true
    )
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
})
