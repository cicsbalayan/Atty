import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Session signing and verification.
 *
 * The cases that matter are the adversarial ones: anything that would let a
 * caller manufacture or extend a session without the signing key.
 */

const SECRET = "a".repeat(32)
const OTHER_SECRET = "b".repeat(32)

async function load() {
  vi.resetModules()
  process.env.SESSION_SECRET = SECRET
  return import("./session")
}

/** Decodes a compact JWS payload without verifying it. */
function payloadOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
}

function headerOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString())
}

describe("session", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.SESSION_SECRET = SECRET
  })

  it("round-trips a signed session", async () => {
    const { signSession, verifySession } = await load()
    const session = await verifySession(await signSession())
    expect(session?.role).toBe("admin")
    expect(typeof session?.iat).toBe("number")
    expect(typeof session?.exp).toBe("number")
  })

  it("signs with HS256 and pins it in the header", async () => {
    const { signSession } = await load()
    expect(headerOf(await signSession()).alg).toBe("HS256")
  })

  it("never puts the PIN or any PII in the payload", async () => {
    const { signSession } = await load()
    expect(Object.keys(payloadOf(await signSession())).sort()).toEqual([
      "exp",
      "iat",
      "role",
    ])
  })

  it("rejects a token with no signature", async () => {
    const { signSession, verifySession } = await load()
    const [header, payload] = (await signSession()).split(".")
    // The classic `alg: none` downgrade: strip the signature entirely.
    const none = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")
    expect(await verifySession(`${none}.${payload}.`)).toBeNull()
    expect(await verifySession(`${header}.${payload}`)).toBeNull()
  })

  it("rejects a tampered payload", async () => {
    const { signSession, verifySession } = await load()
    const [header, , signature] = (await signSession()).split(".")
    const forged = Buffer.from(
      JSON.stringify({ role: "admin", iat: 0, exp: 9_999_999_999 })
    ).toString("base64url")
    expect(await verifySession(`${header}.${forged}.${signature}`)).toBeNull()
  })

  it("rejects a tampered signature", async () => {
    const { signSession, verifySession } = await load()
    const [header, payload, signature] = (await signSession()).split(".")
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`
    expect(await verifySession(`${header}.${payload}.${flipped}`)).toBeNull()
  })

  it("rejects a token signed with a different key", async () => {
    const { signSession, verifySession } = await load()
    const forged = await signSession()
    process.env.SESSION_SECRET = OTHER_SECRET
    expect(await verifySession(forged)).toBeNull()
  })

  it("rejects an expired token", async () => {
    vi.useFakeTimers()
    try {
      const { signSession, verifySession } = await load()
      const token = await signSession()
      // 12 hours plus a minute.
      vi.advanceTimersByTime(43_260_000)
      expect(await verifySession(token)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("accepts a token just inside the window", async () => {
    vi.useFakeTimers()
    try {
      const { signSession, verifySession } = await load()
      const token = await signSession()
      vi.advanceTimersByTime(43_100_000)
      expect(await verifySession(token)).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns null for absent, empty, and garbage input", async () => {
    const { verifySession } = await load()
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession("")).toBeNull()
    expect(await verifySession("not-a-token")).toBeNull()
    expect(await verifySession("a.b.c")).toBeNull()
  })

  it("fails closed when SESSION_SECRET is missing", async () => {
    const { signSession, verifySession } = await load()
    delete process.env.SESSION_SECRET
    // Must not fall open, and must not throw out of the verifier — a
    // misconfiguration has to look like "not signed in" to callers.
    await expect(signSession()).rejects.toThrow()
    expect(await verifySession("whatever")).toBeNull()
  })

  it("rejects a weak SESSION_SECRET rather than accepting it", async () => {
    const { signSession } = await load()
    process.env.SESSION_SECRET = "too-short"
    await expect(signSession()).rejects.toThrow(/at least 32/)
  })

  it("rejects a well-signed token carrying an unexpected role", async () => {
    await load()
    // Re-sign a `viewer` payload with the real key: a valid signature over
    // an unexpected payload is still an unexpected payload.
    const { SignJWT } = await import("jose")
    const token = await new SignJWT({ role: "viewer" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET))
    const { verifySession } = await load()
    expect(await verifySession(token)).toBeNull()
  })
})
