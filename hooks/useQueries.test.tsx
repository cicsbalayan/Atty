/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { refreshAllReads } from "./useCached"
import { useOrganizations } from "./useQueries"
import { listOrganizations } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({
  getEvent: vi.fn(),
  listAttendance: vi.fn(),
  listEvents: vi.fn(),
  getReport: vi.fn(),
  listOrganizations: vi.fn(),
}))

beforeEach(() => {
  refreshAllReads()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function OrgProbe() {
  const { data, loading } = useOrganizations()
  if (loading) return <p>loading</p>
  return <p>{`count:${data?.organizations.length ?? "none"}`}</p>
}

describe("useOrganizations", () => {
  it("starts loading, then yields the organization list", async () => {
    vi.mocked(listOrganizations).mockResolvedValue({
      success: true,
      organizations: [],
    })
    render(<OrgProbe />)
    expect(screen.getByText("loading")).toBeTruthy()
    await waitFor(() => expect(screen.getByText("count:0")).toBeTruthy())
  })
})
