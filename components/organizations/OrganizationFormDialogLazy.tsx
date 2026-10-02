"use client"

import dynamic from "next/dynamic"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

// Deferred until first interaction: pulls the dialog primitive subtree
// out of the initial /organizations bundle. Must live in a Client Component —
// `ssr: false` is not allowed in Server Components.
export const OrganizationFormDialogLazy = dynamic(
  () =>
    import("./OrganizationFormDialog").then((m) => m.OrganizationFormDialog),
  {
    ssr: false,
    loading: () => (
      <Button disabled className="clay-btn clay-btn-primary">
        <Plus className="size-4" aria-hidden /> New organization
      </Button>
    ),
  }
)
