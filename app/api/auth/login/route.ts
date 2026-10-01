/**
 * `POST /api/auth/login` — exchanges a staff PIN for a session cookie.
 */
import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth/cookie"
import { getSessionSecret } from "@/lib/auth/config"
import { rejectPin, verifyPin } from "@/lib/auth/pin"
import { clientKey, consumeAttempt } from "@/lib/auth/rate-limit"
import { parseJsonBody, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return respondWith(async () => {
    // Fail fast on a missing or weak signing key rather than issuing a
    // cookie we would not be able to verify on the next request. Thrown
    // before the body is read so a misconfigured deployment never even
    // attempts a comparison.
    getSessionSecret()

    const body = await parseJsonBody(request)
    const pin = typeof body.pin === "string" ? body.pin : ""

    const limit = consumeAttempt(clientKey(request))
    if (!limit.ok) {
      return NextResponse.json(
        {
          success: false,
          code: "RATE_LIMITED",
          message: "Too many attempts. Try again later.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      )
    }

    if (!verifyPin(pin)) {
      // Outcome only. The PIN is never logged, and neither is the client IP
      // because it is personal data we do not need to retain.
      console.warn("[auth] rejected login attempt")
      rejectPin()
    }

    await createSession()
    return NextResponse.json({ success: true })
  })
}
