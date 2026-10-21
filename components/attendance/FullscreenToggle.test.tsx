/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { FullscreenToggle } from "./FullscreenToggle"

const KEY = "atty:kiosk-focus"

function stubFullscreenApi() {
  const request = vi.fn()
  const exit = vi.fn()
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: request,
  })
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exit,
  })
  return { request, exit }
}

function clearFullscreenApi() {
  delete (document.documentElement as { requestFullscreen?: unknown })
    .requestFullscreen
  delete (document as { exitFullscreen?: unknown }).exitFullscreen
}

function focused() {
  return document.documentElement.getAttribute("data-kiosk-focus") === "true"
}

describe("FullscreenToggle", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    document.documentElement.removeAttribute("data-kiosk-focus")
  })

  afterEach(() => {
    cleanup()
    clearFullscreenApi()
    window.sessionStorage.clear()
    document.documentElement.removeAttribute("data-kiosk-focus")
    vi.restoreAllMocks()
  })

  it("toggles the focus attribute and remembers it for the tab", () => {
    render(<FullscreenToggle />)

    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))
    expect(focused()).toBe(true)
    expect(window.sessionStorage.getItem(KEY)).toBe("true")

    const exit = screen.getByRole("button", { name: "Exit focus mode" })
    expect(exit.getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(exit)
    expect(focused()).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBeNull()
  })

  it("restores focus mode from sessionStorage", () => {
    window.sessionStorage.setItem(KEY, "true")
    render(<FullscreenToggle />)

    expect(focused()).toBe(true)
    expect(screen.getByRole("button", { name: "Exit focus mode" })).toBeTruthy()
  })

  it("exits focus mode on Escape", () => {
    render(<FullscreenToggle />)
    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))

    fireEvent.keyDown(window, { key: "Escape" })

    expect(focused()).toBe(false)
    expect(
      screen.getByRole("button", { name: "Enter focus mode" })
    ).toBeTruthy()
  })

  it("restores chrome on unmount but keeps the preference", () => {
    window.sessionStorage.setItem(KEY, "true")
    const { unmount } = render(<FullscreenToggle />)
    expect(focused()).toBe(true)

    unmount()

    expect(focused()).toBe(false)
    expect(window.sessionStorage.getItem(KEY)).toBe("true")
  })

  it("never asks the browser for monitor fullscreen", () => {
    const { request, exit } = stubFullscreenApi()
    render(<FullscreenToggle />)

    fireEvent.click(screen.getByRole("button", { name: "Enter focus mode" }))
    fireEvent.click(screen.getByRole("button", { name: "Exit focus mode" }))

    expect(request).not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()
  })
})
