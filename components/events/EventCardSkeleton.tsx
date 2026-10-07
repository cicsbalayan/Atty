import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Loading stand-in for EventCard: title, id line, badge-side pill, three
 * meta rows, two action pills. Entirely presentational — no links, buttons,
 * or focusable content, so it can never be operated or tabbed into.
 */
export function EventCardSkeleton() {
  return (
    <Card className="clay-topglow" aria-hidden>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold tracking-tight">
            <Skeleton className="h-5 w-2/3" />
          </div>
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}
