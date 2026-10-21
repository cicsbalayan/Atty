"use client"

import * as React from "react"
import { Maximize, Minimize } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "atty:kiosk-focus"
const CHANGE_EVENT = "atty:kiosk-focus-change"

/**
 * Kiosk focus mode: hides the app chrome inside the current window without
 * the Fullscreen API, so a browser snapped to half the monitor stays there
 * while staff work in the other half.
 */
function readFocus(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

function applyFocus(active: boolean) {
  const root = document.documentElement
  if (active) root.setAttribute("data-kiosk-focus", "true")
  else root.removeAttribute("data-kiosk-focus")
}

function writeFocus(active: boolean) {
  try {
    if (active) window.sessionStorage.setItem(STORAGE_KEY, "true")
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can throw in private mode; focus mode still works for this page.
  }
  applyFocus(active)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribeFocus(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

export function FullscreenToggle() {
  const active = React.useSyncExternalStore(
    subscribeFocus,
    readFocus,
    () => false
  )

  React.useEffect(() => {
    applyFocus(active)
  }, [active])

  // Other routes must never lose their chrome. The preference stays in
  // sessionStorage, so the next check-in visit restores focus mode.
  React.useEffect(() => () => applyFocus(false), [])

  React.useEffect(() => {
    if (!active) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") writeFocus(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [active])

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={active ? "Exit focus mode" : "Enter focus mode"}
      aria-pressed={active}
      title={active ? "Exit focus mode" : "Enter focus mode"}
      className="clay-btn rounded-full"
      onClick={() => writeFocus(!active)}
    >
      {active ? (
        <Minimize className="size-4" aria-hidden />
      ) : (
        <Maximize className="size-4" aria-hidden />
      )}
    </Button>
  )
}
