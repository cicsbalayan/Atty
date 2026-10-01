/**
 * Staff PIN verification.
 *
 * An 8-digit PIN is a 10^8 keyspace, which is enumerable without a ceiling
 * on attempts. Two things actually protect it, and both live here and in
 * `rate-limit.ts`: a constant-time comparison, and a request ceiling. Storing
 * a hash of the PIN would add nothing, because an offline attacker holding
 * SESSION_SECRET could brute-force a derived hash just as easily.
 */
import "server-only"

import { timingSafeEqual } from "node:crypto"
import { HttpError } from "@/lib/api"
import { PIN_PATTERN } from "./constants"
import { getAdminPin } from "./config"

/**
 * True when the value is exactly 8 digits.
 *
 * Checked before any comparison so malformed input is rejected without
 * reaching `timingSafeEqual`, and so the comparison below always operates on
 * two equal-length buffers.
 */
export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin)
}

/**
 * Compares a submitted PIN against `ADMIN_PIN` in constant time.
 *
 * Returns `false` for a wrong PIN. Throws a 503 when `ADMIN_PIN` is unset or
 * malformed, which is a server misconfiguration rather than a failed login
 * and should be visible to whoever is operating the deployment.
 */
export function verifyPin(provided: string): boolean {
  const expected = getAdminPin()
  if (!isValidPinFormat(provided)) return false
  return timingSafeEqual(
    Buffer.from(provided, "utf8"),
    Buffer.from(expected, "utf8")
  )
}

/**
 * Throws a 401 for a failed PIN check.
 *
 * The message is fixed and never distinguishes "wrong PIN" from "right PIN,
 * wrong anything else", so the response carries no information an attacker
 * could use to narrow the search.
 */
export function rejectPin(): never {
  throw new HttpError(401, "UNAUTHORIZED", "Incorrect PIN.")
}
