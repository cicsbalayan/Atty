import type { NextConfig } from "next"

/**
 * Security headers applied to every response.
 *
 * Deliberately conservative and dependency-free. No Content-Security-Policy
 * here on purpose: getting a CSP right for the App Router (inline bootstrap
 * scripts, `next/font`, the kiosk `:fullscreen` path) needs verification
 * across every route in a real browser, and a wrong policy breaks the app in
 * ways that are slow to diagnose. Tracked as follow-up in
 * `docs/api-security.md`.
 */
const securityHeaders = [
  // Stops a browser from second-guessing our Content-Type, which would let a
  // response be reinterpreted as something executable.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // This app has no reason to be framed. Denying it also removes a
  // clickjacking vector against the PIN entry form, where an attacker could
  // overlay a fake field and capture what is typed.
  { key: "X-Frame-Options", value: "DENY" },
  // Keeps event IDs and filter query strings out of third-party Referers
  // while still allowing same-origin referrers, which shareable attendance
  // filter URLs rely on.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const nextConfig: NextConfig = {
  // Removes the `X-Powered-By: Next.js` header, which otherwise advertises
  // the exact framework and version in use.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
