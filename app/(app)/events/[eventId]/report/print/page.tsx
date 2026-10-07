import Link from "next/link"
import { notFound } from "next/navigation"
import {
  getAttendanceCachedFor,
  getEventCachedFor,
  getOrganizationCachedFor,
} from "@/integration/cached"
import { filterAttendance, parseAttendanceFilters } from "@/lib/attendance"
import { requireAdminPage } from "@/lib/auth/dal"
import { PaginatedReport } from "@/components/reports/PaginatedReport"
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton"
import { PrintButton } from "@/components/reports/PrintButton"

export const dynamic = "force-dynamic"

export const metadata = { title: "Attendance Report" }

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The print view dumps every attendance row, so it is gated like any other
  // read. It stays inside the `(app)` group because `@media print` targets
  // `.app-shell` and `.app-chrome`; the gate is independent of the shell.
  await requireAdminPage()

  const { eventId } = await params
  const raw = await searchParams
  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") flat[k] = v
  }
  const filters = parseAttendanceFilters(new URLSearchParams(flat))

  const [event, attendance] = await Promise.all([
    getEventCachedFor(eventId).catch(() => null),
    getAttendanceCachedFor(eventId).catch(() => []),
  ])
  if (!event) notFound()
  const rows = filterAttendance(attendance, filters)

  // The letterhead identity belongs to the event's organization; events
  // without one keep the historic SSC identity.
  const org = event.orgId
    ? await getOrganizationCachedFor(event.orgId).catch(() => null)
    : null
  const orgName = org?.name.trim()
    ? org.name
    : "Supreme Student Council Alangilan – Balayan"
  const orgEmail = org?.email.trim()
    ? org.email
    : "sscbalayan@g.batstate-u.edu.ph"

  // Pagination needs live layout metrics, which only the browser has, so the
  // document itself renders client-side from plain data props. Everything
  // above this line stays server-side: the gate, the reads, and the filter.
  // The key remounts the paginator whenever its inputs change; measured chunk
  // indices from old rows must never address a new array, and a remount
  // restarts measurement from a clean single sheet.
  const signature = JSON.stringify([
    event.id,
    event.name,
    event.date,
    event.time,
    event.location,
    orgName,
    orgEmail,
    rows.map((r) => `${r.srcode}-${r.timestamp}`),
  ])
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/events/${event.id}`}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to event
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <DownloadPdfButton />
        </div>
      </div>

      <PaginatedReport
        key={signature}
        eventMeta={{
          name: event.name,
          date: event.date,
          time: event.time,
          location: event.location,
        }}
        orgName={orgName}
        orgEmail={orgEmail}
        rows={rows.map((r) => ({
          key: `${r.srcode}-${r.timestamp}`,
          srcode: r.srcode,
          name: r.name,
          yearLevel: r.yearLevel,
          program: r.program,
        }))}
      />
    </div>
  )
}
