"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ApiError, closeEvent, openEvent } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { invalidatePrefix } from "@/hooks/useCached"
import type { SchoolEvent } from "@/models/event"

export function EventActions({ event }: { event: SchoolEvent }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)

  async function run(action: () => Promise<unknown>, successMessage: string) {
    setBusy(true)
    try {
      await action()
      invalidatePrefix("events:")
      invalidatePrefix("dashboard:")
      toast.success(successMessage)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {event.status !== "Active" && event.status !== "Closed" ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(() => openEvent(event.id), "Event is now active.")
          }
          className="clay-btn"
        >
          {busy ? "Working…" : "Mark Active"}
        </Button>
      ) : null}
      {event.status !== "Closed" ? (
        <Button
          disabled={busy}
          variant="destructive"
          onClick={() => void run(() => closeEvent(event.id), "Event closed.")}
          className="clay-btn"
        >
          {busy ? "Working…" : "Close event"}
        </Button>
      ) : null}
    </div>
  )
}
