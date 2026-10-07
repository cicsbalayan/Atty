import { Skeleton } from "@/components/ui/skeleton"

export function AttendanceTableSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading attendance">
      <Skeleton className="h-10" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  )
}
