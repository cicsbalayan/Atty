import { NextResponse } from "next/server"
import { createOrganization } from "@/integration/organizations"
import { getOrganizationsCached } from "@/integration/cached"
import { expireOrganizations } from "@/integration/invalidate"
import { requireAdmin } from "@/lib/auth/dal"
import {
  cachedJson,
  optionalString,
  parseJsonBody,
  requireString,
  respondWith,
} from "@/lib/api"

export const dynamic = "force-dynamic"

export async function GET() {
  return respondWith(async () => {
    await requireAdmin()
    const organizations = await getOrganizationsCached()
    return cachedJson({ success: true, organizations }, 30)
  })
}

export async function POST(request: Request) {
  return respondWith(async () => {
    await requireAdmin()
    const body = await parseJsonBody(request)
    const name = requireString(body, "name", 150)
    const email = optionalString(body, "email", 150)
    const organization = await createOrganization({ name, email })
    expireOrganizations()
    return NextResponse.json(
      { success: true, message: "Organization created successfully.", organization },
      { status: 201 }
    )
  })
}
