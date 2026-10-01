import { beforeEach, describe, expect, it } from "vitest"
import {
  MAX_ATTEMPTS,
  WINDOW_MS,
  attemptCount,
  clientKey,
  consumeAttempt,
  resetRateLimit,
} from "./rate-limit"

describe("clientKey", () => {
  it("uses the first hop of x-forwarded-for", () => {
    // Only the first entry is the real client; the rest were appended by
    // intermediate proxies. Trusting a later entry would let a caller rotate
    // the value for a fresh bucket per request.
    const request = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" },
    })
    expect(clientKey(request)).toBe("203.0.113.9")
  })

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(
      clientKey(new Request("https://x.test", { headers: { "x-real-ip": "198.51.100.7" } }))
    ).toBe("198.51.100.7")
    // No trustworthy client address: assume everything is one client.
    expect(clientKey(new Request("https://x.test"))).toBe("unknown")
  })

  it("ignores an empty forwarding header", () => {
    const request = new Request("https://x.test", {
      headers: { "x-forwarded-for": "   " },
    })
    expect(clientKey(request)).toBe("unknown")
  })
})

describe("consumeAttempt", () => {
  beforeEach(() => {
    resetRateLimit()
  })

  it("allows exactly MAX_ATTEMPTS within the window", () => {
    const t0 = 1_000_000
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(consumeAttempt("1.1.1.1", t0 + i).ok).toBe(true)
    }
    const blocked = consumeAttempt("1.1.1.1", t0 + MAX_ATTEMPTS)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(Math.ceil(WINDOW_MS / 1000))
  })

  it("keeps blocking for the rest of the window", () => {
    const t0 = 1_000_000
    for (let i = 0; i <= MAX_ATTEMPTS; i++) consumeAttempt("1.1.1.1", t0 + i)
    expect(consumeAttempt("1.1.1.1", t0 + WINDOW_MS - 1).ok).toBe(false)
  })

  it("starts a fresh window once the old one expires", () => {
    const t0 = 1_000_000
    for (let i = 0; i <= MAX_ATTEMPTS; i++) consumeAttempt("1.1.1.1", t0 + i)
    expect(consumeAttempt("1.1.1.1", t0 + WINDOW_MS).ok).toBe(true)
  })

  it("counts successful attempts too, so a correct PIN is not distinguishable", () => {
    const t0 = 1_000_000
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(consumeAttempt("1.1.1.1", t0 + i).ok).toBe(true)
    }
    // A correct PIN on the sixth try is throttled exactly like a wrong one.
    // Otherwise an attacker could keep probing until one attempt behaved
    // differently and learn they had hit the right PIN.
    expect(consumeAttempt("1.1.1.1", t0 + MAX_ATTEMPTS).ok).toBe(false)
  })

  it("tracks clients independently", () => {
    const t0 = 1_000_000
    for (let i = 0; i <= MAX_ATTEMPTS; i++) consumeAttempt("1.1.1.1", t0 + i)
    expect(consumeAttempt("1.1.1.1", t0).ok).toBe(false)
    expect(consumeAttempt("2.2.2.2", t0).ok).toBe(true)
  })

  it("reports the count without recording an attempt", () => {
    const t0 = 1_000_000
    consumeAttempt("1.1.1.1", t0)
    consumeAttempt("1.1.1.1", t0)
    expect(attemptCount("1.1.1.1", t0)).toBe(2)
    expect(attemptCount("1.1.1.1", t0)).toBe(2)
    expect(attemptCount("1.1.1.1", t0 + WINDOW_MS)).toBe(0)
  })
})
