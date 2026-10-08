"use client"

import { WifiOff } from "lucide-react"
import { useOnline } from "@/hooks/useOnline"

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      className="clay flex items-center gap-2 p-3 text-sm text-muted-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      You are offline. Scans will queue and lists show saved copies.
    </p>
  )
}
