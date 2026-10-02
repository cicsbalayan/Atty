import { CalendarX2 } from "lucide-react"
import { EventCard } from "@/components/events/EventCard"
import type { SchoolEvent } from "@/models/event"

export function EventSection({
  title,
  events,
  empty,
  orgNames,
}: {
  title: string
  events: SchoolEvent[]
  empty: string
  orgNames?: Record<string, string>
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2>{title}</h2>
      </div>
      {events.length === 0 ? (
        <p className="clay clay-dashed flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
          <CalendarX2 className="size-4 shrink-0" aria-hidden /> {empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} orgName={orgNames?.[event.orgId]} />
          ))}
        </div>
      )}
    </section>
  )
}
