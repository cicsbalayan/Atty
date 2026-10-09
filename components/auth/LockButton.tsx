/**
 * Sign-out control.
 *
 * Occupies the `UserSlot` that `DESIGN.md` reserved for an authenticated
 * user's identity. There is one role and no user records in this build, so
 * rather than invent a name to display, the slot carries the action that
 * actually matters here: clearing the session.
 *
 * That matters most on the kiosk. A shared door tablet holds a session for up
 * to 12 hours, so without an explicit lock the next person to use the device
 * inherits the previous one's access. One tap hands it back.
 */
"use client"

import * as React from "react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/api-client"

export function LockButton() {
  const [busy, setBusy] = React.useState(false)

  async function onClick() {
    if (busy) return
    setBusy(true)
    try {
      await logout()
    } finally {
      // A hard navigation, not a client-side push. Ending a session should
      // leave nothing of the authenticated view behind: a router push would
      // keep the previous page's RSC payload in the client cache, so going
      // back could re-render authenticated content from cache. A full
      // document load discards every client cache and lets the proxy make a
      // fresh auth decision. That is worth the extra round trip on a control
      // used a handful of times a day.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login")
    }
  }

  return (
    <Button
      variant="outline"
      onClick={() => void onClick()}
      disabled={busy}
      className="clay-btn rounded-full"
    >
      <LogOut className="size-4" aria-hidden /> Log out
    </Button>
  )
}
