"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Opens the browser print dialog, where the user picks the Save as PDF
    destination. Browsers expose no direct file-download API, so a true
    one-click download is not possible without a server-side PDF engine;
    this is the explicit download action next to Print. */
export function DownloadPdfButton() {
  return (
    <Button className="clay-btn" onClick={() => window.print()}>
      <Download className="size-4" aria-hidden /> Download PDF
    </Button>
  )
}
