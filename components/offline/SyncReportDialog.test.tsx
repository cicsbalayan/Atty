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
      <SyncReportDialog
        report={report}
        onClose={onClose}
        onDiscard={onDiscard}
      />
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
})
