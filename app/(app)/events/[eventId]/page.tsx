import Link from "next/link"
import { notFound } from "next/navigation"
import * as React from "react"
import { ScanLine } from "lucide-react"
import { getAttendanceCachedFor, getEventCachedFor, getOrganizationCachedFor } from "@/integration/cached"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EventActions } from "@/components/events/EventActions"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { AttendanceFilters } from "@/components/attendance/AttendanceFilters"
import { AttendanceTable } from "@/components/attendance/AttendanceTable"
import { RefreshButton } from "@/components/attendance/RefreshButton"
import { ExportButton } from "@/components/attendance/ExportButton"
import { ReportSummary } from "@/components/reports/ReportSummary"
import { Skeleton } from "@/components/ui/skeleton"
import { requireAdminPage } from "@/lib/auth/dal"
import { formatEventDate } from "@/lib/format"
import {
  distinctFilterOptions,
  parseAttendanceFilters,
} from "@/lib/attendance"
import type { AttendanceRecord } from "@/models/attendance"

export const dynamic = "force-dynamic"

/**
 * Streams in after the header: resolves the shared attendance promise
 * (started alongside the event fetch) into dropdown facet options.
 * Failure degrades to empty facets, never a broken page.
 */
async function FilterSection({
  eventId,
  data,
}: {
  eventId: string
  data: Promise<AttendanceRecord[]>
}) {
  let records: AttendanceRecord[] = []
  try {
    records = await data
  } catch {
    records = []
  }
  return <AttendanceFilters eventId={eventId} options={distinctFilterOptions(records)} />
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminPage()

  const { eventId } = await params
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v
  }
  const filters = parseAttendanceFilters(new URLSearchParams(flat))

  // Both reads start concurrently and the promise is created once, so the
  // header renders as soon as the event resolves while the filter facets
  // stream in via Suspense below. Both go through the persistent read
  // cache, so repeat views cost zero upstream roundtrips.
  const attendanceData = getAttendanceCachedFor(eventId)
  let event: Awaited<ReturnType<typeof getEventCachedFor>> | null = null
  try {
    event = await getEventCachedFor(eventId)
  } catch {
    notFound()
  }
  if (!event) notFound()
  // Keep the streaming child alive even if the options fetch fails later.
  void attendanceData.catch(() => [])

  const org = event.orgId
    ? await getOrganizationCachedFor(event.orgId).catch(() => null)
    : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{event.name}</CardTitle>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {event.id} · {formatEventDate(event.date)}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            {org?.name || event.time ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {[org?.name, event.time].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <EventStatusBadge status={event.status} />
        </CardHeader>
        <CardContent>
          {event.description ? <p className="text-sm">{event.description}</p> : null}
          <div className="flex flex-wrap gap-2">
            <EventActions event={event} />
            {event.status === "Active" ? (
              <Link
                href={`/events/${event!.id}/check-in`}
                className={buttonVariants({ size: "sm", className: "clay-btn" })}
              >
                <ScanLine className="size-4" aria-hidden /> Take Attendance
              </Link>
            ) : null}
            <ExportButton eventId={event.id} filters={filters} />
            <RefreshButton />
          </div>
        </CardContent>
      </Card>
      <ReportSummary eventId={event.id} />
      <React.Suspense
        fallback={
          <div className="clay flex flex-col gap-3 p-4" aria-label="Loading filters">
            <Skeleton className="h-11" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
        }
      >
        <FilterSection eventId={event.id} data={attendanceData} />
      </React.Suspense>
      <AttendanceTable eventId={event.id} filters={filters} />
    </div>
  )
}
