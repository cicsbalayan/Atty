"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import type { ScanQueue } from "@/lib/offline/queue"
import { syncQueue, type SyncReport } from "@/lib/offline/sync"
import { useOnline } from "@/hooks/useOnline"

export function usePendingCount(queue: ScanQueue, eventId: string): number {
  const [count, setCount] = React.useState(0)
  React.useEffect(() => {
    let live = true
    const refresh = () => {
      queue.pendingCount(eventId).then((n) => {
        if (live) setCount(n)
      })
    }
    refresh()
    const unsubscribe = queue.subscribe(refresh)
    return () => {
      live = false
      unsubscribe()
    }
  }, [queue, eventId])
  return count
}

export function QueueStatus({
  eventId,
  queue,
  record,
  onReport,
  storageWarning = false,
}: {
  eventId: string
  queue: ScanQueue
  record: (eventId: string, srcode: string) => Promise<unknown>
  onReport: (report: SyncReport) => void
  storageWarning?: boolean
}) {
  const online = useOnline()
  const count = usePendingCount(queue, eventId)
  const [syncing, setSyncing] = React.useState(false)

  async function run() {
    if (syncing || !online) return
    setSyncing(true)
    try {
      onReport(await syncQueue({ queue, eventId, record }))
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync on reconnect when anything is queued.
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!online) return
    const timer = setTimeout(() => {
      void run()
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  if (count === 0 && !storageWarning) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      {storageWarning ? (
        <span role="note" className="text-sm text-muted-foreground">
          Local storage unavailable — queued scans won&apos;t survive a reload.
        </span>
      ) : null}
      {count > 0 ? (
        <>
          <span className="clay-pressed px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
            {count} pending
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="clay-btn"
            disabled={syncing || !online}
            onClick={() => void run()}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </>
      ) : null}
    </div>
  )
}
