import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Layer 2: the authoritative authorization gate.
 *
 * `proxy.ts` already rejects unauthenticated requests before they reach a
 * handler, so at runtime it is hard to tell which layer produced a given 401.
 * These tests call the gate directly to prove it stands on its own — the
 * property that matters is that deleting or narrowing the proxy would not
 * open the application.
 */

const SECRET = "a".repeat(32)

/** Replaces the `next/headers` cookie reader for one test. */
function stubCookies(value?: string) {
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) => (value === undefined ? undefined : { name, value }),
    }),
  }))
}

/** Signs a token with the given key, under that key. */
async function tokenFor(secret = SECRET): Promise<string> {
  const { signSession } = await import("./session")
  process.env.SESSION_SECRET = secret
  return signSession()
}

/**
 * Flips the first character of a token's signature, guaranteeing a change.
 *
 * Appending a fixed character to the end is not safe: the last character of a
 * base64url signature is heavily constrained (it carries only a couple of
 * significant bits), so it is frequently already the character being appended
 * and the "tampered" token comes out identical to the original.
 */
function tamper(token: string): string {
  const [header, payload, signature] = token.split(".")
  const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`
  return `${header}.${payload}.${flipped}`
}

async function load() {
  vi.resetModules()
  return import("./dal")
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock("next/headers")
    process.env.SESSION_SECRET = SECRET
  })

  it("returns the session for a valid token", async () => {
    stubCookies(await tokenFor())
    const { requireAdmin } = await load()
    const session = await requireAdmin()
    expect(session.role).toBe("admin")
  })

  it("throws 401 when no cookie is present", async () => {
    // The layer-2 backstop. Even with the proxy deleted, an unauthenticated
    // caller reaching a handler is rejected here.
    stubCookies(undefined)
    const { requireAdmin } = await load()
    await expect(requireAdmin()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    })
  })

  it("throws 401 for a tampered token", async () => {
    stubCookies(tamper(await tokenFor()))
    const { requireAdmin } = await load()
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it("throws 401 for a token signed with another key", async () => {
    const token = await tokenFor("b".repeat(32))
    // Restore the server's own key: the point is that a token minted
    // elsewhere is rejected here, not that the env is left changed.
    process.env.SESSION_SECRET = SECRET
    stubCookies(token)
    const { requireAdmin } = await load()
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it("throws 401 rather than opening up when SESSION_SECRET is missing", async () => {
    stubCookies("anything")
    delete process.env.SESSION_SECRET
    const { requireAdmin } = await load()
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })
})

describe("requireAdminPage", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doUnmock("next/headers")
    process.env.SESSION_SECRET = SECRET
  })

  it("returns the session for a valid token", async () => {
    stubCookies(await tokenFor())
    const { requireAdminPage } = await load()
    expect((await requireAdminPage()).role).toBe("admin")
  })

  it("redirects to /login when unauthenticated", async () => {
    const redirect = vi.fn(() => {
      throw new Error("NEXT_REDIRECT")
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    stubCookies(undefined)
    const { requireAdminPage } = await load()
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith("/login")
  })

  it("redirects rather than throwing a 401 for a tampered token", async () => {
    const redirect = vi.fn(() => {
      throw new Error("NEXT_REDIRECT")
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    stubCookies(tamper(await tokenFor()))
    const { requireAdminPage } = await load()
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT")
  })
})
