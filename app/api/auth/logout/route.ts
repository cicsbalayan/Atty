/**
 * `POST /api/auth/logout` — clears the session cookie.
 *
 * Sessions are stateless, so there is no server-side record to delete.
 * Removing the cookie is sufficient: the token is discarded by the browser
 * and can no longer be presented. Anything already captured by an attacker
 * stays valid until `exp`, which is why rotating SESSION_SECRET remains the
 * way to invalidate outstanding sessions early.
 */
import { NextResponse } from "next/server"
import { destroySession } from "@/lib/auth/cookie"
import { respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function POST() {
  return respondWith(async () => {
    await destroySession()
    return NextResponse.json({ success: true })
  })
}
