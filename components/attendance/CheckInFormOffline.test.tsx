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
import { ApiError, checkAttendance, recordAttendance } from "@/lib/api-client"
import { getSharedQueue } from "@/lib/offline/shared"

vi.mock("@/lib/api-client", () => ({
  checkAttendance: vi.fn(),
  recordAttendance: vi.fn(),
  ApiError: class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number) {
      super(message)
      this.name = "ApiError"
      this.code = code
      this.status = status
    }
  },
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

  it("shows the confirm UI (not queued) when the network succeeds", async () => {
    vi.mocked(checkAttendance).mockResolvedValue({
      success: true,
      check: {
        present: false,
        student: {
          srcode: "26-00001",
          name: "Juan Dela Cruz",
          college: "Engineering",
          program: "BS Computer Engineering",
          yearLevel: "3rd Year",
          gender: "Male",
        },
      },
    })
    render(
      <CheckInForm eventId="EVT-ONLINE-1" eventName="E" eventActive={true} />
    )
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /validate sr code/i }))
    await waitFor(() => {
      expect(screen.getByText("Juan Dela Cruz")).toBeTruthy()
    })
    expect(screen.queryByText(/queued/i)).toBeNull()
    expect(recordAttendance).not.toHaveBeenCalled()
    await expect(getSharedQueue().pendingCount("EVT-ONLINE-1")).resolves.toBe(0)
  })

  it("shows the error alert and queues nothing on SRCODE_NOT_FOUND", async () => {
    vi.mocked(checkAttendance).mockRejectedValue(
      new ApiError("SRCODE_NOT_FOUND", "Student not found.", 404)
    )
    render(
      <CheckInForm eventId="EVT-ONLINE-2" eventName="E" eventActive={true} />
    )
    fireEvent.change(screen.getByLabelText("Enter SR Code"), {
      target: { value: "26-00001" },
    })
    fireEvent.click(screen.getByRole("button", { name: /validate sr code/i }))
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Invalid SR Code")
    })
    expect(screen.queryByText(/queued/i)).toBeNull()
    expect(recordAttendance).not.toHaveBeenCalled()
    await expect(getSharedQueue().pendingCount("EVT-ONLINE-2")).resolves.toBe(0)
  })
})
