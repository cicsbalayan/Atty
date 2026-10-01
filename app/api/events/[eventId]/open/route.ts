import { NextResponse } from "next/server"
import { openEvent } from "@/integration/events"
import { expireEvent } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type OpenParams = { params: Promise<{ eventId: string }> }

export async function POST(_request: Request, context: OpenParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { eventId } = await context.params
    const event = await openEvent(eventId)
    expireEvent(eventId)
    return NextResponse.json({
      success: true,
      message: "Event opened successfully.",
      event,
    })
  })
}
