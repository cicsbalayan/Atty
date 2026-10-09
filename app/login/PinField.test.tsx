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
    expect(screen.getByTestId("pin-cells").getAttribute("aria-hidden")).toBe(
      "true"
    )
  })

  it("hands the input element back through inputRef", () => {
    // `LoginForm` autofocuses through this ref, and the focus indicator is
    // driven by real focus. If the ref stopped resolving there would be no
    // autofocus, no focus, and therefore no indicator at all -- the whole
    // accessibility invariant failing behind a green suite, since nothing
    // else here reads `.current`.
    const inputRef = ref()
    render(<PinField value="" onChange={() => {}} inputRef={inputRef} />)
    expect(inputRef.current).toBe(screen.getByLabelText("PIN"))
  })

  it("keeps the attributes the single-input design depends on", () => {
    render(<PinField value="" onChange={() => {}} inputRef={ref()} />)
    const input = screen.getByLabelText("PIN") as HTMLInputElement
    // `type="number"` silently discards a leading zero, and
    // `Number("04812075")` is `4812075` -- which would collapse two distinct
    // valid PINs into one. `inputMode` still gets the numeric keypad without
    // the coercion.
    expect(input.getAttribute("inputmode")).toBe("numeric")
    expect(input.getAttribute("type")).toBeNull()
    // A shared kiosk secret, deliberately kept out of password managers.
    expect(input.getAttribute("autocomplete")).toBe("off")
  })

  it("sizes the grid track to the number of cells", () => {
    const view = render(
      <PinField value="" onChange={() => {}} inputRef={ref()} />
    )
    const grid = view.getByTestId("pin-cells")
    // Derived rather than a `grid-cols-8` literal, so the track count cannot
    // drift from `CELLS` if `PIN_LENGTH` ever changes. `minmax(0, 1fr)` is
    // what `grid-cols-8` itself emits: equal-width and shrinkable.
    expect(grid.style.gridTemplateColumns).toBe(
      `repeat(${PIN_LENGTH}, minmax(0, 1fr))`
    )
    // The gap the indicator offset is sized against stays a class.
    expect(grid.className).toContain("gap-2")
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
    render(
      <PinField value="" onChange={(v) => seen.push(v)} inputRef={ref()} />
    )
    fireEvent.change(screen.getByLabelText("PIN"), {
      target: { value: "4a2-3" },
    })
    expect(seen).toEqual(["423"])
  })

  it("caps the value at PIN_LENGTH", () => {
    const seen: string[] = []
    render(
      <PinField value="" onChange={(v) => seen.push(v)} inputRef={ref()} />
    )
    fireEvent.change(screen.getByLabelText("PIN"), {
      target: { value: "12345678901234" },
    })
    // Content as well as length: any eight-digit string would satisfy a
    // length-only assertion, so pin the slice itself.
    expect(seen[0]).toBe("12345678")
    expect(seen[0]).toHaveLength(PIN_LENGTH)
  })

  it("moves the active cell as digits are entered", () => {
    const view = render(
      <PinField value="123" onChange={() => {}} inputRef={ref()} />
    )
    // Focus first: the ring follows real focus, never optimism, so an
    // unfocused field draws no ring at all even mid-value.
    fireEvent.focus(screen.getByLabelText("PIN"))
    expect(view.getByTestId("pin-cell-3").getAttribute("data-active")).toBe(
      "true"
    )
    expect(view.getByTestId("pin-cell-0").getAttribute("data-active")).toBe(
      "false"
    )
  })

  it("draws no indicator before focus lands", () => {
    // `LoginForm` autofocuses in an effect, so the very first render happens
    // before the field has focus. An indicator drawn there would mark a field
    // that is not focused.
    const view = render(
      <PinField value="123" onChange={() => {}} inputRef={ref()} />
    )
    for (let i = 0; i < PIN_LENGTH; i += 1) {
      expect(
        view.getByTestId(`pin-cell-${i}`).getAttribute("data-active")
      ).toBe("false")
    }
  })

  it("marks no cell active while the field is blurred", () => {
    const view = render(
      <PinField value="123" onChange={() => {}} inputRef={ref()} />
    )
    const input = screen.getByLabelText("PIN")
    fireEvent.focus(input)
    expect(view.getByTestId("pin-cell-3").getAttribute("data-active")).toBe(
      "true"
    )
    fireEvent.blur(input)
    // A focus ring on a field that does not have focus is the one thing a
    // focus indicator must never do.
    for (let i = 0; i < PIN_LENGTH; i += 1) {
      expect(
        view.getByTestId(`pin-cell-${i}`).getAttribute("data-active")
      ).toBe("false")
    }
  })

  it("keeps the last cell marked once the PIN is complete", () => {
    // The field is still focused with eight digits in it, so WCAG 2.4.7
    // requires a visible indicator. Clamping to the final cell is what keeps
    // one: `value.length` runs one past the end of the grid, and an index
    // that matches no cell draws nothing at all.
    const view = render(
      <PinField value="12345678" onChange={() => {}} inputRef={ref()} />
    )
    fireEvent.focus(screen.getByLabelText("PIN"))
    expect(view.getByTestId("pin-cell-7").getAttribute("data-active")).toBe(
      "true"
    )
    const marked = screen
      .getAllByTestId(/^pin-cell-/)
      .filter((cell) => cell.getAttribute("data-active") === "true")
    expect(marked).toHaveLength(1)
  })

  it("draws the active indicator with an outline, not a ring", () => {
    const view = render(
      <PinField value="1" onChange={() => {}} inputRef={ref()} />
    )
    fireEvent.focus(screen.getByLabelText("PIN"))
    const active = view.getByTestId("pin-cell-1")
    // A ring is a `box-shadow`, and Tailwind puts utilities after components,
    // so `ring-*` silently overwrites `.clay-input`'s inset shadow and the
    // focused cell stops looking sunken. `outline` is a separate property and
    // leaves the well intact.
    expect(active.className).toMatch(/\boutline-/)
    expect(active.className).not.toMatch(/\bring-/)
    // Only the active cell is decorated.
    expect(view.getByTestId("pin-cell-0").className).not.toMatch(/\boutline-/)
    expect(view.getByTestId("pin-cell-2").className).not.toMatch(/\boutline-/)
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
