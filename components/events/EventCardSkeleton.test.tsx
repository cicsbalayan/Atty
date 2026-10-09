/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { EventCardSkeleton } from "./EventCardSkeleton"

afterEach(cleanup)

describe("EventCardSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<EventCardSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it("exposes no interactive elements", () => {
    const { container } = render(<EventCardSkeleton />)
    expect(
      container.querySelector("button,a,input,select,textarea,[tabindex]")
    ).toBeNull()
  })
})
