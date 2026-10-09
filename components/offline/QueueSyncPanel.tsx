"use client"

import * as React from "react"
import { recordAttendance } from "@/lib/api-client"
import { getSharedQueue, isMemoryFallback } from "@/lib/offline/shared"
import type { SyncReport } from "@/lib/offline/sync"
import { QueueStatus } from "./QueueStatus"
import { SyncReportDialog } from "./SyncReportDialog"
import { useToast } from "@/components/ui/toast"

export function QueueSyncPanel({ eventId }: { eventId: string }) {
  const toast = useToast()
  const [report, setReport] = React.useState<SyncReport | null>(null)
  const queue = React.useMemo(() => getSharedQueue(), [])

  function handleReport(next: SyncReport) {
    if (
      !next.pausedAuth &&
      next.results.length > 0 &&
      next.results.every(
        (r) => r.outcome === "recorded" || r.outcome === "already-present"
      )
    ) {
      toast.success("Sync complete.")
      return
    }
    setReport(next)
  }

  return (
    <>
      <QueueStatus
        eventId={eventId}
        queue={queue}
        record={recordAttendance}
        onReport={handleReport}
        storageWarning={isMemoryFallback()}
      />
      {report ? (
        <SyncReportDialog
          report={report}
          onClose={() => setReport(null)}
          onDiscard={(id) => {
            void queue.remove(id)
            setReport((current) =>
              current
                ? {
                    ...current,
                    results: current.results.filter((r) => r.scan.id !== id),
                  }
                : current
            )
          }}
        />
      ) : null}
    </>
  )
}
