import { NextResponse } from "next/server"
import { getAttendanceCachedFor } from "@/integration/cached"
import {
  filterAttendance,
  parseAttendanceFilters,
  toAttendanceCsv,
} from "@/lib/attendance"
import { requireAdmin } from "@/lib/auth/dal"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type ExportParams = { params: Promise<{ eventId: string }> }

/**
 * CSV export of attendance rows (FR-16). Accepts the same search/filter
 * query params as the attendance list, so organizers can export exactly
 * what they filtered: ?q=&college=&program=&yearLevel=&gender=
 */
export async function GET(request: Request, context: ExportParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const filters = parseAttendanceFilters(new URL(request.url).searchParams)
    const csv = toAttendanceCsv(
      filterAttendance(await getAttendanceCachedFor(eventId), filters)
    )
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${eventId}-attendance.csv"`,
      },
    })
  })
}
