import type { AttendanceRecord } from "@/models/attendance"

/**
 * Server-side search/filter for attendance records (FR-13/FR-14).
 *
 * Filtering happens in the Next.js layer over the joined attendance list,
 * so the Apps Script backend stays untouched and unfiltered responses
 * (no query params) behave exactly as before.
 */
export interface AttendanceFilters {
  /** Free-text search across SRCODE and name only (facets cover the rest). */
  q?: string
  college?: string
  program?: string
  yearLevel?: string
  gender?: string
}

export function parseAttendanceFilters(
  searchParams: URLSearchParams
): AttendanceFilters {
  const pick = (key: string): string | undefined => {
    const value = searchParams.get(key)?.trim()
    return value ? value : undefined
  }
  return {
    q: pick("q"),
    college: pick("college"),
    program: pick("program"),
    yearLevel: pick("yearLevel"),
    gender: pick("gender"),
  }
}

function matches(value: string, filter: string | undefined): boolean {
  if (!filter) return true
  return value.trim().toLowerCase() === filter.trim().toLowerCase()
}

export interface FilterOptions {
  colleges: string[]
  programs: string[]
  yearLevels: string[]
  genders: string[]
}

/**
 * Distinct dropdown values derived from the full (unfiltered) attendance
 * list, so facet options never shrink as filters are applied.
 */
export function distinctFilterOptions(records: AttendanceRecord[]): FilterOptions {
  // One pass populating four sets, rather than four map+Set passes with a
  // sort each: this runs over the full unfiltered list on every render of
  // the event detail page.
  const colleges = new Set<string>()
  const programs = new Set<string>()
  const yearLevels = new Set<string>()
  const genders = new Set<string>()

  for (const record of records) {
    const college = record.college.trim()
    if (college) colleges.add(college)
    const program = record.program.trim()
    if (program) programs.add(program)
    const yearLevel = record.yearLevel.trim()
    if (yearLevel) yearLevels.add(yearLevel)
    const gender = record.gender.trim()
    if (gender) genders.add(gender)
  }

  const sorted = (values: Set<string>): string[] =>
    [...values].sort((a, b) => a.localeCompare(b))

  return {
    colleges: sorted(colleges),
    programs: sorted(programs),
    yearLevels: sorted(yearLevels),
    genders: sorted(genders),
  }
}

export function filterAttendance(
  records: AttendanceRecord[],
  filters: AttendanceFilters
): AttendanceRecord[] {
  const q = filters.q?.trim().toLowerCase()
  if (!q) {
    // No free-text term: facet predicates alone, no per-record haystack.
    return records.filter(
      (record) =>
        matches(record.college, filters.college) &&
        matches(record.program, filters.program) &&
        matches(record.yearLevel, filters.yearLevel) &&
        matches(record.gender, filters.gender)
    )
  }
  return records.filter((record) => {
    const haystack = `${record.srcode} ${record.name}`.toLowerCase()
    if (!haystack.includes(q)) return false
    return (
      matches(record.college, filters.college) &&
      matches(record.program, filters.program) &&
      matches(record.yearLevel, filters.yearLevel) &&
      matches(record.gender, filters.gender)
    )
  })
}

const CSV_HEADERS = [
  "Timestamp",
  "SRCODE",
  "Full Name",
  "College",
  "Program",
  "Year Level",
  "Gender",
] as const

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Builds a UTF-8 CSV export of attendance rows (FR-16). The BOM prefix
 * keeps accented names readable when opened directly in Excel.
 */
export function toAttendanceCsv(records: AttendanceRecord[]): string {
  const lines = [
    CSV_HEADERS.join(","),
    ...records.map((record) =>
      [
        record.timestamp,
        record.srcode,
        record.name,
        record.college,
        record.program,
        record.yearLevel,
        record.gender,
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ]
  return `﻿${lines.join("\r\n")}\r\n`
}
