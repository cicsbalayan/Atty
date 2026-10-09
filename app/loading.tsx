import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center gap-5 px-4 py-10"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Skeleton className="size-14 rounded-2xl" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="clay clay-topglow w-full max-w-lg p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <div className="grid grid-cols-8 gap-2" aria-hidden>
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
          <Skeleton className="h-12" />
        </div>
      </div>
    </div>
  )
}
