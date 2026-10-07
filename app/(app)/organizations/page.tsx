import { getOrganizationsCached } from "@/integration/cached"
import { OrganizationCard } from "@/components/organizations/OrganizationCard"
import { OrganizationFormDialogLazy } from "@/components/organizations/OrganizationFormDialogLazy"
import { requireAdminPage } from "@/lib/auth/dal"

/**
 * Request-time rendered: the list must reflect creates without a redeploy,
 * and the cached read keeps repeat views off the Apps Script roundtrip.
 */
export const dynamic = "force-dynamic"

export default async function OrganizationsPage() {
  await requireAdminPage()

  let organizations: Awaited<ReturnType<typeof getOrganizationsCached>> = []
  let error: string | null = null
  try {
    organizations = await getOrganizationsCached()
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load organizers."
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizers</h1>
          <p className="text-sm text-muted-foreground">
            The offices and schools using this tracker.
          </p>
        </div>
        <OrganizationFormDialogLazy />
      </div>
      {error ? (
        <p role="alert" className="clay p-4 text-sm text-destructive">
          {error}
        </p>
      ) : organizations.length === 0 ? (
        <p className="clay p-4 text-sm text-muted-foreground">
          No organizers yet. Add the first one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} organization={org} />
          ))}
        </div>
      )}
    </div>
  )
}
