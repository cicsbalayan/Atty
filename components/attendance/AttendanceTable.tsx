"use client"

import * as React from "react"
import { formatDateOnly, formatTimeOnly } from "@/lib/format"
import { useAttendance } from "@/hooks/useQueries"
import type { AttendanceFilters as Filters } from "@/lib/attendance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AttendanceTableSkeleton } from "@/components/attendance/AttendanceTableSkeleton"
import { Table, THead, TR, TH, TD } from "@/components/ui/table"
import type { AttendanceListResponse } from "@/models/api"

const PAGE_SIZE = 50

export function AttendanceTable({
  eventId,
  filters,
}: {
  eventId: string
  filters: Filters
}) {
  // 1-indexed to match the API. Only the current page is ever fetched, so
  // a 5,000-row event costs one page of rows per turn, not the full list.
  const [page, setPage] = React.useState(1)
  const filterKey = JSON.stringify(filters)
  // Render-phase reset (React docs pattern): avoids setState-in-effect.
  const [prevKey, setPrevKey] = React.useState(`${eventId}:${filterKey}`)
  if (prevKey !== `${eventId}:${filterKey}`) {
    setPrevKey(`${eventId}:${filterKey}`)
    setPage(1)
  }
  const { data, error, loading, fromSnapshot, savedAt } = useAttendance(
    eventId,
    filters,
    page,
    PAGE_SIZE
  )
  // Keep the previous page visible while the next one loads, scoped to the
  // current filter set so a filter change never flashes stale rows. Synced
  // in render (same React docs pattern as the reset above) because the
  // value is read during render.
  const scopeKey = `${eventId}:${filterKey}`
  const [lastView, setLastView] = React.useState<{
    scope: string
    data: AttendanceListResponse
  } | null>(null)
  if (data && (lastView?.data !== data || lastView?.scope !== scopeKey)) {
    setLastView({ scope: scopeKey, data })
  }
  const view = data ?? (lastView?.scope === scopeKey ? lastView.data : null)
  const fetching = loading && view !== null

  if (!view) {
    if (error) {
      return (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          Could not load attendance: {error.message}
        </p>
      )
    }
    return <AttendanceTableSkeleton />
  }
  if (view.total === 0) {
    return (
      <p className="clay p-4 text-sm text-muted-foreground">
        No attendance records yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={fetching || undefined}>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          Could not load this page: {error.message}
        </p>
      ) : null}
      <Table>
        <THead>
          <TR>
            <TH>Date</TH>
            <TH>Time</TH>
            <TH>SR Code</TH>
            <TH>Full Name</TH>
            <TH>Department</TH>
            <TH>Course</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <tbody>
          {view.attendance.map((r) => (
            <TR key={`${r.srcode}-${r.timestamp}`}>
              <TD className="whitespace-nowrap">
                {formatDateOnly(r.timestamp)}
              </TD>
              <TD className="whitespace-nowrap tabular-nums">
                {formatTimeOnly(r.timestamp)}
              </TD>
              <TD className="font-mono whitespace-nowrap">{r.srcode}</TD>
              <TD className="min-w-38">{r.name}</TD>
              <TD
                className="max-w-40 truncate text-muted-foreground"
                title={r.college}
              >
                {r.college}
              </TD>
              <TD
                className="min-w-30 truncate text-muted-foreground"
                title={r.program}
              >
                {r.program}
              </TD>
              <TD>
                <Badge variant="success">Present</Badge>
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          Page {view.page} of {view.pages} · {view.total} records
          {fetching ? " · Loading…" : ""}
          {fromSnapshot && savedAt !== null
            ? ` · Saved copy from ${formatTimeOnly(new Date(savedAt).toISOString())}`
            : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="clay-btn"
            disabled={fetching || view.page <= 1}
            onClick={() => setPage(view.page - 1)}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="clay-btn"
            disabled={fetching || view.page >= view.pages}
            onClick={() => setPage(view.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
