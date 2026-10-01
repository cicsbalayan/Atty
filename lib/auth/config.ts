/**
 * Server-only authentication configuration.
 *
 * Every credential the app needs lives here and nowhere else. Nothing in
 * this module may be imported by a Client Component: the values are read
 * from the server environment and would be inlined into the browser bundle
 * if they leaked. `server-only` turns that mistake into a build error
 * instead of a silent disclosure.
 *
 * The three credentials are independent by design, so leaking one does not
 * weaken the others:
 *
 *   ADMIN_PIN           compared only during login, never transmitted after
 *                       a successful sign-in
 *   SESSION_SECRET      signs the browser-facing session cookie, never sent
 *                       upstream, so a leaked cookie is useless at the
 *                       Apps Script layer
 *   ADMIN_SERVICE_KEY   sent upstream on every Apps Script call, never
 *                       placed in a cookie
 */
import "server-only"

import { HttpError } from "@/lib/api"
import { MIN_KEY_LENGTH, PIN_LENGTH, PIN_PATTERN } from "./constants"

/**
 * Reads a required environment variable, failing closed.
 *
 * Every failure mode here surfaces as a 503 rather than a silent fallback.
 * An auth system that opens up when misconfigured is worse than one that
 * breaks, because the breakage is visible.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === "") {
    throw new HttpError(503, "CONFIGURATION_ERROR", `${name} is not configured.`)
  }
  return value
}

/**
 * Signing key for session cookies.
 *
 * A floor of 32 bytes of entropy is enforced so a weak value cannot be set
 * by accident. The value is passed to `jose` as a string so the operator's
 * chosen encoding (hex or base64) is preserved rather than reinterpreted.
 */
export function getSessionSecret(): string {
  const secret = required("SESSION_SECRET")
  if (secret.length < MIN_KEY_LENGTH) {
    throw new HttpError(
      503,
      "CONFIGURATION_ERROR",
      `SESSION_SECRET must be at least ${MIN_KEY_LENGTH} characters.`
    )
  }
  return secret
}

/**
 * The staff PIN, validated for format.
 *
 * The PIN is compared directly rather than stored as a hash. An 8-digit PIN
 * is a 10^8 space, so an offline attacker holding SESSION_SECRET could
 * brute-force a derived hash in minutes; hashing would buy nothing. What
 * actually protects a space that small is a constant-time compare plus
 * throttling, both of which live in `pin.ts` and `rate-limit.ts`.
 *
 * Returned as a string and never parsed as a number, because
 * `Number("04812075")` discards the leading zero and collapses two distinct
 * 8-character PINs into one.
 */
export function getAdminPin(): string {
  const pin = required("ADMIN_PIN")
  if (!PIN_PATTERN.test(pin)) {
    throw new HttpError(
      503,
      "CONFIGURATION_ERROR",
      `ADMIN_PIN must be exactly ${PIN_LENGTH} digits.`
    )
  }
  return pin
}

/**
 * Second Apps Script credential.
 *
 * The web app is deployed ANYONE_ANONYMOUS, so its URL is callable by anyone
 * who has it. APPS_SCRIPT_SECRET alone is therefore not enough: holding both
 * the URL and that secret would otherwise grant full read and write access to
 * the spreadsheet, bypassing this application's PIN entirely.
 */
export function getAdminServiceKey(): string {
  const key = required("ADMIN_SERVICE_KEY")
  if (key.length < MIN_KEY_LENGTH) {
    throw new HttpError(
      503,
      "CONFIGURATION_ERROR",
      `ADMIN_SERVICE_KEY must be at least ${MIN_KEY_LENGTH} characters.`
    )
  }
  return key
}
