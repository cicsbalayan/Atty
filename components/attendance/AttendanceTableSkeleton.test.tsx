/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it } from "vitest"
import { AttendanceTableSkeleton } from "./AttendanceTableSkeleton"

afterEach(cleanup)

describe("AttendanceTableSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<AttendanceTableSkeleton />)
    expect(container.firstChild).toBeTruthy()
  })

  it("exposes no interactive elements", () => {
    const { container } = render(<AttendanceTableSkeleton />)
    expect(
      container.querySelector("button,a,input,select,textarea,[tabindex]")
    ).toBeNull()
  })
})
