/**
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TOAST_DURATION_MS, ToastProvider, useToast } from "./toast"

function Probe() {
  const toast = useToast()
  return (
    <div>
      <button type="button" onClick={() => toast.success("Saved.")}>
        succeed
      </button>
      <button type="button" onClick={() => toast.error("Failed.")}>
        fail
      </button>
      <button
        type="button"
        onClick={() => {
          for (let i = 1; i <= 5; i += 1) toast.info(`Note ${i}.`)
        }}
      >
        burst
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ToastProvider>
      <Probe />
    </ToastProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("ToastProvider", () => {
  it("shows a success toast and dismisses it via the close button", () => {
    renderProbe()
    fireEvent.click(screen.getByText("succeed"))
    expect(screen.getByRole("status").textContent).toContain("Saved.")
    fireEvent.click(screen.getByLabelText("Dismiss notification"))
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("announces errors as alerts", () => {
    renderProbe()
    fireEvent.click(screen.getByText("fail"))
    expect(screen.getByRole("alert").textContent).toContain("Failed.")
  })

  it("caps the stack at three, dropping the oldest first", () => {
    renderProbe()
    fireEvent.click(screen.getByText("burst"))
    const notes = screen.getAllByRole("status")
    expect(notes).toHaveLength(3)
    expect(screen.queryByText("Note 1.")).toBeNull()
    expect(screen.queryByText("Note 2.")).toBeNull()
    expect(screen.getByText("Note 5.")).toBeTruthy()
  })

  it("auto-dismisses after a few seconds", () => {
    renderProbe()
    fireEvent.click(screen.getByText("succeed"))
    expect(screen.getByRole("status")).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS)
    })
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("throws outside the provider", () => {
    function Orphan() {
      useToast()
      return null
    }
    expect(() => render(<Orphan />)).toThrow(
      "useToast must be used within ToastProvider."
    )
  })
})
