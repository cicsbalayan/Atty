/**
 * Session signing and verification.
 *
 * Deliberately free of `next/headers` and any other request-bound API so
 * that `proxy.ts` can import it directly. Cookie reading and writing live
 * in `cookie.ts`; this module only deals in raw token strings.
 *
 * The token is a compact JWS signed with HS256. It is stateless: nothing is
 * stored server-side, so a token cannot be looked up, enumerated, or
 * individually revoked before it expires. Rotating SESSION_SECRET invalidates
 * every outstanding session at once, which is the intended incident response.
 */
import "server-only"

import { SignJWT, jwtVerify } from "jose"
import { ADMIN_ROLE, SESSION_TTL_SECONDS } from "./constants"
import { getSessionSecret } from "./config"

/** The verified contents of a session token. */
export interface Session {
  role: typeof ADMIN_ROLE
  /** Issued-at, unix seconds. */
  iat: number
  /** Expiry, unix seconds. */
  exp: number
}

/**
 * Pins the algorithm on both sign and verify.
 *
 * Passing `algorithms` to `jwtVerify` is what prevents algorithm confusion:
 * without it, an attacker could re-sign a token with `alg: none` or swap in
 * an asymmetric algorithm and have it accepted.
 */
const ALGORITHM = "HS256"

/**
 * Decodes the configured secret into raw key bytes.
 *
 * `jose` v6 takes a `CryptoKey` or a `Uint8Array`, not a bare string. The
 * operator's chosen encoding (hex or base64) is preserved as the exact byte
 * sequence it represents rather than being reinterpreted, so the same string
 * always yields the same key.
 */
function signingKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret())
}

/**
 * Signs a new admin session token.
 */
export async function signSession(): Promise<string> {
  return new SignJWT({ role: ADMIN_ROLE })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(signingKey())
}

/**
 * Verifies a token and returns its payload, or `null` for any failure.
 *
 * Returns `null` — never throws — for a missing, malformed, tampered,
 * expired, or wrongly signed token, and also when SESSION_SECRET is
 * misconfigured. That last case is deliberate: an unparseable configuration
 * must fail closed rather than admit anyone, so the caller treats it exactly
 * like an unauthenticated request and the user lands on `/login`, where the
 * real cause is reported. The underlying error is logged server-side so the
 * misconfiguration is still diagnosable.
 */
export async function verifySession(
  token: string | undefined
): Promise<Session | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: [ALGORITHM],
    })
    // Never trust the decoded shape: a valid signature over an unexpected
    // payload would still be an unexpected payload.
    if (
      payload.role !== ADMIN_ROLE ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null
    }
    return {
      role: ADMIN_ROLE,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch (error) {
    if (isConfigurationError(error)) {
      console.error("[auth] session verification misconfigured", error)
    }
    return null
  }
}

function isConfigurationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "HttpError" || /is not configured|at least 32/.test(error.message))
  )
}
