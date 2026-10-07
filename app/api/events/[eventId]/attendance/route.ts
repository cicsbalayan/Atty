import { NextResponse } from "next/server"
import { recordAttendance } from "@/integration/attendance"
import { getAttendanceCachedFor } from "@/integration/cached"
import { expireAttendance } from "@/integration/invalidate"
import {
  filterAttendance,
  paginateRecords,
  parseAttendanceFilters,
  parsePaginationParams,
  sortAttendanceNewestFirst,
} from "@/lib/attendance"
import { requireAdmin } from "@/lib/auth/dal"
import {
  cachedJson,
  parseJsonBody,
  requireString,
  respondWith,
} from "@/lib/api"

export const dynamic = "force-dynamic"

type AttendanceParams = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, context: AttendanceParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const searchParams = new URL(request.url).searchParams
    const filters = parseAttendanceFilters(searchParams)
    const { page, pageSize } = parsePaginationParams(searchParams)
    // The upstream Apps Script read stays whole and cached (10s server
    // cache + tag invalidation on record), so repeat page turns cost one
    // sheet read total. Only the filtered page slice leaves this route,
    // cutting the client payload from O(n) to O(pageSize). The table shows
    // newest check-ins first; export and print keep chronological order.
    const filtered = filterAttendance(
      await getAttendanceCachedFor(eventId),
      filters
    )
    const paginated = paginateRecords(
      sortAttendanceNewestFirst(filtered),
      page,
      pageSize
    )
    return cachedJson(
      {
        success: true,
        attendance: paginated.records,
        total: paginated.total,
        page: paginated.page,
        pageSize: paginated.pageSize,
        pages: paginated.pages,
      },
      10
    )
  })
}

export async function POST(request: Request, context: AttendanceParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const body = await parseJsonBody(request)
    const srcode = requireString(body, "srcode", 20)
    const recorded = await recordAttendance(eventId, srcode)
    expireAttendance(eventId)
    return NextResponse.json(
      {
        success: true,
        message: "Attendance recorded successfully.",
        ...recorded,
      },
      { status: 201 }
    )
  })
}
