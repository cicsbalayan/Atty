/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { PaginatedReport, paginateRows } from "./PaginatedReport"
import type { ReportRow } from "./PaginatedReport"

afterEach(cleanup)

const rows: ReportRow[] = [
  { key: "a", srcode: "23-16300", name: "BAGUNAS, JOHN REY V.", yearLevel: "FOURTH YEAR", program: "BSIT" },
  { key: "b", srcode: "23-19015", name: "CAUSAPIN, IVERENE GRACE M.", yearLevel: "FOURTH YEAR", program: "BSIT" },
  { key: "c", srcode: "26-12797", name: "ALARAS, IVAN A.", yearLevel: "FIRST YEAR", program: "BSAET" },
]

const meta = { name: "Phase2 Verify", date: "2026-10-02", time: "12:00 pm - 1:00 am", location: "sa gate" }

describe("paginateRows", () => {
  it("keeps an empty table to a single sheet", () => {
    expect(paginateRows([], 100)).toEqual([[]])
  })

  it("keeps rows that fit on one sheet", () => {
    expect(paginateRows([10, 10, 10], 30)).toEqual([[0, 1, 2]])
  })

  it("starts a new sheet instead of splitting a row", () => {
    expect(paginateRows([10, 10, 10], 25)).toEqual([
      [0, 1],
      [2],
    ])
  })

  it("gives an oversized row a sheet of its own", () => {
    expect(paginateRows([100], 25)).toEqual([[0]])
  })

  it("packs several sheets greedily", () => {
    expect(paginateRows([10, 10, 10, 10, 10], 25)).toEqual([
      [0, 1],
      [2, 3],
      [4],
    ])
  })
})

describe("PaginatedReport", () => {
  it("renders the header, every row, and both footers", () => {
    // jsdom performs no layout, so every measured height is 0 and the whole
    // table stays on the single measuring sheet. That still proves the full
    // document renders: header copy, all rows, column heads, footer motto.
    // The motto renders twice by design -- once per screen sheet in flow and
    // once as the pinned print footer -- so each is asserted through its own
    // class rather than a text query that would match both.
    const { container } = render(
      <PaginatedReport eventMeta={meta} orgName="Org" orgEmail="org@example.edu" rows={rows} />
    )
    expect(screen.getByText("BATANGAS STATE UNIVERSITY")).toBeTruthy()
    expect(screen.getByText("Phase2 Verify")).toBeTruthy()
    for (const r of rows) {
      expect(screen.getByText(r.name)).toBeTruthy()
    }
    expect(screen.getAllByText("SR-CODE")).toHaveLength(1)
    expect(
      container
        .querySelector(".report-footer-screen")
        ?.textContent?.includes("Leading Innovations")
    ).toBe(true)
    expect(
      container.querySelector(".report-footer")?.textContent?.includes("Leading Innovations")
    ).toBe(true)
  })

  it("renders the empty state when there are no rows", () => {
    render(
      <PaginatedReport eventMeta={meta} orgName="Org" orgEmail="org@example.edu" rows={[]} />
    )
    expect(screen.getByText("No attendance records.")).toBeTruthy()
  })
})
