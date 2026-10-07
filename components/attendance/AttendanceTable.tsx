"use client"

import * as React from "react"
import { formatDateOnly, formatTimeOnly } from "@/lib/format"
import { useAttendance } from "@/hooks/useQueries"
import type { AttendanceFilters as Filters } from "@/lib/attendance"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AttendanceTableSkeleton } from "@/components/attendance/AttendanceTableSkeleton"
import { Table, THead, TR, TH, TD } from "@/components/ui/table"

const PAGE_SIZE = 50

export function AttendanceTable({
  eventId,
  filters,
}: {
  eventId: string
  filters: Filters
}) {
  const { data, error, loading } = useAttendance(eventId, filters)
  const [page, setPage] = React.useState(0)
  const records = React.useDeferredValue(data?.attendance ?? [])
  const filterKey = JSON.stringify(filters)
  // Render-phase reset (React docs pattern): avoids setState-in-effect.
  const [prevKey, setPrevKey] = React.useState(`${eventId}:${filterKey}`)
  if (prevKey !== `${eventId}:${filterKey}`) {
    setPrevKey(`${eventId}:${filterKey}`)
    setPage(0)
  }

  if (loading && records.length === 0) {
    return <AttendanceTableSkeleton />
  }
  if (error) {
    return (
      <p role="alert" className="clay p-4 text-sm text-destructive">
        Could not load attendance: {error.message}
      </p>
    )
  }
  if (records.length === 0) {
    return (
      <p className="clay p-4 text-sm text-muted-foreground">
        No attendance records yet.
      </p>
    )
  }

  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const slice = records.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-2">
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
          {slice.map((r) => (
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
      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page + 1} of {pages} · {records.length} records
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="clay-btn"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="clay-btn"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
