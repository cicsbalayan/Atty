/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
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
