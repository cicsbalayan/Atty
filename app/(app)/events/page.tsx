import * as React from "react"
import { getEventsCached, getOrganizationsCached } from "@/integration/cached"
import { EventCard } from "@/components/events/EventCard"
import { EventFilters } from "@/components/events/EventFilters"
import { EventFormDialogLazy } from "@/components/events/EventFormDialogLazy"
import { requireAdminPage } from "@/lib/auth/dal"
import { parseEventStatusParam, sortEventsForListing } from "@/lib/events"

/**
 * Request-time rendered for the same reason as the dashboard, and because
 * the status/search filters come from searchParams. The cached read keeps
 * repeat views off the Apps Script roundtrip regardless.
 */
export const dynamic = "force-dynamic"

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdminPage()

  const params = await searchParams
  const status = parseEventStatusParam(params.status)
  const q = (params.q ?? "").toLowerCase()

  let events: Awaited<ReturnType<typeof getEventsCached>> = []
  let error: string | null = null
  try {
    events = await getEventsCached()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load events."
  }

  const searched = events.filter(
    (e) => !q || `${e.name} ${e.id} ${e.location}`.toLowerCase().includes(q)
  )
  const counts = {
    Active: searched.filter((e) => e.status === "Active").length,
    Upcoming: searched.filter((e) => e.status === "Upcoming").length,
    Closed: searched.filter((e) => e.status === "Closed").length,
  }
  // Actionable groups first (Active → Upcoming → Closed), soonest upcoming
  // first and most recently closed first.
  const filtered = sortEventsForListing(
    searched.filter((e) => status === "All" || e.status === status)
  )

  const orgNames: Record<string, string> = Object.fromEntries(
    (await getOrganizationsCached().catch(() => [])).map((o) => [o.id, o.name])
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground">
            Create, open, and track school events.
          </p>
        </div>
        <EventFormDialogLazy />
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <React.Suspense
          fallback={
            <div
              className="clay h-28 animate-pulse"
              aria-label="Loading filters"
            />
          }
        >
          <EventFilters counts={counts} />
        </React.Suspense>
      )}
      {error ? null : filtered.length === 0 ? (
        <p className="clay p-4 text-sm text-muted-foreground">
          No events match. Create the first one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              orgName={orgNames[event.orgId]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
