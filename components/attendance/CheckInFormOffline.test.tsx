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
})
