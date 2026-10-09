import { getEventsCached, getOrganizationsCached } from "@/integration/cached"
import { EventSection } from "@/components/dashboard/EventSection"
import { StatCards } from "@/components/dashboard/StatCards"
import { requireAdminPage } from "@/lib/auth/dal"

export const metadata = { title: "Dashboard" }

/**
 * Rendered per request rather than prerendered at build time: the data
 * cache below already removes the upstream roundtrip, and prerendering
 * would freeze a build-time snapshot (or a build-time error) into HTML.
 * Freshness comes from the cached read plus tag expiry on mutation.
 */
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  await requireAdminPage()

  let events: Awaited<ReturnType<typeof getEventsCached>> = []
  let error: string | null = null
  try {
    events = await getEventsCached()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load events."
  }

  const active = events.filter((e) => e.status === "Active")
  const upcoming = events.filter((e) => e.status === "Upcoming")
  const closed = events.filter((e) => e.status === "Closed")

  // One cached read resolves every card's organization name; unknown or
  // missing orgs simply render no org row.
  const orgNames: Record<string, string> = Object.fromEntries(
    (await getOrganizationsCached().catch(() => [])).map((o) => [o.id, o.name])
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="display mt-1">Dashboard</h1>
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          {error} Check <span className="font-mono">APPS_SCRIPT_URL</span> configuration.
        </p>
      ) : null}
      <StatCards active={active.length} upcoming={upcoming.length} closed={closed.length} />
      <EventSection title="Active events" events={active} empty="No active events. Mark an upcoming event Active to start check-ins." orgNames={orgNames} />
      <EventSection title="Upcoming events" events={upcoming} empty="No upcoming events." orgNames={orgNames} />
      <EventSection title="Closed events" events={closed} empty="No closed events." orgNames={orgNames} />
    </div>
  )
}
