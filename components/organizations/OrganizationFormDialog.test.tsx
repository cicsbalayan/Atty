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
import { OrganizationFormDialog } from "./OrganizationFormDialog"
import { createOrganization } from "@/lib/api-client"

vi.mock("@/lib/api-client", () => ({ createOrganization: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

function open() {
  render(<OrganizationFormDialog />)
  fireEvent.click(screen.getByRole("button", { name: /new organization/i }))
}

describe("OrganizationFormDialog", () => {
  it("submits the name and email", async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      success: true,
      organization: {
        id: "ORG-001",
        name: "Batangas State University",
        email: "sscbalayan@g.batstate-u.edu.ph",
      },
    })
    open()
    fireEvent.change(screen.getByLabelText("Organization name"), {
      target: { value: "Batangas State University" },
    })
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: /^create organization$/i })
    )
    await waitFor(() => {
      expect(createOrganization).toHaveBeenCalledTimes(1)
    })
    expect(createOrganization).toHaveBeenCalledWith({
      name: "Batangas State University",
      email: "sscbalayan@g.batstate-u.edu.ph",
    })
  })

  it("refuses a blank name without calling", async () => {
    open()
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "sscbalayan@g.batstate-u.edu.ph" },
    })
    // Submit the form directly: a click on the submit button runs jsdom's
    // native constraint validation first, and the required name input would
    // block the submit before the handler runs. Dispatching submit exercises
    // the handler's trim-and-refuse check itself (same approach as
    // LoginForm.test.tsx).
    fireEvent.submit(
      screen.getByLabelText("Email").closest("form") as HTMLFormElement
    )
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy()
    })
    expect(createOrganization).not.toHaveBeenCalled()
  })
})
