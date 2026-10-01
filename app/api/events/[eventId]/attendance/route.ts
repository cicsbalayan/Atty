import { NextResponse } from "next/server"
import { recordAttendance } from "@/integration/attendance"
import { getAttendanceCachedFor } from "@/integration/cached"
import { expireAttendance } from "@/integration/invalidate"
import { filterAttendance, parseAttendanceFilters } from "@/lib/attendance"
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
    const filters = parseAttendanceFilters(
      new URL(request.url).searchParams
    )
    const attendance = filterAttendance(
      await getAttendanceCachedFor(eventId),
      filters
    )
    return cachedJson(
      { success: true, attendance, total: attendance.length },
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
