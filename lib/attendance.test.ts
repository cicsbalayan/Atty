import { describe, expect, it } from "vitest"
import type { AttendanceRecord } from "@/models/attendance"
import {
  distinctFilterOptions,
  filterAttendance,
  parseAttendanceFilters,
  toAttendanceCsv,
} from "./attendance"

const records: AttendanceRecord[] = [
  {
    timestamp: "09/20/2026 08:01:23",
    srcode: "26-12345",
    name: "Juan Dela Cruz",
    college: "CICS",
    program: "BSIT",
    yearLevel: "First Year",
    gender: "Male",
  },
  {
    timestamp: "09/20/2026 08:03:17",
    srcode: "26-12346",
    name: "Maria Santos",
    college: "CICS",
    program: "BSCS",
    yearLevel: "Second Year",
    gender: "Female",
  },
  {
    timestamp: "09/20/2026 08:05:02",
    srcode: "26-12347",
    name: "Jose Rizal",
    college: "COE",
    program: "BSEE",
    yearLevel: "First Year",
    gender: "Male",
  },
]

function params(query: string): URLSearchParams {
  return new URL(`http://localhost/api?${query}`).searchParams
}

describe("parseAttendanceFilters", () => {
  it("reads supported params and drops blanks", () => {
    expect(
      parseAttendanceFilters(params("q=juan&college=CICS&program=&gender=Male"))
    ).toEqual({
      q: "juan",
      college: "CICS",
      program: undefined,
      yearLevel: undefined,
      gender: "Male",
    })
  })

  it("returns all-undefined for an empty query", () => {
    expect(parseAttendanceFilters(params(""))).toEqual({
      q: undefined,
      college: undefined,
      program: undefined,
      yearLevel: undefined,
      gender: undefined,
    })
  })
})

describe("filterAttendance", () => {
  it("returns everything when no filters are set", () => {
    expect(filterAttendance(records, {})).toHaveLength(3)
  })

  it("searches across srcode and name only (facets cover the rest)", () => {
    expect(filterAttendance(records, { q: "26-12346" })).toHaveLength(1)
    expect(filterAttendance(records, { q: "maria" })).toHaveLength(1)
    expect(filterAttendance(records, { q: "coe" })).toHaveLength(0)
    expect(filterAttendance(records, { q: "cics" })).toHaveLength(0)
    expect(filterAttendance(records, { q: "bs" })).toHaveLength(0)
    expect(filterAttendance(records, { q: "nobody" })).toHaveLength(0)
  })

  it("filters are case-insensitive and combine with AND", () => {
    expect(
      filterAttendance(records, { college: "cics", gender: "female" })
    ).toHaveLength(1)
    expect(
      filterAttendance(records, {
        q: "26-123",
        yearLevel: "First Year",
        program: "BSIT",
      })
    ).toHaveLength(1)
    expect(
      filterAttendance(records, { college: "CICS", gender: "Male" })
    ).toHaveLength(1)
  })
})

describe("distinctFilterOptions", () => {
  it("derives sorted, deduplicated options from the full list", () => {
    expect(distinctFilterOptions(records)).toEqual({
      colleges: ["CICS", "COE"],
      programs: ["BSCS", "BSEE", "BSIT"],
      yearLevels: ["First Year", "Second Year"],
      genders: ["Female", "Male"],
    })
  })

  it("trims values and drops blanks", () => {
    const options = distinctFilterOptions([
      { ...records[0], college: "  CICS  ", program: "   ", gender: "" },
    ])
    expect(options.colleges).toEqual(["CICS"])
    expect(options.programs).toEqual([])
    expect(options.genders).toEqual([])
  })

  it("returns empty options for an empty list", () => {
    expect(distinctFilterOptions([])).toEqual({
      colleges: [],
      programs: [],
      yearLevels: [],
      genders: [],
    })
  })
})

describe("toAttendanceCsv", () => {
  it("emits a BOM, header row, and one line per record", () => {
    const csv = toAttendanceCsv(records)
    expect(csv.startsWith("﻿")).toBe(true)
    const lines = csv.trim().split("\r\n")
    expect(lines[0]).toBe(
      "Timestamp,SRCODE,Full Name,College,Program,Year Level,Gender"
    )
    expect(lines).toHaveLength(4)
    expect(lines[1]).toContain("26-12345,Juan Dela Cruz,CICS,BSIT")
  })

  it("escapes commas, quotes, and newlines", () => {
    const csv = toAttendanceCsv([
      { ...records[0], name: 'Dela "The Comma, King" Cruz' },
    ])
    expect(csv).toContain('"Dela ""The Comma, King"" Cruz"')
  })

  it("still emits headers for an empty list", () => {
    expect(toAttendanceCsv([]).trim().split("\r\n")).toHaveLength(1)
  })
})
