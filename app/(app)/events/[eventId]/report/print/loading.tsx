import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <article className="flex flex-col items-center gap-2" aria-label="Loading">
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-4 w-96" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="my-2 h-1 w-full" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-80" />
      <div className="mt-2 flex w-full flex-col gap-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
    </article>
  )
}
