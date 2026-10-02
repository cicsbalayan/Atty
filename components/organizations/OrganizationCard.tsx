import { Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Organization } from "@/models/organization"

export function OrganizationCard({
  organization: org,
}: {
  organization: Organization
}) {
  return (
    <Card className="clay-topglow flex h-full flex-col">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="truncate">{org.name}</CardTitle>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {org.id}
          </p>
        </div>
      </CardHeader>
      {org.email ? (
        <CardContent className="flex-1">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden /> {org.email}
          </p>
        </CardContent>
      ) : null}
    </Card>
  )
}
