/**
 * Data Access Layer for authorization.
 *
 * This is the authoritative auth gate. `proxy.ts` is an optimistic check that
 * runs first and gives a fast redirect, but it is not a security boundary:
 * the Next.js guidance is explicit that a matcher change "can silently remove
 * Proxy coverage", and a layout check is weaker still because a layout does
 * not control whether child segments render.
 *
 * Every page and every route handler therefore calls `requireAdminPage()` or
 * `requireAdmin()` directly. Those calls are what actually protect the data,
 * and they keep working even if the proxy is deleted.
 *
 * IMPORTANT: never call these from inside a function wrapped in
 * `unstable_cache` (see `integration/cached.ts`). A cached authorization
 * result would be stored and replayed to later callers who never
 * authenticated. The check belongs in the page or handler, outside the
 * cached data function. `cache-isolation.test.ts` enforces this.
 */
import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { HttpError } from "@/lib/api"
import { ADMIN_ROLE, SESSION_COOKIE } from "./constants"
import { type Session, verifySession } from "./session"

/**
 * The verified session for the current request, or `null`.
 *
 * `cookies()` is available in Server Components, Route Handlers, and Server
 * Actions alike, so one implementation covers all three.
 *
 * Not memoised: verification is a single HMAC over a short string, which is
 * far cheaper than the Apps Script round trip it guards, and React's `cache`
 * is only guaranteed to memoise inside a render pass — which Route Handlers
 * are not.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  return verifySession(store.get(SESSION_COOKIE)?.value)
}

/**
 * Gate for Route Handlers.
 *
 * Throws a 401 that `respondWith` already knows how to serialise —
 * `lib/api.ts` maps `UNAUTHORIZED` to 401, so no new plumbing is needed.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession()
  if (!session || session.role !== ADMIN_ROLE) {
    throw new HttpError(401, "UNAUTHORIZED", "Authentication required.")
  }
  return session
}

/**
 * Gate for pages.
 *
 * Redirects to `/login` rather than throwing, so an unauthenticated visitor
 * gets the sign-in page instead of an error boundary.
 *
 * The `next` parameter that returns the user to where they started is added
 * by the proxy, which knows the requested path. This backstop sends them to
 * the default destination instead, because a server component has no
 * dependable access to its own URL. In normal operation the proxy fires first
 * and the destination is preserved.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await getSession()
  if (!session || session.role !== ADMIN_ROLE) {
    redirect("/login")
  }
  return session
}
