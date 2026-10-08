/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { OfflineBanner } from "./OfflineBanner"

describe("OfflineBanner", () => {
  afterEach(cleanup)

  it("appears offline and disappears on reconnect", () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole("status")).toBeNull()
    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(screen.getByRole("status").textContent).toContain("offline")
    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    expect(screen.queryByRole("status")).toBeNull()
  })
})
