/**
 * Session cookie access.
 *
 * Thin wrapper over `next/headers` so the rest of the app never touches
 * cookie plumbing directly. Split from `session.ts` to keep that module
 * importable from `proxy.ts`, which reads cookies off the request rather
 * than through `next/headers`.
 */
import "server-only"

import { cookies } from "next/headers"
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "./constants"
import { type Session, signSession, verifySession } from "./session"

/**
 * Issues a fresh session cookie, overwriting any existing one.
 *
 * Called only from a Server Action or Route Handler, never during render:
 * Next.js forbids cookie mutation while rendering.
 */
export async function createSession(): Promise<void> {
  const token = await signSession()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // HTTPS-only in production; off in development so the app works over
    // http://localhost. Never enableable off-prod in a real deployment.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

/** Removes the session cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/**
 * Verifies the session on the current request.
 *
 * Returns `null` when there is no valid session, so callers can treat
 * "absent" and "forged" identically and never leak which one occurred.
 */
export async function readSession(): Promise<Session | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}
