import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-xl flex-col gap-4"
      aria-label="Loading"
    >
      <div className="flex justify-end">
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="clay p-5 text-center">
        <Skeleton className="mx-auto h-3 w-24" />
        <Skeleton className="mx-auto mt-1 h-6 w-2/3" />
        <Skeleton className="mx-auto mt-1 h-4 w-1/2" />
      </div>
      <div className="clay flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-14" />
        <Skeleton className="h-12" />
      </div>
    </div>
  )
}
