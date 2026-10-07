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
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EventFormDialog } from "./EventFormDialog"
import { createEvent } from "@/lib/api-client"
import { formatEventDate } from "@/lib/format"
import { useOrganizations } from "@/hooks/useQueries"
import type { SchoolEvent } from "@/models/event"

vi.mock("@/lib/api-client", () => ({ createEvent: vi.fn() }))
vi.mock("@/hooks/useQueries", () => ({ useOrganizations: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

const orgs = [{ id: "ORG-001", name: "Batangas State University", email: "" }]

function mockOrgs(list: typeof orgs) {
  vi.mocked(useOrganizations).mockReturnValue({
    data: list.length ? { success: true as const, organizations: list } : null,
    error: null,
    loading: false,
    refresh: vi.fn(),
  })
}

function fillBasics() {
  fireEvent.change(screen.getByLabelText("Event name"), {
    target: { value: "Freshmen Orientation" },
  })
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-11-01" },
  })
}

async function chooseOrg(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Organizer" }))
  const option = await screen.findByRole("option", { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

describe("EventFormDialog", () => {
  it("submits the selected organization id", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.orgId).toBe("ORG-001")
  })

  it("submits the time string verbatim", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "12:00 pm - 5:00 pm" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.time).toBe("12:00 pm - 5:00 pm")
  })

  it("sends a single start date unchanged", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.date).toBe("2026-11-01")
  })

  it("serializes a start and end date as a range", async () => {
    vi.mocked(createEvent).mockResolvedValue({
      success: true,
      event: { id: "EVT-001" } as SchoolEvent,
    })
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-11-03" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledTimes(1)
    })
    const input = vi.mocked(createEvent).mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >
    expect(input.date).toBe(
      `${formatEventDate("2026-11-01")} - ${formatEventDate("2026-11-03")}`
    )
  })

  it("refuses an end date before the start date", async () => {
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    await chooseOrg("Batangas State University")
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: "2026-10-01" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("End date")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("marks the end date optional and links it to the field", async () => {
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    const hint = screen.getByText(/leave blank for one-day events/i)
    expect(hint.getAttribute("id")).toBe("dateEnd-hint")
    expect(screen.getByLabelText("End date").getAttribute("aria-describedby")).toBe(
      "dateEnd-hint"
    )
  })

  it("refuses to submit with no organization selected", async () => {
    mockOrgs(orgs)
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    fillBasics()
    fireEvent.click(screen.getByRole("button", { name: /^create event$/i }))
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("organizer")
    expect(createEvent).not.toHaveBeenCalled()
  })

  it("shows the empty-state prompt and disables submit with zero organizations", async () => {
    vi.mocked(useOrganizations).mockReturnValue({
      data: null,
      error: null,
      loading: false,
      refresh: vi.fn(),
    })
    render(<EventFormDialog />)
    fireEvent.click(screen.getByRole("button", { name: /new event/i }))
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          (element.textContent ?? "")
            .replace(/\s+/g, " ")
            .includes(
              "No organizers yet. Add one on the Organizers page first."
            )
      )
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: /^create event$/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
