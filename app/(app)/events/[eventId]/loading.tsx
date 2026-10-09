import { Skeleton } from "@/components/ui/skeleton"
import { AttendanceTableSkeleton } from "@/components/attendance/AttendanceTableSkeleton"
import { FilterSkeleton } from "@/components/attendance/FilterSkeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading">
      <div className="clay clay-topglow flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-1 h-4 w-1/2" />
        </div>
        <div className="clay-pressed grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
      <div className="clay flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <FilterSkeleton />
      <AttendanceTableSkeleton />
    </div>
  )
}
