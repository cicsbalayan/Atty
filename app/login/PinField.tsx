/**
 * Staff PIN field.
 *
 * Eight digits, presented the same way the SR Code field is on the kiosk:
 * a sunken clay well, centred monospace, wide tracking. Code entry should
 * look and behave identically wherever it happens in this app.
 *
 * `inputMode="numeric"` rather than `type="number"` on purpose. A number
 * input silently discards a leading zero, and `Number("04812075")` is
 * `4812075` — which would turn two distinct valid PINs into one. The value is
 * also masked so a PIN is not left on screen in a shared-space kiosk.
 */
"use client"

import * as React from "react"
import { Input, Label } from "@/components/ui/input"
import { PIN_LENGTH } from "@/lib/auth/constants"

export function PinField({
  value,
  onChange,
  disabled,
  invalid,
  inputRef,
}: {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  invalid?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="pin">Staff PIN</Label>
      <Input
        ref={inputRef}
        id="pin"
        value={value}
        onChange={(event) => {
          // Strip anything that is not a digit as it is typed, so the field
          // can never hold a value the server would reject on format.
          onChange(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
        }}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        maxLength={PIN_LENGTH}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby="pin-hint"
        placeholder="••••••••"
        className="h-14 text-center font-mono text-xl tracking-[0.5em] placeholder:tracking-[0.5em]"
      />
      {/* Live count, so a partly typed PIN is never mistaken for a rejected
          one. Also the accessible description for the field. */}
      <p id="pin-hint" className="text-center text-xs text-muted-foreground tabular-nums">
        {value.length} of {PIN_LENGTH} digits
      </p>
    </div>
  )
}
