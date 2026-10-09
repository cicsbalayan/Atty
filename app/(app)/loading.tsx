import { Skeleton } from "@/components/ui/skeleton"
import { EventCardSkeleton } from "@/components/events/EventCardSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading">
      <Skeleton className="mt-1 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <div key={k} className="clay flex flex-row items-center gap-3 p-5">
            <Skeleton className="size-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((s) => (
        <section
          key={`section-${s}`}
          className="flex flex-col gap-3"
          aria-hidden
        >
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        </section>
      ))}
    </div>
  )
}
