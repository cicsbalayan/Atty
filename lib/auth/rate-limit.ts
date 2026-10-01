/**
 * Login throttling.
 *
 * 8 digits is 10^8, so without a ceiling on attempts the PIN is enumerable
 * from a single IP in a realistic amount of time. This module caps attempts
 * per client for a fixed window.
 *
 * KNOWN LIMITATION — per instance, not shared.
 *
 * The counter lives in this module's memory, so it resets on every deploy
 * and is not coordinated between instances. On a multi-instance or serverless
 * deployment the effective ceiling is `MAX_ATTEMPTS × instance count`, and
 * an attacker who can spread requests across instances gets proportionally
 * more guesses. Closing this properly needs a shared store, which this
 * architecture does not have; see `docs/authentication.md`. The limit is
 * still worth having: it stops a single client hammering the endpoint, which
 * is the realistic case for a small deployment.
 */
import { MAX_ATTEMPTS, WINDOW_MS } from "./constants"

export { MAX_ATTEMPTS, WINDOW_MS }

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** Timestamp of the last expired-bucket sweep; see `sweep`. */
let lastSweep = 0

/** Outcome of a throttling check. */
export interface RateLimitResult {
  ok: boolean
  /** Seconds until the window resets. Only meaningful when `ok` is false. */
  retryAfterSeconds: number
}

/**
 * Derives a throttle key from the request.
 *
 * `x-forwarded-for` is a comma-separated chain appended to by each proxy, so
 * the *first* entry is the original client. Trusting the whole header, or
 * any position but the first, would let a caller rotate the value to get a
 * fresh bucket per request.
 *
 * When no forwarding header is present the key is a single shared bucket.
 * That is intentionally conservative: without a trustworthy client IP the
 * safe assumption is that all traffic is one client.
 */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const first = forwarded?.split(",")[0]?.trim()
  if (first) return first
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp
  return "unknown"
}

/**
 * Records an attempt and reports whether it is permitted.
 *
 * Counts successful attempts too, deliberately: if only failures counted, a
 * correct PIN would stand out as the one attempt that did not advance the
 * counter. Counting everything also means five legitimate staff members
 * signing in back to back on one shared door tablet share a budget, which is
 * the intended trade for a kiosk.
 */
export function consumeAttempt(key: string, now = Date.now()): RateLimitResult {
  if (now - lastSweep >= WINDOW_MS) {
    lastSweep = now
    sweep(now)
  }

  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, retryAfterSeconds: 0 }
  }

  existing.count += 1
  if (existing.count <= MAX_ATTEMPTS) {
    return { ok: true, retryAfterSeconds: 0 }
  }

  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/**
 * Current attempt count for a key, without recording one.
 *
 * Used by tests; also useful for logging.
 */
export function attemptCount(key: string, now = Date.now()): number {
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) return 0
  return bucket.count
}

/**
 * Drops expired buckets.
 *
 * Without this the map grows without bound on a long-lived instance, since
 * every distinct client IP leaves an entry behind. Swept at most once per
 * window so the cost amortises to nothing on a busy endpoint while still
 * bounding memory on a quiet one — no interval to keep alive, and no work on
 * an idle server.
 */
function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

/** Clears all buckets. Tests only. */
export function resetRateLimit(): void {
  buckets.clear()
  lastSweep = 0
}
