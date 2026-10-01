import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
} from "@/models/organization"
import { requestAppsScript } from "./http"

export async function getOrganizations(): Promise<Organization[]> {
  const response = await requestAppsScript<{ organizations: Organization[] }>(
    "getOrganizations"
  )
  return response.organizations
}

export async function getOrganization(
  orgId: string
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "getOrganization",
    { orgId }
  )
  return response.organization
}

export async function createOrganization(
  input: CreateOrganizationInput
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "createOrganization",
    {
      name: input.name,
      // The backend treats a missing field as "", so sending the explicit
      // default keeps the request body and the sheet row in agreement.
      email: input.email ?? "",
    }
  )
  return response.organization
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "updateOrganization",
    { orgId, ...input }
  )
  return response.organization
}

/**
 * Hard deletes. The row is removed permanently, so only delete organizations
 * with no events attached — events keep their stored orgId, which stops
 * resolving afterwards.
 */
export async function deleteOrganization(
  orgId: string
): Promise<Organization> {
  const response = await requestAppsScript<{ organization: Organization }>(
    "deleteOrganization",
    { orgId }
  )
  return response.organization
}
