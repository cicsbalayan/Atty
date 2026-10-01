/**
 * Authentication constants shared by server and client code.
 *
 * Separated from `config.ts` because that module is `server-only` and reads
 * the environment; a Client Component such as `app/login/PinField.tsx` needs
 * the same PIN length but must not pull in the server module to get it.
 *
 * Nothing here is secret. These are shapes and durations, not credentials.
 */

/** Cookie holding the signed admin session. */
export const SESSION_COOKIE = "atty_admin"

/**
 * Absolute session lifetime: 12 hours.
 *
 * Long enough to cover a full event day including setup, so kiosk staff
 * authenticate once rather than repeatedly. Absolute rather than sliding,
 * because a sliding window would require re-issuing the cookie from a render
 * path or the proxy, and Next.js forbids cookie mutation during render.
 */
export const SESSION_TTL_SECONDS = 43_200

/** The staff PIN is exactly this many characters. */
export const PIN_LENGTH = 8

/** Digits only. Enforced before any comparison happens. */
export const PIN_PATTERN = /^\d{8}$/

/** The single role this build recognises. */
export const ADMIN_ROLE = "admin" as const

/** Login attempts allowed per client per window. */
export const MAX_ATTEMPTS = 5

/** Login throttle window in milliseconds (15 minutes). */
export const WINDOW_MS = 15 * 60 * 1000

/** Minimum length for the two high-entropy keys. */
export const MIN_KEY_LENGTH = 32
