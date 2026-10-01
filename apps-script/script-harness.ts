import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Fake Google Sheets API for exercising the real `.gs` sources.
 *
 * The Apps Script files are plain ES5 scripts, so they can be evaluated in a
 * `node:vm` context with the Google globals stubbed in. This harness is the
 * shared, behaviour-only version: it records the row store so a test can
 * assert on what was actually written to a sheet, not just on the object the
 * backend returned.
 *
 * `attendance.test.ts` and `checkin-cost.test.ts` keep their own copies because
 * they additionally count sheet *reads*, which is what those suites are about.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const scriptDir = path.resolve(here, ".")

/**
 * Load order matters: `models.gs` and `sheets.gs` read `Config`, and
 * `Code.gs` resolves every handler lazily, so it can go last.
 */
export const LOAD_ORDER = [
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

export const ORG_HEADERS = ["Org ID", "Org Name", "Email"]

export const EVENT_HEADERS = [
  "Event ID",
  "Event Name",
  "Event Date",
  "Status",
  "Sheet Name",
  "Location",
  "Description",
  "Org ID",
  "Time",
]

/**
 * A sheet cell as Sheets actually hands it back. A date-formatted column can
 * arrive as a number when the sheet coerced it, so seeds are not all strings.
 */
export type Cell = string | number

/** One row: a list of cells. */
export type SeedRow = Cell[]

/** A sheet: a list of rows. */
export type SeedSheet = SeedRow[]

export interface SeedOptions {
  organizations?: SeedSheet
  events?: SeedSheet
  masterlist?: SeedSheet
}

export interface Harness {
  api: Record<string, any>
  /** Current rows of a sheet, so a test can assert on real writes. */
  rows(name: string): SeedSheet
}

const DEFAULT_ORGANIZATIONS: SeedSheet = [
  ORG_HEADERS,
  ["ORG-001", "Batangas State University", "sscbalayan@g.batstate-u.edu.ph"],
  ["ORG-002", "Batangas State University TNEU", ""],
]

const DEFAULT_EVENTS: SeedSheet = [
  EVENT_HEADERS,
  [
    "EVT-001",
    "Freshmen Orientation",
    "09/20/2026",
    "Active",
    "EVT-001",
    "Gym",
    "Welcome",
    "ORG-001",
    "12:00 pm - 5:00 pm",
  ],
]

const DEFAULT_MASTERLIST: SeedSheet = [
  ["SRCODE", "Full Name", "College", "Program", "Year Level", "Gender"],
  ["26-12345", "Juan Dela Cruz", "CICS", "BSIT", "First Year", "Male"],
]

/** Evaluates the `.gs` sources with Google globals stubbed in. */
export function loadScripts(options: SeedOptions = {}): Harness {
  // Rows are copied, not shared: `appendRow` mutates the store, and a module
  // level seed reused across harnesses would leak rows between tests.
  const seed = (rows: SeedSheet) => rows.map((row) => row.slice())
  const store: Record<string, SeedSheet> = {
    Masterlist: seed(options.masterlist ?? DEFAULT_MASTERLIST),
    Organizations: seed(options.organizations ?? DEFAULT_ORGANIZATIONS),
    Events: seed(options.events ?? DEFAULT_EVENTS),
    EVT_001: [["Timestamp", "SRCODE"]],
  }
  const keyFor = (name: string) => name.replace(/-/g, "_")

  function makeSheet(name: string) {
    const rows = () => store[keyFor(name)]
    return {
      getName: () => name,
      getLastRow: () => rows().length,
      getLastColumn: () => rows()[0]?.length ?? 0,
      getDataRange: () => ({
        getValues: () => rows().map((r) => r.slice()),
      }),
      getRange: (
        row: number,
        column: number,
        numRows?: number,
        numCols?: number
      ) => ({
        getValues: () => {
          const all = rows()
          const out: SeedSheet = []
          const height = numRows ?? 1
          const width = numCols ?? 1
          for (let r = 0; r < height; r++) {
            const source = all[row - 1 + r]
            if (!source) {
              out.push(new Array(width).fill(""))
              continue
            }
            const line: SeedRow = []
            for (let c = 0; c < width; c++) {
              line.push(source[column - 1 + c] ?? "")
            }
            out.push(line)
          }
          return out
        },
        getValue: () => rows()[row - 1]?.[column - 1] ?? "",
        setValue: (value: string) => {
          const all = rows()
          while (all.length < row) all.push([])
          all[row - 1][column - 1] = value
        },
      }),
        appendRow: (values: SeedRow) => {
          store[keyFor(name)].push(values.slice())
        },
        deleteRow: (row: number) => {
          rows().splice(row - 1, 1)
        },
    }
  }

  const spreadsheet = () => ({
    getSheetByName: (n: string) => (keyFor(n) in store ? makeSheet(n) : null),
    insertSheet: (n: string) => {
      store[keyFor(n)] = [["Timestamp", "SRCODE"]]
      return makeSheet(n)
    },
  })

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
      getActiveSpreadsheet: spreadsheet,
      openById: spreadsheet,
    },
    // Deliberately hostile: a cache read is a network round trip, so any use
    // of it on a request path must fail the suite rather than slow it down.
    CacheService: {
      getScriptCache: () => {
        throw new Error("CacheService must not be used on a request path.")
      },
    },
    Utilities: {
      formatDate: (value: Date) =>
        `${String(value.getMonth() + 1).padStart(2, "0")}/${String(
          value.getDate()
        ).padStart(2, "0")}/${value.getFullYear()}`,
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
    vm.runInContext(readFileSync(path.join(scriptDir, file), "utf8"), context, {
      filename: file,
    })
  }

  return {
    api: sandbox as Record<string, any>,
    rows: (name: string) => store[keyFor(name)],
  }
}
