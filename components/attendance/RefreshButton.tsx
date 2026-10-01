"use client"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { refreshAllReads, usePendingReads } from "@/hooks/useCached"

/**
 * Manual refresh for the event detail card.
 *
 * The attendance table and report are client-fetched and only refetch on
 * mount or when the filters change, so a board left open during check-in
 * keeps showing the count from when it loaded. This gives the organizer an
 * explicit way to pull the current numbers.
 *
 * Reads are served from the server cache first, so a refresh is usually
 * instant; the button only shows a wait when a check-in has invalidated the
 * data since it was last fetched.
 */
export function RefreshButton() {
  const busy = usePendingReads()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="clay-btn"
      disabled={busy}
      onClick={refreshAllReads}
    >
      <RefreshCw className={cn("size-4", busy && "animate-spin")} aria-hidden />
      Refresh
    </Button>
  )
}
