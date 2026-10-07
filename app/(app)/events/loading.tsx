import { Skeleton } from "@/components/ui/skeleton"
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <EventCardSkeleton />
        <EventCardSkeleton />
        <EventCardSkeleton />
      </div>
    </div>
  )
}
