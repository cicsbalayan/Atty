/**
 * Admin sign-in form.
 *
 * Assembled entirely from existing design-system pieces: the sunken clay well
 * from `ui/input`, the puffy indigo pill from `.clay-btn-primary`, and the
 * error treatment copied from the kiosk's `CheckInForm`. No new CSS and no
 * new colour values, so the login page cannot drift from the rest of the app.
 */
"use client"

import * as React from "react"
import { LockKeyhole, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError, login } from "@/lib/api-client"
import { PIN_LENGTH } from "@/lib/auth/constants"
import { PIN_ERROR_ID, PinField } from "./PinField"

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [pin, setPin] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Autofocus on mount, matching the kiosk convention: the next thing the
  // operator does is type a code.
  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError(null)

    if (pin.length !== PIN_LENGTH) {
      setError(`Enter all ${PIN_LENGTH} digits.`)
      inputRef.current?.focus()
      return
    }

    setBusy(true)
    try {
      const res = await login(pin)
      if (!res.success) {
        setError(res.message ?? "Incorrect PIN.")
        setPin("")
        inputRef.current?.focus()
        return
      }
      // Full navigation rather than a client-side push. The session cookie
      // was just set and a server render on the destination is what picks it
      // up; a soft navigation would not re-run the proxy's auth decision.
      window.location.assign(redirectTo)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Please try again."
      )
      setPin("")
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="clay-topglow w-full max-w-lg">
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <PinField
            value={pin}
            onChange={(value) => {
              setPin(value)
              // Live gate: a rejected attempt is cleared as soon as the
              // operator starts typing again, so a stale error never sits
              // above a freshly entered PIN.
              if (error) setError(null)
            }}
            disabled={busy}
            invalid={Boolean(error)}
            inputRef={inputRef}
          />
          {/* Between the field and the button, in the order the eye already
              travelled. Icon plus text, never colour alone (DESIGN.md 5.3),
              and referenced by the field's aria-describedby so the input
              announces its own error rather than relying on this live region
              alone. */}
          {error ? (
            <p
              id={PIN_ERROR_ID}
              role="alert"
              className="clay-pressed flex items-start gap-2 p-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={busy || pin.length !== PIN_LENGTH}
            className="clay-btn clay-btn-primary h-12 text-base"
          >
            <LockKeyhole className="size-5" aria-hidden />
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
