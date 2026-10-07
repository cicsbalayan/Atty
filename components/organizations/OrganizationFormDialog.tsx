"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input, Label } from "@/components/ui/input"
import { ApiError, createOrganization } from "@/lib/api-client"
import { invalidatePrefix } from "@/hooks/useCached"
import type { CreateOrganizationInput } from "@/models/organization"

export function OrganizationFormDialog() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  async function onSubmit(form: FormData) {
    const name = String(form.get("name") ?? "").trim()
    if (!name) {
      setError("Enter an organizer name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const input: CreateOrganizationInput = {
        name,
        email: String(form.get("email") ?? "").trim(),
      }
      await createOrganization(input)
      invalidatePrefix("organizations:")
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not create organizer."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="clay-btn clay-btn-primary">
            <Plus className="size-4" aria-hidden /> New organizer
          </Button>
        }
      />
      <DialogContent>
          <DialogTitle>Create organizer</DialogTitle>
        <DialogDescription>
          The name and email appear on printed attendance reports.
        </DialogDescription>
        <form
          className="mt-4 flex flex-col gap-3"
          action={(form) => void onSubmit(form)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-name">Organizer name</Label>
            <Input
              id="org-name"
              name="name"
              required
              maxLength={150}
              placeholder="Batangas State University"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-email">Email</Label>
            <Input
              id="org-email"
              name="email"
              type="email"
              maxLength={150}
              placeholder="sscbalayan@g.batstate-u.edu.ph"
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving} className="clay-btn mt-1">
            {saving ? "Creating…" : "Create organizer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
