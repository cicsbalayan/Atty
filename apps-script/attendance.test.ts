import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { beforeEach, describe, expect, it } from "vitest"

/**
 * Runs the real Apps Script sources against a fake Sheets API.
 *
 * The .gs files are plain ES5 script files, so they can be evaluated in a
 * VM context with Google globals stubbed in. That lets these tests assert on
 * behaviour *and* on how many sheet reads a code path performs, which is the
 * whole point of the check-in latency work.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const scriptDir = path.resolve(here, "../apps-script")

const LOAD_ORDER = [
  "config.gs",
  "responses.gs",
  "models.gs",
  "sheets.gs",
  "students.gs",
  "organizations.gs",
  "events.gs",
  "attendance.gs",
  "reports.gs",
  "validators.gs",
  "auth.gs",
]

interface FakeOptions {
  masterlist?: string[][]
  events?: string[][]
  attendance?: string[][]
}

interface Harness {
  api: Record<string, any>
  reads: { masterlist: number; events: number; attendance: number; total: number }
  writes: number
}

/** Evaluates the .gs sources with Google globals stubbed. */
function loadScripts(options: FakeOptions = {}): Harness {
  const masterlist = options.masterlist ?? [
    ["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"],
    ["26-12345", "Juan Dela Cruz", "CICS", "BSIT", "First Year", "Male"],
    ["26-12346", "Maria Santos", "CICS", "BSCS", "Second Year", "Female"],
  ]
  const events = options.events ?? [
    ["Event ID", "Event Name", "Event Date", "Status", "Sheet Name", "Location", "Description"],
    ["EVT-001", "Freshmen Orientation", "09/20/2026", "Active", "EVT-001", "Gym", "Welcome"],
    ["EVT-002", "Closed One", "09/21/2026", "Closed", "EVT-002", "Hall", "Done"],
  ]
  const attendance = options.attendance ?? [
    ["Timestamp", "SRCODE"],
    ["09/20/2026 08:01:23", "26-12345"],
  ]

  const reads = { masterlist: 0, events: 0, attendance: 0, total: 0 }
  let writes = 0

  const store: Record<string, string[][]> = {
    Masterlist: masterlist,
    Events: events,
    EVT_001: attendance,
    EVT_002: [["Timestamp", "SRCODE"]],
  }
  const keyFor = (name: string) => name.replace(/-/g, "_")

  function makeSheet(name: string) {
    const rows = () => store[keyFor(name)]
    return {
      getName: () => name,
      getLastRow: () => rows().length,
      getLastColumn: () => (rows()[0]?.length ?? 0),
      getDataRange: () => ({
        getValues: () => {
          return rows().map((r) => r.slice())
        },
      }),
      getRange: (row: number, column: number, numRows?: number, numCols?: number) => ({
        getValues: () => {
          const all = rows()
          const out: string[][] = []
          const height = numRows ?? 1
          const width = numCols ?? 1
          for (let r = 0; r < height; r++) {
            const source = all[row - 1 + r]
            if (!source) {
              out.push(new Array(width).fill(""))
              continue
            }
            const line: string[] = []
            for (let c = 0; c < width; c++) line.push(source[column - 1 + c] ?? "")
            out.push(line)
          }
          return out
        },
        getValue: () => rows()[row - 1]?.[column - 1] ?? "",
        setValue: (value: string) => {
          writes += 1
          const all = rows()
          while (all.length < row) all.push([])
          all[row - 1][column - 1] = value
        },
      }),
      appendRow: (values: string[]) => {
        writes += 1
        store[keyFor(name)].push(values.slice())
      },
    }
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
        getSheetByName: (name: string) => (name in store ? makeSheet(name) : null),
        insertSheet: (name: string) => {
          store[keyFor(name)] = [["Timestamp", "SRCODE"]]
          return makeSheet(name)
        },
        openById: () => ({
          getSheetByName: (name: string) => (name in store ? makeSheet(name) : null),
        }),
      }),
      openById: () => ({
        getSheetByName: (name: string) => (name in store ? makeSheet(name) : null),
      }),
    },
    // Deliberately hostile: CacheService reads are network round trips, and
    // a previous version chunked the Masterlist index through them, turning
    // one bulk sheet read into a sequential chain of cache gets that
    // exhausted the upstream timeout. Any use here must fail the test.
    CacheService: {
      getScriptCache: () => {
        throw new Error(
          "CacheService must not be used on the check-in path: each read is a network round trip."
        )
      },
    },
    Utilities: {
      formatDate: (value: Date) =>
        `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}/${value.getFullYear()}`,
    },
    Session: { getScriptTimeZone: () => "Asia/Manila" },
    LockService: {
      getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => "test-secret",
        setProperty: () => {},
      }),
    },
  }

  const vm = require("node:vm") as typeof import("node:vm")
  const context = vm.createContext(sandbox)
  for (const file of LOAD_ORDER) {
    const source = readFileSync(path.join(scriptDir, file), "utf8")
    vm.runInContext(source, context, { filename: file })
  }

  const counted = {
    get masterlist() {
      return reads.masterlist
    },
    get events() {
      return reads.events
    },
    get attendance() {
      return reads.attendance
    },
    get total() {
      return reads.masterlist + reads.events + reads.attendance
    },
  }

  const buckets: Record<string, keyof typeof reads> = {
    Masterlist: "masterlist",
    Events: "events",
    EVT_001: "attendance",
    EVT_002: "attendance",
  }

  const api = sandbox as Record<string, any>

  // Wrap sheet value accessors so every read is counted, then re-point the
  // spreadsheet factories at the instrumented sheets.
  const wrap = (name: string) => {
    const sheet = makeSheet(name)
    const origRange = sheet.getRange
    const origData = sheet.getDataRange
    const bump = () => {
      const bucket = buckets[keyFor(name)]
      if (bucket) reads[bucket] += 1
    }
    sheet.getDataRange = () => {
      bump()
      return origData()
    }
    sheet.getRange = ((row: number, column: number, numRows?: number, numCols?: number) => {
      bump()
      return origRange(row, column, numRows, numCols)
    }) as typeof sheet.getRange
    return sheet
  }
  sandbox.SpreadsheetApp.getActiveSpreadsheet = () => ({
    getSheetByName: (name: string) => (keyFor(name) in store ? wrap(name) : null),
    insertSheet: (name: string) => {
      store[keyFor(name)] = [["Timestamp", "SRCODE"]]
      return wrap(name)
    },
  })
  sandbox.SpreadsheetApp.openById = () => ({
    getSheetByName: (name: string) => (keyFor(name) in store ? wrap(name) : null),
  })

  return { api, reads: counted, get writes() { return writes } } as Harness
}

describe("check-in read amplification", () => {
  let h: Harness
  beforeEach(() => {
    h = loadScripts()
  })

  it("records attendance without a second Events read", () => {
    h.api.Attendance.record("EVT-001", "26-12346")
    expect(h.writes).toBe(1)
    // One Events read (was two: findRowByValue + getValues).
    expect(h.reads.events).toBe(1)
  })

  it("reuses the cached Masterlist across a validate then record pair", () => {
    const before = h.reads.masterlist
    h.api.Attendance.check("EVT-001", "26-12345")
    const afterFirst = h.reads.masterlist
    h.api.Attendance.record("EVT-001", "26-12346")
    const afterSecond = h.reads.masterlist
    expect(afterFirst - before).toBe(1)
    // The second lookup must be served from cache, not re-read.
    expect(afterSecond).toBe(afterFirst)
  })

  it("still returns the student from the Masterlist when cached", () => {
    const result = h.api.Attendance.record("EVT-001", "26-12346")
    expect(result.student.name).toBe("Maria Santos")
    expect(result.student.college).toBe("CICS")
  })

  it("rejects an unknown srcode after a cache round trip", () => {
    h.api.Attendance.check("EVT-001", "26-12345")
    let code = ""
    try {
      h.api.Attendance.record("EVT-001", "99-99999")
    } catch (error) {
      code = (error as { code?: string }).code ?? ""
    }
    expect(code).toBe("SRCODE_NOT_FOUND")
  })

  it("still blocks a duplicate attendance row", () => {
    // 26-12345 is already present in the seeded sheet.
    let code = ""
    try {
      h.api.Attendance.record("EVT-001", "26-12345")
    } catch (error) {
      code = (error as { code?: string }).code ?? ""
    }
    expect(code).toBe("DUPLICATE_ATTENDANCE")
  })

  it("reports present with the original timestamp on re-check", () => {
    const result = h.api.Attendance.check("EVT-001", "26-12345")
    expect(result.present).toBe(true)
    expect(result.timestamp).toBe("09/20/2026 08:01:23")
  })

  it("refuses to record into a closed event", () => {
    let code = ""
    try {
      h.api.Attendance.record("EVT-002", "26-12345")
    } catch (error) {
      code = (error as { code?: string }).code ?? ""
    }
    expect(code).toBe("EVENT_NOT_ACTIVE")
  })
})

describe("Masterlist memoization", () => {
  it("serves repeat lookups without re-reading the Masterlist", () => {
    const h = loadScripts()
    h.api.Attendance.check("EVT-001", "26-12345")
    const afterFirst = h.reads.masterlist
    h.api.Attendance.record("EVT-001", "26-12346")
    // A warm container memoizes, so the second lookup adds no read.
    expect(afterFirst).toBe(1)
    expect(h.reads.masterlist).toBe(1)
  })

  it("re-reads after the memo is dropped", () => {
    const h = loadScripts()
    h.api.Attendance.check("EVT-001", "26-12345")
    expect(h.reads.masterlist).toBe(1)
    h.api.Students.refreshIndex()
    expect(h.reads.masterlist).toBe(2)
  })

  it("re-reads once the TTL has elapsed", () => {
    const h = loadScripts()
    h.api.Attendance.check("EVT-001", "26-12345")
    expect(h.reads.masterlist).toBe(1)
    // Age the memo past the TTL rather than waiting for it.
    h.api.Students.memo.at -= h.api.Students.INDEX_TTL_MS + 1
    h.api.Attendance.check("EVT-001", "26-12346")
    expect(h.reads.masterlist).toBe(2)
  })

  it("handles a large roster", () => {
    const rows: string[][] = [
      ["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"],
    ]
    for (let i = 0; i < 400; i++) {
      rows.push([
        `26-${String(i).padStart(5, "0")}`,
        `Student ${i}`,
        "CICS",
        "BSIT",
        "First Year",
        "Male",
      ])
    }
    const h = loadScripts({ masterlist: rows })
    const a = h.api.Attendance.check("EVT-001", "26-00001")
    expect(a.student.name).toBe("Student 1")
    const b = h.api.Attendance.record("EVT-001", "26-00399")
    expect(b.student.name).toBe("Student 399")
    // One read regardless of roster size, since nothing is chunked.
    expect(h.reads.masterlist).toBe(1)
  })
})
