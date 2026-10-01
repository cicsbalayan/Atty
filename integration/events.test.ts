import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SchoolEvent } from "@/models/event"
import {
  closeEvent,
  createEvent,
  getEvent,
  getEvents,
  openEvent,
  updateEvent,
} from "./events"
import { requestAppsScript } from "./http"

vi.mock("./http", () => ({
  requestAppsScript: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)

const sampleEvent: SchoolEvent = {
  id: "EVT-001",
  name: "Freshmen Orientation",
  date: "09/20/2026",
  status: "Active",
  sheetName: "EVT-001",
  location: "Gymnasium",
  description: "Welcome event.",
  orgId: "ORG-001",
  time: "12:00 pm - 5:00 pm",
}

beforeEach(() => {
  requestMock.mockReset()
})

function mockSuccess(payload: object): void {
  requestMock.mockResolvedValue({ success: true, ...payload } as never)
}

describe("events integration", () => {
  it("lists events via getEvents", async () => {
    mockSuccess({ events: [sampleEvent] })
    await expect(getEvents()).resolves.toEqual([sampleEvent])
    expect(requestMock).toHaveBeenCalledWith("getEvents")
  })

  it("fetches a single event via getEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(getEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("getEvent", {
      eventId: "EVT-001",
    })
  })

  it("creates an event via createEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(
      createEvent({
        name: sampleEvent.name,
        date: "2026-09-20",
        location: "Gymnasium",
        description: "Welcome event.",
      })
    ).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "Gymnasium",
      description: "Welcome event.",
      orgId: "",
      time: "",
    })
  })

  it("defaults missing location/description/orgId/time to empty strings", async () => {
    mockSuccess({
      event: {
        ...sampleEvent,
        location: "",
        description: "",
        orgId: "",
        time: "",
      },
    })
    await createEvent({ name: sampleEvent.name, date: "2026-09-20" })
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "",
      description: "",
      orgId: "",
      time: "",
    })
  })

  it("forwards an orgId and time range when supplied", async () => {
    mockSuccess({ event: sampleEvent })
    await createEvent({
      name: sampleEvent.name,
      date: "2026-09-20",
      orgId: "ORG-001",
      time: "12:00 pm - 5:00 pm",
    })
    expect(requestMock).toHaveBeenCalledWith("createEvent", {
      name: sampleEvent.name,
      date: "2026-09-20",
      location: "",
      description: "",
      orgId: "ORG-001",
      time: "12:00 pm - 5:00 pm",
    })
  })

  it("closes an event via closeEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(closeEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("closeEvent", {
      eventId: "EVT-001",
    })
  })

  it("opens an event via openEvent", async () => {
    mockSuccess({ event: sampleEvent })
    await expect(openEvent("EVT-001")).resolves.toEqual(sampleEvent)
    expect(requestMock).toHaveBeenCalledWith("openEvent", {
      eventId: "EVT-001",
    })
  })

  it("propagates upstream errors", async () => {
    requestMock.mockRejectedValue(new Error("EVENT_NOT_FOUND"))
    await expect(getEvent("EVT-999")).rejects.toThrow("EVENT_NOT_FOUND")
  })

  it("updates an event via updateEvent", async () => {
    mockSuccess({ event: { ...sampleEvent, location: "Auditorium" } })
    await expect(
      updateEvent("EVT-001", { location: "Auditorium", status: "Active" })
    ).resolves.toMatchObject({ location: "Auditorium" })
    expect(requestMock).toHaveBeenCalledWith("updateEvent", {
      eventId: "EVT-001",
      location: "Auditorium",
      status: "Active",
    })
  })
})
