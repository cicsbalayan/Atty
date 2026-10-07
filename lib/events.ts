import type { EventStatus, SchoolEvent } from "@/models/event"
import { EVENT_STATUSES } from "@/models/event"

/** Status tabs shown on the events listing, in display order. */
export const EVENT_FILTER_TABS = [
  "All",
  "Active",
  "Upcoming",
  "Closed",
] as const

export type EventFilterTab = (typeof EVENT_FILTER_TABS)[number]

/**
 * Reads ?status= with a safe fallback. Hand-edited junk degrades to "All"
 * instead of an empty listing.
 */
export function parseEventStatusParam(
  value: string | undefined
): EventFilterTab {
  return (EVENT_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as EventStatus)
    : "All"
}

/**
 * Start of an event as epoch millis. Handles both stored shapes: a single
 * ISO date and the pretty range "November 1, 2026 - November 3, 2026".
 * Unparseable dates sink (POSITIVE_INFINITY) so broken rows never lead.
 */
export function eventStartTime(event: SchoolEvent): number {
  const first = event.date.split(" - ")[0]?.trim() ?? ""
  const time = new Date(first).getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

const STATUS_RANK: Record<EventStatus, number> = {
  Active: 0,
  Upcoming: 1,
  Closed: 2,
}

/**
 * Listing order for the events page: actionable groups first
 * (Active → Upcoming → Closed), soonest upcoming first (ascending) and
 * most recently closed first (descending). Unknown statuses sink to the
 * end in backend order.
 */
export function sortEventsForListing(events: SchoolEvent[]): SchoolEvent[] {
  return [...events].sort((a, b) => {
    const rankA = STATUS_RANK[a.status] ?? 99
    const rankB = STATUS_RANK[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    const startA = eventStartTime(a)
    const startB = eventStartTime(b)
    // Closed reads as history (most recent first); everything else reads
    // as a schedule (soonest first).
    return a.status === "Closed" ? startB - startA : startA - startB
  })
}
