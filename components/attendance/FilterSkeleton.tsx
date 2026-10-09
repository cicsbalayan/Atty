import { Skeleton } from "@/components/ui/skeleton"

export function FilterSkeleton() {
  return (
    <div className="clay flex flex-col gap-3 p-4" aria-label="Loading filters">
      <Skeleton className="h-11" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
        <Skeleton className="h-11" />
      </div>
    </div>
  )
}
