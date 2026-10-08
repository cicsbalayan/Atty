import { notFound } from "next/navigation"
import { getEventCachedFor } from "@/integration/cached"
import { CheckInForm } from "@/components/attendance/CheckInForm"
import { FullscreenToggle } from "@/components/attendance/FullscreenToggle"
import { QueueSyncPanel } from "@/components/offline/QueueSyncPanel"
import { EventStatusBadge } from "@/components/events/EventStatusBadge"
import { requireAdminPage } from "@/lib/auth/dal"
import { formatEventDate } from "@/lib/format"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const event = await getEventCachedFor(eventId).catch(() => null)
  return { title: event ? `Check in · ${event.name}` : "Check in" }
}

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  // Staff authenticate once with the PIN, then operate the kiosk for the
  // life of the session. The door workflow is not left open to anonymous
  // callers, because recording attendance is a write to the spreadsheet.
  await requireAdminPage()

  const { eventId } = await params
  let event: Awaited<ReturnType<typeof getEventCachedFor>> | null = null
  try {
    event = await getEventCachedFor(eventId)
  } catch {
    notFound()
  }
  if (!event) notFound()

  return (
    <div className="kiosk mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex justify-end">
        <FullscreenToggle />
      </div>
      <div className="clay p-5 text-center">
        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          {event.id}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight uppercase">
          {event.name}
        </h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {formatEventDate(event.date)}{" "}
          <EventStatusBadge status={event.status} />
        </p>
      </div>
      <QueueSyncPanel eventId={event.id} />
      <CheckInForm
        eventId={event.id}
        eventName={event.name}
        eventActive={event.status === "Active"}
      />
    </div>
  )
}
