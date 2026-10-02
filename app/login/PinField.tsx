/**
 * Staff PIN field.
 *
 * Eight character cells, but ONE real input: a transparent `<input>` is
 * stretched over an `aria-hidden` grid of cells. That keeps this one field --
 * one tab stop, native paste, native numeric keypad, one screen-reader
 * announcement -- while looking like eight separate boxes.
 *
 * The active cell's ring is therefore the entire focus indicator, since the
 * input's own outline is invisible. It must stay legible against its
 * neighbours in both themes.
 *
 * `inputMode="numeric"` rather than `type="number"` on purpose. A number input
 * silently discards a leading zero, and `Number("04812075")` is `4812075` --
 * which would turn two distinct valid PINs into one. The value is masked so a
 * PIN is never readable over someone's shoulder on a shared kiosk.
 */
"use client"

import * as React from "react"
import { Input, Label } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PIN_LENGTH } from "@/lib/auth/constants"

/**
 * Id of the element describing this field's error.
 *
 * Exported rather than repeated as a literal in `LoginForm`, so the input's
 * `aria-describedby` and the error element's `id` cannot drift apart.
 */
export const PIN_ERROR_ID = "pin-error"

const CELLS = Array.from({ length: PIN_LENGTH }, (_, index) => index)

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
  // Starts false: `LoginForm` autofocuses in an effect, and a programmatic
  // `.focus()` fires a real focus event, so the ring appears on its own once
  // focus genuinely lands. An optimistic `true` would draw a focus ring on a
  // field that does not have focus.
  const [focused, setFocused] = React.useState(false)
  const activeIndex = value.length

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="pin">PIN</Label>
      <div className="relative">
        {/* Decorative mirror of the value. The input below is the field. */}
        <div
          data-testid="pin-cells"
          aria-hidden="true"
          className="grid grid-cols-8 gap-2"
        >
          {CELLS.map((index) => {
            const filled = index < value.length
            const active = focused && index === activeIndex
            return (
              <div
                key={index}
                data-testid={`pin-cell-${index}`}
                data-active={active ? "true" : "false"}
                className={cn(
                  "clay-input flex h-14 items-center justify-center",
                  active && "ring-2 ring-primary"
                )}
              >
                {filled ? (
                  <span
                    data-testid={`pin-filled-${index}`}
                    className="size-2.5 rounded-full bg-(--clay-heading)"
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        <Input
          ref={inputRef}
          id="pin"
          value={value}
          onChange={(event) => {
            // Strip anything that is not a digit as it is typed, so the field
            // can never hold a value the server would reject on format.
            onChange(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          maxLength={PIN_LENGTH}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? PIN_ERROR_ID : undefined}
          className="absolute inset-0 h-full w-full font-mono text-xl caret-transparent opacity-0"
        />
      </div>
    </div>
  )
}
