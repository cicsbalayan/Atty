"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Explicit print action. It opens the browser print dialog, where the user
    picks a printer or Save as PDF. It never fires on its own: landing on the
    preview must not throw a system dialog at the user. */
export function PrintButton() {
  return (
    <Button className="clay-btn" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> Print
    </Button>
  )
}
