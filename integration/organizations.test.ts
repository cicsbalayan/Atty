import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Organization } from "@/models/organization"
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizations,
  updateOrganization,
} from "./organizations"
import { requestAppsScript } from "./http"

vi.mock("./http", () => ({
  requestAppsScript: vi.fn(),
}))

const requestMock = vi.mocked(requestAppsScript)

const sampleOrg: Organization = {
  id: "ORG-001",
  name: "Batangas State University",
  email: "sscbalayan@g.batstate-u.edu.ph",
}

beforeEach(() => {
  requestMock.mockReset()
})

function mockSuccess(payload: object): void {
  requestMock.mockResolvedValue({ success: true, ...payload } as never)
}

describe("organizations integration", () => {
  it("lists organizations via getOrganizations", async () => {
    mockSuccess({ organizations: [sampleOrg] })
    await expect(getOrganizations()).resolves.toEqual([sampleOrg])
    expect(requestMock).toHaveBeenCalledWith("getOrganizations")
  })

  it("fetches a single organization via getOrganization", async () => {
    mockSuccess({ organization: sampleOrg })
    await expect(getOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("getOrganization", {
      orgId: "ORG-001",
    })
  })

  it("defaults a missing email to an empty string on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization({ name: sampleOrg.name })
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: "",
    })
  })

  it("forwards name and email supplied on create", async () => {
    mockSuccess({ organization: sampleOrg })
    await createOrganization(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("createOrganization", {
      name: sampleOrg.name,
      email: sampleOrg.email,
    })
  })

  it("updates an organization via updateOrganization", async () => {
    mockSuccess({ organization: { ...sampleOrg, email: "new@example.edu" } })
    await expect(
      updateOrganization("ORG-001", { email: "new@example.edu" })
    ).resolves.toMatchObject({ email: "new@example.edu" })
    expect(requestMock).toHaveBeenCalledWith("updateOrganization", {
      orgId: "ORG-001",
      email: "new@example.edu",
    })
  })

  it("propagates upstream errors", async () => {
    requestMock.mockRejectedValue(new Error("ORG_NOT_FOUND"))
    await expect(getOrganization("ORG-999")).rejects.toThrow("ORG_NOT_FOUND")
  })

  it("hard deletes via deleteOrganization", async () => {
    mockSuccess({ organization: sampleOrg })
    await expect(deleteOrganization("ORG-001")).resolves.toEqual(sampleOrg)
    expect(requestMock).toHaveBeenCalledWith("deleteOrganization", {
      orgId: "ORG-001",
    })
  })
})
