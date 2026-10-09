/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { FilterSkeleton } from "./FilterSkeleton"

afterEach(cleanup)

describe("FilterSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<FilterSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it("exposes no interactive elements", () => {
    const { container } = render(<FilterSkeleton />)
    expect(
      container.querySelector("button,a,input,select,textarea,[tabindex]")
    ).toBeNull()
  })
})
