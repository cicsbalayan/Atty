import { NextResponse } from "next/server"
import { checkAttendance } from "@/integration/attendance"
import { requireAdmin } from "@/lib/auth/dal"
import { parseJsonBody, requireString, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type CheckParams = { params: Promise<{ eventId: string }> }

export async function POST(request: Request, context: CheckParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const body = await parseJsonBody(request)
    const srcode = requireString(body, "srcode", 20)
    const check = await checkAttendance(eventId, srcode)
    return NextResponse.json({ success: true, check })
  })
}
