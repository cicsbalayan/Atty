import Link from "next/link"
import { ArrowRight, Building2, Clock, MapPin } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatEventDate } from "@/lib/format"
import type { SchoolEvent } from "@/models/event"
import { EventStatusBadge } from "./EventStatusBadge"

export function EventCard({ event, orgName }: { event: SchoolEvent; orgName?: string }) {
  return (
    <Card className="clay-topglow flex h-full flex-col transition-transform hover:-translate-y-0.5">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{event.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {event.id} · {formatEventDate(event.date)}
          </p>
        </div>
        <EventStatusBadge status={event.status} />
      </CardHeader>
      <CardContent className="flex-1">
        {orgName ? (
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Building2 className="size-3.5 shrink-0" aria-hidden /> {orgName}
          </p>
        ) : null}
        {event.time ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" aria-hidden /> {event.time}
          </p>
        ) : null}
        {event.location ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden /> {event.location}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Link href={`/events/${event.id}`} className={buttonVariants({ size: "sm", className: "clay-btn" })}>
            Open <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          {event.status === "Active" ? (
            <Link
              href={`/events/${event.id}/check-in`}
              className={buttonVariants({ size: "sm", variant: "secondary", className: "clay-btn" })}
            >
              Take Attendance
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
