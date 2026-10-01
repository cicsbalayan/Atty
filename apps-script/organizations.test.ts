import { describe, expect, it } from "vitest"
import { EVENT_HEADERS, loadScripts, ORG_HEADERS } from "./script-harness"

/**
 * Exercises the real `.gs` sources through the shared fake Sheets harness.
 *
 * Covers the Organizations registry — sequencing, partial updates, the
 * not-found path — and the two event fields that reference it.
 */

describe("organizations registry", () => {
  it("lists every organization row", () => {
    const all = loadScripts().api.Organizations.all()
    expect(all).toHaveLength(2)
    expect(all[0].id).toBe("ORG-001")
    expect(all[0].name).toBe("Batangas State University")
  })

  it("maps id, name, and email", () => {
    const org = loadScripts().api.Organizations.getById("ORG-001")
    expect(org.id).toBe("ORG-001")
    expect(org.name).toBe("Batangas State University")
    expect(org.email).toBe("sscbalayan@g.batstate-u.edu.ph")
  })

  it("returns an empty list when the sheet does not exist yet", () => {
    // A fresh spreadsheet has no Organizations tab; a read must not throw.
    const h = loadScripts({ organizations: [] })
    h.api.SpreadsheetApp.getActiveSpreadsheet = () => ({
      getSheetByName: () => null,
      insertSheet: () => {
        throw new Error("insertSheet must not be called on a read")
      },
    })
    expect(h.api.Organizations.all()).toEqual([])
  })

  it("creates an organization with the next sequential ID", () => {
    const h = loadScripts()
    const org = createOrg(h, "Nueva Eatry", "nueva@example.edu")
    expect(org.id).toBe("ORG-003")
    expect(org.name).toBe("Nueva Eatry")
    expect(h.rows("Organizations")).toHaveLength(4)
  })

  it("defaults a missing email to an empty string", () => {
    const org = createOrg(loadScripts(), "Bare Org")
    expect(org.email).toBe("")
  })

  it("pads the first organization ID to three digits", () => {
    const h = loadScripts({ organizations: [ORG_HEADERS] })
    expect(createOrg(h, "First Org").id).toBe("ORG-001")
  })

  it("rejects a name longer than the configured maximum", () => {
    expect(codeOf(() =>
      loadScripts().api.Organizations.handleCreate({ name: "x".repeat(151) })
    )).toBe("INVALID_REQUEST")
  })

  it("patches only the fields present in the update", () => {
    const org = loadScripts().api.Organizations.update("ORG-001", {
      email: "new@example.edu",
    })
    expect(org.email).toBe("new@example.edu")
    // Untouched fields keep their values.
    expect(org.name).toBe("Batangas State University")
  })

  it("ignores envelope fields on an organization update", () => {
    // Every request carries secret/adminKey/action; the update loop must skip
    // them instead of rejecting them as unknown fields.
    const res = loadScripts().api.Organizations.handleUpdate({
      orgId: "ORG-001",
      secret: "test-secret",
      adminKey: "test-key",
      action: "updateOrganization",
      email: "env@example.edu",
    })
    expect(res.success).toBe(true)
    expect(res.organization.email).toBe("env@example.edu")
  })

  it("writes the update to the sheet, not just the returned object", () => {
    const h = loadScripts()
    h.api.Organizations.update("ORG-001", { email: "new@example.edu" })
    expect(h.rows("Organizations")[1][2]).toBe("new@example.edu")
  })

  it("throws ORG_NOT_FOUND for an unknown ID", () => {
    expect(
      codeOf(() => loadScripts().api.Organizations.assertById("ORG-999"))
    ).toBe("ORG_NOT_FOUND")
  })

  it("wraps list and get results in the standard success envelope", () => {
    const api = loadScripts().api
    const list = api.Organizations.handleList()
    expect(list.success).toBe(true)
    expect(list.organizations).toHaveLength(2)

    const one = api.Organizations.handleGet({ orgId: "ORG-002" })
    expect(one.success).toBe(true)
    expect(one.organization.id).toBe("ORG-002")
  })
})

describe("events carry an organization and a time range", () => {
  it("reads orgId and time off the event row", () => {
    const event = loadScripts().api.Events.getById("EVT-001")
    expect(event.orgId).toBe("ORG-001")
    expect(event.time).toBe("12:00 pm - 5:00 pm")
  })

  it("yields empty strings for a pre-migration event row", () => {
    // A sheet written before the two columns were appended has shorter rows.
    const h = loadScripts({
      events: [
        EVENT_HEADERS.slice(0, 7),
        ["EVT-001", "Legacy", "09/20/2026", "Active", "EVT-001", "Gym", ""],
      ],
    })
    const event = h.api.Events.getById("EVT-001")
    expect(event.orgId).toBe("")
    expect(event.time).toBe("")
  })

  it("stores the time range verbatim", () => {
    const created = loadScripts().api.Events.create(
      "Council Night",
      "10/05/2026",
      "Hall",
      "",
      "ORG-002",
      "5:30 pm - 8:00 pm"
    )
    expect(created.time).toBe("5:30 pm - 8:00 pm")
    expect(created.orgId).toBe("ORG-002")
  })

  it("accepts a create with no organization at all", () => {
    const created = loadScripts().api.Events.create(
      "Open House",
      "10/06/2026",
      "",
      "",
      "",
      ""
    )
    expect(created.orgId).toBe("")
  })

  it("rejects a create naming an organization that does not exist", () => {
    const h = loadScripts()
    expect(
      codeOf(() =>
        h.api.Events.create("Bad Org", "10/07/2026", "", "", "ORG-999", "")
      )
    ).toBe("ORG_NOT_FOUND")
    // Rejected before anything was written, so no orphan attendance sheet.
    expect(h.api.Events.all()).toHaveLength(1)
    expect(h.api.Sheets.sheetByName("EVT-002")).toBeNull()
  })

  it("patches orgId and time on an existing event", () => {
    const event = loadScripts().api.Events.update("EVT-001", {
      time: "1:00 pm - 4:00 pm",
      orgId: "ORG-002",
    })
    expect(event.time).toBe("1:00 pm - 4:00 pm")
    expect(event.orgId).toBe("ORG-002")
  })

  it("rejects a patch naming an organization that does not exist", () => {
    expect(
      codeOf(() =>
        loadScripts().api.Events.update("EVT-001", { orgId: "ORG-999" })
      )
    ).toBe("ORG_NOT_FOUND")
  })

  it("rejects unknown fields on an update", () => {
    expect(
      codeOf(() =>
        loadScripts().api.Events.handleUpdate({
          eventId: "EVT-001",
          nonsense: "x",
        })
      )
    ).toBe("INVALID_REQUEST")
  })

  it("ignores envelope fields on an event update", () => {
    const res = loadScripts().api.Events.handleUpdate({
      eventId: "EVT-001",
      secret: "test-secret",
      adminKey: "test-key",
      action: "updateEvent",
      time: "2:00 pm - 3:00 pm",
    })
    expect(res.success).toBe(true)
    expect(res.event.time).toBe("2:00 pm - 3:00 pm")
  })
})

describe("organizations hard delete", () => {
  it("removes the row permanently", () => {
    const h = loadScripts()
    const org = h.api.Organizations.delete("ORG-002")
    expect(org.id).toBe("ORG-002")
    expect(h.rows("Organizations")).toHaveLength(2)
    const ids = h.api.Organizations.all().map((o: { id: string }) => o.id)
    expect(ids).toEqual(["ORG-001"])
  })

  it("leaves the deleted id unresolvable afterwards", () => {
    // Events keep their stored orgId string, but nothing resolves it, so an
    // event attached to a deleted org can no longer revalidate the reference.
    const h = loadScripts()
    h.api.Organizations.delete("ORG-001")
    expect(codeOf(() => h.api.Organizations.assertOptional("ORG-001"))).toBe(
      "ORG_NOT_FOUND"
    )
  })

  it("rejects deleting an unknown organization", () => {
    expect(codeOf(() => loadScripts().api.Organizations.handleDelete({ orgId: "ORG-999" }))).toBe(
      "ORG_NOT_FOUND"
    )
  })

  it("wraps delete in the standard success envelope", () => {
    const removed = loadScripts().api.Organizations.handleDelete({ orgId: "ORG-002" })
    expect(removed.success).toBe(true)
    expect(removed.organization.id).toBe("ORG-002")
  })
})

/** Creates an organization through the handler, unwrapping the envelope. */
function createOrg(h: ReturnType<typeof loadScripts>, name: string, email = "") {
  return h.api.Organizations.handleCreate({ name, email }).organization
}

/** Returns the AppError code a call throws, or "" when it does not throw. */
function codeOf(run: () => unknown): string {
  try {
    run()
    return ""
  } catch (error) {
    return (error as { code?: string }).code ?? ""
  }
}
