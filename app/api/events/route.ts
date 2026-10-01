import { NextResponse } from "next/server"
import { createEvent } from "@/integration/events"
import { getEventsCached } from "@/integration/cached"
import { expireEvents } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import {
  cachedJson,
  optionalString,
  parseJsonBody,
  requireString,
  respondWith,
} from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  return respondWith(async () => {
    await requireAdmin()
    const events = await getEventsCached()
    return cachedJson({ success: true, events }, 30)
  })
}

export async function POST(request: Request) {
  return respondWith(async () => {
    await requireAdmin()
    const body = await parseJsonBody(request)
    const name = requireString(body, "name", 150)
    const date = requireString(body, "date")
    const location = optionalString(body, "location", 150)
    const description = optionalString(body, "description", 500)
    // Optional: the event form collects neither yet. The backend validates
    // orgId whenever it is present.
    const orgId = optionalString(body, "orgId", 20)
    const time = optionalString(body, "time", 100)
    const event = await createEvent({
      name,
      date,
      location,
      description,
      orgId,
      time,
    })
    expireEvents()
    return NextResponse.json(
      { success: true, message: "Event created successfully.", event },
      { status: 201 }
    )
  })
}
