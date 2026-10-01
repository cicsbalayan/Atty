import { NextResponse } from "next/server"
import {
  deleteOrganization,
  updateOrganization,
} from "@/integration/organizations"
import { getOrganizationCachedFor } from "@/integration/cached"
import { expireOrganization } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import type { UpdateOrganizationInput } from "@/models/organization"
import { cachedJson, HttpError, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

type OrgParams = { params: Promise<{ orgId: string }> }

const UPDATABLE_FIELDS = ["name", "email"] as const

export async function GET(_request: Request, context: OrgParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { orgId } = await context.params
    const organization = await getOrganizationCachedFor(orgId)
    return cachedJson({ success: true, organization }, 30)
  })
}

export async function PATCH(request: Request, context: OrgParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { orgId } = await context.params
    const input = parsePatchBody(await request.text())
    const organization = await updateOrganization(orgId, input)
    expireOrganization(orgId)
    return NextResponse.json({
      success: true,
      message: "Organization updated successfully.",
      organization,
    })
  })
}

/**
 * Hard deletes: the row is removed permanently. Only delete organizations
 * with no events attached — an event's stored orgId stops resolving
 * afterwards, so its letterhead falls back and it can no longer revalidate
 * the reference.
 */
export async function DELETE(_request: Request, context: OrgParams) {
  return respondWith(async () => {
    await requireAdmin()
    const { orgId } = await context.params
    const organization = await deleteOrganization(orgId)
    expireOrganization(orgId)
    return NextResponse.json({
      success: true,
      message: "Organization deleted successfully.",
      organization,
    })
  })
}

/**
 * Accepts a subset of the editable fields. Mirrors the event PATCH
 * body: unknown keys are dropped, an empty body is rejected, and each value
 * must be a non-empty string. A blank email is cleared upstream by
 * sending "" rather than by omitting the key.
 */
function parsePatchBody(raw: string): UpdateOrganizationInput {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.")
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object.")
  }
  const record = body as Record<string, unknown>
  const input: UpdateOrganizationInput = {}
  for (const field of UPDATABLE_FIELDS) {
    const value = record[field]
    if (value === undefined || value === null) continue
    if (typeof value !== "string" || value.trim() === "") {
      throw new HttpError(400, "INVALID_FIELD", `Invalid field: ${field}.`)
    }
    input[field] = value.trim()
  }
  if (Object.keys(input).length === 0) {
    throw new HttpError(
      400,
      "INVALID_FIELD",
      "Provide at least one of: name, email."
    )
  }
  return input
}
