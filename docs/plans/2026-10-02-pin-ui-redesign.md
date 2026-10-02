# PIN Sign-in UI Redesign -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single masked PIN text field with eight designed character cells backed by one real input, relocate the error beneath the field with an icon and correct ARIA wiring, and strip the two pieces of copy that carry no information.

**Architecture:** `PinField` becomes a `relative` wrapper holding an eight-cell grid (track derived from `PIN_LENGTH`) plus a single absolutely positioned, transparent real `<input>` layered over it. The grid is `aria-hidden`; the input stays the single accessible field, so tab order, paste, the mobile keypad, and screen-reader behaviour are all inherited unchanged. `LoginForm` moves its error block between the field and the button, gives it an id and a `TriangleAlert` icon, and `page.tsx` loses the subtitle.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 with the clay token system, Vitest plus `@testing-library/react` in jsdom. No new dependencies.

**Spec:** `docs/specs/2026-10-02-pin-ui-redesign-design.md`

## Global Constraints

- Every file under 400 lines. The repo enforces this by convention (`README.md`).
- **No new npm dependencies.** `@testing-library/react` and `jsdom` are already dev dependencies; `lucide-react` already ships `TriangleAlert`.
- **No new colour values.** Every colour resolves through an existing token or utility: `.clay-input`, `.clay-pressed`, `ring-primary`, `--clay-heading`. Raw hex outside `app/globals.css` is forbidden by `DESIGN.md`.
- **No raw CSS additions.** This plan changes no rule in `app/globals.css`. Everything is Tailwind utilities plus existing `.clay-*` component classes.
- `app/login/page.tsx` must NOT call `requireAdminPage()` -- it is the public entry point, and `lib/auth/cache-isolation.test.ts:91-96` fails the build if it does. Leave its auth surface untouched.
- Do not modify `lib/auth/**`, `app/api/auth/**`, or `components/auth/LockButton.tsx`. This plan is presentation only.
- Do not add a lockout countdown, an on-screen keypad, a forgot-PIN flow, or signed-out messaging. All four are recorded non-goals in the spec.
- Keep `inputMode="numeric"` rather than `type="number"`: a number input discards a leading zero, which would collapse two distinct valid PINs into one (`app/login/PinField.tsx:8-12`).
- Keep `autoComplete="off"`: this is a shared kiosk secret, deliberately kept out of password managers.
- Prettier: `semi: false`, double quotes, 2-space, `printWidth: 80`, `trailingComma: "es5"`.
- **Do not run `npm run format`.** It is repo-wide and rewrites dozens of pre-existing files because the repo is not prettier-clean. Format only the files you touch:
  `npx prettier --write app/login/PinField.tsx app/login/LoginForm.tsx app/login/page.tsx app/login/PinField.test.tsx app/login/LoginForm.test.tsx`

## Decisions This Plan Fixes

Settled with the requester on 2026-10-02; not reopenable during execution. Full
rationale is in the spec.

1. **Eight cells drawn from one real input**, not eight real `<input>` elements.
2. **The active cell ring is the focus indicator.** The real input is transparent,
   so its native outline is invisible and the ring carries the whole affordance.
3. **`focused` state initialises to `false`.** `LoginForm` autofocuses in an
   effect; a programmatic `.focus()` fires a real focus event, so the ring
   appears once focus genuinely lands. An optimistic `true` would draw a focus
   ring on a field that does not have focus.
4. **Card widens to `max-w-lg`.** `max-w-md` yields 43px cells, under the 44px
   minimum touch target in `DESIGN.md` section 5.6. `max-w-lg` yields 51px.
5. **Cells stay masked** -- a filled cell shows a dot, never the digit.
6. **The cell grid is `aria-hidden="true"`.** It duplicates what the input
   already exposes.
7. **The error id is a shared constant.** `PinField` exports `PIN_ERROR_ID` and
   uses it for `aria-describedby`; `LoginForm` imports it for the element id. No
   new prop, no duplicated magic string.
8. **Copy cuts:** delete the subtitle paragraph and the "N of 8 digits" counter.
   Label becomes "PIN". Heading becomes "Sign in".

## File Structure

| File | Responsibility |
| --- | --- |
| `app/login/PinField.tsx` | Owns the eight cells, the overlay input, focus tracking, digit masking, and `PIN_ERROR_ID`. |
| `app/login/LoginForm.tsx` | Owns form state, submission, and the relocated accessible error block. |
| `app/login/page.tsx` | Server shell: brand block, heading, copy cuts, spacing. |
| `app/login/PinField.test.tsx` | New. Cell rendering, masking, digit stripping, length cap, active-cell movement. |
| `app/login/LoginForm.test.tsx` | New. Error order, ARIA wiring, button gating, error clearing. |

---

### Task 1: Segmented PIN field

**Files:**
- Modify: `app/login/PinField.tsx`
- Test: `app/login/PinField.test.tsx`

**Interfaces:**
- Consumes: `PIN_LENGTH` from `@/lib/auth/constants`; `Input` and `Label` from
  `@/components/ui/input`; `cn` from `@/lib/utils`.
- Produces: `PIN_ERROR_ID` (exported constant, string `"pin-error"`), and the
  existing `PinField` props `value`, `onChange`, `disabled`, `invalid`,
  `inputRef` -- all unchanged. Task 2 consumes `PIN_ERROR_ID`.

- [ ] **Step 1: Write the failing test**

Create `app/login/PinField.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { PIN_LENGTH } from "@/lib/auth/constants"
import { PinField } from "./PinField"

// `@testing-library/jest-dom` is NOT a dependency of this repo and vitest has
// no `setupFiles`, so jest-dom matchers (`toHaveAttribute`, `toBeDisabled`)
// do not exist. Assert through the DOM directly, exactly as
// `hooks/useCached.test.tsx` does with plain matchers.

afterEach(cleanup)

function ref(): React.RefObject<HTMLInputElement | null> {
  return { current: null }
}

describe("PinField", () => {
  it("renders one text input and eight hidden decorative cells", () => {
    render(<PinField value="" onChange={() => {}} inputRef={ref()} />)
    const input = screen.getByLabelText("PIN") as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    // `pin-cells` (the container) must not match this pattern, so the count
    // is exactly the eight cells.
    expect(screen.getAllByTestId(/^pin-cell-/)).toHaveLength(PIN_LENGTH)
    // The grid duplicates what the input already exposes, so it is hidden
    // from assistive technology rather than announced twice.
    expect(screen.getByTestId("pin-cells").getAttribute("aria-hidden")).toBe("true")
  })

  it("renders a dot per entered digit and never the digit itself", () => {
    render(<PinField value="12" onChange={() => {}} inputRef={ref()} />)
    expect(screen.getByTestId("pin-filled-0")).toBeTruthy()
    expect(screen.getByTestId("pin-filled-1")).toBeTruthy()
    expect(screen.queryByTestId("pin-filled-2")).toBeNull()
    expect(document.body.textContent).not.toContain("12")
  })

  it("strips non-digit characters as they are typed", () => {
    const seen: string[] = []
    render(<PinField value="" onChange={(v) => seen.push(v)} inputRef={ref()} />)
    fireEvent.change(screen.getByLabelText("PIN"), { target: { value: "4a2-3" } })
    expect(seen).toEqual(["423"])
  })

  it("caps the value at PIN_LENGTH", () => {
    const seen: string[] = []
    render(<PinField value="" onChange={(v) => seen.push(v)} inputRef={ref()} />)
    fireEvent.change(screen.getByLabelText("PIN"), {
      target: { value: "12345678901234" },
    })
    expect(seen[0]).toHaveLength(PIN_LENGTH)
  })

  it("moves the active cell as digits are entered", () => {
    const view = render(
      <PinField value="123" onChange={() => {}} inputRef={ref()} />
    )
    expect(view.getByTestId("pin-cell-3").getAttribute("data-active")).toBe("true")
    expect(view.getByTestId("pin-cell-0").getAttribute("data-active")).toBe("false")
  })

  it("marks no cell active while the field is blurred", () => {
    const view = render(
      <PinField value="123" onChange={() => {}} inputRef={ref()} />
    )
    const input = screen.getByLabelText("PIN")
    fireEvent.focus(input)
    expect(view.getByTestId("pin-cell-3").getAttribute("data-active")).toBe("true")
    fireEvent.blur(input)
    // A focus ring on a field that does not have focus is the one thing a
    // focus indicator must never do.
    for (let i = 0; i < PIN_LENGTH; i += 1) {
      expect(view.getByTestId(`pin-cell-${i}`).getAttribute("data-active")).toBe(
        "false"
      )
    }
  })

  it("points aria-describedby at the error only while invalid", () => {
    const view = render(
      <PinField value="" onChange={() => {}} invalid inputRef={ref()} />
    )
    const input = screen.getByLabelText("PIN")
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.getAttribute("aria-describedby")).toBe("pin-error")
    view.rerender(<PinField value="" onChange={() => {}} inputRef={ref()} />)
    expect(screen.getByLabelText("PIN").hasAttribute("aria-describedby")).toBe(
      false
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/login/PinField.test.tsx`
Expected: FAIL. The existing `PinField` renders no `pin-cell` test ids, no
`data-active`, and always sets `aria-describedby="pin-hint"`.

- [ ] **Step 3: Rewrite `PinField.tsx`**

Replace `app/login/PinField.tsx` in full:

```tsx
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
    // Clamped, not raw: with a full PIN, value.length runs to 8 while CELLS
  // stops at 7, so the raw length would leave the focused field with no ring
  // at all -- a WCAG 2.4.7 Focus Visible failure. Cell 7 keeps the ring on a
  // complete PIN. Human ruling 2026-10-02, overrides the raw length this plan
  // originally carried.
  const activeIndex = Math.min(value.length, PIN_LENGTH - 1)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="pin">PIN</Label>
      <div className="relative">
        {/* Decorative mirror of the value. The input below is the field. */}
        <div
          data-testid="pin-cells"
          aria-hidden="true"
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${PIN_LENGTH}, minmax(0, 1fr))` }}
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
                  // Outline, not ring: ring-* writes box-shadow and would
                  // clobber .clay-input's inset sunken well on this same
                  // element. Human ruling 2026-10-02, overrides the
                  // ring-2 text this plan originally carried.
                  active && "outline-2 outline-offset-3 outline-primary"
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
          className="absolute inset-0 h-full w-full opacity-0 font-mono text-xl caret-transparent"
        />
      </div>
    </div>
  )
}
```

Notes on one detail: `bg-(--clay-heading)` is Tailwind 4's CSS-variable syntax.
If the installed Tailwind version rejects it, use `bg-[var(--clay-heading)]`,
which is the documented arbitrary-value escape hatch.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/login/PinField.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green. `lib/auth/cache-isolation.test.ts` must still pass, which
is what proves `page.tsx` was not given an auth gate.

- [ ] **Step 6: Commit**

```bash
npx prettier --write app/login/PinField.tsx app/login/PinField.test.tsx
git add app/login/PinField.tsx app/login/PinField.test.tsx
git commit -m "feat(login): render the staff PIN as eight designed cells"
```

---

### Task 2: Relocate and wire the error

**Files:**
- Modify: `app/login/LoginForm.tsx`
- Test: `app/login/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `PinField` and `PIN_ERROR_ID` from Task 1.
- Produces: no new exports. `LoginForm`'s signature is unchanged.

- [ ] **Step 1: Write the failing test**

Create `app/login/LoginForm.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LoginForm } from "./LoginForm"

// `@testing-library/jest-dom` is NOT a dependency of this repo and vitest has
// no `setupFiles`, so jest-dom matchers do not exist. Assert through the DOM.

const login = vi.fn()

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client")
  return { ...actual, login: (...args: unknown[]) => login(...args) }
})

beforeEach(() => {
  login.mockReset()
})

afterEach(cleanup)

function type(value: string) {
  fireEvent.change(screen.getByLabelText("PIN"), { target: { value } })
}

function submit() {
  const input = screen.getByLabelText("PIN")
  fireEvent.submit(input.closest("form") as HTMLFormElement)
}

function button(): HTMLButtonElement {
  return screen.getByRole("button", { name: /sign in/i }) as HTMLButtonElement
}

describe("LoginForm", () => {
  it("keeps the submit button disabled below a full PIN", () => {
    render(<LoginForm redirectTo="/" />)
    expect(button().disabled).toBe(true)
    type("1234567")
    expect(button().disabled).toBe(true)
    type("12345678")
    expect(button().disabled).toBe(false)
  })

  it("places the error between the field and the button", async () => {
    login.mockResolvedValue({ success: false, message: "Incorrect PIN." })
    render(<LoginForm redirectTo="/" />)
    type("12345678")
    submit()

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Incorrect PIN.")

    // Order in the DOM is what the eye reads: field, then message, then the
    // control that was pressed.
    const form = alert.closest("form") as HTMLFormElement
    const order = Array.from(
      form.querySelectorAll("[data-testid='pin-cells'], [role='alert'], button")
    ).map((node) => node.getAttribute("data-testid") ?? node.tagName)
    expect(order).toEqual(["pin-cells", "P", "BUTTON"])
  })

  it("describes the field with the error and marks it invalid", async () => {
    login.mockResolvedValue({ success: false, message: "Incorrect PIN." })
    render(<LoginForm redirectTo="/" />)
    type("12345678")
    submit()

    const alert = await screen.findByRole("alert")
    expect(alert.getAttribute("id")).toBe("pin-error")
    await waitFor(() => {
      const field = screen.getByLabelText("PIN")
      expect(field.getAttribute("aria-invalid")).toBe("true")
      expect(field.getAttribute("aria-describedby")).toBe("pin-error")
    })
  })

  it("clears the error as soon as the operator types again", async () => {
    login.mockResolvedValue({ success: false, message: "Incorrect PIN." })
    render(<LoginForm redirectTo="/" />)
    type("12345678")
    submit()
    await screen.findByRole("alert")

    type("9")
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull()
    })
  })

  it("shows a server message verbatim", async () => {
    login.mockResolvedValue({
      success: false,
      message: "Too many attempts. Try again later.",
    })
    render(<LoginForm redirectTo="/" />)
    type("12345678")
    submit()
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Too many attempts. Try again later.")
  })
})
```

No `window.location` stub is needed: the success path hard-navigates, and every
test above forces `success: false`, so `window.location.assign` is never
reached. The success path therefore stays uncovered, which is recorded rather
than worked around with a fragile jsdom location override.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: FAIL. The error currently renders after the button, has no `id`, and
the input has no `aria-describedby` pointing at it.

- [ ] **Step 3: Make three targeted edits to `LoginForm.tsx`**

These are surgical edits, not a rewrite. In particular the busy-state label on
the submit button already ends in a real ellipsis character; leave that line
alone rather than retyping it.

**Edit 1** -- widen the card. Change `max-w-sm` to `max-w-lg` in:

```tsx
    <Card className="clay-topglow w-full max-w-sm">
```

`max-w-md` would give 43px cells, under the 44px minimum touch target in
`DESIGN.md` section 5.6. `max-w-lg` yields 51px cells against a 56px height.

**Edit 2** -- import the icon and the shared error id. The import block becomes:

```tsx
import * as React from "react"
import { LockKeyhole, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ApiError, login } from "@/lib/api-client"
import { PIN_LENGTH } from "@/lib/auth/constants"
import { PIN_ERROR_ID, PinField } from "./PinField"
```

Two changes: `TriangleAlert` joins the `lucide-react` import, and the final
line now pulls `PIN_ERROR_ID` from `./PinField` alongside `PinField`.

**Edit 3** -- relocate the error. Delete this block from its current position,
after the `</Button>`:

```tsx
          {error ? (
            <p role="alert" className="clay-pressed p-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}
```

and insert it immediately **before** the `<Button type="submit">`, so the form
reads label, cells, error, button:

```tsx
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
```

Nothing else in the file changes: the submit handler, the autofocus effect, the
`window.location.assign` comment, and the `<Button>` block all stay as they are.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/login/LoginForm.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full gate**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
npx prettier --write app/login/LoginForm.tsx app/login/LoginForm.test.tsx
git add app/login/LoginForm.tsx app/login/LoginForm.test.tsx
git commit -m "fix(login): place the sign-in error under the field and wire its ARIA"
```

---

### Task 3: Cut the copy and tighten the shell

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `LoginForm` (unchanged signature).
- Produces: no new exports.

- [ ] **Step 1: Make the copy edits**

In `app/login/page.tsx`:

1. Change the container's `gap-6` to `gap-5`:

   ```tsx
   <div className="relative flex min-h-svh flex-col items-center justify-center gap-5 px-4 py-10">
   ```

2. Delete this block entirely -- the subtitle carries no information on a
   screen only staff can reach:

   ```tsx
   <div className="flex flex-col items-center gap-2 text-center">
     <h1 className="display">Admin sign-in</h1>
     <p className="text-sm text-muted-foreground">
       Enter the staff PIN to manage events and take attendance.
     </p>
   </div>
   ```

   and replace it with the heading alone:

   ```tsx
   <h1 className="display text-center">Sign in</h1>
   ```

3. Update the file's docblock, which currently claims a sub-label that no longer
   exists. Replace:

   ```
   no sidebar, no primary nav, just one centred card on the mesh canvas that
   `body` already paints. Built from the same clay tokens and primitives as
   the rest of the app -- brand mark, `.display` title, `.overline` sub-label,
   sunken PIN well, indigo pill -- so it reads as part of the product.
   ```

   with:

   ```
   no sidebar, no primary nav, just one centred card on the mesh canvas that
   `body` already paints. Built from the same clay tokens and primitives as
   the rest of the app -- brand mark, `.display` title, `.overline` overline,
   the eight-cell PIN well, indigo pill -- so it reads as part of the product.
   ```

- [ ] **Step 2: Verify the cuts landed and nothing else moved**

Run: `git diff app/login/page.tsx`
Expected: exactly three hunks -- the `gap-6` to `gap-5`, the removed subtitle
block, and the docblock wording. No changes to the theme toggle, the brand
block, `safeNext`, or the `metadata` export.

- [ ] **Step 3: Verify the auth rule still holds**

Run: `npx vitest run lib/auth/cache-isolation.test.ts`
Expected: PASS. This is the test that fails if `page.tsx` ever grows an auth
gate, so it is the one to re-run after touching this file.

- [ ] **Step 4: Run the full gate**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
npx prettier --write app/login/page.tsx
git add app/login/page.tsx
git commit -m "refactor(login): drop filler copy and tighten the sign-in shell"
```

---

## Manual Verification

No automated test can judge this screen. A human must open it once:

1. `npm run dev`, then load `/login`.
2. At 375px and at 1280px, in light and dark themes:
   - the eight cells read as one group, not eight separate pills;
   - the active-cell ring is clearly visible in both themes;
   - typing a digit advances the ring and fills one dot, and the digit itself
     never appears;
   - backspace un-fills and steps the ring back.
3. Paste `1234-5678` into the field: it should yield eight digits, because the
   change handler strips non-digits.
4. Submit a wrong PIN: the error appears between the cells and the button, with
   an icon, and the field is outlined.
5. Keyboard only: Tab reaches the field, digits type, Enter submits.
6. Submit five wrong PINs to trip the rate limiter: the "Too many attempts."
   message appears in the same slot with no countdown. That is the documented
   non-goal, not a regression.
7. Confirm the theme toggle still works from this page.