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

  it("draws no ring before focus lands", () => {
    // `LoginForm` autofocuses in an effect, so the very first render happens
    // before the field has focus. A ring drawn there would be a focus
    // indicator on a field that is not focused.
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
