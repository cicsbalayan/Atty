/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useOnline } from "./useOnline"

function Probe() {
  return <p>{useOnline() ? "online" : "offline"}</p>
}

describe("useOnline", () => {
  afterEach(cleanup)

  it("reflects browser online/offline events", () => {
    render(<Probe />)
    expect(screen.getByText("online")).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event("offline"))
    })
    expect(screen.getByText("offline")).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event("online"))
    })
    expect(screen.getByText("online")).toBeTruthy()
  })
})
