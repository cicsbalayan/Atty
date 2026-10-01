/**
 * Layer 1 of 3: optimistic request-level authorization.
 *
 * Runs before any route renders. Its job is to send unauthenticated visitors
 * to `/login` quickly and to answer unauthenticated API calls with a 401,
 * without booting the React tree or reaching Apps Script.
 *
 * It is deliberately NOT the only defence. Next.js documents that a matcher
 * change "can silently remove Proxy coverage", and that proxy "should not be
 * your only line of defense in protecting your data". The authoritative
 * checks live in `lib/auth/dal.ts` and are called from every page and every
 * route handler, so deleting this file would not open the app.
 *
 * Notes:
 * - Next.js 16 renamed `middleware` to `proxy` and deprecated the former.
 * - Proxy runs on the Node.js runtime, so importing `lib/auth/session` here
 *   needs no edge-runtime caveat.
 * - `lib/auth/rate-limit.ts` is NOT imported here. It is stateful, and the
 *   proxy documentation warns against relying on shared module state. It is
 *   used only by the login route.
 */
import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE } from "@/lib/auth/constants"
import { safeNext } from "@/lib/auth/redirect"
import { verifySession } from "@/lib/auth/session"

/** Paths reachable without a session. */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const session = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value
  )

  if (session) {
    // Already signed in: the login page has nothing to offer, so send the
    // user onward rather than making them dismiss it.
    if (pathname === "/login") {
      return NextResponse.redirect(
        new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url)
      )
    }
    return NextResponse.next()
  }

  // An API caller expects JSON. Redirecting would hand it an HTML body and
  // turn a clean 401 into a confusing parse error in `lib/api-client.ts`.
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401 }
    )
  }

  const login = new URL("/login", request.url)
  login.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  // Covers pages and /api so both are filtered up front. Static assets are
  // excluded, otherwise the login page could not load its own CSS or JS.
  // `_next/data` is intentionally NOT excluded: Next.js invokes proxy for
  // those routes even when the pattern omits them, precisely so a protected
  // page cannot leak its data route.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|bsu-tneu-logo.png).*)"],
}
