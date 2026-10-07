"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Input, Label } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { EVENT_FILTER_TABS, type EventFilterTab } from "@/lib/events"

/**
 * Status pills + search for the events listing. Drives ?status= and ?q= in
 * the URL (which the server page already honors), so pills are shareable
 * links and back-button safe with no backend change.
 */
export function EventFilters({
  counts,
}: {
  counts: Record<Exclude<EventFilterTab, "All">, number>
}) {
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get("status") ?? "All"

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value && value !== "All") next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(`/events${qs ? `?${qs}` : ""}`, { scroll: false })
  }

  return (
    <div className="clay flex flex-col gap-3 p-4">
      <div
        role="group"
        aria-label="Filter events by status"
        className="flex flex-wrap gap-2"
      >
        {EVENT_FILTER_TABS.map((tab) => {
          const isActive =
            tab === "All" ? !params.get("status") : active === tab
          const count =
            tab === "All"
              ? counts.Active + counts.Upcoming + counts.Closed
              : counts[tab]
          return (
            <button
              key={tab}
              type="button"
              aria-pressed={isActive}
              onClick={() => update("status", tab)}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: isActive ? "default" : "outline",
                  className: "clay-btn",
                }),
                isActive && "pointer-events-none"
              )}
            >
              {tab}
              <span className="font-mono text-xs opacity-70">{count}</span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="e-q">Search</Label>
        <span className="relative block">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="e-q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Name, ID, or location…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => update("q", e.target.value)}
            className="clay-search pl-11"
          />
        </span>
      </div>
    </div>
  )
}
