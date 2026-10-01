import { getAttendanceReportCachedFor } from "@/integration/cached"
import { requireAdmin } from "@/lib/auth/dal"
import { cachedJson, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type ReportParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, context: ReportParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const report = await getAttendanceReportCachedFor(eventId)
    return cachedJson({ success: true, report }, 15)
  })
}
