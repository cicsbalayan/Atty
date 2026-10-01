import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Read-budget guard for the check-in hot path.
 *
 * Every Apps Script call is dominated by sheet reads, and a getValues() cost
 * scales with the rows it pulls. These tests assert a budget on read *calls*
 * and on masterlist *rows* touched, so a change that reintroduces a
 * full-sheet scan on every scan fails here rather than showing up as a slow
 * kiosk at the door.
 *
 * It asserts on the current implementation only. A "before" comparison would
 * have to simulate the old code by rewriting the sources, which can silently
 * stop applying and report flattering numbers.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const scriptDir = path.resolve(here, "../apps-script")
const FILES = [
  "config.gs",
  "responses.gs",
  "models.gs",
  "sheets.gs",
  "students.gs",
  "organizations.gs",
  "events.gs",
  "attendance.gs",
  "validators.gs",
  "auth.gs",
]

const MASTERLIST_ROWS = 2000

interface Counters {
  calls: { masterlist: number; events: number; attendance: number }
  masterlistRows: number
}

function harness(masterlistSize: number) {
  const masterlist: string[][] = [["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"]]
  for (let i = 0; i < masterlistSize; i++) {
    masterlist.push([
      `26-${String(i).padStart(5, "0")}`,
      `Student Number ${i}`,
      "CICS",
      "BSIT",
      "First Year",
      i % 2 ? "Male" : "Female",
    ])
  }

  const store: Record<string, string[][]> = {
    Masterlist: masterlist,
    Events: [
      ["Event ID", "Event Name", "Event Date", "Status", "Sheet Name", "Location", "Description"],
      ["EVT-001", "Big Event", "09/20/2026", "Active", "EVT-001", "Gym", ""],
    ],
    EVT_001: [["Timestamp", "SRCODE"]],
  }
  const keyFor = (n: string) => n.replace(/-/g, "_")
  const calls = { masterlist: 0, events: 0, attendance: 0 }
  const counters: Counters = { calls, masterlistRows: 0 }
  const bucket = (n: string) =>
    (n === "Masterlist" ? "masterlist" : n === "Events" ? "events" : "attendance") as
      | "masterlist"
      | "events"
      | "attendance"

  const sheet = (name: string) => {
    const rows = () => store[keyFor(name)]
    const getRange = (row: number, col: number, h?: number, w?: number) => ({
      getValues: () => {
        const all = rows()
        if (name === "Masterlist") counters.masterlistRows += h ?? 1
        const out: string[][] = []
        for (let r = 0; r < (h ?? 1); r++) {
          const line: string[] = []
          for (let c = 0; c < (w ?? 1); c++) line.push(all[row - 1 + r]?.[col - 1 + c] ?? "")
          out.push(line)
        }
        return out
      },
      getValue: () => rows()[row - 1]?.[col - 1] ?? "",
      setValue: (v: string) => {
        rows()[row - 1][col - 1] = v
      },
    })
    return {
      getLastRow: () => rows().length,
      getLastColumn: () => rows()[0]?.length ?? 0,
      getDataRange: () => ({
        getValues: () => {
          if (name === "Masterlist") counters.masterlistRows += rows().length
          return rows().map((r) => r.slice())
        },
      }),
      getRange,
      appendRow: (v: string[]) => {
        rows().push(v.slice())
      },
    }
  }

  const counted = (name: string) => {
    const s = sheet(name)
    const d = s.getDataRange
    const g = s.getRange
    s.getDataRange = () => {
      calls[bucket(name)] += 1
      return d()
    }
    s.getRange = ((a: number, b: number, c?: number, e?: number) => {
      calls[bucket(name)] += 1
      return g(a, b, c, e)
    }) as typeof s.getRange
    return s
  }

  const sandbox: Record<string, any> = {
    console,
    JSON,
    Date,
    parseInt,
    String,
    Number,
    Math,
    Object,
    Array,
    Error,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => (keyFor(n) in store ? counted(n) : null),
        insertSheet: (n: string) => {
          store[keyFor(n)] = [["Timestamp", "SRCODE"]]
          return counted(n)
        },
      }),
      openById: () => ({
        getSheetByName: (n: string) => (keyFor(n) in store ? counted(n) : null),
      }),
    },
    // CacheService reads are network round trips. A previous version chunked
    // the Masterlist index across them, so one bulk getValues() became a
    // sequential chain of cache gets that exhausted the upstream request
    // timeout and made event pages take 15-20s. Any use must fail loudly.
    CacheService: {
      getScriptCache: () => {
        throw new Error("CacheService must not be used on the check-in path.")
      },
    },
    Utilities: { formatDate: () => "01/01/2026" },
    Session: { getScriptTimeZone: () => "Asia/Manila" },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => "s", setProperty: () => {} }),
    },
  }

  const vm = require("node:vm") as typeof import("node:vm")
  const ctx = vm.createContext(sandbox)
  for (const f of FILES) {
    vm.runInContext(readFileSync(path.join(scriptDir, f), "utf8"), ctx, { filename: f })
  }

  return { api: sandbox as Record<string, any>, counters }
}

/** Runs the kiosk flow for N students: validate, then confirm. */
function checkIn(h: ReturnType<typeof harness>, students: number) {
  for (let i = 0; i < students; i++) {
    h.api.Attendance.check("EVT-001", `26-${String(i).padStart(5, "0")}`)
    h.api.Attendance.record("EVT-001", `26-${String(i).padStart(5, "0")}`)
  }
}

describe("check-in read budget", () => {
  it("reads the masterlist once for 5 students, not once per student", () => {
    const h = harness(MASTERLIST_ROWS)
    checkIn(h, 5)
    // Ten App Script calls, but the roster is read a single time.
    expect(h.counters.calls.masterlist).toBe(1)
    expect(h.counters.masterlistRows).toBe(MASTERLIST_ROWS + 1)
  })

  it("reads the Events registry once per App Script call", () => {
    const h = harness(MASTERLIST_ROWS)
    checkIn(h, 5)
    // 5 validates + 5 records = 10 calls, one Events read each.
    expect(h.counters.calls.events).toBe(10)
  })

  it("keeps the whole check-in under 20 sheet read calls", () => {
    const h = harness(MASTERLIST_ROWS)
    checkIn(h, 5)
    const total =
      h.counters.calls.masterlist + h.counters.calls.events + h.counters.calls.attendance
    expect(total).toBeLessThanOrEqual(20)
  })

  it("does not touch CacheService at all", () => {
    // The stub above throws, so simply completing proves it. This documents
    // why: network-backed cache reads made this path far slower.
    const h = harness(50)
    const result = h.api.Attendance.check("EVT-001", "26-00007")
    expect(result.student.name).toBe("Student Number 7")
  })

  it("stays correct for a large roster", () => {
    const h = harness(MASTERLIST_ROWS)
    const first = h.api.Attendance.check("EVT-001", "26-00000")
    expect(first.student.name).toBe("Student Number 0")
    const last = h.api.Attendance.record("EVT-001", `26-${String(MASTERLIST_ROWS - 1).padStart(5, "0")}`)
    expect(last.student.name).toBe(`Student Number ${MASTERLIST_ROWS - 1}`)
  })
})
