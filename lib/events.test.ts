import { describe, expect, it } from "vitest"
import type { SchoolEvent } from "@/models/event"
import {
  eventStartTime,
  parseEventStatusParam,
  sortEventsForListing,
} from "./events"

function event(overrides: Partial<SchoolEvent> & { id: string }): SchoolEvent {
  return {
    name: "Event",
    date: "2026-11-01",
    status: "Upcoming",
    sheetName: "Sheet",
    location: "",
    description: "",
    orgId: "",
    time: "",
    ...overrides,
  }
}

describe("parseEventStatusParam", () => {
  it("accepts known statuses", () => {
    expect(parseEventStatusParam("Active")).toBe("Active")
    expect(parseEventStatusParam("Closed")).toBe("Closed")
  })

  it("falls back to All for missing or junk values", () => {
    expect(parseEventStatusParam(undefined)).toBe("All")
    expect(parseEventStatusParam("All")).toBe("All")
    expect(parseEventStatusParam("incoming")).toBe("All")
  })
})

describe("eventStartTime", () => {
  it("reads a single ISO date", () => {
    expect(eventStartTime(event({ id: "a", date: "2026-11-01" }))).toBe(
      new Date("2026-11-01").getTime()
    )
  })

  it("reads the first date of a pretty range", () => {
    expect(
      eventStartTime(
        event({ id: "b", date: "November 1, 2026 - November 3, 2026" })
      )
    ).toBe(new Date("November 1, 2026").getTime())
  })

  it("sinks unparseable dates to the end", () => {
    expect(eventStartTime(event({ id: "c", date: "someday" }))).toBe(
      Number.POSITIVE_INFINITY
    )
  })
})

describe("sortEventsForListing", () => {
  it("groups Active, then Upcoming, then Closed", () => {
    const sorted = sortEventsForListing([
      event({ id: "closed", status: "Closed", date: "2026-01-01" }),
      event({ id: "upcoming", status: "Upcoming", date: "2026-12-01" }),
      event({ id: "active", status: "Active", date: "2026-10-01" }),
    ])
    expect(sorted.map((e) => e.id)).toEqual(["active", "upcoming", "closed"])
  })

  it("orders upcoming soonest-first and closed most-recent-first", () => {
    const sorted = sortEventsForListing([
      event({ id: "far", status: "Upcoming", date: "2026-12-01" }),
      event({ id: "near", status: "Upcoming", date: "2026-10-15" }),
      event({ id: "old", status: "Closed", date: "2026-01-01" }),
      event({ id: "recent", status: "Closed", date: "2026-09-01" }),
    ])
    expect(sorted.map((e) => e.id)).toEqual(["near", "far", "recent", "old"])
  })

  it("does not mutate the input", () => {
    const input = [
      event({ id: "b", status: "Closed", date: "2026-01-01" }),
      event({ id: "a", status: "Active", date: "2026-10-01" }),
    ]
    sortEventsForListing(input)
    expect(input[0].id).toBe("b")
  })
})
