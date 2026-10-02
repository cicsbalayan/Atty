"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ApiError, closeEvent, openEvent } from "@/lib/api-client"
import { invalidatePrefix } from "@/hooks/useCached"
import type { SchoolEvent } from "@/models/event"

export function EventActions({ event }: { event: SchoolEvent }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      invalidatePrefix("events:")
      invalidatePrefix("dashboard:")
      router.refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {event.status !== "Active" && event.status !== "Closed" ? (
        <Button disabled={busy} onClick={() => void run(() => openEvent(event.id))} className="clay-btn">
          {busy ? "Working…" : "Mark Active"}
        </Button>
      ) : null}
      {event.status !== "Closed" ? (
        <Button
          disabled={busy}
          variant="destructive"
          onClick={() => void run(() => closeEvent(event.id))}
          className="clay-btn"
        >
          {busy ? "Working…" : "Close event"}
        </Button>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
